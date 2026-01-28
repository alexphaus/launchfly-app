// src/app/api/webhook/twilio/v3/route.ts
// V3 AI Receptionist - Clean Architecture
// Thin orchestrator that delegates to handlers

import { NextRequest, NextResponse } from 'next/server';
import Twilio from 'twilio';
import { createClient } from '@supabase/supabase-js';
import { 
    normalizePhone, 
    checkRateLimit,
    CONFIG 
} from '@/lib/ai-receptionist/utils';
import { getLastBusinessId, getConversationHistory, saveMessage } from '@/lib/ai-receptionist/history';
import { handleReminderResponse } from '@/lib/ai-receptionist/handlers/reminder';
import { processWithAI } from '@/lib/ai-receptionist/handlers/ai-brain';
import type { WebhookContext, ConversationMessage } from '@/lib/ai-receptionist/types';

// Supabase with service key for server-side operations
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
);

// Twilio client
const twilioClient = Twilio(
    process.env.TWILIO_ACCOUNT_SID!,
    process.env.TWILIO_AUTH_TOKEN!
);

export const maxDuration = 60;

export async function POST(request: NextRequest) {
    const startTime = Date.now();
    
    try {
        // 1. Parse incoming webhook
        const formData = await request.formData();
        const body = formData.get('Body')?.toString() || '';
        const from = formData.get('From')?.toString() || '';
        const to = formData.get('To')?.toString() || '';
        
        // Normalize phone number
        const phoneFormats = normalizePhone(from);
        const customerPhone = phoneFormats.withPlus;
        
        if (!customerPhone || customerPhone.length < 10) {
            console.log('[V3] Invalid phone:', from);
            return NextResponse.json({ error: 'Invalid phone' }, { status: 400 });
        }
        
        console.log(`[V3] Message from ${customerPhone}: "${body.substring(0, 50)}..."`);
        
        // 2. Rate limit check
        if (!checkRateLimit(customerPhone)) {
            console.log(`[V3] Rate limited: ${customerPhone}`);
            return new NextResponse('TooManyRequests', { status: 429 });
        }
        
        // 3. Extract business ID from [BIZ:uuid] in message or from history
        const bizMatch = body.match(/\[BIZ:([a-f0-9-]+)\]/i);
        let businessId: string | null = bizMatch ? bizMatch[1] : null;
        
        // Clean the message text (remove [BIZ:] tag)
        const messageText = body.replace(/\[BIZ:[a-f0-9-]+\]/i, '').trim();
        
        // Try to get business ID from recent history if not in message
        if (!businessId) {
            businessId = await getLastBusinessId(customerPhone);
        }
        
        // Last resort: check if customer exists in DB
        if (!businessId) {
            const { data: existingCustomer } = await supabase
                .from('customers')
                .select('business_id')
                .or(`phone.eq.${phoneFormats.withPlus},phone.eq.${phoneFormats.withoutPlus}`)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();
            
            if (existingCustomer?.business_id) {
                businessId = existingCustomer.business_id;
                console.log(`[V3] Found business_id from customer record: ${businessId}`);
            }
        }
        
        // 4. Fetch context in parallel
        const [businessRes, customerRes, history] = await Promise.all([
            businessId 
                ? supabase.from('businesses').select('*').eq('id', businessId).single()
                : Promise.resolve({ data: null, error: null }),
            businessId
                ? supabase.from('customers')
                    .select('*')
                    .or(`phone.eq.${phoneFormats.withPlus},phone.eq.${phoneFormats.withoutPlus}`)
                    .eq('business_id', businessId)
                    .maybeSingle()
                : Promise.resolve({ data: null, error: null }),
            businessId 
                ? getConversationHistory(customerPhone, businessId)
                : Promise.resolve([])
        ]);
        
        // Build context object matching WebhookContext type
        const context: WebhookContext = {
            businessId,
            customerPhone,
            messageText,
            businessContext: businessRes.data,
            customerContext: customerRes.data,
            history: history as ConversationMessage[],
            twilioClient,
            fromNumber: to
        };
        
        // 5. Save incoming message to history
        if (businessId) {
            await saveMessage(customerPhone, 'user', messageText, businessId);
        }
        
        // 6. Check for Smart Nag reminder response ("yes" after 6-month nudge)
        const reminderResult = await handleReminderResponse(context);
        if (reminderResult.handled) {
            console.log(`[V3] Reminder handled in ${Date.now() - startTime}ms`);
            return NextResponse.json({ success: true, handler: 'reminder' });
        }
        
        // 7. Process with main AI brain
        const aiResult = await processWithAI(context);
        
        // 8. Send AI response via Twilio
        if (aiResult.text) {
            await twilioClient.messages.create({
                from: to,
                to: from,
                body: aiResult.text
            });
            
            // Save bot response to history
            if (businessId) {
                await saveMessage(customerPhone, 'assistant', aiResult.text, businessId);
            }
        }
        
        const toolNames = aiResult.toolCalls.map(t => t.toolName);
        console.log(`[V3] Complete in ${Date.now() - startTime}ms | Tools: ${toolNames.join(', ') || 'none'}`);
        
        return NextResponse.json({
            success: true,
            duration: Date.now() - startTime,
            toolsCalled: toolNames
        });
        
    } catch (error) {
        console.error('[V3] Fatal error:', error);
        return NextResponse.json({ 
            error: 'Internal error',
            message: error instanceof Error ? error.message : 'Unknown'
        }, { status: 500 });
    }
}

