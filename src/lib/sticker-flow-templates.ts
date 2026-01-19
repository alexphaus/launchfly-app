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
 * Generate direct WhatsApp link for QR codes
 */
export function generateStickerWhatsAppLink(whatsappNumber: string): string {
    const cleanPhone = whatsappNumber.replace(/[^\d]/g, '');
    const triggerMessage = "Hi, I scanned the Service Sticker";
    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(triggerMessage)}`;
}
