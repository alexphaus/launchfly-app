import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export async function GET(request, { params }) {
  try {
    const { sessionId } = params;
    
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    
    return Response.json({
      id: session.id,
      payment_status: session.payment_status,
      amount_total: session.amount_total,
      currency: session.currency,
      customer_details: session.customer_details,
      metadata: session.metadata
    });
    
  } catch (error) {
    console.error('Error retrieving Stripe session:', error);
    return Response.json(
      { error: 'Failed to retrieve session' }, 
      { status: 500 }
    );
  }
}
