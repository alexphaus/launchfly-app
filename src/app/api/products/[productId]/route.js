// src/app/api/products/[productId]/route.js
import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function PUT(request, { params }) {
  try {
    const { productId } = await params;
    const body = await request.json();
    const { 
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
    if (!name || !description || !price) {
      return NextResponse.json({ 
        error: 'Name, description, and price are required' 
      }, { status: 400 });
    }

    if (price <= 0) {
      return NextResponse.json({ error: 'Price must be greater than 0' }, { status: 400 });
    }

    const cookieStore = await cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

    // Update product
    const { data: product, error } = await supabase
      .from('products')
      .update({
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
        },
        updated_at: new Date().toISOString()
      })
      .eq('id', productId)
      .select()
      .single();

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json({ error: 'Failed to update product' }, { status: 500 });
    }

    // Also update business_data to keep products in sync
    try {
      const { data: business } = await supabase
        .from('businesses')
        .select('business_data')
        .eq('id', product.business_id)
        .single();

      if (business?.business_data) {
        const businessData = business.business_data;
        if (businessData.products) {
          // Find and update the product in business_data
          const productIndex = businessData.products.findIndex(p => p.id === productId);
          if (productIndex !== -1) {
            businessData.products[productIndex] = {
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
            };

            await supabase
              .from('businesses')
              .update({ 
                business_data: businessData,
                updated_at: new Date().toISOString()
              })
              .eq('id', product.business_id);
          }
        }
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
    console.error('Products PUT error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { productId } = await params;

    const cookieStore = await cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

    // Get product first to get business_id
    const { data: product } = await supabase
      .from('products')
      .select('business_id')
      .eq('id', productId)
      .single();

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    // Delete product
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', productId);

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json({ error: 'Failed to delete product' }, { status: 500 });
    }

    // Also remove from business_data to keep products in sync
    try {
      const { data: business } = await supabase
        .from('businesses')
        .select('business_data')
        .eq('id', product.business_id)
        .single();

      if (business?.business_data?.products) {
        const businessData = business.business_data;
        businessData.products = businessData.products.filter(p => p.id !== productId);

        await supabase
          .from('businesses')
          .update({ 
            business_data: businessData,
            updated_at: new Date().toISOString()
          })
          .eq('id', product.business_id);
      }
    } catch (syncError) {
      console.warn('Failed to sync with business_data:', syncError);
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Products DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
