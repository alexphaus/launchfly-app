/**
 * Sticker Flow Templates
 * 
 * Universal templates for the Direct-to-WhatsApp sticker flow.
 * These adapt to any service type using dynamic variables.
 */

// Configuration for each service niche
export interface StickerFlowConfig {
    serviceName: string;          // e.g., "Aircon Service", "Pest Control"
    cleaningLabel: string;        // Menu option 1 label
    repairLabel: string;          // Menu option 2 label
    priceLabel: string;           // Menu option 3 label
    quantifierQuestion: string;   // e.g., "How many units?", "How many sqm?"
    pricePerUnit: number;         // Base price per unit/sqm
    unitLabel: string;            // e.g., "unit", "room", "sqm"
    repairInspectionFee: number;  // Inspection fee for repairs
    currency: string;             // Currency symbol
}

// Service-specific configurations
export const SERVICE_FLOW_CONFIGS: Record<string, StickerFlowConfig> = {
    aircon: {
        serviceName: 'Aircon Service',
        cleaningLabel: 'Book Cleaning 💦',
        repairLabel: 'Not Cooling / Repair 🔧',
        priceLabel: 'Check Price 💰',
        quantifierQuestion: 'How many units need cleaning?',
        pricePerUnit: 120,
        unitLabel: 'unit',
        repairInspectionFee: 80,
        currency: 'RM'
    },
    pest_control: {
        serviceName: 'Pest Control',
        cleaningLabel: 'General Pest Spray 🪳',
        repairLabel: 'Termite / Infestation 🐜',
        priceLabel: 'Check Price 💰',
        quantifierQuestion: 'What is the approx. size of your place? (sqm or rooms)',
        pricePerUnit: 150,
        unitLabel: 'visit',
        repairInspectionFee: 100,
        currency: 'RM'
    },
    plumber: {
        serviceName: 'Plumbing Service',
        cleaningLabel: 'Clog / Drainage 🚿',
        repairLabel: 'Leak / Water Damage 💧',
        priceLabel: 'Check Price 💰',
        quantifierQuestion: 'Where is the issue? (kitchen, bathroom, etc.)',
        pricePerUnit: 100,
        unitLabel: 'job',
        repairInspectionFee: 80,
        currency: 'RM'
    },
    electrician: {
        serviceName: 'Electrical Service',
        cleaningLabel: 'Installation / Wiring ⚡',
        repairLabel: 'Power Issue / Repair 🔌',
        priceLabel: 'Check Price 💰',
        quantifierQuestion: 'What type of work is needed?',
        pricePerUnit: 150,
        unitLabel: 'job',
        repairInspectionFee: 80,
        currency: 'RM'
    },
    cleaning: {
        serviceName: 'Cleaning Service',
        cleaningLabel: 'Regular Cleaning 🧹',
        repairLabel: 'Deep Clean / Move-out 🏠',
        priceLabel: 'Check Price 💰',
        quantifierQuestion: 'How many rooms/sqm?',
        pricePerUnit: 80,
        unitLabel: 'room',
        repairInspectionFee: 0,
        currency: 'RM'
    },
    // Philippine peso versions
    aircon_ph: {
        serviceName: 'Aircon Service',
        cleaningLabel: 'Book Cleaning 💦',
        repairLabel: 'Hindi Lumalamig / Repair 🔧',
        priceLabel: 'Check Price 💰',
        quantifierQuestion: 'Ilang units ang lilinisin?',
        pricePerUnit: 800,
        unitLabel: 'unit',
        repairInspectionFee: 500,
        currency: '₱'
    },
    default: {
        serviceName: 'Service',
        cleaningLabel: 'Book Service 🛠️',
        repairLabel: 'Report Issue 🔧',
        priceLabel: 'Check Price 💰',
        quantifierQuestion: 'Can you describe what you need?',
        pricePerUnit: 100,
        unitLabel: 'service',
        repairInspectionFee: 50,
        currency: 'RM'
    }
};

/**
 * Get flow config for a business niche
 */
export function getFlowConfig(niche?: string): StickerFlowConfig {
    if (!niche) return SERVICE_FLOW_CONFIGS.default;

    const normalized = niche.toLowerCase().replace(/[^a-z_]/g, '');
    return SERVICE_FLOW_CONFIGS[normalized] || SERVICE_FLOW_CONFIGS.default;
}

/**
 * Generate VIP greeting message for sticker scan
 */
export function generateStickerGreeting(config: StickerFlowConfig, businessName: string): string {
    return `Welcome back! 👋
Since you scanned the sticker, I have pulled up your Priority Record. 🛠️

What do you need help with today?

1️⃣ ${config.cleaningLabel}
2️⃣ ${config.repairLabel}
3️⃣ ${config.priceLabel}

Reply with 1, 2, or 3`;
}

/**
 * Generate cleaning/booking flow message
 */
export function generateCleaningPrompt(config: StickerFlowConfig): string {
    return `Got it. ${config.serviceName.split(' ')[0]} Cleaning is ${config.currency} ${config.pricePerUnit} / ${config.unitLabel}.

${config.quantifierQuestion}`;
}

/**
 * Generate repair flow message
 */
export function generateRepairPrompt(config: StickerFlowConfig): string {
    if (config.repairInspectionFee === 0) {
        return `Understood. For ${config.repairLabel.replace(/[^\w\s]/g, '').trim()}, we need to assess first.

Can you briefly describe the issue or send a photo? 📸`;
    }

    return `Understood. For repairs, our Inspection Fee is ${config.currency} ${config.repairInspectionFee}.
*(Note: If you proceed with the repair, we waive this fee!)*

Can you send a photo or describe the issue? 📸`;
}

/**
 * Generate price list message
 */
export function generatePriceList(config: StickerFlowConfig, businessName: string): string {
    return `Here are our prices for ${businessName}:

🧹 ${config.cleaningLabel.replace(/[^\w\s]/g, '').trim()}: ${config.currency} ${config.pricePerUnit} / ${config.unitLabel}
🔧 ${config.repairLabel.replace(/[^\w\s]/g, '').trim()}: Inspection ${config.currency} ${config.repairInspectionFee} (waived if repaired)

Ready to book? Reply with what you need!`;
}

/**
 * Generate units received confirmation
 */
export function generateUnitsConfirmation(
    config: StickerFlowConfig,
    units: number
): string {
    const total = config.pricePerUnit * units;
    return `Noted. ${units} ${config.unitLabel}${units > 1 ? 's' : ''} = ${config.currency} ${total}.

Please reply with your *Name & Full Address* (or tap the Location pin 📍) so I can check which technician is nearby.`;
}

/**
 * Generate direct WhatsApp link for QR codes with business context
 * The business ID is embedded so the bot knows which business this is for
 */
export function generateStickerWhatsAppLink(launchflyBotNumber: string, businessId?: string): string {
    const cleanPhone = launchflyBotNumber.replace(/[^\d]/g, '');
    const triggerMessage = businessId 
        ? `Hi, I scanned the Service Sticker [BIZ:${businessId}]`
        : "Hi, I scanned the Service Sticker";
    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(triggerMessage)}`;
}

/**
 * Extract business ID from sticker scan trigger message
 */
export function extractBusinessIdFromTrigger(message: string): string | null {
    const match = message.match(/\[BIZ:([a-zA-Z0-9-]+)\]/);
    return match ? match[1] : null;
}

/**
 * Generate slot options for booking
 */
export function generateSlotOptions(): { label: string; value: string }[] {
    const now = new Date();
    // UTC+8 for SEA timezone
    const utcHour = now.getUTCHours();
    const hour = (utcHour + 8 + 24) % 24;
    
    const localNow = new Date(now.getTime() + (8 * 60 * 60 * 1000));
    const tomorrow = new Date(localNow);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dayAfter = new Date(localNow);
    dayAfter.setDate(dayAfter.getDate() + 2);
    
    const formatDate = (d: Date) => d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
    const formatDateValue = (d: Date) => d.toISOString().split('T')[0];
    
    const slots: { label: string; value: string }[] = [];
    
    // Today slots - only if before the slot starts
    if (hour < 9) {
        slots.push({ label: 'Today 9am - 11am', value: `${formatDateValue(localNow)}_morning` });
    }
    if (hour < 14) {
        slots.push({ label: 'Today 2pm - 4pm', value: `${formatDateValue(localNow)}_afternoon` });
    }
    if (hour < 16) {
        slots.push({ label: 'Today 4pm - 6pm', value: `${formatDateValue(localNow)}_evening` });
    }
    
    // Tomorrow slots
    if (slots.length < 3) {
        slots.push({ label: `${formatDate(tomorrow)} 9am - 11am`, value: `${formatDateValue(tomorrow)}_morning` });
    }
    if (slots.length < 3) {
        slots.push({ label: `${formatDate(tomorrow)} 2pm - 4pm`, value: `${formatDateValue(tomorrow)}_afternoon` });
    }
    if (slots.length < 3) {
        slots.push({ label: `${formatDate(dayAfter)} 10am - 12pm`, value: `${formatDateValue(dayAfter)}_morning` });
    }
    
    return slots.slice(0, 3);
}

/**
 * Generate booking confirmation "Job Card" message
 */
export function generateBookingConfirmation(params: {
    customerName: string;
    businessName: string;
    serviceName: string;
    serviceDetails?: string;
    timeSlot: string;
    address: string;
    estimate?: string;
}): string {
    return `All set! ✅

*Booking Confirmed:*
👤 *Name:* ${params.customerName}
📅 *Date:* ${params.timeSlot}
🛠️ *Service:* ${params.serviceName}${params.serviceDetails ? ` (${params.serviceDetails})` : ''}
📍 *Location:* ${params.address}
${params.estimate ? `💰 *Estimate:* ${params.estimate}\n` : ''}
Our team from *${params.businessName}* will WhatsApp you 30 mins before arrival.

See you then! 🙏`;
}

/**
 * Generate the universal AI system prompt for any business niche
 * This creates a dynamic persona based on business data
 */
export function generateUniversalSystemPrompt(business: {
    name: string;
    niche?: string;
    ownerName?: string;
    services?: string[];
    priceList?: { service: string; price: string }[];
    currency?: string;
    serviceAreas?: string[];
    operatingHours?: string;
    phone?: string;
}): string {
    const serviceList = business.services?.length 
        ? business.services.map(s => `• ${s}`).join('\n')
        : '• General services available';
    
    const priceInfo = business.priceList?.length
        ? business.priceList.map(p => `• ${p.service}: ${business.currency || 'RM'} ${p.price}`).join('\n')
        : 'Prices quoted upon request';

    return `You are the AI Receptionist for ${business.name}.
Your tone is: Friendly, Professional, and Concise.

## Business Information
- Owner: ${business.ownerName || 'The owner'}
- Niche: ${business.niche || 'Service Business'}
- Currency: ${business.currency || 'RM'}
${business.serviceAreas?.length ? `- Service Areas: ${business.serviceAreas.join(', ')}` : ''}
${business.operatingHours ? `- Hours: ${business.operatingHours}` : ''}

## Services Offered
${serviceList}

## Pricing Guide
${priceInfo}

## YOUR GOAL
1. Identify the customer's problem/need
2. Give them a rough price estimate (based on the list above)
3. Get their Name and Address
4. Secure the Booking (Get a Date/Time)

## RULES
- Keep replies under 3 sentences
- Do not use flowery language - be direct
- If the service is NOT in the list, say you need to check with ${business.ownerName || 'the owner'}
- If they ask for a discount on first visit, you can offer 5% Welcome Discount
- Never make up prices - use the list or say "I'll get you an accurate quote"
- Always try to move towards booking

## CONVERSATION STATES
- sticker_menu: Customer just scanned QR, show service menu (1/2/3)
- sticker_units: Customer selected cleaning, ask how many units
- sticker_repair: Customer has issue, ask for details/photo
- awaiting_address: Got service details, need address to book
- awaiting_slot: Got address, show time slot options
- booked: Booking confirmed, send job card`;}