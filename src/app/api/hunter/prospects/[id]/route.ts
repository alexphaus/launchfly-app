import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// PATCH: Update prospect (status, preview_url, etc.)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const allowedFields = [
      'status',
      'owner_name',
      'website_url',
      'notes',
      'preview_url',
      'preview_business_id',
      'opener_sent_at',
      'replied_at',
      'preview_sent_at',
      'last_follow_up_at',
      'closed_at',
    ];

    // Filter to only allowed fields
    const updateData: Record<string, any> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    // Auto-set timestamps based on status changes
    if (body.status === 'opener_sent' && !body.opener_sent_at) {
      updateData.opener_sent_at = new Date().toISOString();
    }
    if (body.status === 'replied' && !body.replied_at) {
      updateData.replied_at = new Date().toISOString();
    }
    if (body.status === 'preview_sent' && !body.preview_sent_at) {
      updateData.preview_sent_at = new Date().toISOString();
    }
    if (body.status?.startsWith('follow_up') && !body.last_follow_up_at) {
      updateData.last_follow_up_at = new Date().toISOString();
    }
    if ((body.status === 'closed_won' || body.status === 'closed_lost') && !body.closed_at) {
      updateData.closed_at = new Date().toISOString();
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('hunter_prospects')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating prospect:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: 'Prospect not found' }, { status: 404 });
    }

    return NextResponse.json({ prospect: data, success: true });
  } catch (err: any) {
    console.error('Error in PATCH /api/hunter/prospects/[id]:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// GET: Get single prospect
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { data, error } = await supabase
      .from('hunter_prospects')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching prospect:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: 'Prospect not found' }, { status: 404 });
    }

    return NextResponse.json({ prospect: data });
  } catch (err: any) {
    console.error('Error in GET /api/hunter/prospects/[id]:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE: Delete prospect
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { error } = await supabase
      .from('hunter_prospects')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting prospect:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Error in DELETE /api/hunter/prospects/[id]:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
