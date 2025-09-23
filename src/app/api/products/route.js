// src/app/api/products/route.js
import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get('businessId');

    if (!businessId) {
      return NextResponse.json({ error: 'Business ID is required' }, { status: 400 });
    }

    const cookieStore = await cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

    // Get products from products table
    const { data: products, error } = await supabase
      .from('products')
      .select('*')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });
    }

    return NextResponse.json({ products: products || [] });

  } catch (error) {
    console.error('Products GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { 
      business_id, 
      name, 
      description, 
      price, 
      compare_at_price, 
      inventory_count, 
      image_url, 
      category, 
      features, 
      status 
    } = body;

    // Validation
    if (!business_id || !name || !description || !price) {
      return NextResponse.json({ 
        error: 'Business ID, name, description, and price are required' 
      }, { status: 400 });
    }

    if (price <= 0) {
      return NextResponse.json({ error: 'Price must be greater than 0' }, { status: 400 });
    }

    const cookieStore = await cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

    // Create product
    const { data: product, error } = await supabase
      .from('products')
      .insert({
        business_id,
        name: name.trim(),
        description: description.trim(),
        price: parseFloat(price),
        compare_at_price: compare_at_price ? parseFloat(compare_at_price) : null,
        inventory_count: inventory_count ? parseInt(inventory_count) : 999,
        image_url: image_url?.trim() || null,
        status: status || 'active',
        metadata: {
          category: category?.trim() || null,
          features: features?.filter(f => f?.trim()) || []
        }
      })
      .select()
      .single();

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json({ error: 'Failed to create product' }, { status: 500 });
    }

    // Also update business_data to keep products in sync
    try {
      const { data: business } = await supabase
        .from('businesses')
        .select('business_data')
        .eq('id', business_id)
        .single();

      if (business?.business_data) {
        const businessData = business.business_data;
        if (!businessData.products) businessData.products = [];
        
        // Add new product to business_data
        businessData.products.push({
          id: product.id,
          name: product.name,
          description: product.description,
          price: product.price,
          compare_at_price: product.compare_at_price,
          inventory_count: product.inventory_count,
          image_url: product.image_url,
          category: product.metadata?.category,
          features: product.metadata?.features || [],
          status: product.status
        });

        await supabase
          .from('businesses')
          .update({ 
            business_data: businessData,
            updated_at: new Date().toISOString()
          })
          .eq('id', business_id);
      }
    } catch (syncError) {
      console.warn('Failed to sync with business_data:', syncError);
    }

    return NextResponse.json({ 
      product: {
        ...product,
        category: product.metadata?.category,
        features: product.metadata?.features || []
      }
    });

  } catch (error) {
    console.error('Products POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
