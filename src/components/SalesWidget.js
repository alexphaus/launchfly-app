'use client';

import { useState, useEffect } from 'react';

const SalesWidget = ({ businessId, theme }) => {
  const [salesData, setSalesData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAllSales, setShowAllSales] = useState(false);

  useEffect(() => {
    if (businessId) {
      fetchSalesData();
      // Poll for new sales every 30 seconds
      const interval = setInterval(fetchSalesData, 30000);
      return () => clearInterval(interval);
    }
  }, [businessId]);

  const fetchSalesData = async () => {
    try {
      const response = await fetch(`/api/sales/${businessId}`);
      if (response.ok) {
        const data = await response.json();
        setSalesData(data);
      }
    } catch (error) {
      console.error('Error fetching sales data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-6" style={{ boxShadow: theme.shadows.lg }}>
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-8 bg-gray-200 rounded w-1/2 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-2/3"></div>
        </div>
      </div>
    );
  }

  if (!salesData) {
    return null;
  }

  const { summary, sales } = salesData;

  return (
    <div className="space-y-6">
      {/* Sales Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4" style={{ boxShadow: theme.shadows.md }}>
          <div className="text-2xl font-bold" style={{ color: theme.colors.success }}>
            ${summary.totalRevenue.toFixed(2)}
          </div>
          <div className="text-sm" style={{ color: theme.colors.textGray }}>
            Total Revenue
          </div>
        </div>
        
        <div className="bg-white rounded-xl p-4" style={{ boxShadow: theme.shadows.md }}>
          <div className="text-2xl font-bold" style={{ color: theme.colors.primary }}>
            {summary.totalSales}
          </div>
          <div className="text-sm" style={{ color: theme.colors.textGray }}>
            Total Sales
          </div>
        </div>
        
        <div className="bg-white rounded-xl p-4" style={{ boxShadow: theme.shadows.md }}>
          <div className="text-2xl font-bold" style={{ color: theme.colors.secondaryCta }}>
            ${summary.todayRevenue.toFixed(2)}
          </div>
          <div className="text-sm" style={{ color: theme.colors.textGray }}>
            Today's Revenue
          </div>
        </div>
        
        <div className="bg-white rounded-xl p-4" style={{ boxShadow: theme.shadows.md }}>
          <div className="text-2xl font-bold" style={{ color: theme.colors.textDark }}>
            {summary.uniqueCustomers}
          </div>
          <div className="text-sm" style={{ color: theme.colors.textGray }}>
            Customers
          </div>
        </div>
      </div>

      {/* Recent Sales */}
      {sales.length > 0 && (
        <div className="bg-white rounded-2xl p-6" style={{ boxShadow: theme.shadows.lg }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold" style={{ color: theme.colors.textDark }}>
              Recent Sales 💰
            </h3>
            <button
              onClick={() => setShowAllSales(!showAllSales)}
              className="text-sm px-3 py-1 rounded-lg hover:bg-gray-100"
              style={{ color: theme.colors.primary }}
            >
              {showAllSales ? 'Show Less' : 'View All'}
            </button>
          </div>
          
          <div className="space-y-3">
            {(showAllSales ? salesData.allSales : sales).map((sale) => (
              <div
                key={sale.id}
                className="flex items-center justify-between p-3 rounded-lg"
                style={{ backgroundColor: theme.colors.bgLight }}
              >
                <div className="flex-1">
                  <div className="font-medium" style={{ color: theme.colors.textDark }}>
                    {sale.customer_name || sale.customer_email}
                  </div>
                  <div className="text-sm" style={{ color: theme.colors.textGray }}>
                    {sale.product_id} • {new Date(sale.created_at).toLocaleDateString()}
                  </div>
                </div>
                <div className="font-bold" style={{ color: theme.colors.success }}>
                  ${Number(sale.amount).toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No Sales Yet */}
      {sales.length === 0 && (
        <div className="bg-white rounded-2xl p-8 text-center" style={{ boxShadow: theme.shadows.lg }}>
          <div className="text-4xl mb-4">🎯</div>
          <h3 className="text-xl font-bold mb-2" style={{ color: theme.colors.textDark }}>
            Ready for your first sale!
          </h3>
          <p className="text-gray-600 mb-4">
            Your payment system is active. Share your website to start generating revenue.
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-blue-800 text-sm">
              💡 <strong>Pro tip:</strong> Most businesses get their first sale within 48 hours of sharing their link!
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalesWidget;
