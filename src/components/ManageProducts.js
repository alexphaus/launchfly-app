'use client';

import React, { useState, useEffect } from 'react';
import { ArrowLeft, Save, Plus, Trash2, AlertCircle, Loader2, CheckCircle } from 'lucide-react';

const theme = {
  colors: {
    primary: '#007BFF',
    primaryDark: '#0056b3',
    success: '#28a745',
    textDark: '#1A2B48',
    textGray: '#5A6982',
    bgLight: '#F9FAFB',
    white: '#ffffff',
    borderLight: '#E4E7EB',
    orange: '#f59e0b',
    error: '#dc3545',
  },
  shadows: {
    sm: '0 1px 3px rgba(0, 0, 0, 0.1)',
    md: '0 4px 8px rgba(26, 43, 72, 0.1)',
    lg: '0 12px 20px rgba(26, 43, 72, 0.1)',
    xl: '0 24px 32px rgba(26, 43, 72, 0.12)',
  },
  gradients: {
    primary: 'linear-gradient(135deg, #007BFF 0%, #00B8D9 100%)',
    success: 'linear-gradient(135deg, #28a745 0%, #20c997 100%)',
  }
};

const ManageProducts = ({ session, business, onBack }) => {
  const [products, setProducts] = useState([]);
  const [productSource, setProductSource] = useState(null);
  const [newProduct, setNewProduct] = useState({ name: '', price: '', description: '' });
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    const layout = business?.business_data?.layout;
    let foundInLayout = false;
    if (layout) {
      const productSection = layout.find(
        (section) =>
          section.component === 'PricingTable' ||
          section.component === 'ProductGrid' ||
          section.component === 'EcommerceProductGrid'
      );
      if (productSection) {
        const productsOrPlans = productSection.props.products || productSection.props.plans;
        if (productsOrPlans) {
          setProducts(JSON.parse(JSON.stringify(productsOrPlans))); // Deep copy to avoid mutation
          setProductSource('layout');
          foundInLayout = true;
        }
      }
    }
    if (!foundInLayout) {
      setProducts(JSON.parse(JSON.stringify(business?.business_data?.products || [])));
      setProductSource('products');
    }
  }, [business]);


  const validateProduct = (product) => {
    if (!product.name?.trim()) return 'Name is required';
    const priceString = (product.price || '').toString();
    const numericPrice = parseFloat(priceString.replace(/[^0-9.]/g, ''));
    if (!priceString.trim() || isNaN(numericPrice)) return 'Valid price is required';
    if (!product.description?.trim()) return 'Description is required';
    return null;
  };

  const handleProductChange = (index, field, value) => {
    const updated = [...products];
    updated[index][field] = value;
    setProducts(updated);
  };

  const handleAddProduct = () => {
    const error = validateProduct(newProduct);
    if (error) {
      setErrors({ new: error });
      return;
    }

    setProducts([...products, { ...newProduct, id: Date.now().toString() }]);
    setNewProduct({ name: '', price: '', description: '' });
    setErrors({});
  };

  const handleDeleteProduct = (index) => {
    const updated = products.filter((_, i) => i !== index);
    setProducts(updated);
  };

  const handleSave = async () => {
    // Validate all products
    for (let i = 0; i < products.length; i++) {
      const error = validateProduct(products[i]);
      if (error) {
        setErrors({ [i]: error });
        return;
      }
    }

    setIsSaving(true);
    setErrors({});

    try {
      let businessDataUpdates = {};

      if (productSource === 'layout') {
        const layout = JSON.parse(JSON.stringify(business.business_data.layout)); // Deep copy
        const productSectionIndex = layout.findIndex(
          (section) =>
            section.component === 'PricingTable' ||
            section.component === 'ProductGrid' ||
            section.component === 'EcommerceProductGrid'
        );

        if (productSectionIndex > -1) {
          const section = layout[productSectionIndex];
          if (section.props.plans) {
            section.props.plans = products;
          } else {
            section.props.products = products;
          }
          businessDataUpdates = { layout: layout };
        } else {
          // Fallback if section somehow disappears, though this shouldn't happen
          businessDataUpdates = { products: products };
        }
      } else { // 'products' or null
        businessDataUpdates = { products: products };
      }

      const response = await fetch('/api/business/update-progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId: business.id,
          partialData: businessDataUpdates
        })
      });

      if (!response.ok) {
        throw new Error('Failed to update products');
      }

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      setErrors({ global: error.message || 'Failed to save changes' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div style={{ 
      minHeight: '100vh',
      background: theme.colors.bgLight,
      paddingBottom: '40px'
    }}>
      {/* Header */}
      <header style={{
        background: 'white',
        borderBottom: `1px solid ${theme.colors.borderLight}`,
        padding: '20px 0',
        marginBottom: '32px',
        position: 'sticky',
        top: 0,
        zIndex: 100
      }}>
        <div style={{
          maxWidth: '720px',
          margin: '0 auto',
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          gap: '16px'
        }}>
          <button
            onClick={onBack}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'none',
              border: 'none',
              color: theme.colors.textGray,
              fontSize: '16px',
              cursor: 'pointer',
              padding: '8px',
              borderRadius: '8px',
              transition: 'all 0.2s'
            }}
            onMouseEnter={e => e.target.style.background = theme.colors.bgLight}
            onMouseLeave={e => e.target.style.background = 'none'}
          >
            <ArrowLeft size={20} />
            Back to Dashboard
          </button>
          
          <div style={{ 
            height: '24px', 
            width: '1px', 
            background: theme.colors.borderLight 
          }} />
          
          <h1 style={{ 
            fontSize: '24px', 
            fontWeight: '700', 
            color: theme.colors.textDark,
            margin: 0
          }}>
            Manage Products
          </h1>
        </div>
      </header>

      {/* Main Content */}
      <main style={{
        maxWidth: '720px',
        margin: '0 auto',
        padding: '0 24px'
      }}>
        {/* Products List */}
        <div style={{
          background: 'white',
          borderRadius: '20px',
          padding: '24px',
          marginBottom: '24px',
          boxShadow: theme.shadows.lg
        }}>
          <h2 style={{ fontSize: '20px', fontWeight: '700', color: theme.colors.textDark, marginBottom: '20px' }}>
            Your Products
          </h2>
          
          {products.length === 0 ? (
            <p style={{ color: theme.colors.textGray, textAlign: 'center', padding: '32px' }}>
              No products yet. Add one below!
            </p>
          ) : (
            products.map((product, index) => (
              <div key={index} style={{
                padding: '20px',
                border: `2px solid ${errors[index] ? theme.colors.error : theme.colors.borderLight}`,
                borderRadius: '12px',
                marginBottom: '16px',
                background: 'white'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <h3 style={{ fontSize: '18px', fontWeight: '600', color: theme.colors.textDark }}>
                    Product {index + 1}
                  </h3>
                  <button
                    onClick={() => handleDeleteProduct(index)}
                    style={{
                      background: theme.colors.error,
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '8px 12px',
                      fontSize: '14px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <Trash2 size={16} />
                    Delete
                  </button>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '14px', color: theme.colors.textGray, marginBottom: '4px' }}>Name</label>
                    <input
                      value={product.name}
                      onChange={(e) => handleProductChange(index, 'name', e.target.value)}
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        border: `2px solid ${theme.colors.borderLight}`,
                        borderRadius: '8px',
                        fontSize: '16px'
                      }}
                    />
                  </div>
                  
                  <div>
                    <label style={{ display: 'block', fontSize: '14px', color: theme.colors.textGray, marginBottom: '4px' }}>Price</label>
                    <input
                      value={product.price}
                      onChange={(e) => handleProductChange(index, 'price', e.target.value)}
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        border: `2px solid ${theme.colors.borderLight}`,
                        borderRadius: '8px',
                        fontSize: '16px'
                      }}
                    />
                  </div>
                  
                  <div>
                    <label style={{ display: 'block', fontSize: '14px', color: theme.colors.textGray, marginBottom: '4px' }}>Description</label>
                    <textarea
                      value={product.description}
                      onChange={(e) => handleProductChange(index, 'description', e.target.value)}
                      rows={4}
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        border: `2px solid ${theme.colors.borderLight}`,
                        borderRadius: '8px',
                        fontSize: '16px'
                      }}
                    />
                  </div>
                </div>
                
                {errors[index] && (
                  <p style={{ 
                    fontSize: '14px', 
                    color: theme.colors.error, 
                    marginTop: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    <AlertCircle size={16} />
                    {errors[index]}
                  </p>
                )}
              </div>
            ))
          )}
        </div>

        {/* Add New Product */}
        <div style={{
          background: 'white',
          borderRadius: '20px',
          padding: '24px',
          marginBottom: '24px',
          boxShadow: theme.shadows.lg
        }}>
          <h2 style={{ fontSize: '20px', fontWeight: '700', color: theme.colors.textDark, marginBottom: '20px' }}>
            Add New Product
          </h2>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <input
              placeholder="Product Name"
              value={newProduct.name}
              onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
              style={{
                width: '100%',
                padding: '12px 16px',
                border: `2px solid ${errors.new ? theme.colors.error : theme.colors.borderLight}`,
                borderRadius: '8px',
                fontSize: '16px'
              }}
            />
            
            <input
              placeholder="Price (e.g. $99)"
              value={newProduct.price}
              onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })}
              style={{
                width: '100%',
                padding: '12px 16px',
                border: `2px solid ${errors.new ? theme.colors.error : theme.colors.borderLight}`,
                borderRadius: '8px',
                fontSize: '16px'
              }}
            />
            
            <textarea
              placeholder="Description"
              value={newProduct.description}
              onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
              rows={4}
              style={{
                width: '100%',
                padding: '12px 16px',
                border: `2px solid ${errors.new ? theme.colors.error : theme.colors.borderLight}`,
                borderRadius: '8px',
                fontSize: '16px'
              }}
            />
            
            {errors.new && (
              <p style={{ 
                fontSize: '14px', 
                color: theme.colors.error, 
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                <AlertCircle size={16} />
                {errors.new}
              </p>
            )}
            
            <button
              onClick={handleAddProduct}
              style={{
                background: theme.colors.primary,
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                padding: '12px 20px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                transition: 'all 0.2s'
              }}
              onMouseEnter={e => e.target.style.background = theme.colors.primaryDark}
              onMouseLeave={e => e.target.style.background = theme.colors.primary}
            >
              <Plus size={16} />
              Add Product
            </button>
          </div>
        </div>

        {/* Save Button */}
        <div style={{ 
          position: 'sticky',
          bottom: 0,
          background: theme.colors.bgLight,
          padding: '16px 24px',
          margin: '0 -24px'
        }}>
          <button
            onClick={handleSave}
            disabled={isSaving}
            style={{
              width: '100%',
              background: saveSuccess ? theme.colors.success : theme.colors.primary,
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              padding: '16px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: isSaving ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'all 0.2s',
              opacity: isSaving ? 0.6 : 1
            }}
          >
            {isSaving ? (
              <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
            ) : saveSuccess ? (
              <CheckCircle size={20} />
            ) : (
              <Save size={20} />
            )}
            {isSaving ? 'Saving...' : saveSuccess ? 'Saved!' : 'Save Changes'}
          </button>
          
          {errors.global && (
            <p style={{ 
              fontSize: '14px', 
              color: theme.colors.error, 
              marginTop: '8px',
              textAlign: 'center',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px'
            }}>
              <AlertCircle size={16} />
              {errors.global}
            </p>
          )}
        </div>
      </main>

      <style jsx>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @media (max-width: 640px) {
          header, main {
            padding: 0 16px;
          }
          
          .sticky-bottom {
            margin: 0 -16px;
            padding: 16px;
          }
        }
      `}</style>
    </div>
  );
};

export default ManageProducts;
