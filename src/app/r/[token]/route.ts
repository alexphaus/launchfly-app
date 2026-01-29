/**
 * Referral Link Redirect Handler
 * 
 * THE VIRAL TRACKING SYSTEM
 * 
 * When a customer shares their referral link (e.g., https://app.launchfly.com/r/ABC123),
 * this route:
 * 1. Tracks that the link was clicked (link_clicked_at)
 * 2. Redirects to WhatsApp with a pre-filled message
 * 3. The message includes the referral code so we can track conversions
 * 
 * FLOW:
 * 1. Referrer gets link: https://app.launchfly.com/r/XYZ789
 * 2. Referrer shares with friend
 * 3. Friend clicks → lands here → tracked → redirected to WhatsApp
 * 4. Friend messages business with referral code embedded
 * 5. AI recognizes referral code → creates referral record → applies discount
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
);

const LAUNCHFLY_BOT_NUMBER = '13203627874'; // Without + for wa.me link

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ token: string }> }
) {
    const { token } = await params;
    
    console.log(`🔗 Referral link clicked: ${token}`);

    try {
        // 1. Look up the referral by token
        const { data: referral, error: fetchError } = await supabase
            .from('referrals')
            .select(`
                id,
                referral_code,
                referrer_id,
                business_id,
                referee_discount_percent,
                expires_at,
                status,
                customers!referrals_referrer_id_fkey(name, first_name),
                businesses!referrals_business_id_fkey(name, phone_number, whatsapp_number)
            `)
            .eq('referral_token', token.toUpperCase())
            .single();

        if (fetchError || !referral) {
            console.log(`❌ Invalid referral token: ${token}`);
            // Redirect to generic landing page or WhatsApp without code
            return NextResponse.redirect(
                `https://wa.me/${LAUNCHFLY_BOT_NUMBER}?text=Hi, I'm interested in your service!`
            );
        }

        // 2. Check if expired
        if (referral.expires_at && new Date(referral.expires_at) < new Date()) {
            console.log(`⏰ Referral token expired: ${token}`);
            return NextResponse.redirect(
                `https://wa.me/${LAUNCHFLY_BOT_NUMBER}?text=Hi, I was referred but the link seems expired. Can I still get a discount?`
            );
        }

        // 3. Track the click
        await supabase
            .from('referrals')
            .update({
                link_clicked_at: new Date().toISOString(),
                status: referral.status === 'pending' ? 'clicked' : referral.status,
            })
            .eq('id', referral.id);

        // 4. Build the WhatsApp message
        // @ts-ignore - Supabase join types
        const referrerName = referral.customers?.first_name || referral.customers?.name?.split(' ')[0] || 'a friend';
        // @ts-ignore
        const businessName = referral.businesses?.name || 'the business';
        const discount = referral.referee_discount_percent || 10;
        // @ts-ignore
        const businessPhone = referral.businesses?.whatsapp_number || referral.businesses?.phone_number || LAUNCHFLY_BOT_NUMBER;
        const cleanPhone = businessPhone.replace(/[^\d]/g, '');

        // Pre-filled message with embedded referral code
        const message = encodeURIComponent(
            `Hi! I was referred by ${referrerName} (code: ${referral.referral_code}). ` +
            `I'd like to book a service with my ${discount}% discount! 🎁`
        );

        const whatsappUrl = `https://wa.me/${cleanPhone}?text=${message}`;
        
        console.log(`   ✅ Redirecting to WhatsApp: ${cleanPhone}`);
        console.log(`   📝 Referral code: ${referral.referral_code}`);

        // 5. Redirect to WhatsApp
        return NextResponse.redirect(whatsappUrl);

    } catch (error: any) {
        console.error('❌ Referral redirect error:', error);
        // Fallback: redirect to generic WhatsApp
        return NextResponse.redirect(
            `https://wa.me/${LAUNCHFLY_BOT_NUMBER}?text=Hi, I'm interested in your service!`
        );
    }
}
