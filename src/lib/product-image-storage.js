// Enhanced product image generator with persistent storage
import { createClient } from '@supabase/supabase-js';
import { generateProductImages } from './product-image-generator.js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/**
 * Download image from URL and upload to Supabase Storage
 */
async function downloadAndStoreImage(imageUrl, businessId, productId, imageIndex = 0) {
  try {
    console.log('📥 Downloading image from DALL-E...');
    
    // Download the image from DALL-E
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.status}`);
    }
    
    const imageBuffer = await response.arrayBuffer();
    const fileName = `${businessId}/${productId}/image-${imageIndex}-${Date.now()}.png`;
    
    console.log('☁️ Uploading to Supabase Storage...');
    
    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from('product-images')
      .upload(fileName, imageBuffer, {
        contentType: 'image/png',
        cacheControl: '3600',
        upsert: false
      });
    
    if (error) {
      console.error('Storage upload error:', error);
      throw error;
    }
    
    // Get the public URL
    const { data: { publicUrl } } = supabase.storage
      .from('product-images')
      .getPublicUrl(fileName);
    
    console.log('✅ Image stored successfully:', publicUrl);
    
    return publicUrl;
    
  } catch (error) {
    console.error('❌ Error storing image:', error);
    // Return original URL as fallback (even if it will expire)
    return imageUrl;
  }
}

/**
 * Enhanced image generation with automatic storage
 */
export async function generateAndStoreProductImages(product, businessData, businessId) {
  try {
    console.log('🎨 Generating images for product:', product.name);
    
    // Generate images using existing function
    const tempImageUrls = await generateProductImages(product, businessData);
    
    // Store each image permanently
    const productId = product.id || product.name.toLowerCase().replace(/\s+/g, '-');
    const permanentUrls = [];
    
    for (let i = 0; i < tempImageUrls.length; i++) {
      const tempUrl = tempImageUrls[i];
      if (tempUrl && tempUrl.startsWith('https://oaidalleapiprodscus.blob.core.windows.net')) {
        // This is a DALL-E URL that will expire - store it permanently
        const permanentUrl = await downloadAndStoreImage(tempUrl, businessId, productId, i);
        permanentUrls.push(permanentUrl);
      } else {
        // This is already a permanent URL or placeholder
        permanentUrls.push(tempUrl);
      }
      
      // Add small delay between downloads to avoid rate limits
      if (i < tempImageUrls.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    console.log('✅ All images stored permanently for:', product.name);
    return permanentUrls;
    
  } catch (error) {
    console.error('❌ Error in generateAndStoreProductImages:', error);
    
    // Fallback to original function
    return await generateProductImages(product, businessData);
  }
}

/**
 * Batch generate and store images for multiple products
 */
export async function generateAndStoreProductImagesBatch(products, businessData, businessId) {
  console.log('🎨 Starting batch image generation with storage for', products.length, 'products');
  
  const results = [];
  
  for (const product of products) {
    try {
      // Add delay between requests to avoid rate limits
      if (results.length > 0) {
        await new Promise(resolve => setTimeout(resolve, 3000)); // 3 second delay for storage operations
      }
      
      const images = await generateAndStoreProductImages(product, businessData, businessId);
      
      results.push({
        productId: product.id || product.name.toLowerCase().replace(/\s+/g, '-'),
        productName: product.name,
        images: images,
        success: images.length > 0,
        stored: true
      });
      
    } catch (error) {
      console.error('❌ Error generating/storing images for product:', product.name, error);
      
      // Fallback to placeholders
      const placeholderService = 'https://picsum.photos';
      const productId = product.name.toLowerCase().replace(/\s+/g, '-');
      
      results.push({
        productId: productId,
        productName: product.name,
        images: [
          `${placeholderService}/800/800?random=${productId}`,
          `${placeholderService}/800/800?random=${productId}-2`,
        ],
        success: false,
        stored: false,
        error: error.message
      });
    }
  }
  
  console.log('✅ Batch image generation with storage completed:', results.length, 'products processed');
  return results;
}

/**
 * Migrate existing expired images to storage
 */
export async function migrateExpiredImages(businessId) {
  try {
    console.log('🔄 Checking for expired images to migrate...');
    
    const { data: business, error } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', businessId)
      .single();

    if (error || !business) {
      throw new Error('Business not found');
    }

    if (!business.business_data?.products) {
      console.log('No products found');
      return { success: false, message: 'No products found' };
    }

    let migratedCount = 0;
    const updatedProducts = [];

    for (const product of business.business_data.products) {
      if (product.images && product.images.length > 0) {
        // Check if images are expired DALL-E URLs
        const expiredImages = product.images.filter(url => 
          url.includes('oaidalleapiprodscus.blob.core.windows.net') && url.includes('se=')
        );
        
        if (expiredImages.length > 0) {
          console.log(`🔄 Product "${product.name}" has ${expiredImages.length} expired images, regenerating...`);
          
          // Regenerate images for this product
          const newImages = await generateAndStoreProductImages(product, business.business_data, businessId);
          
          updatedProducts.push({
            ...product,
            images: newImages,
            imageGeneratedAt: new Date().toISOString(),
            imageMigratedAt: new Date().toISOString()
          });
          
          migratedCount++;
        } else {
          // Keep existing product as-is
          updatedProducts.push(product);
        }
      } else {
        // Keep existing product as-is
        updatedProducts.push(product);
      }
    }

    if (migratedCount > 0) {
      // Update the business with new images
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
        throw updateError;
      }

      console.log(`✅ Migrated ${migratedCount} products with expired images`);
    } else {
      console.log('No expired images found to migrate');
    }

    return {
      success: true,
      migratedCount,
      message: `Migrated ${migratedCount} products`
    };

  } catch (error) {
    console.error('❌ Error migrating expired images:', error);
    return {
      success: false,
      error: error.message
    };
  }
}
