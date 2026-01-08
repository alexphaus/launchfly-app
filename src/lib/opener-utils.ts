// Shared opener message generator for Hunter and Sales pages

// Service type mapping for generating opener messages
export const SERVICE_TYPE_LABELS: Record<string, string> = {
    pest_control: 'pest control',
    aircon: 'aircon',
    plumbing: 'plumbing',
    renovation: 'renovation',
    cleaning: 'cleaning',
    electrical: 'electrical',
    roofing: 'roofing',
    landscaping: 'landscaping',
    moving: 'moving',
    auto_repair: 'auto repair',
    locksmith: 'locksmith',
    other: 'service',
};

/**
 * Generate the opener message for cold outreach
 * @param serviceType - The service type key (e.g., 'aircon', 'pest_control')
 * @param area - The service area/location
 * @param customArea - Optional custom area to use instead of the full area string
 * @returns The formatted opener message
 */
export function generateOpenerMessage(
    serviceType: string,
    area: string,
    customArea?: string
): string {
    const service = SERVICE_TYPE_LABELS[serviceType] || serviceType;
    const areaToUse = customArea || area;

    return `Hi boss 👋 You still handling ${service} jobs around ${areaToUse}?

I built a WhatsApp tool that automatically replies to 'Hm po?' inquiries and quotes prices while you are driving or on a ladder. 🪜

Want to see the demo?`;
}

/**
 * Open WhatsApp with a pre-filled message
 * Uses api.whatsapp.com instead of wa.me to avoid ISP blocks (e.g. in Philippines)
 * @param phone - The phone number (with or without country code)
 * @param message - The message to send
 */
export function openWhatsAppWithMessage(phone: string, message: string): void {
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const encoded = encodeURIComponent(message);
    window.open(`https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encoded}`, '_blank');
}
