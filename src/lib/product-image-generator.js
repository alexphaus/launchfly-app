// src/lib/product-image-generator.js
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 60000, // Longer timeout for image generation
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/**
 * Generate high-quality product images using DALL-E 3
 * @param {Object} product - Product object with name, description, category
 * @param {Object} businessData - Business context for consistent styling
 * @returns {Array} Array of generated image URLs
 */
export async function generateProductImages(product, businessData) {
  try {
    console.log('🎨 Generating images for product:', product.name);
    
    // Determine business style and aesthetic
    const businessStyle = getBusinessImageStyle(businessData);
    
    // Create comprehensive image prompt
    const imagePrompt = createImagePrompt(product, businessStyle);
    
    console.log('🖼️ Image prompt:', imagePrompt);
    
    // Generate primary product image
    const primaryImage = await generateSingleImage(imagePrompt, 'primary');
    
    // Generate additional variant images if needed
    const images = [primaryImage];
    
    // For products with variants, generate additional images
    if (product.variants && product.variants.length > 1) {
      const variantImage = await generateVariantImage(product, businessStyle);
      if (variantImage) images.push(variantImage);
    }
    
    // Generate lifestyle/context image for premium products
    if (parseFloat(product.price.replace(/[^0-9.]/g, '')) > 50) {
      const lifestyleImage = await generateLifestyleImage(product, businessStyle);
      if (lifestyleImage) images.push(lifestyleImage);
    }
    
    console.log('✅ Generated', images.length, 'images for', product.name);
    return images;
    
  } catch (error) {
    console.error('❌ Error generating product images:', error);
    
    // Return fallback placeholder URLs
    return generateFallbackImages(product);
  }
}

/**
 * Generate a single product image using DALL-E 3
 */
async function generateSingleImage(prompt, imageType = 'primary') {
  try {
    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: prompt,
      n: 1,
      size: "1024x1024",
      quality: "hd",
      style: "natural", // More realistic for product photos
    });
    
    const imageUrl = response.data[0].url;
    console.log(`✅ Generated ${imageType} image:`, imageUrl);
    
    return imageUrl;
    
  } catch (error) {
    console.error(`❌ Error generating ${imageType} image:`, error);
    return null;
  }
}

/**
 * Create detailed image prompt for product photography
 */
function createImagePrompt(product, businessStyle) {
  const { category, name, description } = product;
  const { aesthetic, lighting, background, perspective } = businessStyle;
  
  // Base prompt structure for professional product photography
  let prompt = `Professional product photography of ${name}, `;
  
  // Add category-specific details
  if (category) {
    const categoryPrompts = {
      'skincare': 'luxury skincare product with clean minimalist packaging, premium cosmetic photography',
      'electronics': 'sleek modern electronics with premium materials, tech product photography',
      'clothing': 'high-end fashion item with premium materials, fashion photography',
      'home': 'elegant home decor item with modern design, lifestyle product photography',
      'accessories': 'stylish accessory with premium craftsmanship, luxury product photography',
      'food': 'artisanal food product with premium packaging, gourmet food photography',
      'fitness': 'professional fitness equipment or supplement, athletic product photography'
    };
    
    prompt += categoryPrompts[category.toLowerCase()] || 'premium product with high-quality materials, professional product photography';
  }
  
  // Add business aesthetic
  prompt += `, ${aesthetic} style, `;
  
  // Add lighting and technical specs
  prompt += `${lighting}, ${background}, ${perspective}, `;
  
  // Add quality specifications
  prompt += `studio lighting, ultra-high detail, commercial photography, product catalog quality, `;
  prompt += `sharp focus, professional composition, clean aesthetic, premium branding, `;
  prompt += `photorealistic, 4K quality, commercial grade`;
  
  // Ensure prompt stays within limits and is optimized
  if (prompt.length > 400) {
    prompt = prompt.substring(0, 397) + '...';
  }
  
  return prompt;
}

/**
 * Generate variant-specific images (different colors, styles)
 */
async function generateVariantImage(product, businessStyle) {
  try {
    const firstVariant = product.variants[0];
    const secondVariant = product.variants[1];
    
    if (!firstVariant || !secondVariant) return null;
    
    const variantPrompt = createImagePrompt(product, businessStyle) + 
      `, showing ${firstVariant.name} and ${secondVariant.name} versions side by side, product comparison photography`;
    
    return await generateSingleImage(variantPrompt, 'variant');
    
  } catch (error) {
    console.error('Error generating variant image:', error);
    return null;
  }
}

/**
 * Generate lifestyle/in-use images for premium products
 */
async function generateLifestyleImage(product, businessStyle) {
  try {
    const lifestylePrompts = {
      'skincare': `person using ${product.name} in modern bathroom setting, lifestyle skincare photography, natural lighting`,
      'electronics': `${product.name} in modern workspace setting, tech lifestyle photography, clean minimal environment`,
      'clothing': `person wearing ${product.name} in stylish urban setting, fashion lifestyle photography`,
      'home': `${product.name} in beautifully designed modern home interior, lifestyle home photography`,
      'fitness': `person using ${product.name} in premium gym or home workout setting, fitness lifestyle photography`
    };
    
    const category = product.category?.toLowerCase() || 'general';
    const lifestylePrompt = lifestylePrompts[category] || 
      `${product.name} in premium lifestyle setting, professional lifestyle photography`;
    
    return await generateSingleImage(lifestylePrompt, 'lifestyle');
    
  } catch (error) {
    console.error('Error generating lifestyle image:', error);
    return null;
  }
}

/**
 * Determine business-specific image style and aesthetic
 */
function getBusinessImageStyle(businessData) {
  const businessName = businessData?.name || '';
  const industry = businessData?.industry || '';
  const niche = businessData?.niche || '';
  
  // Default professional style
  let style = {
    aesthetic: 'modern minimalist',
    lighting: 'soft studio lighting',
    background: 'clean white background',
    perspective: 'slightly angled front view'
  };
  
  // Customize based on business type
  if (industry.includes('skincare') || niche.includes('beauty')) {
    style = {
      aesthetic: 'luxury spa-inspired',
      lighting: 'soft natural lighting',
      background: 'marble or clean white backdrop',
      perspective: 'elegant product styling'
    };
  } else if (industry.includes('tech') || niche.includes('electronics')) {
    style = {
      aesthetic: 'sleek futuristic',
      lighting: 'dramatic accent lighting',
      background: 'gradient dark to light background',
      perspective: 'dynamic angular composition'
    };
  } else if (industry.includes('fashion') || niche.includes('clothing')) {
    style = {
      aesthetic: 'high-fashion editorial',
      lighting: 'professional fashion lighting',
      background: 'neutral seamless backdrop',
      perspective: 'artistic fashion photography angle'
    };
  } else if (industry.includes('food') || niche.includes('culinary')) {
    style = {
      aesthetic: 'artisanal gourmet',
      lighting: 'warm natural lighting',
      background: 'rustic or clean modern surface',
      perspective: 'appetizing overhead or angled shot'
    };
  }
  
  return style;
}

/**
 * Generate fallback placeholder images when AI generation fails
 */
function generateFallbackImages(product) {
  const placeholderService = 'https://picsum.photos';
  const productId = product.name.toLowerCase().replace(/\s+/g, '-');
  
  return [
    `${placeholderService}/800/800?random=${productId}`,
    `${placeholderService}/800/800?random=${productId}-2`,
  ];
}

/**
 * Batch generate images for multiple products
 */
export async function generateProductImagesBatch(products, businessData) {
  console.log('🎨 Starting batch image generation for', products.length, 'products');
  
  const results = [];
  
  for (const product of products) {
    try {
      // Add delay between requests to avoid rate limits
      if (results.length > 0) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
      }
      
      const images = await generateProductImages(product, businessData);
      
      results.push({
        productId: product.id || product.name.toLowerCase().replace(/\s+/g, '-'),
        productName: product.name,
        images: images,
        success: images.length > 0
      });
      
    } catch (error) {
      console.error('❌ Error generating images for product:', product.name, error);
      
      results.push({
        productId: product.id || product.name.toLowerCase().replace(/\s+/g, '-'),
        productName: product.name,
        images: generateFallbackImages(product),
        success: false,
        error: error.message
      });
    }
  }
  
  console.log('✅ Batch image generation completed:', results.length, 'products processed');
  return results;
}

/**
 * Save generated images to Supabase storage (optional)
 */
export async function saveImagesToStorage(imageResults, businessId) {
  try {
    console.log('💾 Saving generated images to storage...');
    
    // This would implement Supabase storage integration
    // For now, we'll just return the direct URLs
    
    return imageResults;
    
  } catch (error) {
    console.error('❌ Error saving images to storage:', error);
    return imageResults;
  }
}
