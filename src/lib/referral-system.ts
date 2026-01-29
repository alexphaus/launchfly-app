/**
 * Referral System Utilities
 * 
 * THE VIRAL GROWTH ENGINE
 * 
 * Handles:
 * 1. Creating referral records with unique tokens
 * 2. Generating shareable links
 * 3. Tracking referral conversions
 * 4. Applying discounts
 */

import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const getSupabase = () => createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
);

// Characters for token generation (removed confusables: I, O, 0, 1)
const TOKEN_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/**
 * Generate a unique 8-character referral token
 */
export function generateReferralToken(): string {
    let token = '';
    for (let i = 0; i < 8; i++) {
        token += TOKEN_CHARS.charAt(Math.floor(Math.random() * TOKEN_CHARS.length));
    }
    return token;
}

/**
 * Generate a unique referral code (shorter, for display)
 * Format: REF-XXXXX (e.g., REF-A7B3K)
 */
export function generateReferralCode(): string {
    let code = 'REF-';
    for (let i = 0; i < 5; i++) {
        code += TOKEN_CHARS.charAt(Math.floor(Math.random() * TOKEN_CHARS.length));
    }
    return code;
}

/**
 * Create or get existing referral record for a customer
 */
export async function getOrCreateReferral(params: {
    customerId: string;
    businessId: string;
    discountPercent?: number;
}): Promise<{
    referralCode: string;
    referralToken: string;
    referralLink: string;
} | null> {
    const supabase = getSupabase();
    const { customerId, businessId, discountPercent = 10 } = params;

    try {
        // 1. Check for existing active referral
        const { data: existing } = await supabase
            .from('referrals')
            .select('referral_code, referral_token')
            .eq('referrer_id', customerId)
            .eq('business_id', businessId)
            .eq('status', 'pending')
            .gt('expires_at', new Date().toISOString())
            .single();

        if (existing?.referral_token) {
            const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.launchfly.com';
            return {
                referralCode: existing.referral_code,
                referralToken: existing.referral_token,
                referralLink: `${baseUrl}/r/${existing.referral_token}`,
            };
        }

        // 2. Create new referral
        const referralCode = generateReferralCode();
        const referralToken = generateReferralToken();
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30); // 30 day expiry

        const { error: insertError } = await supabase
            .from('referrals')
            .insert({
                referrer_id: customerId,
                business_id: businessId,
                referral_code: referralCode,
                referral_token: referralToken,
                referrer_discount_percent: discountPercent,
                referee_discount_percent: discountPercent,
                status: 'pending',
                expires_at: expiresAt.toISOString(),
            });

        if (insertError) {
            console.error('Failed to create referral:', insertError);
            return null;
        }

        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.launchfly.com';
        return {
            referralCode,
            referralToken,
            referralLink: `${baseUrl}/r/${referralToken}`,
        };

    } catch (error) {
        console.error('Error in getOrCreateReferral:', error);
        return null;
    }
}

/**
 * Process a referral when a new customer mentions a referral code
 */
export async function processReferralCode(params: {
    referralCode: string;
    refereePhone: string;
    refereeName?: string;
    businessId: string;
}): Promise<{
    valid: boolean;
    referrerName?: string;
    discountPercent?: number;
    message?: string;
}> {
    const supabase = getSupabase();
    const { referralCode, refereePhone, refereeName, businessId } = params;

    try {
        // 1. Look up the referral
        const { data: referral, error } = await supabase
            .from('referrals')
            .select(`
                id,
                referee_discount_percent,
                status,
                expires_at,
                customers!referrals_referrer_id_fkey(name, first_name)
            `)
            .eq('referral_code', referralCode.toUpperCase())
            .eq('business_id', businessId)
            .single();

        if (error || !referral) {
            return {
                valid: false,
                message: 'Invalid referral code',
            };
        }

        // 2. Check expiry
        if (referral.expires_at && new Date(referral.expires_at) < new Date()) {
            return {
                valid: false,
                message: 'This referral code has expired',
            };
        }

        // 3. Check if already used
        if (referral.status === 'completed' || referral.status === 'booked') {
            return {
                valid: false,
                message: 'This referral code has already been used',
            };
        }

        // 4. Update the referral with referee info
        await supabase
            .from('referrals')
            .update({
                referee_phone: refereePhone,
                referee_name: refereeName,
                registered_at: new Date().toISOString(),
                status: 'registered',
            })
            .eq('id', referral.id);

        // @ts-ignore
        const referrerName = referral.customers?.first_name || referral.customers?.name?.split(' ')[0] || 'Your friend';

        return {
            valid: true,
            referrerName,
            discountPercent: referral.referee_discount_percent || 10,
            message: `Referral from ${referrerName} applied! You get ${referral.referee_discount_percent || 10}% off!`,
        };

    } catch (error) {
        console.error('Error processing referral code:', error);
        return {
            valid: false,
            message: 'Error processing referral',
        };
    }
}

/**
 * Complete a referral when the referred customer completes a booking
 */
export async function completeReferral(params: {
    referralCode: string;
    businessId: string;
}): Promise<boolean> {
    const supabase = getSupabase();
    const { referralCode, businessId } = params;

    try {
        const { error } = await supabase
            .from('referrals')
            .update({
                status: 'completed',
                completed_at: new Date().toISOString(),
            })
            .eq('referral_code', referralCode.toUpperCase())
            .eq('business_id', businessId);

        return !error;
    } catch (error) {
        console.error('Error completing referral:', error);
        return false;
    }
}

/**
 * Generate the referral message to send to a customer after positive feedback
 */
export function generateReferralAskMessage(params: {
    customerName: string;
    referralLink: string;
    discountPercent: number;
    businessName: string;
}): string {
    const { customerName, referralLink, discountPercent, businessName } = params;
    
    return `Thanks for the great feedback, ${customerName}! 🙏

If you have friends or neighbors who need aircon service, share this link with them:

👉 ${referralLink}

They'll get *${discountPercent}% off* their first service, and you'll earn a *${discountPercent}% discount* on your next one!

It's our way of saying thanks for spreading the word about ${businessName}! 🎁`;
}
