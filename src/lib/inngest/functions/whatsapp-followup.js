// src/lib/inngest/functions/whatsapp-followup.js
/**
 * WhatsApp Follow-up Engine
 * Handles scheduled follow-up messages for job leads.
 */

import { inngest, EVENTS } from '../client';
import { sendFollowUpMessage } from '@/lib/whatsapp-push';

/**
 * Inngest function to send a scheduled WhatsApp follow-up message.
 * Triggered by the 'whatsapp/followup.scheduled' event.
 */
export const whatsappFollowUpHandler = inngest.createFunction(
    { id: 'whatsapp-followup-handler', name: 'WhatsApp Follow-up Handler' },
    { event: EVENTS.WHATSAPP_FOLLOWUP_SCHEDULED },
    async ({ event, step }) => {
        const { customerId, customerPhone, businessName, followUpType, delayMinutes } = event.data;

        // Use Inngest's built-in sleep for the delay
        // This is the key to the scheduling - Inngest handles the timer.
        await step.sleep(`wait-for-${followUpType}`, `${delayMinutes}m`);

        // Then send the message
        await step.run('send-whatsapp-followup', async () => {
            console.log(`⏰ Sending ${followUpType} follow-up to ${customerPhone} for ${businessName}`);
            await sendFollowUpMessage(customerPhone, { type: followUpType, businessName });
        });

        return { success: true, followUpType, sentTo: customerPhone };
    }
);
