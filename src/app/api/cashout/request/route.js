// src/app/api/cashout/request/route.js
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export async function POST(request) {
  try {
    const { businessId, amount } = await request.json();

    if (!businessId || !amount || amount <= 0) {
      return Response.json({ error: 'Invalid request parameters' }, { status: 400 });
    }

    console.log('Processing cashout request:', { businessId, amount });

    // Get business data
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', businessId)
      .single();

    if (businessError || !business) {
      console.error('Business not found:', businessError);
      return Response.json({ error: 'Business not found' }, { status: 404 });
    }

    // Check available balance
    const availableBalance = parseFloat(business.available_balance || 0);
    if (availableBalance < amount) {
      return Response.json({ 
        error: 'Insufficient funds', 
        available: availableBalance,
        requested: amount 
      }, { status: 400 });
    }

    // Check if business has Stripe Connect account
    if (!business.stripe_connect_account_id) {
      return Response.json({ 
        error: 'Bank account not connected. Please connect your bank account first.',
        action: 'connect_bank'
      }, { status: 400 });
    }

    // Verify Connect account status with Stripe
    try {
      const connectAccount = await stripe.accounts.retrieve(business.stripe_connect_account_id);
      
      // Check if account is fully onboarded and can receive payouts
      if (!connectAccount.payouts_enabled) {
        return Response.json({ 
          error: 'Bank account setup incomplete. Please complete your bank account verification.',
          action: 'complete_onboarding',
          connect_account_id: business.stripe_connect_account_id
        }, { status: 400 });
      }

      // Check if account has any restrictions
      if (connectAccount.requirements?.disabled_reason) {
        return Response.json({ 
          error: `Account restricted: ${connectAccount.requirements.disabled_reason}. Please contact support.`,
          action: 'contact_support'
        }, { status: 400 });
      }

      // Check for pending requirements
      const currentlyDue = connectAccount.requirements?.currently_due || [];
      if (currentlyDue.length > 0) {
        return Response.json({ 
          error: 'Additional information required to complete bank setup.',
          action: 'complete_requirements',
          requirements: currentlyDue
        }, { status: 400 });
      }

    } catch (stripeError) {
      console.error('Error verifying Connect account:', stripeError);
      return Response.json({ 
        error: 'Unable to verify bank account status. Please try again.',
        action: 'retry'
      }, { status: 500 });
    }

    // Create cashout transaction record
    const { data: cashoutTransaction, error: transactionError } = await supabase
      .from('cashout_transactions')
      .insert({
        business_id: businessId,
        amount: amount,
        status: 'pending',
        processor: 'stripe',
        payment_method_details: {
          stripe_connect_account_id: business.stripe_connect_account_id
        }
      })
      .select()
      .single();

    if (transactionError) {
      console.error('Error creating cashout transaction:', transactionError);
      return Response.json({ error: 'Failed to create cashout transaction' }, { status: 500 });
    }

    try {
      // Create Stripe transfer to connected account
      const transfer = await stripe.transfers.create({
        amount: Math.round(amount * 100), // Convert to cents
        currency: 'usd',
        destination: business.stripe_connect_account_id,
        description: `Launchfly Cashout - ${business.name}`,
        metadata: {
          business_id: businessId,
          cashout_transaction_id: cashoutTransaction.id,
          business_name: business.name
        }
      });

      // Update cashout transaction with Stripe transfer ID
      await supabase
        .from('cashout_transactions')
        .update({
          processor_transaction_id: transfer.id,
          status: 'processing',
          processed_at: new Date().toISOString()
        })
        .eq('id', cashoutTransaction.id);

      // Deduct amount from available_balance
      const newAvailableBalance = availableBalance - amount;
      await supabase
        .from('businesses')
        .update({
          available_balance: newAvailableBalance
        })
        .eq('id', businessId);

      // Log activity
      await supabase
        .from('ai_activities')
        .insert({
          business_id: businessId,
          type: 'cashout_requested',
          icon: '💰',
          message: `Cashout initiated: $${amount.toFixed(2)}`,
          details: `Funds will be transferred to your bank account within 1-2 business days`,
          metadata: {
            amount: amount,
            transfer_id: transfer.id,
            remaining_balance: newAvailableBalance
          }
        });

      console.log('✅ Cashout request processed successfully:', transfer.id);

      return Response.json({
        success: true,
        cashoutId: cashoutTransaction.id,
        transferId: transfer.id,
        amount: amount,
        newAvailableBalance: newAvailableBalance,
        message: 'Cashout initiated successfully. Funds will be transferred within 1-2 business days.'
      });

    } catch (stripeError) {
      console.error('Stripe transfer failed:', stripeError);
      
      // Update transaction status to failed
      await supabase
        .from('cashout_transactions')
        .update({
          status: 'failed',
          failure_reason: stripeError.message,
          processed_at: new Date().toISOString()
        })
        .eq('id', cashoutTransaction.id);

      return Response.json({ 
        error: 'Payment processing failed', 
        details: stripeError.message 
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Cashout request error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
