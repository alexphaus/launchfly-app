// src/lib/ai-receptionist/handlers/notifications.ts
// Handle owner notifications after tool actions

import type { WebhookContext, ToolResult } from '../types';
import { formatWhatsApp } from '../utils';
import { sendJobConfirmed } from '../../whatsapp-push';

/**
 * Send notifications to owner based on tool results
 */
export async function sendToolNotifications(
    ctx: WebhookContext,
    toolResults: ToolResult[]
): Promise<void> {
    const { twilioClient, fromNumber, businessContext, customerPhone, customerContext } = ctx;
    
    for (const tr of toolResults) {
        const res = tr.output ?? tr.result;
        const toolName = tr.toolName;
        
        if (!res) continue;
        
        // 1. notifyOwner - Plain text alerts
        if ((res as any)?.action === 'notify_owner' && (res as any)?.phone) {
            await sendPlainNotification(ctx, (res as any).message || 'Notification from AI');
        }
        
        // 2. createBooking - Send JOB CONFIRMED template
        if (toolName === 'createBooking' && (res as any)?.success) {
            const booking = res as any;
            const ownerPhone = booking.ownerPhone || businessContext?.ownerPhone;
            
            if (ownerPhone) {
                try {
                    await sendJobConfirmed(ownerPhone, {
                        id: booking.bookingId?.substring(0, 8).toUpperCase() || 'NEW',
                        serviceName: booking.serviceType || businessContext?.niche || 'Service',
                        serviceEmoji: '🔧',
                        timeSlot: booking.slotLabel || 'As scheduled',
                        address: booking.address || 'Address provided',
                        customerName: booking.customerName || customerContext?.name || 'Customer',
                        customerPhone: booking.customerPhone || customerPhone,
                        estimate: booking.estimate
                    });
                    console.log(`   📤 Sent JOB CONFIRMED to owner: ${ownerPhone}`);
                } catch (e) {
                    console.error('Failed to send job confirmed:', e);
                }
            }
        }
        
        // 3. cancelBooking - Send cancellation alert
        if (toolName === 'cancelBooking' && (res as any)?.success) {
            const ownerPhone = businessContext?.ownerPhone;
            if (ownerPhone && twilioClient && fromNumber) {
                try {
                    await twilioClient.messages.create({
                        from: formatWhatsApp(fromNumber),
                        to: formatWhatsApp(ownerPhone),
                        body: `🔴 *JOB CANCELLED*\n\n` +
                              `👤 ${(res as any).customerName || 'Customer'}\n` +
                              `🗓️ Slot: ${(res as any).slotLabel || 'Unknown'}\n` +
                              `⚠️ Please check dashboard.`
                    });
                    console.log(`   📤 Notified owner of CANCELLATION`);
                } catch (e) {
                    console.error('Failed to notify cancellation:', e);
                }
            }
        }
        
        // 4. rescheduleBooking - Send reschedule alert
        if (toolName === 'rescheduleBooking' && (res as any)?.success) {
            const ownerPhone = businessContext?.ownerPhone;
            if (ownerPhone && twilioClient && fromNumber) {
                try {
                    await twilioClient.messages.create({
                        from: formatWhatsApp(fromNumber),
                        to: formatWhatsApp(ownerPhone),
                        body: `🔄 *JOB RESCHEDULED*\n\n` +
                              `👤 ${(res as any).customerName || 'Customer'}\n` +
                              `🗓️ NEW: ${(res as any).newSlotLabel || 'New slot'}\n` +
                              `⚠️ Please check dashboard.`
                    });
                    console.log(`   📤 Notified owner of RESCHEDULE`);
                } catch (e) {
                    console.error('Failed to notify reschedule:', e);
                }
            }
        }
    }
}

async function sendPlainNotification(ctx: WebhookContext, message: string): Promise<void> {
    const { twilioClient, fromNumber, businessContext } = ctx;
    const ownerPhone = businessContext?.ownerPhone;
    
    if (ownerPhone && twilioClient && fromNumber) {
        try {
            await twilioClient.messages.create({
                from: formatWhatsApp(fromNumber),
                to: formatWhatsApp(ownerPhone),
                body: message,
            });
        } catch (e) {
            console.error('Failed to send notification:', e);
        }
    }
}
