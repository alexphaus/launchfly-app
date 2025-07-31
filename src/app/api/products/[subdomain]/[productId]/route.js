import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export async function GET(request, { params }) {
  try {
    const { subdomain, productId } = params;

    // Get business data
    const { data: business, error } = await supabase
      .from('businesses')
      .select('*')
      .eq('subdomain', subdomain)
      .eq('status', 'ready')
      .single();

    if (error || !business) {
      return Response.json({ error: 'Business not found' }, { status: 404 });
    }

    // Find the specific product
    const products = business.business_data?.products || [];
    const product = products.find(
      p => p.id === productId || p.name.toLowerCase().replace(/\s+/g, '-') === productId
    );

    if (!product) {
      // Try index-based lookup as fallback
      const productIndex = parseInt(productId);
      if (!isNaN(productIndex) && products[productIndex]) {
        const foundProduct = products[productIndex];
        return Response.json({
          product: foundProduct,
          business: {
            id: business.id,
            name: business.name,
            subdomain: business.subdomain,
            theme: business.business_data?.theme
          }
        });
      }
      
      return Response.json({ error: 'Product not found' }, { status: 404 });
    }

    return Response.json({
      product,
      business: {
        id: business.id,
        name: business.name,
        subdomain: business.subdomain,
        theme: business.business_data?.theme
      }
    });

  } catch (error) {
    console.error('Error fetching product:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
