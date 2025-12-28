import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET: List prospects with optional filters
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const serviceType = searchParams.get('service_type');
    const limit = parseInt(searchParams.get('limit') || '50'); // Reduced default for faster initial load

    let query = supabase
      .from('hunter_prospects')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    if (serviceType && serviceType !== 'all') {
      query = query.eq('service_type', serviceType);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching prospects:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Add cache headers for better performance
    return NextResponse.json(
      { prospects: data },
      { 
        headers: { 
          'Cache-Control': 'private, max-age=10, stale-while-revalidate=30' 
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
    const body = await request.json();

    const {
      business_name,
      service_type,
      area,
      whatsapp_number,
      owner_name,
      website_url,
      source,
      pain_signals,
      notes,
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
        owner_name: owner_name || null,
        website_url: website_url || null,
        source: source || 'manual',
        pain_signals: pain_signals || [],
        notes: notes || null,
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
