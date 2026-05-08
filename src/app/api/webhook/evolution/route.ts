// src/app/api/webhook/evolution/route.ts
// ═══════════════════════════════════════════════════════════════════════════
// Evolution API Inbound Webhook — Receives incoming WhatsApp messages
//
// Evolution sends a POST with JSON:
//   { event: 'messages.upsert', data: { key, pushName, message, ... } }
//
// Mirrors the UltraMsg webhook flow: resolve business → fire automation.
// Adds: typing indicator + read receipts for realism.
//
// Also handles outgoing messages (fromMe):
//   - If message contains 📝 or #q → detected as a quote, fires quote_sent
//   - Otherwise → human handoff, pauses AI for that customer for 24h
// ═══════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getLastBusinessId } from '@/lib/ai-receptionist/history';
import { fireEvent } from '@/lib/automations/executor';
import {
  resolveBusinessByInstance,
  sendTypingPresence,
  markAsRead,
} from '@/lib/evolution';
import OpenAI from 'openai';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
  );
}

// ─── POST handler ────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const json = await request.json();

    // Evolution sends different event types — we only care about incoming messages
    const event = json.event;
    if (event !== 'messages.upsert') {
      return NextResponse.json({ ok: true, skipped: true, reason: `event:${event}` });
    }

    const data = json.data;
    if (!data) {
      return NextResponse.json({ ok: true, skipped: true, reason: 'no_data' });
    }

    // ── CEO Assistant Instance ─────────────────────────────────────
    // The Launchfly CEO number is a special-purpose instance that is NOT
    // in the whatsapp_instances table.  It only serves as the AI CEO
    // assistant channel — never for outreach.
    const CEO_INSTANCE = process.env.LAUNCHFLY_INSTANCE_NAME;
    const rawInstanceName = json.instance || json.instanceName || '';
    const isCeoInstance = !!(CEO_INSTANCE && rawInstanceName === CEO_INSTANCE);

    // ── Handle outgoing messages (fromMe) ──────────────────────────
    if (data.key?.fromMe) {
      // Skip outgoing messages on the CEO instance entirely — they are
      // either bot echoes or CEO assistant replies, never business outgoing.
      if (isCeoInstance) {
        return NextResponse.json({ ok: true, skipped: true, reason: 'ceo_outgoing' });
      }

      const instanceName = rawInstanceName;
      const remoteJid = data.key?.remoteJid || '';
      if (remoteJid.includes('@g.us')) {
        return NextResponse.json({ ok: true, skipped: true, reason: 'outgoing_group' });
      }

      const outText =
        data.message?.conversation ||
        data.message?.extendedTextMessage?.text ||
        '';
      const customerPhone = remoteJid.replace('@s.whatsapp.net', '').replace('@c.us', '');
      if (!outText.trim() || !customerPhone) {
        return NextResponse.json({ ok: true, skipped: true, reason: 'outgoing_no_text' });
      }

      // Resolve which business this instance belongs to
      let bizId: string | null = null;
      if (instanceName) bizId = await resolveBusinessByInstance(instanceName);
      if (!bizId) {
        return NextResponse.json({ ok: true, skipped: true, reason: 'outgoing_no_business' });
      }

      const supabase = getSupabase();

      // ── Bot echo filter: skip messages sent by our own API ──
      const msgId = data.key?.id;
      if (msgId) {
        const { data: botMsg } = await supabase
          .from('_bot_message_ids')
          .delete()
          .eq('message_id', msgId)
          .select('message_id')
          .maybeSingle();
        if (botMsg) {
          return NextResponse.json({ ok: true, skipped: true, reason: 'bot_echo' });
        }
      }

      // ── Agent tool update / report echo filter ──────────────
      // If a message looks like an agent-generated tool status update, report,
      // integration request, or approval request, skip it to prevent feedback
      // loops between WhatsApp instances.
      // Matches: _🔍 search_web..._  |  _🔍 search_web: query text_  |  🤖 *Agent Report  |  🔌 *New Integration  |  🔔 *Approval Required
      const AGENT_ECHO_PATTERN = /^_[^\n]{1,120}_$|^🤖 \*Agent Report|^🔌 \*New Integration|^🔔 \*Approval Required|^💡 \*Strategic Insight/;
      if (AGENT_ECHO_PATTERN.test(outText.trim())) {
        return NextResponse.json({ ok: true, skipped: true, reason: 'agent_echo' });
      }

      // Look up the DB instance ID for routing follow-ups to the correct instance
      let waInstanceId: string | undefined;
      if (instanceName) {
        const { data: inst } = await supabase
          .from('whatsapp_instances')
          .select('id')
          .eq('instance_name', instanceName)
          .eq('active', true)
          .limit(1)
          .maybeSingle();
        waInstanceId = inst?.id;
      }

      const QUOTE_TAG = /📝|#q\b/i;
      const isQuote = QUOTE_TAG.test(outText);

      // Phone normalization for DB queries
      const phoneWithPlus = customerPhone.startsWith('+') ? customerPhone : `+${customerPhone}`;
      const phoneWithoutPlus = customerPhone.replace(/^\+/, '');

      // ── Ensure customer record exists so handoff/disable always works ──
      await supabase.from('customers').upsert(
        {
          business_id: bizId,
          phone: phoneWithPlus,
          name: 'Unknown',
          email: `${phoneWithoutPlus}@wa.placeholder`,
          status: 'lead',
          source: 'whatsapp_outbound',
        },
        { onConflict: 'business_id,phone', ignoreDuplicates: true },
      );

      // ── Per-contact bot control: #off / #on ──
      const OFF_TAG = /\b#off\b/i;
      const ON_TAG = /\b#on\b/i;

      if (OFF_TAG.test(outText)) {
        // Permanently disable bot for this contact
        await supabase
          .from('customers')
          .update({ ai_paused_until: '2099-12-31T23:59:59Z' })
          .eq('business_id', bizId)
          .or(`phone.eq.${phoneWithPlus},phone.eq.${phoneWithoutPlus}`);
        console.log(`\n🚫 Bot disabled for +${customerPhone} (business ${bizId}) via #off`);
        return NextResponse.json({ ok: true, bot_disabled: true });
      }

      if (ON_TAG.test(outText)) {
        // Re-enable bot for this contact
        await supabase
          .from('customers')
          .update({ ai_paused_until: null })
          .eq('business_id', bizId)
          .or(`phone.eq.${phoneWithPlus},phone.eq.${phoneWithoutPlus}`);
        console.log(`\n✅ Bot re-enabled for +${customerPhone} (business ${bizId}) via #on`);
        return NextResponse.json({ ok: true, bot_enabled: true });
      }

      if (isQuote) {
        // ── Quote Detection: contractor tagged this message as a quote ──
        console.log(`\n📝 Quote detected from contractor (business ${bizId}) to +${customerPhone}`);
        const cleanText = outText.replace(/📝/g, '').replace(/#q\b/gi, '').trim();

        // Extract quote details via fast LLM
        let quoteAmount: number | undefined;
        let jobType: string | undefined;
        try {
          const deepseek = new OpenAI({ apiKey: process.env.DEEPSEEK_API_KEY, baseURL: 'https://api.deepseek.com' });
          const extraction = await deepseek.chat.completions.create({
            model: 'deepseek-chat',
            temperature: 0,
            max_tokens: 150,
            messages: [{
              role: 'user',
              content: `Extract from this contractor quote message:\n- quote_amount (number only, no currency symbol)\n- job_type (short description)\n\nMessage: "${cleanText}"\n\nReturn JSON only: {"quote_amount": number|null, "job_type": string|null}`,
            }],
          });
          const parsed = JSON.parse(extraction.choices[0]?.message?.content || '{}');
          quoteAmount = parsed.quote_amount ?? undefined;
          jobType = parsed.job_type ?? undefined;
        } catch (e) {
          console.warn('   ⚠️ Quote extraction failed (non-fatal):', e);
        }

        // Fire quote_sent event → triggers assistant's quote follow-up sequence
        const result = await fireEvent({
          businessId: bizId,
          event: 'quote_sent',
          phone: customerPhone,
          amount: quoteAmount,
          metadata: {
            quoteAmount,
            jobType,
            source: 'whatsapp_tag',
            rawMessage: cleanText.substring(0, 500),
            ...(waInstanceId && { wa_instance_id: waInstanceId }),
          },
        });

        console.log(`   ✅ Quote event fired: ${result.fired} rule(s)`);
        return NextResponse.json({ ok: true, quote_detected: true, fired: result.fired });
      } else {
        // ── Human Handoff: contractor manually replied → pause AI for this customer ──
        const pauseUntil = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

        await supabase
          .from('customers')
          .update({ ai_paused_until: pauseUntil })
          .eq('business_id', bizId)
          .or(`phone.eq.${phoneWithPlus},phone.eq.${phoneWithoutPlus}`);

        console.log(`\n🤝 Human handoff: contractor (${bizId}) replied to +${customerPhone} — AI paused until ${pauseUntil}`);

        return NextResponse.json({ ok: true, human_handoff: true, paused_until: pauseUntil });
      }
    }

    // Extract fields
    const remoteJid = data.key?.remoteJid || '';
    const messageId = data.key?.id || '';
    const pushname = data.pushName || '';
    const instanceName = rawInstanceName;

    // Skip group messages
    if (remoteJid.includes('@g.us')) {
      return NextResponse.json({ ok: true, skipped: true, reason: 'group' });
    }

    // Extract message text from different message types
    let messageText =
      data.message?.conversation ||
      data.message?.extendedTextMessage?.text ||
      '';

    // Handle documents and images without text
    if (!messageText) {
      const docMsg = data.message?.documentMessage || data.message?.documentWithCaptionMessage?.message?.documentMessage;
      const imgMsg = data.message?.imageMessage || data.message?.imageWithCaptionMessage?.message?.imageMessage;

      if (docMsg) {
        const fileName = docMsg.fileName || docMsg.title || 'a document';
        const mimetype = docMsg.mimetype;
        
        let extractedText: string | null = null;
        let docUrl: string | null = null;

        try {
          const instCreds = await resolveInstanceCreds(instanceName);
          if (instCreds) {
            // Try inline text extraction for PDFs
            if (mimetype === 'application/pdf') {
              console.log(`   📄 PDF detected from ${remoteJid}, extracting text...`);
              try {
                const { extractTextFromDocument } = await import('@/lib/extract-document');
                const text = await extractTextFromDocument({
                  baseUrl: instCreds.baseUrl,
                  apiKey: instCreds.apiKey,
                  instanceName: instCreds.instanceName,
                  message: data.message,
                  messageKey: data.key,
                  mimetype,
                  fileName,
                });
                if (text && text.trim().length > 0) {
                  extractedText = text;
                  console.log(`   📝 Extracted ${text.length} chars from PDF: "${text.substring(0, 100).replace(/\n/g, ' ')}..."`);
                }
              } catch (err) {
                console.warn('   ⚠️ PDF extraction failed:', err);
              }
            }

            // If text extraction failed/skipped, download and store for agent access
            if (!extractedText) {
              const { downloadAndStoreMedia } = await import('@/lib/vision-inventory');
              docUrl = await downloadAndStoreMedia({
                baseUrl: instCreds.baseUrl,
                apiKey: instCreds.apiKey,
                instanceName: instCreds.instanceName,
                message: data.message,
                messageKey: data.key,
                fileName,
                mimetype,
              });
              if (docUrl) console.log(`   📎 Document stored: ${docUrl}`);
            }
          }
        } catch (err) {
          console.warn('   ⚠️ Document processing failed:', err);
        }

        if (extractedText) {
          messageText = `[Document received: ${fileName}]\n\n--- DOCUMENT CONTENTS ---\n${extractedText}\n--- END DOCUMENT CONTENTS ---`;
        } else if (docUrl) {
          messageText = `[Document received: ${fileName}]\n[DOCUMENT URL: ${docUrl}]\nUse process_document tool to extract and read the contents of this file.`;
        } else {
          messageText = `[Document received: ${fileName} - could not be downloaded]`;
        }
      } else if (imgMsg) {
        // Download and store image for agent access
        let imgUrl: string | null = null;
        try {
          const instCreds = await resolveInstanceCreds(instanceName);
          if (instCreds) {
            const { downloadAndStoreMedia } = await import('@/lib/vision-inventory');
            imgUrl = await downloadAndStoreMedia({
              baseUrl: instCreds.baseUrl,
              apiKey: instCreds.apiKey,
              instanceName: instCreds.instanceName,
              message: data.message,
              messageKey: data.key,
              mimetype: imgMsg.mimetype,
            });
            if (imgUrl) console.log(`   📸 Image stored: ${imgUrl}`);
          }
        } catch (err) {
          console.warn('   ⚠️ Image download failed:', err);
        }

        if (imgUrl) {
          messageText = `[Image received]\n[ATTACHED IMAGE: ${imgUrl}]`;
        } else {
          messageText = `[Image received - could not be downloaded]`;
        }
      }
    }

    // ─── Voice Note Transcription ───────────────────────────────────
    const isAudioMessage = !!(data.message?.audioMessage);
    if (isAudioMessage && !messageText) {
      console.log(`   🎤 Voice note detected from ${remoteJid}, transcribing...`);
      try {
        // Resolve instance credentials for media download
        const instCreds = await resolveInstanceCreds(instanceName);
        if (instCreds) {
          const { transcribeVoiceNote } = await import('@/lib/transcribe-audio');
          const transcribed = await transcribeVoiceNote({
            baseUrl: instCreds.baseUrl,
            apiKey: instCreds.apiKey,
            instanceName: instCreds.instanceName,
            message: data.message,
            messageKey: data.key,
          });
          if (transcribed) {
            messageText = transcribed;
            console.log(`   📝 Transcribed: "${messageText.substring(0, 100)}"`);
          }
        }
      } catch (err) {
        console.warn('   ⚠️ Voice transcription failed:', err);
      }
    }

    const customerPhone = remoteJid.replace('@s.whatsapp.net', '').replace('@c.us', '');

    // Allow image-only and voice-only messages through
    const hasImage = !!(data.message?.imageMessage || data.message?.imageWithCaptionMessage);
    const hasDocument = !!(data.message?.documentMessage || data.message?.documentWithCaptionMessage);
    const hasAudio = !!(data.message?.audioMessage);
    if ((!messageText.trim() && !hasImage && !hasDocument && !hasAudio) || !customerPhone) {
      return NextResponse.json({ ok: true, skipped: true });
    }

    // If voice note transcription failed, set a placeholder so the agent still sees it
    if (hasAudio && !messageText.trim()) {
      messageText = '[Voice note received but could not be transcribed]';
    }

    console.log(`\n🟢 Evolution Incoming: +${customerPhone}`);
    console.log(`   Message: ${messageText.substring(0, 100)}`);
    if (pushname) console.log(`   Name: ${pushname}`);
    if (hasAudio) console.log(`   🎤 Audio message (transcribed: ${messageText !== '[Voice note received but could not be transcribed]'})`);

    const supabase = getSupabase();

    // ── Bot echo / Agent loop filter (Global Incoming) ────────────
    // 1. Database check: Did our system send this message?
    const msgId = data.key?.id;
    if (msgId) {
      const { data: botMsg } = await supabase
        .from('_bot_message_ids')
        .delete()
        .eq('message_id', msgId)
        .select('message_id')
        .maybeSingle();
      if (botMsg) {
        console.log(`   🔇 Filtered bot echo by message ID: ${msgId}`);
        return NextResponse.json({ ok: true, skipped: true, reason: 'bot_echo_global' });
      }
    }

    // 2. Pattern check: Does it look exactly like an agent status or report?
    // This catches messages that somehow bypassed the DB check (e.g. sent manually via DB/UI or latency)
    const AGENT_ECHO_RE = /^_[^\n]{1,200}_$|^🤖 \*Agent Report|^🔌 \*New Integration|^🔔 \*Approval Required/;
    if (AGENT_ECHO_RE.test(messageText.trim())) {
      console.log(`   🔁 Skipping agent echo pattern: "${messageText.substring(0, 60)}"`);
      return NextResponse.json({ ok: true, skipped: true, reason: 'agent_echo_global' });
    }

    // ─── CEO Assistant Instance — special routing ───────────────────
    // Messages arriving on the CEO number are ALWAYS from a business owner.
    // Resolve business by matching the sender's phone to a business owner,
    // then jump straight to the owner/Chief-of-Staff path.
    if (isCeoInstance) {
      console.log(`   🎯 CEO instance — resolving owner by phone`);
      const senderNorm = customerPhone.replace(/^\+/, '');
      const senderPlus = `+${senderNorm}`;

      // Match sender to a business by OWNER phone fields only.
      // Deliberately exclude whatsapp_number — that's the bot's own number,
      // not the owner. Matching on it would let self-chat echoes resolve.
      const { data: ownerBiz } = await supabase
        .from('businesses')
        .select('id, whatsapp_number')
        .or(
          `whatsapp_notify_number.eq.${senderPlus},whatsapp_notify_number.eq.${senderNorm},` +
          `phone_number.eq.${senderPlus},phone_number.eq.${senderNorm}`
        )
        .limit(1)
        .maybeSingle();

      if (!ownerBiz?.id) {
        console.log(`   ⚠️ CEO instance: sender +${customerPhone} is not a known business owner`);
        return NextResponse.json({ ok: true, skipped: true, reason: 'ceo_unknown_sender' });
      }

      // Guard: if sender's phone IS the business bot's WhatsApp number, this
      // is a self-chat echo (bot → bot). Never create a task for it.
      const bizWhatsApp = (ownerBiz.whatsapp_number || '').replace(/^\+/, '');
      if (bizWhatsApp && senderNorm === bizWhatsApp) {
        console.log(`   🔇 CEO instance: self-chat echo from bot number +${senderNorm}`);
        return NextResponse.json({ ok: true, skipped: true, reason: 'ceo_self_chat' });
      }

      const businessId = ownerBiz.id;
      console.log(`   🏢 CEO instance → business ${businessId}`);

      // ── Check for pending approval gates ──────────────────────────
      // If an agent is waiting for owner approval, this reply resumes it
      {
        const { data: pendingApproval } = await supabase
          .from('agent_pending_approvals')
          .select('id, task_id, question')
          .eq('business_id', businessId)
          .is('response', null)
          .gt('expires_at', new Date().toISOString())
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (pendingApproval && messageText.trim()) {
          console.log(`   ✅ Approval response for task ${pendingApproval.task_id}: "${messageText.substring(0, 50)}"`);

          // Record the response
          await supabase.from('agent_pending_approvals').update({
            response: messageText,
            responded_at: new Date().toISOString(),
          }).eq('id', pendingApproval.id);

          // Resume the paused agent task
          const { resumeTaskFromApproval } = await import('@/lib/agent/runner');
          const resumed = await resumeTaskFromApproval(pendingApproval.task_id, messageText);

          return NextResponse.json({ ok: true, routed: 'approval_response', resumed, taskId: pendingApproval.task_id });
        }
      }

      // Integration API key handling is delegated to the agent — it uses
      // request_integration(api_key=...) to activate services with full context.

      // ── Handle owner image messages ────
      let ownerImageUrl: string | null = null;
      const ownerImgMsg = data.message?.imageMessage || data.message?.imageWithCaptionMessage?.message?.imageMessage;
      if (ownerImgMsg) {
        console.log(`   📸 Owner sent an image, downloading...`);
        try {
          const instCreds = await resolveInstanceCreds(instanceName);
          if (instCreds) {
            const { downloadAndStoreImage } = await import('@/lib/vision-inventory');
            ownerImageUrl = await downloadAndStoreImage({
              baseUrl: instCreds.baseUrl,
              apiKey: instCreds.apiKey,
              instanceName: instCreds.instanceName,
              message: data.message,
              messageKey: data.key,
              businessId,
            });
            if (ownerImageUrl) console.log(`   📸 Owner image stored: ${ownerImageUrl}`);
          }
        } catch (err) {
          console.warn('   ⚠️ Owner image download failed:', err);
        }
      }

      // Capture caption text
      if (!messageText && ownerImgMsg) {
        messageText = data.message?.imageMessage?.caption
          || data.message?.imageWithCaptionMessage?.message?.imageMessage?.caption
          || '';
      }

      // Fetch the default orchestrator agent (The Researcher handles owner requests
      // and delegates to specialized agents as needed)
      const { data: orchestrator } = await supabase
        .from('assistants')
        .select('name, system_prompt, tools_enabled')
        .eq('business_id', businessId)
        .eq('name', 'The Researcher')
        .maybeSingle();

      let goalStr = messageText.substring(0, 1000);
      let rolePrompt: string;
      let enabledTools: string[] | null = null;

      // ── Save message to history so the agent has context ──
      const { saveMessage } = await import('@/lib/ai-receptionist/history');
      await saveMessage(customerPhone, 'user', messageText, businessId).catch(e => console.warn('Failed to save owner message to history:', e));

      const trimmed = messageText.trim().toLowerCase().replace(/[^a-z\s]/g, '');

      // ── "Panic" detection: global kill switch for runaways ──
      const isEmergencyStop = /^(emergency stop|panic|kill all|stop everything|shut down everything)$/.test(trimmed);
      if (isEmergencyStop) {
        const { emergencyStopAllTasks } = await import('@/lib/agent/runner');
        const count = await emergencyStopAllTasks();
        const { sendWhatsAppWithCreds } = await import('@/lib/evolution');
        const creds = {
          baseUrl: process.env.EVOLUTION_BASE_URL!,
          apiKey: process.env.EVOLUTION_API_KEY!,
          instanceName: process.env.LAUNCHFLY_INSTANCE_NAME!,
        };
        if (creds.baseUrl && creds.apiKey && creds.instanceName) {
          await sendWhatsAppWithCreds(
            customerPhone,
            `☢️ *EMERGENCY STOP EXECUTED*\n\nPurged ${count} active agent tasks globally. All agent operations are now halted.`,
            creds
          ).catch(() => {});
        }
        return NextResponse.json({ ok: true, routed: 'emergency_stop', count });
      }

      // ── "Stop" detection: cancel any running/pending agent tasks ──
      const isStopRequest = /^(stop|cancel|abort|halt|enough|stop it|stop that|cancel that|nevermind|never mind|nvm|quit|shut up)$/.test(trimmed);
      if (isStopRequest) {
        const { cancelRunningTasks } = await import('@/lib/agent/runner');
        const cancelled = await cancelRunningTasks(businessId, 'Cancelled by owner');
        console.log(`   🛑 Stop: cancelled ${cancelled} task(s) for business ${businessId}`);
        // Send confirmation via Launchfly instance
        const { sendWhatsAppWithCreds } = await import('@/lib/evolution');
        const creds = {
          baseUrl: process.env.EVOLUTION_BASE_URL!,
          apiKey: process.env.EVOLUTION_API_KEY!,
          instanceName: process.env.LAUNCHFLY_INSTANCE_NAME!,
        };
        if (creds.baseUrl && creds.apiKey && creds.instanceName) {
          await sendWhatsAppWithCreds(
            customerPhone,
            cancelled > 0 ? `🛑 Stopped ${cancelled} running task${cancelled > 1 ? 's' : ''}. What would you like me to do instead?` : `No tasks were running. What can I help with?`,
            creds,
          ).catch(() => {});
        }
        return NextResponse.json({ ok: true, routed: 'stop_tasks', cancelled });
      }

      // ── "Continue" detection: resume the last task instead of creating a new one ──
      const isContinueRequest = /^(continue|keep going|go on|finish it|carry on|resume|next|dont stop|continue the task|continue last task|continue that)$/.test(trimmed);
      if (isContinueRequest) {
        // Look for the most recent task that was completed or is still running/pending
        const { data: lastTask } = await supabase
          .from('agent_tasks')
          .select('id, status, goal, steps_used, updated_at')
          .eq('business_id', businessId)
          .in('status', ['completed', 'pending', 'running'])
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (lastTask) {
          if (lastTask.status === 'pending' || lastTask.status === 'running') {
            // Task is still in-flight, let it finish
            console.log(`   ⏳ Continue: task ${lastTask.id} is already ${lastTask.status}, no action needed`);
            return NextResponse.json({ ok: true, routed: 'continue_existing', taskId: lastTask.id });
          }
          // Task completed — re-open it as a continuation
          console.log(`   🔄 Continue: resuming completed task ${lastTask.id} (${lastTask.steps_used} steps used)`);
          const { resumeCompletedTask } = await import('@/lib/agent/runner');
          const resumed = await resumeCompletedTask(lastTask.id, messageText);
          if (resumed) {
            return NextResponse.json({ ok: true, routed: 'continue_last_task', taskId: lastTask.id });
          }
          // Fall through to create a new task if resume failed
          console.warn(`   ⚠️ Continue: resume failed for task ${lastTask.id}, creating new task`);
        }
      }

      if (orchestrator) {
        if (ownerImageUrl) {
          goalStr += `\n\n[ATTACHED IMAGE: ${ownerImageUrl}]\nThe owner attached an image. Use analyze_image tool to describe what you see. If the owner explicitly mentions inventory, shelf, stall, or stock, use analyze_inventory instead to compare against the golden state. If the owner says to save it as a reference, use set_golden action.`;
        }
        rolePrompt = orchestrator.system_prompt;
        enabledTools = null; // All tools — orchestrator's system_prompt guides which to use
      } else {
        if (ownerImageUrl) {
          goalStr += `\n\n[ATTACHED IMAGE: ${ownerImageUrl}]\nThe owner sent an image. Use analyze_image tool to describe it. If the message mentions inventory or stock, use analyze_inventory instead.`;
        }
        rolePrompt = `You are an autonomous AI agent for this business. You handle the owner's requests directly: research, operations, marketing, and customer management. Use the tools available to accomplish the goal. Delegate to specialized agents when needed (query the assistants table to see available agents). Always send_report back to the owner when done. Be concise and action-oriented.`;
        enabledTools = null;
      }

      // ── Dedup guard: skip if an agent task is already running recently ──
      // Prevents cascading tasks when multiple messages arrive in quick
      // succession (e.g. agent echoes that slip past filters, or rapid taps).
      const DEDUP_WINDOW_SECS = 120;
      const recentCutoff = new Date(Date.now() - DEDUP_WINDOW_SECS * 1000).toISOString();
      const { data: recentTask } = await supabase
        .from('agent_tasks')
        .select('id, status, created_at')
        .eq('business_id', businessId)
        .in('status', ['pending', 'running'])
        .gte('created_at', recentCutoff)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (recentTask) {
        // ── Mid-task steering: append the owner's correction/clarification to the running task ──
        // Instead of dropping the message, inject it so the agent picks it up on next loop iteration.
        console.log(`   🔄 Steering: appending owner message to running task ${recentTask.id}`);
        try {
          const { data: taskRow } = await supabase
            .from('agent_tasks')
            .select('messages')
            .eq('id', recentTask.id)
            .single();

          const msgs = Array.isArray(taskRow?.messages) ? taskRow.messages : [];
          msgs.push({
            role: 'user',
            content: `[OWNER CORRECTION — sent while you were working]: ${messageText}`,
          });

          await supabase.from('agent_tasks')
            .update({ messages: msgs, updated_at: new Date().toISOString() })
            .eq('id', recentTask.id);
        } catch (steerErr) {
          console.error(`   ⚠️ Failed to steer task ${recentTask.id}:`, steerErr);
        }
        return NextResponse.json({ ok: true, steered: true, reason: 'mid_task_correction', existingTaskId: recentTask.id });
      }

      const dispatched = await dispatchAgentViaQStash({
        businessId,
        goal: goalStr,
        role: rolePrompt,
        enabledTools,
        ownerPhone: customerPhone,
      });
      return NextResponse.json({ ok: true, routed: 'ceo_owner_agent', dispatched, orchestrator: !!orchestrator });
    }

    // ─── Resolve Business ID (non-CEO instances) ────────────────────
    let businessId: string | null =
      request.nextUrl.searchParams.get('businessId') || null;

    if (!businessId && instanceName) {
      businessId = await resolveBusinessByInstance(instanceName);
    }

    if (!businessId) {
      businessId = resolveBusinessIdFromMessage(messageText);
    }

    if (!businessId) {
      businessId = await getLastBusinessId(customerPhone);
    }

    if (!businessId) {
      const phoneWithPlus = customerPhone.startsWith('+') ? customerPhone : `+${customerPhone}`;
      const phoneWithoutPlus = customerPhone.replace(/^\+/, '');
      const { data: existingCustomer } = await supabase
        .from('customers')
        .select('business_id')
        .or(`phone.eq.${phoneWithPlus},phone.eq.${phoneWithoutPlus}`)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (existingCustomer?.business_id) {
        businessId = existingCustomer.business_id;
      }
    }

    if (!businessId) {
      console.log('   ⚠️ Evolution: No business found — sending fallback');
      const { sendWhatsApp } = await import('@/lib/evolution');
      await sendWhatsApp(
        customerPhone,
        "Hi! 👋 I couldn't identify which business you're trying to reach. Could you let me know the business name?",
      );
      return NextResponse.json({ ok: true, fallback: true });
    }

    console.log(`   🏢 Business: ${businessId}`);

    // ─── Ensure customer record exists (upsert on business_id+phone) ──
    const phoneWithPlus = customerPhone.startsWith('+') ? customerPhone : `+${customerPhone}`;
    const phoneWithoutPlus = customerPhone.replace(/^\+/, '');
    await supabase.from('customers').upsert(
      {
        business_id: businessId,
        phone: phoneWithPlus,
        name: pushname || 'Unknown',
        email: `${phoneWithoutPlus}@wa.placeholder`,
        status: 'lead',
        source: 'whatsapp_inbound',
      },
      { onConflict: 'business_id,phone', ignoreDuplicates: true },
    );

    // ─── OPT-OUT CHECK ──────────────────────────────────────────────
    const isOptOut = /^(stop|unsubscribe|cancel|quit|end|no\s*more|opt\s*out)$/i.test(messageText.trim());
    if (isOptOut) {
      console.log(`   🛑 User ${customerPhone} opted out via WhatsApp.`);

      const { sendWhatsApp } = await import('@/lib/evolution');
      await sendWhatsApp(customerPhone, "You've been successfully unsubscribed and won't receive more automated messages from us.", businessId);

      await supabase
        .from('customers')
        .update({ accepts_marketing: false })
        .eq('business_id', businessId)
        .or(`phone.eq.${phoneWithPlus},phone.eq.${phoneWithoutPlus}`);

      return NextResponse.json({ ok: true, opted_out: true });
    }

    // ─── AUTO-REPLY DETECTOR ────────────────────────────────────────
    const autoReplyRegex = /thank you for contacting|thanks for contacting|automated message|auto-?reply|out of (the )?office|currently closed|will get back to you|we are away|not in the office/i;
    if (autoReplyRegex.test(messageText)) {
      console.log(`   🤖 Detected Auto-Reply from +${customerPhone}. Ignoring to prevent AI loop.`);
      return NextResponse.json({ ok: true, skipped: true, reason: 'auto_reply' });
    }

    // ─── DEDUPLICATION CHECK ────────────────────────────────────────
    const duplicateWindowMs = 30 * 1000;
    const { data: recentDups } = await supabase
      .from('chat_history')
      .select('id')
      .eq('phone', customerPhone.replace(/^\+/, ''))
      .eq('role', 'user')
      .eq('content', messageText)
      .gte('created_at', new Date(Date.now() - duplicateWindowMs).toISOString())
      .limit(1);

    if (recentDups && recentDups.length > 0) {
      console.log(`   🔄 Detected duplicate webhook for ${customerPhone}. Skipping.`);
      return NextResponse.json({ ok: true, skipped: true, reason: 'duplicate_retry' });
    }

    // ─── HUMAN HANDOFF CHECK ────────────────────────────────────────
    // If the contractor recently replied to this customer, skip AI response
    {

      const { data: cust } = await supabase
        .from('customers')
        .select('ai_paused_until')
        .eq('business_id', businessId)
        .or(`phone.eq.${phoneWithPlus},phone.eq.${phoneWithoutPlus}`)
        .maybeSingle();

      if (cust?.ai_paused_until && new Date(cust.ai_paused_until) > new Date()) {
        console.log(`   🤝 AI paused for +${customerPhone} until ${cust.ai_paused_until} (human handoff). Skipping.`);
        return NextResponse.json({ ok: true, skipped: true, reason: 'human_handoff' });
      }
    }

    // ─── Resolve instance ID for correct follow-up routing ────────
    let waInstanceId: string | undefined;
    if (instanceName) {
      const { data: inst } = await supabase
        .from('whatsapp_instances')
        .select('id')
        .eq('instance_name', instanceName)
        .eq('active', true)
        .limit(1)
        .maybeSingle();
      waInstanceId = inst?.id;
    }

    // ─── PURCHASING OS ROUTING ──────────────────────────────────────
    // Owner → Purchasing OS agent | Supplier → quote-processing agent | Customer → receptionist
    {
      const { data: biz } = await supabase
        .from('businesses')
        .select('whatsapp_notify_number, whatsapp_number, phone_number')
        .eq('id', businessId)
        .single();

      const ownerPhones = [
        biz?.whatsapp_notify_number,
        biz?.whatsapp_number,
        biz?.phone_number,
      ]
        .filter(Boolean)
        .map((p: string) => p.replace(/[\s\-()]/g, '').replace(/^\+/, ''));

      const senderNorm = customerPhone.replace(/^\+/, '');
      const isOwner = ownerPhones.includes(senderNorm);

      if (isOwner) {
        console.log(`   👑 Owner message from +${customerPhone} → Orchestrator`);

        // Save owner message to chat_history for conversation continuity
        const { saveMessage } = await import('@/lib/ai-receptionist/history');
        await saveMessage(customerPhone, 'user', messageText, businessId).catch(e => console.warn('Failed to save owner message to history:', e));

        // Integration API key handling is delegated to the agent — it uses
        // request_integration(api_key=...) to activate services with full context.

        // ─── Handle owner image messages (inventory photos, etc.) ────
        let ownerImageUrl: string | null = null;
        const ownerImgMsg = data.message?.imageMessage || data.message?.imageWithCaptionMessage?.message?.imageMessage;
        if (ownerImgMsg) {
          console.log(`   📸 Owner sent an image, downloading...`);
          try {
            const instCreds = await resolveInstanceCreds(instanceName);
            if (instCreds) {
              const { downloadAndStoreImage } = await import('@/lib/vision-inventory');
              ownerImageUrl = await downloadAndStoreImage({
                baseUrl: instCreds.baseUrl,
                apiKey: instCreds.apiKey,
                instanceName: instCreds.instanceName,
                message: data.message,
                messageKey: data.key,
                businessId,
              });
              if (ownerImageUrl) {
                console.log(`   📸 Owner image stored: ${ownerImageUrl}`);
              }
            }
          } catch (err) {
            console.warn('   ⚠️ Owner image download failed:', err);
          }
        }

        // Also capture caption text from image messages
        if (!messageText && ownerImgMsg) {
          messageText = data.message?.imageMessage?.caption
            || data.message?.imageWithCaptionMessage?.message?.imageMessage?.caption
            || '';
        }
        
        // Try to fetch "The Researcher" as the default orchestrator
        const { data: orchestrator } = await supabase
          .from('assistants')
          .select('name, system_prompt, tools_enabled')
          .eq('business_id', businessId)
          .eq('name', 'The Researcher')
          .maybeSingle();

        let goalStr = '';
        let rolePrompt = '';
        let enabledTools: string[] | null = null;

        if (orchestrator) {
          // Pass the raw message — the system_prompt already contains all orchestration instructions
          goalStr = messageText.substring(0, 1000);
          if (ownerImageUrl) {
            goalStr += `\n\n[ATTACHED IMAGE: ${ownerImageUrl}]\nThe owner attached an image. Use analyze_image tool to describe what you see. If the owner explicitly mentions inventory, shelf, stall, or stock, use analyze_inventory instead to compare against the golden state. If the owner says to save it as a reference, use set_golden action.`;
          }
          rolePrompt = orchestrator.system_prompt;
          enabledTools = null; // All tools — orchestrator's system_prompt guides which to use
        } else {
          // Fallback to the Purchasing OS explicitly as before
          goalStr = messageText.substring(0, 1000);
          if (ownerImageUrl) {
            goalStr += `\n\n[ATTACHED IMAGE: ${ownerImageUrl}]\nThe owner sent an image. Use analyze_image tool to describe it. If the message mentions inventory or stock, use analyze_inventory instead.`;
          }
          rolePrompt = `You are an autonomous AI agent for this business. You handle the owner's requests directly: research, operations, marketing, and customer management. Use the tools available to accomplish the goal. Delegate to specialized agents when needed (query the assistants table to see available agents). Always send_report back to the owner when done. Be concise and action-oriented.`;
          enabledTools = null;
        }

        const dispatched = await dispatchAgentViaQStash({
          businessId,
          goal: goalStr,
          role: rolePrompt,
          enabledTools,
          ownerPhone: customerPhone,
        });
        return NextResponse.json({ ok: true, routed: 'owner_agent', dispatched, orchestrator: !!orchestrator });
      }

      // ─── Supplier routing removed ───
      // We now let all non-owner messages flow through to fireEvent('inbound_whatsapp').
      // This allows the single Receptionist/Agent Prompt to identify the contact type natively.
    }

    // ─── Fire automation event (customer & supplier → receptionist/agent) ────────────
    const result = await fireEvent({
      businessId,
      event: 'inbound_whatsapp',
      phone: customerPhone,
      message: messageText,
      metadata: {
        channel: 'whatsapp',
        pushname,
        source: 'evolution',
        messageId,
        ...(waInstanceId && { wa_instance_id: waInstanceId }),
      },
    });

    console.log(
      `   ✅ Evolution done in ${Date.now() - startTime}ms — ${result.fired} rule(s), ${result.results.length} action(s)`,
    );

    return NextResponse.json({ ok: true, fired: result.fired });
  } catch (error) {
    console.error('❌ Evolution Webhook Error:', error);
    return NextResponse.json({ ok: false, error: 'Internal error' }, { status: 500 });
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────

/** Dispatch an agent task via QStash (DB-driven: creates task row, QStash carries only taskId) */
async function dispatchAgentViaQStash(payload: {
  businessId: string;
  goal: string;
  role: string;
  enabledTools: string[] | null;
  ownerPhone?: string;
}): Promise<boolean> {
  try {
    const { createAgentTask } = await import('@/lib/agent/runner');
    const { dispatched } = await createAgentTask({
      businessId: payload.businessId,
      goal: payload.goal,
      role: payload.role,
      ownerPhone: payload.ownerPhone,
      enabledTools: payload.enabledTools,
    });
    return dispatched;
  } catch (err) {
    console.error('   ❌ Agent dispatch failed:', err);
    return false;
  }
}

/** Resolve Evolution API credentials for a given instance name */
async function resolveInstanceCreds(instName: string): Promise<{ baseUrl: string; apiKey: string; instanceName: string } | null> {
  if (!instName) return null;
  try {
    const supabase = getSupabase();
    const { data } = await supabase
      .from('whatsapp_instances')
      .select('base_url, api_key, instance_name')
      .eq('instance_name', instName)
      .eq('provider', 'evolution')
      .eq('active', true)
      .limit(1)
      .maybeSingle();
    if (data?.base_url && data?.api_key) {
      return { baseUrl: data.base_url, apiKey: data.api_key, instanceName: data.instance_name };
    }
  } catch { /* fall through */ }
  // Fallback to env vars
  const baseUrl = process.env.EVOLUTION_BASE_URL;
  const apiKey = process.env.EVOLUTION_API_KEY;
  if (baseUrl && apiKey) return { baseUrl, apiKey, instanceName: instName };
  return null;
}

function resolveBusinessIdFromMessage(text: string): string | null {
  const bizMatch = text.match(/\[BIZ:([a-f0-9-]+)\]/i);
  if (bizMatch) return bizMatch[1];

  const refMatch = text.match(/\(Ref:\s*([a-zA-Z0-9-]+)\)/i);
  if (refMatch) {
    const val = refMatch[1];
    if (/^[a-f0-9-]{36}$/i.test(val)) return val;
  }
  return null;
}

// ─── Health check ────────────────────────────────────────────────────────

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    version: 'evolution-v1',
    description: 'Evolution API WhatsApp webhook — typing indicators + read receipts',
    features: ['typing_indicator', 'read_receipts', 'self_hosted'],
  });
}
