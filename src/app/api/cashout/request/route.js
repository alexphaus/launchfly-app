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
    const { businessId, amount, payoutSpeed = 'standard', instantFee = 0 } = await request.json();

    if (!businessId || !amount || amount <= 0) {
      return Response.json({ error: 'Invalid request parameters' }, { status: 400 });
    }

    console.log('Processing cashout request:', { businessId, amount, payoutSpeed, instantFee });

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

    // Check available balance (for instant, we need to check against the full amount including fee)
    const availableBalance = parseFloat(business.available_balance || 0);
    const totalRequired = payoutSpeed === 'instant' ? amount + instantFee : amount;
    
    if (availableBalance < totalRequired) {
      return Response.json({ 
        error: 'Insufficient funds', 
        available: availableBalance,
        requested: totalRequired,
        breakdown: payoutSpeed === 'instant' ? {
          payout: amount,
          fee: instantFee,
          total: totalRequired
        } : null
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
          stripe_connect_account_id: business.stripe_connect_account_id,
          payout_speed: payoutSpeed,
          instant_fee: instantFee,
          net_amount: amount
        }
      })
      .select()
      .single();

    if (transactionError) {
      console.error('Error creating cashout transaction:', transactionError);
      return Response.json({ error: 'Failed to create cashout transaction' }, { status: 500 });
    }

    try {
      let transfer, payout;
      
      if (payoutSpeed === 'instant') {
        // For instant payouts, we first transfer to the Connect account, then create an instant payout
        transfer = await stripe.transfers.create({
          amount: Math.round(amount * 100), // Convert to cents (net amount)
          currency: 'usd',
          destination: business.stripe_connect_account_id,
          description: `Launchfly Instant Cashout - ${business.name}`,
          metadata: {
            business_id: businessId,
            cashout_transaction_id: cashoutTransaction.id,
            business_name: business.name,
            payout_speed: 'instant'
          }
        });

        // Then create instant payout from the Connect account
        payout = await stripe.payouts.create({
          amount: Math.round(amount * 100), // Net amount to user
          currency: 'usd',
          method: 'instant',
          description: `Instant payout - ${business.name}`,
          metadata: {
            business_id: businessId,
            cashout_transaction_id: cashoutTransaction.id,
            transfer_id: transfer.id
          }
        }, {
          stripeAccount: business.stripe_connect_account_id
        });
        
        console.log('✅ Instant payout created:', payout.id);
      } else {
        // Standard transfer - Stripe handles the payout timing automatically
        transfer = await stripe.transfers.create({
          amount: Math.round(amount * 100), // Convert to cents
          currency: 'usd',
          destination: business.stripe_connect_account_id,
          description: `Launchfly Standard Cashout - ${business.name}`,
          metadata: {
            business_id: businessId,
            cashout_transaction_id: cashoutTransaction.id,
            business_name: business.name,
            payout_speed: 'standard'
          }
        });
      }

      // Update cashout transaction with Stripe IDs
      const updateData = {
        processor_transaction_id: transfer.id,
        status: payoutSpeed === 'instant' ? 'completed' : 'processing',
        processed_at: new Date().toISOString()
      };
      
      if (payout) {
        updateData.payment_method_details = {
          ...cashoutTransaction.payment_method_details,
          payout_id: payout.id,
          payout_method: 'instant'
        };
        updateData.completed_at = new Date().toISOString();
      }

      await supabase
        .from('cashout_transactions')
        .update(updateData)
        .eq('id', cashoutTransaction.id);

      // Deduct total amount (including fee for instant) from available_balance
      const newAvailableBalance = availableBalance - totalRequired;
      await supabase
        .from('businesses')
        .update({
          available_balance: newAvailableBalance
        })
        .eq('id', businessId);

      // Log activity
      const activityMessage = payoutSpeed === 'instant' 
        ? `Instant cashout completed: $${amount.toFixed(2)}`
        : `Cashout initiated: $${amount.toFixed(2)}`;
      
      const activityDetails = payoutSpeed === 'instant'
        ? `Funds transferred instantly to your bank account (Fee: $${instantFee.toFixed(2)})`
        : `Funds will be transferred to your bank account within 1-2 business days`;

      await supabase
        .from('ai_activities')
        .insert({
          business_id: businessId,
          type: payoutSpeed === 'instant' ? 'instant_cashout_completed' : 'cashout_requested',
          icon: payoutSpeed === 'instant' ? '⚡' : '💰',
          message: activityMessage,
          details: activityDetails,
          metadata: {
            amount: amount,
            instant_fee: instantFee,
            net_amount: amount,
            payout_speed: payoutSpeed,
            transfer_id: transfer.id,
            payout_id: payout?.id,
            remaining_balance: newAvailableBalance
          }
        });

      console.log('✅ Cashout request processed successfully:', transfer.id);

      const successMessage = payoutSpeed === 'instant'
        ? `Instant cashout completed! $${amount.toFixed(2)} has been transferred to your bank account.`
        : `Cashout initiated successfully. $${amount.toFixed(2)} will be transferred within 1-2 business days.`;

      return Response.json({
        success: true,
        cashoutId: cashoutTransaction.id,
        transferId: transfer.id,
        payoutId: payout?.id,
        amount: amount,
        instantFee: instantFee,
        netAmount: amount,
        payoutSpeed: payoutSpeed,
        newAvailableBalance: newAvailableBalance,
        message: successMessage
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
