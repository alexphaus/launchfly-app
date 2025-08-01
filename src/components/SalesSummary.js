'use client';

import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

/**
 * SalesSummary Component - Display recent sales and metrics
 */
const SalesSummary = ({ business, theme }) => {
  const [sales, setSales] = useState([]);
  const [metrics, setMetrics] = useState({
    totalSales: 0,
    totalRevenue: 0,
    averageSale: 0
  });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    if (business?.id) {
      loadSales();
    }
  }, [business?.id, page]);

  async function loadSales() {
    if (!business?.id) return;
    setLoading(true);
    
    try {
      // Use the dedicated API endpoint for better performance
      const response = await fetch(`/api/businesses/${business.id}/sales?page=${page}&limit=10`);
      const data = await response.json();
      
      if (!response.ok) throw new Error(data.error || 'Failed to load sales');
      
      setSales(data.sales || []);
      setMetrics(data.metrics || {
        totalSales: 0,
        totalRevenue: 0,
        averageSale: 0
      });
      setTotalPages(data.pagination?.totalPages || 1);
      
    } catch (error) {
      console.error('Error loading sales:', error);
    } finally {
      setLoading(false);
    }
  }
  
  // Backup calculation in case API doesn't provide metrics
  const calculatedTotalRevenue = sales.reduce((sum, sale) => sum + (Number(sale.amount) || 0), 0);
  const totalRevenue = metrics.totalRevenue || calculatedTotalRevenue;
  const firstSale = business?.first_sale_date;

  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-6 shadow-lg">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded mb-4"></div>
          <div className="h-4 bg-gray-200 rounded mb-2"></div>
          <div className="h-4 bg-gray-200 rounded mb-2"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl p-6 shadow-lg">
      <h3 className="text-xl font-bold mb-4" style={{ color: theme.colors.textDark }}>
        💰 Sales Performance
      </h3>
      
      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="text-center p-4 bg-gray-50 rounded-lg">
          <div className="text-2xl font-bold" style={{ color: theme.colors.primary }}>
            {metrics.totalSales || 0}
          </div>
          <div className="text-sm text-gray-600">Total Sales</div>
        </div>
        <div className="text-center p-4 bg-gray-50 rounded-lg">
          <div className="text-2xl font-bold" style={{ color: theme.colors.primary }}>
            ${(metrics.totalRevenue || 0).toFixed(2)}
          </div>
          <div className="text-sm text-gray-600">Total Revenue</div>
        </div>
        <div className="text-center p-4 bg-gray-50 rounded-lg">
          <div className="text-2xl font-bold" style={{ color: theme.colors.primary }}>
            {metrics.totalSales > 0 ? `$${(metrics.averageSale || 0).toFixed(2)}` : '$0'}
          </div>
          <div className="text-sm text-gray-600">Avg. Sale</div>
        </div>
      </div>

      {/* First Sale Celebration */}
      {firstSale && (
        <div className="mb-6 p-4 rounded-lg" style={{ background: `${theme.colors.primary}15`, border: `1px solid ${theme.colors.primary}40` }}>
          <div className="flex items-center">
            <span className="text-2xl mr-3">🎉</span>
            <div>
              <div className="font-semibold" style={{ color: theme.colors.primary }}>
                First Sale Achieved!
              </div>
              <div className="text-sm text-gray-600">
                {new Date(firstSale).toLocaleDateString()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Recent Sales */}
      {sales.length > 0 ? (
        <div>
          <h4 className="font-semibold mb-3" style={{ color: theme.colors.textDark }}>
            Recent Sales
          </h4>
          <div className="space-y-3 mb-4">
            {sales.map((sale) => (
              <div key={sale.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg border border-gray-100">
                <div className="flex items-center">
                  <div className="text-green-500 mr-3">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">
                      {sale.product_name || 'Product'}
                    </div>
                    <div className="text-sm text-gray-600 flex items-center">
                      <span>{sale.customer_email?.split('@')[0] || 'Customer'}</span>
                      <span className="mx-1">•</span>
                      <span>{new Date(sale.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold" style={{ color: theme.colors.primary }}>
                    ${Number(sale.amount).toFixed(2)}
                  </div>
                  <div className="text-xs inline-flex items-center px-2 py-0.5 rounded-full bg-green-100 text-green-800">
                    {sale.payment_status || 'paid'}
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-between items-center border-t pt-4">
              <button 
                className="px-3 py-1 rounded text-sm disabled:opacity-50"
                disabled={page <= 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                style={{ color: theme.colors.primary }}
              >
                ← Previous
              </button>
              <span className="text-sm text-gray-500">
                Page {page} of {totalPages}
              </span>
              <button 
                className="px-3 py-1 rounded text-sm disabled:opacity-50"
                disabled={page >= totalPages}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                style={{ color: theme.colors.primary }}
              >
                Next →
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-8 bg-gray-50 rounded-lg border border-dashed border-gray-300">
          <div className="text-5xl mb-4">🎯</div>
          <div className="text-lg font-medium text-gray-900 mb-2">
            No Sales Yet
          </div>
          <div className="text-gray-600 mb-4 max-w-md mx-auto">
            Your customers are waiting! Share your business link and promote your products to start making sales.
          </div>
          <button
            onClick={() => {
              const businessUrl = `${window.location.origin}/sites/${business.subdomain}`;
              navigator.clipboard.writeText(businessUrl);
              alert('Business URL copied to clipboard!');
            }}
            className="px-4 py-2 rounded-lg font-medium text-white"
            style={{ backgroundColor: theme.colors.primary }}
          >
            Copy Business Link
          </button>
        </div>
      )}
    </div>
  );
};

export default SalesSummary;
