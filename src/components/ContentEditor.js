// src/components/ContentEditor.js
// Simple form-based editor for landing page content
// NOT a drag-and-drop editor - just text fields for key editable content

'use client';

import React, { useState, useEffect } from 'react';
import { Save, X, Phone, DollarSign, FileText, Megaphone, Check, AlertCircle } from 'lucide-react';

export default function ContentEditor({ business, onSave, onClose }) {
  const businessData = business?.business_data || {};
  const landingPage = businessData.landing_page || {};
  const pdfContent = businessData.lead_magnet_pdf || {};
  
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);
  
  const [formData, setFormData] = useState({
    // Business Info
    businessName: businessData.businessName || business?.name || '',
    phone: business?.phone_number || businessData.phone || '',
    address: businessData.address || '',
    
    // Landing Page
    headline: landingPage.headline || '',
    subheadline: landingPage.subheadline || '',
    ctaText: landingPage.cta_text || 'Get My Free Guide',
    
    // Lead Magnet
    leadMagnetTitle: businessData.lead_magnet_title || '',
    
    // Pricing/Offers
    priceRanges: pdfContent.price_ranges || [],
    couponCode: pdfContent.coupon_code || '',
    couponOffer: pdfContent.coupon_offer || '',
  });

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setSaved(false);
  };

  const handlePriceChange = (index, field, value) => {
    const newPrices = [...(formData.priceRanges || [])];
    if (!newPrices[index]) newPrices[index] = {};
    newPrices[index][field] = value;
    setFormData(prev => ({ ...prev, priceRanges: newPrices }));
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    
    try {
      const response = await fetch('/api/business/update-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId: business.id,
          updates: formData,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save changes');
      }

      setSaved(true);
      if (onSave) onSave(formData);
      
      // Auto-hide success after 3s
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">Edit Your Funnel</h2>
            <p className="text-blue-100 text-sm">Update your landing page and PDF content</p>
          </div>
          <button 
            onClick={onClose}
            className="text-white/80 hover:text-white p-2 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Form Content */}
        <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 140px)' }}>
          {/* Status Messages */}
          {saved && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-700">
              <Check size={18} />
              Changes saved successfully!
            </div>
          )}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
              <AlertCircle size={18} />
              {error}
            </div>
          )}

          {/* Business Info Section */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-3 flex items-center gap-2">
              <FileText size={20} className="text-blue-600" />
              Business Information
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Business Name
                </label>
                <input
                  type="text"
                  value={formData.businessName}
                  onChange={(e) => handleChange('businessName', e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Ali's Plumbing Services"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    <Phone size={14} className="inline mr-1" /> Phone Number
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => handleChange('phone', e.target.value)}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="+60 12-345 6789"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Location/Area
                  </label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => handleChange('address', e.target.value)}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Shah Alam, Selangor"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Landing Page Section */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-3 flex items-center gap-2">
              <Megaphone size={20} className="text-purple-600" />
              Landing Page Text
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Main Headline
                </label>
                <input
                  type="text"
                  value={formData.headline}
                  onChange={(e) => handleChange('headline', e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Get Your Free Plumbing Price Guide"
                />
                <p className="text-xs text-slate-500 mt-1">This is the first thing visitors see</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Subheadline
                </label>
                <textarea
                  value={formData.subheadline}
                  onChange={(e) => handleChange('subheadline', e.target.value)}
                  rows={2}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Download our guide to learn fair prices before calling any plumber"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Guide Title
                  </label>
                  <input
                    type="text"
                    value={formData.leadMagnetTitle}
                    onChange={(e) => handleChange('leadMagnetTitle', e.target.value)}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="2025 Plumbing Price Guide"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Button Text
                  </label>
                  <input
                    type="text"
                    value={formData.ctaText}
                    onChange={(e) => handleChange('ctaText', e.target.value)}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Get My Free Guide"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Pricing/Offers Section */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-3 flex items-center gap-2">
              <DollarSign size={20} className="text-green-600" />
              Pricing & Offers (Shows in PDF)
            </h3>
            <div className="space-y-4">
              {/* Price Ranges */}
              <div className="bg-slate-50 rounded-lg p-4">
                <label className="block text-sm font-medium text-slate-700 mb-3">
                  Your Price List (up to 3 services)
                </label>
                {[0, 1, 2].map((index) => (
                  <div key={index} className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={formData.priceRanges?.[index]?.service || ''}
                      onChange={(e) => handlePriceChange(index, 'service', e.target.value)}
                      className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm"
                      placeholder={`Service ${index + 1} (e.g., Aircon Service)`}
                    />
                    <input
                      type="text"
                      value={formData.priceRanges?.[index]?.price || ''}
                      onChange={(e) => handlePriceChange(index, 'price', e.target.value)}
                      className="w-32 px-3 py-2 border border-slate-300 rounded-lg text-sm"
                      placeholder="RM 90"
                    />
                  </div>
                ))}
                <p className="text-xs text-slate-500 mt-2">
                  💡 Real prices convert better than generic guides!
                </p>
              </div>

              {/* Coupon */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Coupon Code
                  </label>
                  <input
                    type="text"
                    value={formData.couponCode}
                    onChange={(e) => handleChange('couponCode', e.target.value.toUpperCase())}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 uppercase"
                    placeholder="GUIDE15"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Offer Text
                  </label>
                  <input
                    type="text"
                    value={formData.couponOffer}
                    onChange={(e) => handleChange('couponOffer', e.target.value)}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="15% off first service"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="border-t border-slate-200 px-6 py-4 bg-slate-50 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-600 hover:text-slate-800 font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save size={18} />
                Save Changes
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
