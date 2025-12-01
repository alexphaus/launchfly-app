import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export async function POST(request) {
  try {
    const { businessId, updates } = await request.json();

    if (!businessId || !updates) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Sanitize updates to prevent updating protected fields
    const allowedUpdates = ['owner_name', 'email', 'subdomain', 'name', 'phone_number', 'business_data'];
    const sanitizedUpdates = {};
    for (const key of Object.keys(updates)) {
      if (allowedUpdates.includes(key)) {
        sanitizedUpdates[key] = updates[key];
      }
    }

    if (Object.keys(sanitizedUpdates).length === 0) {
        return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }
    
    // If subdomain is being updated, we should double-check for availability server-side
    if (sanitizedUpdates.subdomain) {
      const { data, error } = await supabase
        .from('businesses')
        .select('id')
        .eq('subdomain', sanitizedUpdates.subdomain)
        .not('id', 'eq', businessId)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        return NextResponse.json({ error: 'Subdomain is already taken' }, { status: 409 });
      }
    }


    const { error: updateError } = await supabase
      .from('businesses')
      .update(sanitizedUpdates)
      .eq('id', businessId);

    if (updateError) {
      console.error('Error updating business:', updateError);
      return NextResponse.json({ error: 'Failed to update business' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Business updated successfully' });

  } catch (error) {
    console.error('Error in /api/business/update:', error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}
