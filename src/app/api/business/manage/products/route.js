// src/app/api/business/manage/products/route.js
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// GET - Fetch all products for a business
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get('businessId');

    if (!businessId) {
      return Response.json({ error: 'Business ID is required' }, { status: 400 });
    }

    // First check if products are in the dedicated products table
    const { data: productsTable, error: productsError } = await supabase
      .from('products')
      .select('*')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false });

    if (productsError) {
      console.error('Error fetching products from table:', productsError);
    }

    // Also get products from business_data for backward compatibility
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .select('business_data')
      .eq('id', businessId)
      .single();

    if (businessError) {
      return Response.json({ error: 'Business not found' }, { status: 404 });
    }

    // Combine products from both sources, prioritizing the products table
    const businessDataProducts = business.business_data?.products || [];
    const allProducts = [...(productsTable || []), ...businessDataProducts];

    // Remove duplicates based on name
    const uniqueProducts = allProducts.reduce((acc, product) => {
      const existing = acc.find(p => p.name === product.name);
      if (!existing) {
        acc.push(product);
      }
      return acc;
    }, []);

    return Response.json({
      success: true,
      products: uniqueProducts,
      source: {
        tableProducts: productsTable?.length || 0,
        businessDataProducts: businessDataProducts.length
      }
    });

  } catch (error) {
    console.error('Error in products GET:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create a new product
export async function POST(request) {
  try {
    const { businessId, product } = await request.json();

    if (!businessId || !product) {
      return Response.json({ error: 'Business ID and product data are required' }, { status: 400 });
    }

    // Validate required product fields
    if (!product.name || !product.price) {
      return Response.json({ error: 'Product name and price are required' }, { status: 400 });
    }

    // Insert into products table
    const { data: newProduct, error: insertError } = await supabase
      .from('products')
      .insert({
        business_id: businessId,
        name: product.name,
        description: product.description || '',
        price: parseFloat(product.price),
        compare_at_price: product.compare_at_price ? parseFloat(product.compare_at_price) : null,
        inventory_count: product.inventory_count || 999,
        image_url: product.image_url || null,
        status: product.status || 'active',
        metadata: product.metadata || {}
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error creating product:', insertError);
      return Response.json({ error: 'Failed to create product' }, { status: 500 });
    }

    // Also update business_data for backward compatibility
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .select('business_data')
      .eq('id', businessId)
      .single();

    if (!businessError && business) {
      const updatedProducts = [...(business.business_data?.products || []), {
        id: newProduct.id,
        name: newProduct.name,
        description: newProduct.description,
        price: `$${newProduct.price}`,
        originalPrice: newProduct.compare_at_price ? `$${newProduct.compare_at_price}` : null,
        image: newProduct.image_url
      }];

      await supabase
        .from('businesses')
        .update({
          business_data: {
            ...business.business_data,
            products: updatedProducts
          }
        })
        .eq('id', businessId);
    }

    return Response.json({
      success: true,
      message: 'Product created successfully',
      product: newProduct
    });

  } catch (error) {
    console.error('Error in products POST:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT - Update an existing product
export async function PUT(request) {
  try {
    const { businessId, productId, product } = await request.json();

    if (!businessId || !productId || !product) {
      return Response.json({ error: 'Business ID, product ID, and product data are required' }, { status: 400 });
    }

    // Update in products table
    const { data: updatedProduct, error: updateError } = await supabase
      .from('products')
      .update({
        name: product.name,
        description: product.description || '',
        price: parseFloat(product.price),
        compare_at_price: product.compare_at_price ? parseFloat(product.compare_at_price) : null,
        inventory_count: product.inventory_count || 999,
        image_url: product.image_url || null,
        status: product.status || 'active',
        metadata: product.metadata || {},
        updated_at: new Date().toISOString()
      })
      .eq('id', productId)
      .eq('business_id', businessId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating product:', updateError);
      return Response.json({ error: 'Failed to update product' }, { status: 500 });
    }

    // Also update business_data for backward compatibility
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .select('business_data')
      .eq('id', businessId)
      .single();

    if (!businessError && business) {
      const products = business.business_data?.products || [];
      const updatedProducts = products.map(p => 
        p.id === productId || p.name === updatedProduct.name ? {
          ...p,
          id: updatedProduct.id,
          name: updatedProduct.name,
          description: updatedProduct.description,
          price: `$${updatedProduct.price}`,
          originalPrice: updatedProduct.compare_at_price ? `$${updatedProduct.compare_at_price}` : null,
          image: updatedProduct.image_url
        } : p
      );

      await supabase
        .from('businesses')
        .update({
          business_data: {
            ...business.business_data,
            products: updatedProducts
          }
        })
        .eq('id', businessId);
    }

    return Response.json({
      success: true,
      message: 'Product updated successfully',
      product: updatedProduct
    });

  } catch (error) {
    console.error('Error in products PUT:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Remove a product
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get('businessId');
    const productId = searchParams.get('productId');

    if (!businessId || !productId) {
      return Response.json({ error: 'Business ID and product ID are required' }, { status: 400 });
    }

    // Delete from products table
    const { error: deleteError } = await supabase
      .from('products')
      .delete()
      .eq('id', productId)
      .eq('business_id', businessId);

    if (deleteError) {
      console.error('Error deleting product:', deleteError);
      return Response.json({ error: 'Failed to delete product' }, { status: 500 });
    }

    // Also remove from business_data for backward compatibility
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .select('business_data')
      .eq('id', businessId)
      .single();

    if (!businessError && business) {
      const products = business.business_data?.products || [];
      const updatedProducts = products.filter(p => p.id !== productId);

      await supabase
        .from('businesses')
        .update({
          business_data: {
            ...business.business_data,
            products: updatedProducts
          }
        })
        .eq('id', businessId);
    }

    return Response.json({
      success: true,
      message: 'Product deleted successfully'
    });

  } catch (error) {
    console.error('Error in products DELETE:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
