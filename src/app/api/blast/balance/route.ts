// /api/blast/balance/route.ts
// Get blast credits balance for a business

import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
);

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get('businessId');

    if (!businessId) {
        return NextResponse.json({ error: 'Missing businessId' }, { status: 400 });
    }

    try {
        const { data: business, error } = await supabase
            .from('businesses')
            .select('blast_credits, blast_credits_used')
            .eq('id', businessId)
            .single();

        if (error || !business) {
            return NextResponse.json({ error: 'Business not found' }, { status: 404 });
        }

        // Get recent transactions
        const { data: transactions } = await supabase
            .from('blast_transactions')
            .select('*')
            .eq('business_id', businessId)
            .order('created_at', { ascending: false })
            .limit(10);

        return NextResponse.json({
            credits: business.blast_credits || 0,
            used: business.blast_credits_used || 0,
            costPerMessage: 5, // ₱5 per message
            transactions: transactions || []
        });

    } catch (error) {
        console.error('Balance fetch error:', error);
        return NextResponse.json({ error: 'Failed to fetch balance' }, { status: 500 });
    }
}
