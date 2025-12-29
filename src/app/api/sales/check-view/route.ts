import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabaseInstance: SupabaseClient | null = null;

function getSupabase() {
    if (!supabaseInstance) {
        supabaseInstance = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );
    }
    return supabaseInstance;
}

export async function GET(request: NextRequest) {
    try {
        const supabase = getSupabase();
        const { searchParams } = new URL(request.url);
        const business_id = searchParams.get('business_id');

        if (!business_id) {
            return NextResponse.json({ error: 'Missing business_id' }, { status: 400 });
        }

        // Check ai_activities table for website_visit events for this business
        const { count, error } = await supabase
            .from('ai_activities')
            .select('*', { count: 'exact', head: true })
            .eq('business_id', business_id)
            .eq('type', 'website_visit');

        if (error) {
            console.error('Error checking preview views:', error);
            return NextResponse.json({ viewed: false });
        }

        return NextResponse.json({
            viewed: (count || 0) > 0,
            viewCount: count || 0
        });
    } catch (err: any) {
        console.error('Error in GET /api/sales/check-view:', err);
        return NextResponse.json({ viewed: false });
    }
}
