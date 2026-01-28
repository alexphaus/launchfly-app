// src/lib/ai-receptionist/handlers/reminder.ts
// Handles Smart Nag reminder conversions

import { createClient } from '@supabase/supabase-js';
import type { WebhookContext, HandlerResult } from '../types';
import { saveMessage } from '../history';
import { formatWhatsApp } from '../utils';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
);

/**
 * Check if this is a customer responding to a Smart Nag reminder
 * and handle the conversion to booking flow
 */
export async function handleReminderResponse(ctx: WebhookContext): Promise<HandlerResult> {
    const { customerContext, businessContext, messageText, customerPhone, twilioClient, fromNumber, businessId } = ctx;
    
    // Only handle if customer has reminder_sent or reengaged status
    const status = customerContext?.status;
    if (status !== 'reminder_sent' && status !== 'reengaged') {
        return { handled: false };
    }
    
    // Check if message is a confirmation
    const isConfirmation = /^(yes|ok|okay|yep|yeah|book|sure|hi|hello|interested|1)$/i.test(messageText.trim());
    if (!isConfirmation) {
        return { handled: false };
    }
    
    console.log('🔔 Hot lead! Customer responding to Smart Nag reminder');
    
    const customerName = customerContext?.name?.split(' ')[0] || 'Boss';
    const niche = businessContext?.niche || 'Service';
    
    // Get their last service for context
    const { data: lastService } = await supabase
        .from('service_records')
        .select('service_name')
        .eq('customer_id', customerContext?.id)
        .order('service_date', { ascending: false })
        .limit(1)
        .single();
    
    const serviceName = lastService?.service_name || niche;
    
    // Build response
    const responseText = `Great ${customerName}! 🎉 Welcome back!\n\nLet's book your ${serviceName.toLowerCase()} service.\n\nHow many units need servicing?`;
    
    // Send message
    if (twilioClient && fromNumber) {
        await twilioClient.messages.create({
            from: formatWhatsApp(fromNumber),
            to: formatWhatsApp(customerPhone),
            body: responseText,
        });
    }
    
    // Update customer status
    await supabase.from('customers').update({
        status: 'booking_in_progress',
        notes: (customerContext?.address || '') + `\n[REMINDER_CONVERTED: ${new Date().toISOString()}]`
    }).eq('id', customerContext?.id);
    
    // Save to history
    await saveMessage(customerPhone, 'assistant', responseText, businessId!);
    
    // Notify owner
    const ownerPhone = businessContext?.ownerPhone;
    if (ownerPhone && twilioClient && fromNumber) {
        try {
            await twilioClient.messages.create({
                from: formatWhatsApp(fromNumber),
                to: formatWhatsApp(ownerPhone),
                body: `🔔 *HOT LEAD!*\n\n${customerName} (${customerPhone}) responded to your reminder and wants to book!\n\nThey're in the booking flow now. 🎯`
            });
        } catch (e) {
            console.error('Failed to notify owner:', e);
        }
    }
    
    return { handled: true, response: responseText };
}
