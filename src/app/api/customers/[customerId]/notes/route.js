// src/app/api/customers/[customerId]/notes/route.js
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Get notes for a customer
export async function GET(request, { params }) {
  try {
    const { customerId } = await params;

    const { data, error } = await supabase
      .from('customer_notes')
      .select('*')
      .eq('customer_email', customerId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ success: true, notes: data || [] });
  } catch (error) {
    console.error('Error fetching notes:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Add a note to a customer
export async function POST(request, { params }) {
  try {
    const { customerId } = await params;
    const body = await request.json();
    const { businessId, note } = body;

    if (!businessId || !note) {
      return NextResponse.json({ error: 'businessId and note are required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('customer_notes')
      .insert({
        business_id: businessId,
        customer_email: customerId,
        note: note,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, note: data });
  } catch (error) {
    console.error('Error adding note:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

