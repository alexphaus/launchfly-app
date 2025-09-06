// src/lib/inngest/functions/nurture-sequence.js
import { inngest, EVENTS } from '../client';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { Resend } from 'resend';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Nurture Sequence Function
 * Sends value-first content to warm prospects to increase reply rates.
 * Hardcoded structure with AI intelligence layer for copy.
 */
export const nurtureSequence = inngest.createFunction(
  {
    id: 'nurture-sequence',
    name: 'Lead Nurture Sequence',
    retries: 2,
    concurrency: { limit: 10 }
  },
  { event: EVENTS.NURTURE_SCHEDULED },
  async ({ event, step }) => {
    const { businessId, businessData, theme = 'education', max = 25 } = event.data || {};

    if (!businessId) {
      throw new Error('businessId is required for nurture sequence');
    }

    // 1) Load business
    const business = await step.run('load-business', async () => {
      const { data } = await supabase
        .from('businesses')
        .select('*')
        .eq('id', businessId)
        .single();
      return data;
    });

    // 2) Select warm prospects (contacted, engaged, interested)
    const warmProspects = await step.run('select-warm-prospects', async () => {
      const { data } = await supabase
        .from('prospects')
        .select('*')
        .eq('business_id', businessId)
        .in('status', ['contacted', 'interested', 'engaged'])
        .order('updated_at', { ascending: false })
        .limit(Math.max(1, Math.min(100, max || 25)));
      return data || [];
    });

    if (!warmProspects.length) {
      await step.run('log-no-prospects', async () => {
        await supabase.from('ai_activities').insert({
          business_id: businessId,
          type: 'metrics_update',
          icon: '📭',
          message: 'No warm prospects to nurture',
          details: 'AI will keep listening for replies and engagement',
          metadata: { theme }
        });
      });
      return { success: true, sent: 0 };
    }

    // 3) Build content (fallback to playbook if OpenAI unavailable)
    const buildContent = async (prospect) => {
      const base = {
        subject: `Quick resource for ${prospect.company || 'your team'}`,
        body: `Sharing a short resource we created to help ${prospect.industry || 'teams'} get results faster. Thought it might be useful for ${prospect.company || 'you'}.

- Quick win checklist
- 2-minute teardown example
- Optional audit at the end

Happy to send the full version if helpful.`
      };
      if (!process.env.OPENAI_API_KEY) return base;
      try {
        const prompt = `Create a concise, helpful nurture email. Theme: ${theme}. 
Business: ${business?.businessName || businessData?.businessName || 'Launchfly user'}
Value prop: ${business?.tagline || businessData?.tagline || ''}
Prospect: ${prospect.name} at ${prospect.company} (${prospect.industry || 'industry'})
Tone: helpful, not salesy. 80-120 words. Return JSON {subject, body}.`;
        const resp = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' },
          temperature: 0.6
        });
        return JSON.parse(resp.choices[0].message.content);
      } catch (_) {
        return base;
      }
    };

    let sent = 0;
    for (const p of warmProspects) {
      // Skip invalid emails
      if (!p.email || p.email.includes('@example')) continue;

      const content = await step.run(`build-content-${p.id}`, () => buildContent(p));

      // 4) Send email via Resend if configured
      const canSend = Boolean(process.env.RESEND_API_KEY && process.env.FROM_EMAIL);
      if (!canSend) continue;

      try {
        const { data, error } = await resend.emails.send({
          from: process.env.FROM_EMAIL,
          to: p.email,
          subject: content.subject,
          html: `<!doctype html><html><body style="font-family: -apple-system, Arial; line-height:1.6;">${
            content.body.split('\n').map(line => line.trim() ? `<p>${line}</p>` : '<br>').join('')
          }</body></html>`,
          tags: [
            { name: 'business_id', value: businessId },
            { name: 'email_type', value: 'nurture' }
          ]
        });
        if (error) throw error;

        sent++;
        // 5) Log activity
        await supabase.from('ai_activities').insert({
          business_id: businessId,
          type: 'email_sent',
          icon: '📨',
          message: `Nurture email sent to ${p.name || p.email}`,
          details: `Subject: "${content.subject}"`,
          metadata: { prospect_id: p.id, email_type: 'nurture', resend_id: data?.id }
        });

        // Update prospect status
        await supabase
          .from('prospects')
          .update({ status: 'engaged', last_engagement: new Date().toISOString() })
          .eq('id', p.id);

        // Gentle pacing
        await step.sleep(`delay-${p.id}`, '2s');
      } catch (e) {
        // Log failure but continue
        await supabase.from('ai_activities').insert({
          business_id: businessId,
          type: 'optimization',
          icon: '⚠️',
          message: `Failed to send nurture email to ${p.email}`,
          details: e.message,
          metadata: { prospect_id: p.id }
        });
      }
    }

    return { success: true, sent, totalCandidates: warmProspects.length };
  }
);

export default nurtureSequence;


