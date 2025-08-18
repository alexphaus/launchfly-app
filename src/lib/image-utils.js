// src/lib/image-utils.js
/**
 * Utility functions for handling images in ecommerce sites
 */

/**
 * Preload images to improve loading experience
 * @param {Array} imageUrls - Array of image URLs to preload
 * @returns {Promise} Promise that resolves when all images are loaded
 */
export function preloadImages(imageUrls) {
  if (!imageUrls || !Array.isArray(imageUrls)) {
    return Promise.resolve();
  }

  const validUrls = imageUrls.filter(url => 
    url && 
    typeof url === 'string' && 
    url.trim() !== '' &&
    !url.includes('product-image-1.jpg') // Skip placeholder images
  );

  const preloadPromises = validUrls.map(url => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(url);
      img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
      img.src = url;
    });
  });

  return Promise.allSettled(preloadPromises);
}

/**
 * Check if an image URL is valid (not a placeholder)
 * @param {string} imageUrl - Image URL to check
 * @returns {boolean} True if valid, false otherwise
 */
export function isValidImageUrl(imageUrl) {
  return imageUrl && 
    typeof imageUrl === 'string' && 
    imageUrl.trim() !== '' &&
    !imageUrl.includes('product-image-1.jpg') && // Exclude placeholder
    (imageUrl.startsWith('http') || imageUrl.startsWith('data:'));
}

/**
 * Get the first valid image from a product's images array
 * @param {Object} product - Product object
 * @returns {string|null} First valid image URL or null
 */
export function getProductImageUrl(product) {
  if (!product?.images || !Array.isArray(product.images)) {
    return null;
  }

  return product.images.find(isValidImageUrl) || null;
}

/**
 * Extract all image URLs from a list of products
 * @param {Array} products - Array of product objects
 * @returns {Array} Array of image URLs
 */
export function extractProductImageUrls(products) {
  if (!products || !Array.isArray(products)) {
    return [];
  }

  const imageUrls = [];
  
  products.forEach(product => {
    if (product?.images && Array.isArray(product.images)) {
      product.images.forEach(imageUrl => {
        if (isValidImageUrl(imageUrl)) {
          imageUrls.push(imageUrl);
        }
      });
    }
  });

  return [...new Set(imageUrls)]; // Remove duplicates
}
