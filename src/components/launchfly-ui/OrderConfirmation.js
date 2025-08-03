'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function OrderConfirmation({ orderData }) {
  const [order, setOrder] = useState(orderData || null);
  const [loading, setLoading] = useState(!orderData);
  const params = useParams();
  const router = useRouter();

  useEffect(() => {
    if (!orderData && params.orderId) {
      fetchOrderDetails();
    }
  }, [params.orderId, orderData]);

  const fetchOrderDetails = async () => {
    try {
      // In a real app, you'd fetch order details from your API
      // For now, we'll simulate it
      const mockOrder = {
        id: params.orderId || 'ORD-' + Math.random().toString(36).substr(2, 9).toUpperCase(),
        status: 'confirmed',
        createdAt: new Date().toISOString(),
        customer: {
          email: 'customer@example.com',
          firstName: 'John',
          lastName: 'Doe'
        },
        items: [],
        totals: {
          subtotal: 0,
          shipping: 0,
          tax: 0,
          total: 0
        },
        estimatedDelivery: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      };
      
      setOrder(mockOrder);
    } catch (error) {
      console.error('Error fetching order details:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price) => {
    return `$${parseFloat(price).toFixed(2)}`;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const handleContinueShopping = () => {
    router.push(`/${params.subdomain}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading order details...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="text-6xl mb-6">❌</div>
            <h1 className="text-3xl font-bold text-gray-900 mb-4">Order Not Found</h1>
            <p className="text-gray-600 mb-8">
              We couldn't find the order you're looking for.
            </p>
            <button
              onClick={handleContinueShopping}
              className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white shadow-sm hover:opacity-90 transition-opacity"
              style={{ background: 'var(--primary, #3b82f6)' }}
            >
              Continue Shopping
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Success Header */}
        <div className="text-center mb-12">
          <div className="text-6xl mb-6">✅</div>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Thank you for your order!
          </h1>
          <p className="text-xl text-gray-600 mb-2">
            Your order has been confirmed and is being processed.
          </p>
          <p className="text-gray-500">
            We've sent a confirmation email to{' '}
            <span className="font-medium text-gray-900">{order.customer?.email}</span>
          </p>
        </div>

        {/* Order Details Card */}
        <div className="bg-white rounded-lg shadow-sm p-8 mb-8">
          {/* Order Header */}
          <div className="flex flex-wrap items-center justify-between mb-8 pb-6 border-b border-gray-200">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                Order #{order.id}
              </h2>
              <p className="text-gray-600 mt-1">
                Placed on {formatDate(order.createdAt)}
              </p>
            </div>
            <div className="text-right">
              <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Confirmed
              </div>
            </div>
          </div>

          {/* Order Items */}
          {order.items && order.items.length > 0 && (
            <div className="mb-8">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Order Items</h3>
              <div className="space-y-4">
                {order.items.map((item, index) => (
                  <div key={index} className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg">
                    <div className="w-16 h-16 bg-white rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
                      {item.image ? (
                        <img
                          src={item.image}
                          alt={item.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-2xl">📦</span>
                      )}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900">{item.name}</h4>
                      {item.variant && (
                        <p className="text-sm text-gray-500">{item.variant.name}</p>
                      )}
                      <p className="text-sm text-gray-500">Quantity: {item.quantity}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-gray-900">
                        {formatPrice(parseFloat(item.price.toString().replace(/[^0-9.-]+/g, '')) * item.quantity)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Order Summary */}
          <div className="grid md:grid-cols-2 gap-8">
            {/* Shipping Information */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Shipping Information</h3>
              <div className="bg-gray-50 p-4 rounded-lg">
                {order.customer && (
                  <div className="space-y-1">
                    <p className="font-medium">
                      {order.customer.firstName} {order.customer.lastName}
                    </p>
                    {order.shipping && (
                      <>
                        <p className="text-gray-600">{order.shipping.address}</p>
                        <p className="text-gray-600">
                          {order.shipping.city}, {order.shipping.state} {order.shipping.zipCode}
                        </p>
                        <p className="text-gray-600">{order.shipping.country}</p>
                      </>
                    )}
                  </div>
                )}
                
                {/* Estimated Delivery */}
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="flex items-center text-sm">
                    <svg className="w-4 h-4 mr-2 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" />
                    </svg>
                    <div>
                      <p className="font-medium text-gray-900">Estimated Delivery</p>
                      <p className="text-gray-600">{formatDate(order.estimatedDelivery)}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Order Total */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Order Total</h3>
              <div className="bg-gray-50 p-4 rounded-lg">
                {order.totals && (
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Subtotal</span>
                      <span className="font-medium">{formatPrice(order.totals.subtotal)}</span>
                    </div>
                    
                    {order.totals.discount > 0 && (
                      <div className="flex justify-between text-green-600">
                        <span>Discount</span>
                        <span className="font-medium">-{formatPrice(order.totals.discount)}</span>
                      </div>
                    )}

                    <div className="flex justify-between">
                      <span className="text-gray-600">Shipping</span>
                      <span className="font-medium">
                        {order.totals.shipping === 0 ? 'Free' : formatPrice(order.totals.shipping)}
                      </span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-gray-600">Tax</span>
                      <span className="font-medium">{formatPrice(order.totals.tax)}</span>
                    </div>

                    <div className="border-t border-gray-200 pt-2 mt-2">
                      <div className="flex justify-between">
                        <span className="text-lg font-medium text-gray-900">Total</span>
                        <span className="text-xl font-bold text-gray-900">
                          {formatPrice(order.totals.total)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Next Steps */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
          <h3 className="text-lg font-medium text-blue-900 mb-3">What happens next?</h3>
          <ul className="space-y-2 text-blue-800">
            <li className="flex items-start">
              <svg className="w-5 h-5 mr-2 mt-0.5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              We'll send you a confirmation email with your order details
            </li>
            <li className="flex items-start">
              <svg className="w-5 h-5 mr-2 mt-0.5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              Your order will be processed and shipped within 2 business days
            </li>
            <li className="flex items-start">
              <svg className="w-5 h-5 mr-2 mt-0.5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              You'll receive tracking information once your order ships
            </li>
          </ul>
        </div>

        {/* Action Buttons */}
        <div className="text-center space-y-4">
          <button
            onClick={handleContinueShopping}
            className="inline-flex items-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-white shadow-sm hover:opacity-90 transition-opacity"
            style={{ background: 'var(--primary, #3b82f6)' }}
          >
            Continue Shopping
          </button>
          
          <div className="text-sm text-gray-500">
            <p>Need help? Contact us at support@example.com</p>
            <p className="mt-1">
              <span className="font-medium">Returns:</span> 30-day returns on all items
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
