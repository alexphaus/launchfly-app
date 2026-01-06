// /api/blast/topup/route.ts
// Top up blast credits (manual confirmation after GCash payment)

import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
);

export async function POST(request: NextRequest) {
    try {
        const { businessId, amount, type = 'topup', description } = await request.json();

        if (!businessId || !amount) {
            return NextResponse.json({ error: 'Missing businessId or amount' }, { status: 400 });
        }

        // Validate amount
        if (amount <= 0 || amount > 50000) {
            return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
        }

        // Get current balance
        const { data: business, error: fetchError } = await supabase
            .from('businesses')
            .select('blast_credits')
            .eq('id', businessId)
            .single();

        if (fetchError || !business) {
            return NextResponse.json({ error: 'Business not found' }, { status: 404 });
        }

        const currentCredits = business.blast_credits || 0;
        const newCredits = currentCredits + amount;

        // Update business credits
        const { error: updateError } = await supabase
            .from('businesses')
            .update({ blast_credits: newCredits })
            .eq('id', businessId);

        if (updateError) {
            throw updateError;
        }

        // Record transaction
        await supabase
            .from('blast_transactions')
            .insert({
                business_id: businessId,
                type: type, // 'topup', 'bonus', 'refund'
                amount: amount,
                description: description || `Top-up ₱${amount}`
            });

        console.log(`✅ Topped up ₱${amount} for business ${businessId}. New balance: ₱${newCredits}`);

        return NextResponse.json({
            success: true,
            previousBalance: currentCredits,
            addedAmount: amount,
            newBalance: newCredits
        });

    } catch (error) {
        console.error('Top-up error:', error);
        return NextResponse.json({ error: 'Failed to process top-up' }, { status: 500 });
    }
}
