import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export async function GET(request, { params }) {
  try {
    const { sessionId } = params;
    
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    
    return Response.json(session);
  } catch (error) {
    console.error('Error retrieving session:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
