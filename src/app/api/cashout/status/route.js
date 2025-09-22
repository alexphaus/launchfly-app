// src/app/api/cashout/status/route.js
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get('businessId');
    const cashoutId = searchParams.get('cashoutId');

    if (!businessId) {
      return Response.json({ error: 'Business ID required' }, { status: 400 });
    }

    let query = supabase
      .from('cashout_transactions')
      .select('*')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false });

    // If specific cashout ID requested, filter by it
    if (cashoutId) {
      query = query.eq('id', cashoutId).single();
    } else {
      // Otherwise return recent cashouts
      query = query.limit(10);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching cashout status:', error);
      return Response.json({ error: 'Failed to fetch cashout status' }, { status: 500 });
    }

    // Also get current available balance
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .select('available_balance, total_revenue')
      .eq('id', businessId)
      .single();

    if (businessError) {
      console.error('Error fetching business:', businessError);
      return Response.json({ error: 'Business not found' }, { status: 404 });
    }

    return Response.json({
      success: true,
      cashouts: cashoutId ? [data] : data,
      currentBalance: {
        available: parseFloat(business.available_balance || 0),
        total: parseFloat(business.total_revenue || 0)
      }
    });

  } catch (error) {
    console.error('Cashout status error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Update cashout status (for webhook processing)
export async function POST(request) {
  try {
    const { cashoutId, status, transferId, failureReason } = await request.json();

    if (!cashoutId || !status) {
      return Response.json({ error: 'Invalid request parameters' }, { status: 400 });
    }

    const updateData = {
      status: status,
      updated_at: new Date().toISOString()
    };

    if (status === 'completed') {
      updateData.completed_at = new Date().toISOString();
    }

    if (status === 'failed' && failureReason) {
      updateData.failure_reason = failureReason;
    }

    if (transferId) {
      updateData.processor_transaction_id = transferId;
    }

    const { data, error } = await supabase
      .from('cashout_transactions')
      .update(updateData)
      .eq('id', cashoutId)
      .select()
      .single();

    if (error) {
      console.error('Error updating cashout status:', error);
      return Response.json({ error: 'Failed to update cashout status' }, { status: 500 });
    }

    // Log activity update
    if (data.business_id) {
      const activityMessage = status === 'completed' 
        ? `Cashout completed: $${data.amount} transferred to your bank`
        : status === 'failed'
        ? `Cashout failed: $${data.amount} - ${failureReason || 'Unknown error'}`
        : `Cashout status updated: ${status}`;

      await supabase
        .from('ai_activities')
        .insert({
          business_id: data.business_id,
          type: `cashout_${status}`,
          icon: status === 'completed' ? '✅' : status === 'failed' ? '❌' : '⏳',
          message: activityMessage,
          details: status === 'failed' ? 'Amount has been returned to your available balance' : null,
          metadata: {
            cashout_id: cashoutId,
            amount: data.amount,
            status: status
          }
        });

      // If failed, return money to available balance
      if (status === 'failed') {
        const { data: business } = await supabase
          .from('businesses')
          .select('available_balance')
          .eq('id', data.business_id)
          .single();

        if (business) {
          const newBalance = parseFloat(business.available_balance || 0) + parseFloat(data.amount);
          await supabase
            .from('businesses')
            .update({ available_balance: newBalance })
            .eq('id', data.business_id);
        }
      }
    }

    return Response.json({
      success: true,
      cashout: data
    });

  } catch (error) {
    console.error('Cashout status update error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
