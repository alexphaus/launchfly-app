// src/components/launchfly-ui/EcommerceProductGrid.js
'use client';

import { useState, useEffect } from 'react';
import { useCart } from '@/hooks/useCart';
import EcommerceProductCard from './EcommerceProductCard';
import { preloadImages, extractProductImageUrls } from '@/lib/image-utils';

export default function EcommerceProductGrid({ 
  title = "Our Products",
  subtitle = "Discover our amazing collection",
  products = [],
  categories = []
}) {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState('name');
  const [searchTerm, setSearchTerm] = useState('');

  // Optimized image preloading - only preload visible/critical images
  useEffect(() => {
    if (products && products.length > 0) {
      const imageUrls = extractProductImageUrls(products);
      if (imageUrls.length > 0) {
        console.log('Smart preloading for', Math.min(imageUrls.length, 6), 'critical product images');
        
        // Only preload the first 6 images (above the fold)
        const criticalImages = imageUrls.slice(0, 6);
        
        // Use requestIdleCallback to avoid blocking main thread
        if ('requestIdleCallback' in window) {
          requestIdleCallback(() => {
            criticalImages.forEach((url, index) => {
              const link = document.createElement('link');
              link.rel = 'preload';
              link.as = 'image';
              link.href = url;
              link.fetchPriority = index < 3 ? 'high' : 'low';
              document.head.appendChild(link);
            });
          }, { timeout: 1000 });
        }
      }
    }
  }, [products]);

  // Filter products based on category and search
  const filteredProducts = products
    .filter(product => {
      const matchesCategory = selectedCategory === 'all' || product.category === selectedCategory;
      const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           product.description.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesCategory && matchesSearch;
    })
    .sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'price') {
        const priceA = parseFloat(a.price.replace(/[^0-9.-]+/g, ''));
        const priceB = parseFloat(b.price.replace(/[^0-9.-]+/g, ''));
        return priceA - priceB;
      }
      if (sortBy === 'rating') return (b.rating || 0) - (a.rating || 0);
      return 0;
    });

  return (
    <section className="py-16 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4" style={{ color: 'var(--text-dark, #1f2937)' }}>
            {title}
          </h2>
          <p className="text-xl max-w-2xl mx-auto" style={{ color: 'var(--text-gray, #6b7280)' }}>
            {subtitle}
          </p>
        </div>

        {/* Filters and Search */}
        <div className="mb-8 space-y-4 lg:space-y-0 lg:flex lg:items-center lg:justify-between">
          {/* Search */}
          <div className="relative max-w-md">
            <input
              type="text"
              placeholder="Search products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 pl-10 pr-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <svg className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            {/* Category Filter */}
            {categories.length > 0 && (
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Categories</option>
                {categories.map(category => (
                  <option key={category} value={category}>
                    {category.charAt(0).toUpperCase() + category.slice(1)}
                  </option>
                ))}
              </select>
            )}

            {/* Sort */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="name">Sort by Name</option>
              <option value="price">Sort by Price</option>
              <option value="rating">Sort by Rating</option>
            </select>
          </div>
        </div>

        {/* Results count */}
        <div className="mb-6">
          <p className="text-sm text-gray-600">
            Showing {filteredProducts.length} of {products.length} products
          </p>
        </div>

        {/* Products Grid */}
        {filteredProducts.length === 0 ? (
          <div className="text-center py-12">
            <svg className="mx-auto h-12 w-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <h3 className="mt-4 text-lg font-medium text-gray-900">No products found</h3>
            <p className="mt-2 text-gray-500">Try adjusting your search or filter criteria.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredProducts.map((product, index) => (
              <EcommerceProductCard
                key={product.id || index}
                product={product}
              />
            ))}
          </div>
        )}

        {/* Load More Button (for pagination if needed) */}
        {filteredProducts.length > 12 && (
          <div className="text-center mt-12">
            <button className="px-8 py-3 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium">
              Load More Products
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
