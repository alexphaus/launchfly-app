// src/lib/ai-receptionist/utils.ts
// Shared utilities for AI Receptionist

/**
 * Normalize phone number to consistent formats
 */
export function normalizePhone(phone: string): { withPlus: string; withoutPlus: string; clean: string } {
    const clean = phone.replace(/[^\d+]/g, '');
    const withPlus = clean.startsWith('+') ? clean : `+${clean}`;
    const withoutPlus = clean.replace(/^\+/, '');
    return { withPlus, withoutPlus, clean };
}

/**
 * Format WhatsApp number for Twilio
 */
export function formatWhatsApp(phone: string): string {
    const { clean } = normalizePhone(phone);
    return clean.startsWith('whatsapp:') ? clean : `whatsapp:${clean}`;
}

/**
 * Parse date from natural language to YYYY-MM-DD
 */
export function parseRelativeDate(text: string, baseDate = new Date()): string {
    const lower = text.toLowerCase();
    const result = new Date(baseDate);
    
    if (lower.includes('today')) {
        // Keep as is
    } else if (lower.includes('tomorrow')) {
        result.setDate(result.getDate() + 1);
    } else {
        // Check for day names
        const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        for (const day of dayNames) {
            if (lower.includes(day)) {
                const currentDay = result.getDay();
                const targetDay = dayNames.indexOf(day);
                let daysUntil = targetDay - currentDay;
                if (daysUntil <= 0) daysUntil += 7;
                result.setDate(result.getDate() + daysUntil);
                break;
            }
        }
    }
    
    return result.toISOString().split('T')[0];
}

/**
 * Parse time window from text
 */
export function parseTimeWindow(text: string, fallback: 'morning' | 'afternoon' = 'afternoon'): 'morning' | 'afternoon' {
    const lower = text.toLowerCase();
    if (lower.includes('morning') && !lower.includes("can't") && !lower.includes("cant")) {
        return 'morning';
    }
    if (lower.includes('afternoon')) {
        return 'afternoon';
    }
    return fallback;
}

/**
 * Format a date for display
 */
export function formatDateLabel(date: string, window: 'morning' | 'afternoon'): string {
    const d = new Date(date);
    const dayLabel = d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' });
    const windowLabel = window === 'morning' ? 'Morning (9am - 12pm)' : 'Afternoon (1pm - 5pm)';
    return `${dayLabel} ${windowLabel}`;
}

/**
 * Check if text looks like an address
 */
export function looksLikeAddress(text: string): boolean {
    if (text.length < 5) return false;
    const lower = text.toLowerCase();
    return (
        /\d/.test(text) || // Has numbers
        lower.includes('street') || lower.includes('st.') ||
        lower.includes('avenue') || lower.includes('ave') ||
        lower.includes('road') || lower.includes('rd.') ||
        lower.includes('building') || lower.includes('bldg') ||
        lower.includes('floor') || lower.includes('unit') ||
        lower.includes('block') || lower.includes('lot') ||
        // Common Malaysian/Filipino areas
        lower.includes('jalan') || lower.includes('lorong') ||
        lower.includes('taman') || lower.includes('bandar') ||
        lower.includes('makati') || lower.includes('manila') ||
        lower.includes('quezon') || lower.includes('bgc')
    );
}

/**
 * Extract customer name from text (simple heuristic)
 */
export function extractName(text: string): string | null {
    // Skip if it's clearly not a name
    if (text.length < 2 || text.length > 50) return null;
    if (/^\d+$/.test(text)) return null; // Just numbers
    if (looksLikeAddress(text)) return null;
    
    // Basic name pattern: 1-3 words, starts with capital or is short
    const words = text.trim().split(/\s+/);
    if (words.length <= 3) {
        // Capitalize first letter of each word
        return words.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
    }
    
    return null;
}

/**
 * Simple in-memory rate limiter
 */
const rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_MAX = 15; // 15 messages per minute

export function checkRateLimit(phone: string): boolean {
    const now = Date.now();
    const timestamps = rateLimitMap.get(phone) || [];
    
    // Remove old timestamps
    const recent = timestamps.filter(t => now - t < RATE_LIMIT_WINDOW);
    
    if (recent.length >= RATE_LIMIT_MAX) {
        return false; // Rate limited
    }
    
    recent.push(now);
    rateLimitMap.set(phone, recent);
    return true;
}

/**
 * Clean up rate limit map periodically (call from cron or similar)
 */
export function cleanupRateLimits(): void {
    const now = Date.now();
    for (const [phone, timestamps] of rateLimitMap.entries()) {
        const recent = timestamps.filter(t => now - t < RATE_LIMIT_WINDOW);
        if (recent.length === 0) {
            rateLimitMap.delete(phone);
        } else {
            rateLimitMap.set(phone, recent);
        }
    }
}

/**
 * Configuration constants
 */
export const CONFIG = {
    AI_MODEL: 'gpt-4o-mini' as const,
    MAX_STEPS: 5,
    MAX_HISTORY: 15,
    RETRY_ENABLED: true,
    TIMEOUT_MS: 25000, // 25 seconds max for Vercel
    DEFAULT_CURRENCY: 'RM',
    DEFAULT_CLEANING_PRICE: 120,
    DEFAULT_WARRANTY_DAYS: 30,
} as const;
