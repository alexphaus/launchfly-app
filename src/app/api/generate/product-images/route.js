// src/app/api/generate/product-images/route.js
import { generateProductImagesBatch } from '@/lib/product-image-generator';
import { generateAndStoreProductImagesBatch, migrateExpiredImages } from '@/lib/product-image-storage';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export async function POST(request) {
  try {
    const { businessId, productIds, generateAll = false, migrateExpired = false } = await request.json();
    
    console.log('🎨 Starting product image generation for business:', businessId);
    
    // Handle migration of expired images
    if (migrateExpired) {
      console.log('🔄 Migrating expired images...');
      const migrationResult = await migrateExpiredImages(businessId);
      return Response.json(migrationResult);
    }
    
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
    
    console.log('📸 Generating and storing images for', products.length, 'products');
    
    // Generate images with automatic storage
    const imageResults = await generateAndStoreProductImagesBatch(products, business.business_data, businessId);
    
    // Update products with generated image URLs
    const updatedProducts = products.map(product => {
      const productId = product.id || product.name.toLowerCase().replace(/\s+/g, '-');
      const result = imageResults.find(r => r.productId === productId);
      
      if (result && result.images.length > 0) {
        return {
          ...product,
          images: result.images,
          hasGeneratedImages: true,
          imageGeneratedAt: new Date().toISOString(),
          imagesPermanentlyStored: result.stored || false
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
    const storedCount = imageResults.filter(r => r.stored).length;
    
    console.log('✅ Image generation completed:', {
      total: imageResults.length,
      successful: successCount,
      failed: failureCount,
      stored: storedCount
    });
    
    return Response.json({
      success: true,
      message: `Generated images for ${successCount} products (${storedCount} stored permanently)`,
      results: imageResults,
      summary: {
        total: imageResults.length,
        successful: successCount,
        failed: failureCount,
        stored: storedCount
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
