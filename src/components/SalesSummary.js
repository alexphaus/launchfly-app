'use client';

import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

/**
 * SalesSummary Component - Display recent sales and metrics
 */
const SalesSummary = ({ business, theme }) => {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSales();
  }, [business?.id]);

  async function loadSales() {
    if (!business?.id) return;
    
    try {
      const supabase = createClientComponentClient();
      const { data, error } = await supabase
        .from('sales')
        .select('*')
        .eq('business_id', business.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (!error) {
        setSales(data || []);
      }
    } catch (error) {
      console.error('Error loading sales:', error);
    } finally {
      setLoading(false);
    }
  }

  const totalRevenue = sales.reduce((sum, sale) => sum + (Number(sale.amount) || 0), 0);
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
            {sales.length}
          </div>
          <div className="text-sm text-gray-600">Total Sales</div>
        </div>
        <div className="text-center p-4 bg-gray-50 rounded-lg">
          <div className="text-2xl font-bold" style={{ color: theme.colors.primary }}>
            ${totalRevenue.toFixed(2)}
          </div>
          <div className="text-sm text-gray-600">Total Revenue</div>
        </div>
        <div className="text-center p-4 bg-gray-50 rounded-lg">
          <div className="text-2xl font-bold" style={{ color: theme.colors.primary }}>
            {sales.length > 0 ? `$${(totalRevenue / sales.length).toFixed(2)}` : '$0'}
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
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {sales.map((sale, index) => (
              <div key={sale.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                <div>
                  <div className="font-medium text-gray-900">
                    {sale.customer_name || 'Anonymous Customer'}
                  </div>
                  <div className="text-sm text-gray-600">
                    {sale.product_id} • {new Date(sale.created_at).toLocaleDateString()}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold" style={{ color: theme.colors.primary }}>
                    ${Number(sale.amount).toFixed(2)}
                  </div>
                  <div className="text-xs text-gray-500 capitalize">
                    {sale.payment_status}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-center py-8">
          <div className="text-6xl mb-4">🎯</div>
          <div className="text-lg font-medium text-gray-900 mb-2">
            No Sales Yet
          </div>
          <div className="text-gray-600 mb-4">
            Your customers are waiting! Share your business link to start making sales.
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
