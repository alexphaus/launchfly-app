// src/components/FulfillmentDashboard.js
/**
 * Fulfillment Dashboard Component
 * 
 * Shows business owners how the AI fulfillment system is delivering
 * value to their customers automatically
 */

import React, { useState, useEffect } from 'react';

export default function FulfillmentDashboard({ businessId }) {
  const [fulfillmentData, setFulfillmentData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (businessId) {
      loadFulfillmentData();
    }
  }, [businessId]);

  async function loadFulfillmentData() {
    try {
      const response = await fetch(`/api/fulfillment/manual?businessId=${businessId}`);
      
      if (!response.ok) {
        throw new Error('Failed to load fulfillment data');
      }
      
      const data = await response.json();
      setFulfillmentData(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function triggerBatchFulfillment() {
    try {
      setLoading(true);
      
      const response = await fetch('/api/fulfillment/manual', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          businessId: businessId,
          force: false
        })
      });
      
      if (response.ok) {
        await loadFulfillmentData(); // Refresh data
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded w-full"></div>
            <div className="h-4 bg-gray-200 rounded w-2/3"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6">
        <div className="flex items-center">
          <div className="text-2xl mr-3">❌</div>
          <div>
            <h3 className="font-semibold text-red-800">Error Loading Fulfillment Data</h3>
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!fulfillmentData) {
    return null;
  }

  const { total_sales, fulfilled_sales, pending_sales, failed_sales, total_value_delivered, sales } = fulfillmentData;
  const fulfillmentRate = total_sales > 0 ? (fulfilled_sales / total_sales * 100).toFixed(1) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl text-white p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold mb-2">🚀 AI Fulfillment System</h2>
            <p className="opacity-90">
              Automatically delivering personalized value to every customer
            </p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold">{fulfillmentRate}%</div>
            <div className="text-sm opacity-90">Fulfillment Rate</div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg p-4 shadow-md border">
          <div className="text-2xl font-bold text-gray-900">{total_sales}</div>
          <div className="text-sm text-gray-600">Total Sales</div>
          <div className="text-xs text-gray-500 mt-1">All completed purchases</div>
        </div>
        
        <div className="bg-white rounded-lg p-4 shadow-md border">
          <div className="text-2xl font-bold text-green-600">{fulfilled_sales}</div>
          <div className="text-sm text-gray-600">Fulfilled</div>
          <div className="text-xs text-gray-500 mt-1">Value delivered successfully</div>
        </div>
        
        <div className="bg-white rounded-lg p-4 shadow-md border">
          <div className="text-2xl font-bold text-yellow-600">{pending_sales}</div>
          <div className="text-sm text-gray-600">Pending</div>
          <div className="text-xs text-gray-500 mt-1">Awaiting fulfillment</div>
        </div>
        
        <div className="bg-white rounded-lg p-4 shadow-md border">
          <div className="text-2xl font-bold text-purple-600">${total_value_delivered}</div>
          <div className="text-sm text-gray-600">Value Delivered</div>
          <div className="text-xs text-gray-500 mt-1">Total AI-generated value</div>
        </div>
      </div>

      {/* Actions */}
      {pending_sales > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-yellow-800">Pending Fulfillments</h3>
              <p className="text-yellow-700 text-sm">
                {pending_sales} customers are waiting for their value delivery
              </p>
            </div>
            <button
              onClick={triggerBatchFulfillment}
              className="bg-yellow-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-yellow-700 transition-colors"
            >
              Fulfill All Pending
            </button>
          </div>
        </div>
      )}

      {/* Recent Sales */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Sales & Fulfillments</h3>
        
        {sales.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <div className="text-4xl mb-3">🎯</div>
            <p>No sales yet. Once you get your first sale, AI fulfillment will activate automatically!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sales.slice(0, 10).map((sale) => {
              const fulfillment = sale.fulfillments[0];
              const isFulfilled = fulfillment && fulfillment.status === 'completed';
              
              return (
                <div key={sale.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-gray-900">{sale.customer_name}</div>
                      <div className="text-sm text-gray-600">
                        {sale.product_id} • ${sale.amount} • {new Date(sale.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    
                    <div className="text-right">
                      {isFulfilled ? (
                        <div>
                          <div className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            ✅ Fulfilled
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            ${fulfillment.total_value} value delivered
                          </div>
                        </div>
                      ) : fulfillment ? (
                        <div className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          ❌ Failed
                        </div>
                      ) : (
                        <div className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                          ⏳ Pending
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {isFulfilled && (
                    <div className="mt-3 pt-3 border-t">
                      <div className="text-xs text-gray-600">
                        <strong>Delivered:</strong> {fulfillment.fulfillment_type.replace('_', ' ')} • 
                        <strong> Completed:</strong> {new Date(fulfillment.completed_at).toLocaleDateString()}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* How It Works */}
      <div className="bg-blue-50 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-blue-900 mb-3">💡 How AI Fulfillment Works</h3>
        <div className="grid md:grid-cols-2 gap-4 text-sm text-blue-800">
          <div>
            <h4 className="font-medium mb-2">For E-commerce Products:</h4>
            <ul className="space-y-1 text-blue-700">
              <li>• Personalized usage guides</li>
              <li>• Expert tips & techniques</li>
              <li>• Progress tracking systems</li>
              <li>• Community access</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium mb-2">For Services:</h4>
            <ul className="space-y-1 text-blue-700">
              <li>• Custom business audits</li>
              <li>• Strategic action plans</li>
              <li>• Implementation roadmaps</li>
              <li>• Success metrics</li>
            </ul>
          </div>
        </div>
        <div className="mt-4 p-3 bg-white rounded-lg">
          <p className="text-blue-800 text-sm">
            <strong>The Result:</strong> Customers receive 5-10x more value than they paid for, 
            delivered instantly with zero manual work from you. This creates amazing customer 
            satisfaction and word-of-mouth growth.
          </p>
        </div>
      </div>
    </div>
  );
}
