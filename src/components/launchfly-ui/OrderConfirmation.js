'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

export default function OrderConfirmation({ 
  orderNumber,
  customerEmail,
  orderItems = [],
  orderTotals = {},
  shippingAddress = {},
  estimatedDelivery,
  businessData = {}
}) {
  const [showDetails, setShowDetails] = useState(false);
  const params = useParams();
  
  // Generate order number if not provided
  const finalOrderNumber = orderNumber || `LF-${Date.now().toString().slice(-6)}`;
  
  // Calculate estimated delivery if not provided
  const finalEstimatedDelivery = estimatedDelivery || (() => {
    const date = new Date();
    date.setDate(date.getDate() + 7); // 7 days from now
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  })();

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Success Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-6">
            <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          
          <h1 className="text-4xl font-bold mb-4" style={{ color: 'var(--text-dark, #1f2937)' }}>
            Thank You for Your Order!
          </h1>
          
          <p className="text-xl text-gray-600 mb-2">
            Your order has been successfully placed and is now being processed.
          </p>
          
          <p className="text-gray-600">
            We've sent a confirmation email to <strong>{customerEmail}</strong>
          </p>
        </div>

        {/* Order Number Card */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-8 text-center">
          <h2 className="text-2xl font-bold mb-4" style={{ color: 'var(--text-dark, #1f2937)' }}>
            Order Number
          </h2>
          <div 
            className="text-4xl font-mono font-bold mb-4 px-6 py-3 rounded-lg inline-block"
            style={{ 
              background: 'var(--primary, #3b82f6)', 
              color: 'white' 
            }}
          >
            #{finalOrderNumber}
          </div>
          <p className="text-gray-600">
            Save this number for your records and order tracking
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Order Summary */}
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold" style={{ color: 'var(--text-dark, #1f2937)' }}>
                Order Summary
              </h2>
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="text-sm font-medium hover:underline"
                style={{ color: 'var(--primary, #3b82f6)' }}
              >
                {showDetails ? 'Hide Details' : 'Show Details'}
              </button>
            </div>

            {/* Order Items */}
            <div className="space-y-4 mb-6">
              {orderItems.map((item, index) => (
                <div 
                  key={item.id || index} 
                  className={`${showDetails ? 'p-4 bg-gray-50 rounded-lg' : 'flex items-center justify-between'}`}
                >
                  {showDetails ? (
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 bg-white rounded-lg flex items-center justify-center">
                        {item.image ? (
                          <img
                            src={item.image}
                            alt={item.name}
                            className="w-full h-full object-cover rounded-lg"
                          />
                        ) : (
                          <span className="text-xl">{item.icon || '📦'}</span>
                        )}
                      </div>
                      <div className="flex-1">
                        <h4 className="font-medium" style={{ color: 'var(--text-dark, #1f2937)' }}>
                          {item.name}
                        </h4>
                        <p className="text-sm text-gray-600">{item.description}</p>
                        <div className="flex items-center gap-4 mt-1">
                          <span className="text-sm text-gray-600">Qty: {item.quantity}</span>
                          <span className="text-sm font-medium" style={{ color: 'var(--primary, #3b82f6)' }}>
                            {item.price} each
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold" style={{ color: 'var(--text-dark, #1f2937)' }}>
                          ${(parseFloat(item.price.replace('$', '')) * item.quantity).toFixed(2)}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div>
                        <span className="font-medium" style={{ color: 'var(--text-dark, #1f2937)' }}>
                          {item.name}
                        </span>
                        <span className="text-gray-600 ml-2">×{item.quantity}</span>
                      </div>
                      <span className="font-medium" style={{ color: 'var(--primary, #3b82f6)' }}>
                        ${(parseFloat(item.price.replace('$', '')) * item.quantity).toFixed(2)}
                      </span>
                    </>
                  )}
                </div>
              ))}
            </div>

            {/* Order Totals */}
            <div className="border-t pt-4 space-y-2">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>${(orderTotals.subtotal || 0).toFixed(2)}</span>
              </div>
              
              {orderTotals.discount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Discount</span>
                  <span>-${orderTotals.discount.toFixed(2)}</span>
                </div>
              )}
              
              <div className="flex justify-between">
                <span>Shipping</span>
                <span>${(orderTotals.shipping || 0).toFixed(2)}</span>
              </div>
              
              <div className="flex justify-between">
                <span>Tax</span>
                <span>${(orderTotals.tax || 0).toFixed(2)}</span>
              </div>
              
              <hr className="my-2" />
              
              <div className="flex justify-between font-bold text-lg">
                <span>Total</span>
                <span style={{ color: 'var(--primary, #3b82f6)' }}>
                  ${(orderTotals.total || 0).toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Shipping & Delivery Info */}
          <div className="space-y-6">
            {/* Delivery Estimate */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--text-dark, #1f2937)' }}>
                Estimated Delivery
              </h2>
              
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                </div>
                <div>
                  <div className="font-bold text-lg" style={{ color: 'var(--text-dark, #1f2937)' }}>
                    {finalEstimatedDelivery}
                  </div>
                  <div className="text-sm text-gray-600">
                    We'll send tracking info once your order ships
                  </div>
                </div>
              </div>
              
              <div className="bg-blue-50 rounded-lg p-4">
                <p className="text-sm" style={{ color: 'var(--primary, #3b82f6)' }}>
                  <strong>📧 Confirmation email sent!</strong><br />
                  Check your inbox for order details and tracking updates.
                </p>
              </div>
            </div>

            {/* Shipping Address */}
            {shippingAddress.firstName && (
              <div className="bg-white rounded-2xl shadow-lg p-6">
                <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--text-dark, #1f2937)' }}>
                  Shipping Address
                </h2>
                
                <div className="text-gray-700">
                  <div className="font-medium">
                    {shippingAddress.firstName} {shippingAddress.lastName}
                  </div>
                  <div>{shippingAddress.address}</div>
                  <div>
                    {shippingAddress.city}, {shippingAddress.state} {shippingAddress.zipCode}
                  </div>
                  {shippingAddress.phone && <div>{shippingAddress.phone}</div>}
                </div>
              </div>
            )}

            {/* What's Next */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--text-dark, #1f2937)' }}>
                What's Next?
              </h2>
              
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-blue-600 text-sm font-bold">1</span>
                  </div>
                  <div>
                    <div className="font-medium" style={{ color: 'var(--text-dark, #1f2937)' }}>
                      Order Processing
                    </div>
                    <div className="text-sm text-gray-600">
                      We're preparing your order (usually within 1-2 business days)
                    </div>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-blue-600 text-sm font-bold">2</span>
                  </div>
                  <div>
                    <div className="font-medium" style={{ color: 'var(--text-dark, #1f2937)' }}>
                      Shipping Notification
                    </div>
                    <div className="text-sm text-gray-600">
                      You'll receive an email with tracking information
                    </div>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-blue-600 text-sm font-bold">3</span>
                  </div>
                  <div>
                    <div className="font-medium" style={{ color: 'var(--text-dark, #1f2937)' }}>
                      Delivery
                    </div>
                    <div className="text-sm text-gray-600">
                      Your order arrives by {finalEstimatedDelivery}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center mt-12">
          <Link
            href={`/${params.subdomain}`}
            className="px-8 py-3 border-2 rounded-lg font-semibold text-center hover:bg-gray-50 transition-colors"
            style={{ 
              borderColor: 'var(--primary, #3b82f6)',
              color: 'var(--primary, #3b82f6)',
              textDecoration: 'none'
            }}
          >
            Continue Shopping
          </Link>
          
          <button
            onClick={() => window.print()}
            className="px-8 py-3 rounded-lg font-semibold text-white transition-colors"
            style={{ background: 'var(--primary, #3b82f6)' }}
          >
            Print Receipt
          </button>
        </div>

        {/* Support Info */}
        <div className="text-center mt-12 p-6 bg-white rounded-2xl shadow-lg">
          <h3 className="font-bold mb-2" style={{ color: 'var(--text-dark, #1f2937)' }}>
            Need Help?
          </h3>
          <p className="text-gray-600 mb-4">
            Questions about your order? We're here to help!
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center text-sm">
            <div>
              <strong>Email:</strong> {businessData.email || 'support@launchfly.ai'}
            </div>
            {businessData.phone && (
              <div>
                <strong>Phone:</strong> {businessData.phone}
              </div>
            )}
            <div>
              <strong>Order #:</strong> #{finalOrderNumber}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
