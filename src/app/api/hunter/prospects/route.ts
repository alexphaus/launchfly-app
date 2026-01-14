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

// GET: List prospects with optional filters
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabase();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const serviceType = searchParams.get('service_type');
    const query = searchParams.get('q');
    const limit = parseInt(searchParams.get('limit') || (query ? '100' : '50')); // Increased limit when searching

    let supabaseQuery = supabase
      .from('hunter_prospects')
      .select('*')
      .order('created_at', { ascending: false });

    if (status && status !== 'all') {
      supabaseQuery = supabaseQuery.eq('status', status);
    }

    if (serviceType && serviceType !== 'all') {
      supabaseQuery = supabaseQuery.eq('service_type', serviceType);
    }

    if (query) {
      supabaseQuery = supabaseQuery.or(`business_name.ilike.%${query}%,area.ilike.%${query}%,whatsapp_number.ilike.%${query}%,owner_name.ilike.%${query}%`);
    }

    // Apply limit at the end
    supabaseQuery = supabaseQuery.limit(limit);

    const { data, error } = await supabaseQuery;

    if (error) {
      console.error('Error fetching prospects:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // No cache for fresh pipeline data
    return NextResponse.json(
      { prospects: data },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        }
      }
    );
  } catch (err: any) {
    console.error('Error in GET /api/hunter/prospects:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST: Create new prospect
export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabase();
    const body = await request.json();

    const {
      business_name,
      service_type,
      area,
      whatsapp_number,
      email,
      owner_name,
      website_url,
      source,
      pain_signals,
      notes,
      raw_context, // Original Facebook/context data for richer preview generation later
    } = body;

    // Validate required fields
    if (!business_name || !service_type || !area || !whatsapp_number) {
      return NextResponse.json(
        { error: 'Missing required fields: business_name, service_type, area, whatsapp_number' },
        { status: 400 }
      );
    }

    // Clean phone number (ensure it has country code)
    let cleanPhone = whatsapp_number.replace(/[^0-9+]/g, '');
    if (!cleanPhone.startsWith('+') && !cleanPhone.startsWith('60')) {
      // Assume Malaysia if no country code
      cleanPhone = '60' + cleanPhone.replace(/^0/, '');
    }
    if (!cleanPhone.startsWith('+')) {
      cleanPhone = '+' + cleanPhone;
    }

    // Check for duplicate (same phone number)
    const { data: existing } = await supabase
      .from('hunter_prospects')
      .select('id, business_name')
      .eq('whatsapp_number', cleanPhone)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: `This phone number is already logged for: ${existing.business_name}` },
        { status: 409 }
      );
    }

    // Insert prospect
    const { data, error } = await supabase
      .from('hunter_prospects')
      .insert({
        business_name,
        service_type,
        area,
        whatsapp_number: cleanPhone,
        email: email || null,
        owner_name: owner_name || null,
        website_url: website_url || null,
        source: source || 'manual',
        pain_signals: pain_signals || [],
        notes: notes || null,
        raw_context: raw_context || null, // Preserve original Facebook context
        status: 'new',
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating prospect:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ prospect: data, success: true });
  } catch (err: any) {
    console.error('Error in POST /api/hunter/prospects:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
