// src/app/api/customers/export/route.js
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get('businessId');

    if (!businessId) {
      return NextResponse.json({ error: 'businessId is required' }, { status: 400 });
    }

    // Fetch all prospects for the business
    const { data: prospects, error } = await supabase
      .from('prospects')
      .select('*')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Create CSV content
    const headers = ['Name', 'Email', 'Company', 'Status', 'Title', 'Industry', 'Source', 'Created At'];
    const rows = (prospects || []).map(p => [
      p.name || '',
      p.email || '',
      p.company || '',
      p.status || '',
      p.title || '',
      p.industry || '',
      p.source || '',
      new Date(p.created_at).toLocaleDateString()
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="customers-${businessId}-${Date.now()}.csv"`
      }
    });
  } catch (error) {
    console.error('Error exporting customers:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

