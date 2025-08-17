// src/components/ProductImageManager.js
import { useState } from 'react';

export default function ProductImageManager({ businessId, products = [] }) {
  const [generating, setGenerating] = useState(false);
  const [results, setResults] = useState(null);
  const [selectedProducts, setSelectedProducts] = useState([]);

  const handleGenerateImages = async (generateAll = false) => {
    setGenerating(true);
    setResults(null);

    try {
      const response = await fetch('/api/generate/product-images', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          businessId,
          productIds: generateAll ? undefined : selectedProducts,
          generateAll
        })
      });

      const data = await response.json();

      if (data.success) {
        setResults(data);
        // Refresh the page to show new images
        setTimeout(() => window.location.reload(), 2000);
      } else {
        throw new Error(data.error || 'Failed to generate images');
      }

    } catch (error) {
      console.error('Error generating images:', error);
      alert('Failed to generate images: ' + error.message);
    } finally {
      setGenerating(false);
    }
  };

  const toggleProductSelection = (productId) => {
    setSelectedProducts(prev => 
      prev.includes(productId)
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    );
  };

  const hasImages = (product) => {
    return product.images && product.images.length > 0;
  };

  const needsImages = products.filter(p => !hasImages(p));
  const hasExistingImages = products.filter(p => hasImages(p));

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            🎨 Product Image Generation
          </h2>
          <p className="text-gray-600">
            Generate professional product photos using AI for your e-commerce store
          </p>
        </div>
        
        {!generating && (
          <div className="flex gap-3">
            <button
              onClick={() => handleGenerateImages(false)}
              disabled={selectedProducts.length === 0}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                selectedProducts.length === 0
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              Generate Selected ({selectedProducts.length})
            </button>
            
            <button
              onClick={() => handleGenerateImages(true)}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-colors"
            >
              Generate All Products
            </button>
          </div>
        )}
      </div>

      {generating && (
        <div className="text-center py-12">
          <div className="inline-flex items-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mr-3"></div>
            <span className="text-lg font-medium text-gray-700">
              Generating professional product images...
            </span>
          </div>
          <p className="text-gray-500 mt-2">
            This may take a few minutes. Each image is created using AI with professional photography techniques.
          </p>
        </div>
      )}

      {results && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
          <h3 className="text-lg font-semibold text-green-900 mb-2">
            ✅ Image Generation Completed!
          </h3>
          <p className="text-green-700">
            Generated images for {results.summary.successful} out of {results.summary.total} products.
            {results.summary.failed > 0 && ` ${results.summary.failed} failed.`}
          </p>
          <p className="text-sm text-green-600 mt-1">
            Page will refresh automatically to show the new images...
          </p>
        </div>
      )}

      {!generating && (
        <>
          {/* Products needing images */}
          {needsImages.length > 0 && (
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                📦 Products Without Images ({needsImages.length})
              </h3>
              <div className="grid gap-4">
                {needsImages.map((product) => {
                  const productId = product.id || product.name.toLowerCase().replace(/\s+/g, '-');
                  const isSelected = selectedProducts.includes(productId);
                  
                  return (
                    <div 
                      key={productId}
                      className={`border rounded-lg p-4 cursor-pointer transition-all ${
                        isSelected 
                          ? 'border-blue-500 bg-blue-50' 
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => toggleProductSelection(productId)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}}
                            className="mr-3 rounded border-gray-300"
                          />
                          <div>
                            <div className="flex items-center gap-3">
                              <span className="text-2xl">{product.icon || '📦'}</span>
                              <div>
                                <h4 className="font-medium text-gray-900">{product.name}</h4>
                                <p className="text-sm text-gray-500">{product.price}</p>
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center text-sm text-gray-500">
                          <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full">
                            Needs Images
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Products with existing images */}
          {hasExistingImages.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                🖼️ Products With Generated Images ({hasExistingImages.length})
              </h3>
              <div className="grid gap-4">
                {hasExistingImages.map((product) => {
                  const productId = product.id || product.name.toLowerCase().replace(/\s+/g, '-');
                  
                  return (
                    <div key={productId} className="border border-green-200 rounded-lg p-4 bg-green-50">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {product.images && product.images[0] ? (
                            <img 
                              src={product.images[0]} 
                              alt={product.name}
                              className="w-12 h-12 object-cover rounded-lg"
                            />
                          ) : (
                            <span className="text-2xl">{product.icon || '📦'}</span>
                          )}
                          <div>
                            <h4 className="font-medium text-gray-900">{product.name}</h4>
                            <p className="text-sm text-gray-500">
                              {product.price} • {product.images?.length || 0} images
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-center text-sm text-green-700">
                          <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full">
                            ✅ Images Ready
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {products.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <div className="text-4xl mb-4">📦</div>
              <p>No products found. Create some products first to generate images.</p>
            </div>
          )}
        </>
      )}

      {/* Image generation info */}
      <div className="mt-8 p-4 bg-gray-50 rounded-lg">
        <h4 className="font-medium text-gray-900 mb-2">💡 About AI Image Generation</h4>
        <ul className="text-sm text-gray-600 space-y-1">
          <li>• Professional product photography using DALL-E 3</li>
          <li>• Multiple images per product (primary, variants, lifestyle)</li>
          <li>• Optimized for e-commerce with consistent branding</li>
          <li>• High-resolution images suitable for web and print</li>
          <li>• Cost: ~$0.04 per image (charged to your OpenAI account)</li>
        </ul>
      </div>
    </div>
  );
}
