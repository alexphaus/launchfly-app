import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export async function POST(request) {
  try {
    const { productId, businessId, customerEmail, customerName, subdomain } = await request.json();
    
    console.log('Checkout request:', { productId, businessId, customerEmail, customerName, subdomain });
    
    // Handle mock business (for testing with axceleratebusiness)
    if (!businessId || businessId === 'undefined' || businessId === null) {
      console.log('No businessId provided, handling as mock business');
      
      // For mock businesses, we need to get the product price from the subdomain
      // Since we don't have access to the full business data here, we'll use a default price
      // or extract it from the productId if it contains price info
      let productName = 'Professional Service';
      let productPrice = 29700; // Default $297.00
      
      if (productId === 'mock_product_1') {
        productName = 'Business Acceleration Package';
        productPrice = 29700; // $297.00
      } else if (productId === 'mock_product_2') {
        productName = 'Digital Transformation Suite';
        productPrice = 49700; // $497.00
      }
      
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: productName,
                description: 'Professional service from ' + (subdomain || 'our business'),
              },
              unit_amount: productPrice,
            },
            quantity: 1,
          },
        ],
        mode: 'payment',
        success_url: `${process.env.NEXT_PUBLIC_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}&business=${subdomain}`,
        cancel_url: `${process.env.NEXT_PUBLIC_URL}/sites/${subdomain}` || `http://localhost:3008/sites/${subdomain}`,
        customer_email: customerEmail,
        billing_address_collection: 'required',
        metadata: {
          businessId: 'mock_business',
          productId: productId,
          customerName: customerName || '',
          subdomain: subdomain
        },
      });
      
      return Response.json({ 
        sessionId: session.id,
        url: session.url 
      });
    }
    
    // Get business data to fetch product details
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', businessId)
      .single();
    
    if (businessError || !business) {
      console.error('Business not found:', businessError);
      return Response.json({ error: 'Business not found' }, { status: 404 });
    }
    
    // Find the specific product from business data
    const businessData = business.business_data;
    const product = businessData?.products?.find(p => p.id === productId);
    
    if (!product) {
      console.error('Product not found:', { productId, availableProducts: businessData?.products?.map(p => p.id) });
      return Response.json({ error: 'Product not found' }, { status: 404 });
    }
    
    // Convert price to cents (Stripe expects amount in cents)
    const unitAmount = Math.round(parseFloat(product.price.replace(/[^0-9.-]+/g, '')) * 100);
    
    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: product.name,
              description: product.description,
              images: product.image ? [product.image] : [],
            },
            unit_amount: unitAmount,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${process.env.NEXT_PUBLIC_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}&business=${subdomain}`,
      cancel_url: `${process.env.NEXT_PUBLIC_WEBSITE_BASE_URL}/${subdomain}`,
      customer_email: customerEmail,
      billing_address_collection: 'required', // Add this for better fraud protection
      metadata: {
        businessId: businessId,
        productId: productId,
        customerName: customerName || '',
        subdomain: subdomain
      },
    });
    
    return Response.json({ 
      sessionId: session.id,
      url: session.url 
    });
    
  } catch (error) {
    console.error('Stripe checkout session creation error:', error);
    return Response.json(
      { error: 'Failed to create checkout session: ' + error.message }, 
      { status: 500 }
    );
  }
}
