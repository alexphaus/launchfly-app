// src/app/api/generate/product-images/route.js
import { generateProductImagesBatch } from '@/lib/product-image-generator';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export async function POST(request) {
  try {
    const { businessId, productIds, generateAll = false } = await request.json();
    
    console.log('🎨 Starting product image generation for business:', businessId);
    
    // Get business data
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', businessId)
      .single();
    
    if (businessError || !business) {
      return Response.json({ error: 'Business not found' }, { status: 404 });
    }
    
    // Get products to generate images for
    let products = business.business_data?.products || [];
    
    if (!generateAll && productIds) {
      products = products.filter(p => 
        productIds.includes(p.id || p.name.toLowerCase().replace(/\s+/g, '-'))
      );
    }
    
    if (products.length === 0) {
      return Response.json({ error: 'No products found to generate images for' }, { status: 400 });
    }
    
    console.log('📸 Generating images for', products.length, 'products');
    
    // Generate images for all products
    const imageResults = await generateProductImagesBatch(products, business.business_data);
    
    // Update products with generated image URLs
    const updatedProducts = products.map(product => {
      const productId = product.id || product.name.toLowerCase().replace(/\s+/g, '-');
      const result = imageResults.find(r => r.productId === productId);
      
      if (result && result.images.length > 0) {
        return {
          ...product,
          images: result.images,
          hasGeneratedImages: true,
          imageGeneratedAt: new Date().toISOString()
        };
      }
      
      return product;
    });
    
    // Update business data with new product images
    const updatedBusinessData = {
      ...business.business_data,
      products: updatedProducts
    };
    
    const { error: updateError } = await supabase
      .from('businesses')
      .update({ 
        business_data: updatedBusinessData,
        updated_at: new Date().toISOString()
      })
      .eq('id', businessId);
    
    if (updateError) {
      console.error('❌ Error updating business with generated images:', updateError);
      return Response.json({ error: 'Failed to save generated images' }, { status: 500 });
    }
    
    // Calculate success metrics
    const successCount = imageResults.filter(r => r.success).length;
    const failureCount = imageResults.length - successCount;
    
    console.log('✅ Image generation completed:', {
      total: imageResults.length,
      successful: successCount,
      failed: failureCount
    });
    
    return Response.json({
      success: true,
      message: `Generated images for ${successCount} products`,
      results: imageResults,
      summary: {
        total: imageResults.length,
        successful: successCount,
        failed: failureCount
      },
      updatedProducts
    });
    
  } catch (error) {
    console.error('❌ Error in product image generation:', error);
    return Response.json({ 
      error: 'Failed to generate product images',
      details: error.message 
    }, { status: 500 });
  }
}
