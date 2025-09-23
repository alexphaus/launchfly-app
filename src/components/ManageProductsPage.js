// src/components/ManageProductsPage.js
'use client';

import React, { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Edit3, Trash2, Save, X, Upload, DollarSign, Package, Image, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';

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

const ManageProductsPage = ({ session, business, onBack }) => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingProduct, setEditingProduct] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [success, setSuccess] = useState('');

  // Form state for new/editing product
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    compare_at_price: '',
    inventory_count: '999',
    image_url: '',
    category: '',
    features: [''],
    status: 'active'
  });

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    try {
      setLoading(true);
      
      // First try to get products from the products table
      const response = await fetch(`/api/products?businessId=${business.id}`);
      
      if (response.ok) {
        const data = await response.json();
        setProducts(data.products || []);
      } else {
        // Fallback to business_data products
        const businessProducts = business?.business_data?.products || [];
        setProducts(businessProducts.map((p, index) => ({
          id: p.id || `temp-${index}`,
          ...p,
          business_id: business.id
        })));
      }
    } catch (error) {
      console.error('Error loading products:', error);
      setErrors({ load: 'Failed to load products' });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear field error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  const handleFeatureChange = (index, value) => {
    const newFeatures = [...formData.features];
    newFeatures[index] = value;
    setFormData(prev => ({ ...prev, features: newFeatures }));
  };

  const addFeature = () => {
    setFormData(prev => ({ ...prev, features: [...prev.features, ''] }));
  };

  const removeFeature = (index) => {
    if (formData.features.length > 1) {
      const newFeatures = formData.features.filter((_, i) => i !== index);
      setFormData(prev => ({ ...prev, features: newFeatures }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.name.trim()) newErrors.name = 'Product name is required';
    if (!formData.description.trim()) newErrors.description = 'Description is required';
    if (!formData.price || parseFloat(formData.price) <= 0) newErrors.price = 'Valid price is required';
    if (formData.compare_at_price && parseFloat(formData.compare_at_price) <= parseFloat(formData.price)) {
      newErrors.compare_at_price = 'Compare price must be higher than regular price';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;
    
    setSaving(true);
    setErrors({});
    
    try {
      const productData = {
        ...formData,
        price: parseFloat(formData.price),
        compare_at_price: formData.compare_at_price ? parseFloat(formData.compare_at_price) : null,
        inventory_count: parseInt(formData.inventory_count) || 999,
        features: formData.features.filter(f => f.trim()),
        business_id: business.id
      };
      
      const url = editingProduct 
        ? `/api/products/${editingProduct.id}` 
        : '/api/products';
      
      const method = editingProduct ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(productData)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save product');
      }
      
      const result = await response.json();
      
      if (editingProduct) {
        setProducts(prev => prev.map(p => p.id === editingProduct.id ? result.product : p));
        setSuccess('Product updated successfully!');
      } else {
        setProducts(prev => [...prev, result.product]);
        setSuccess('Product created successfully!');
      }
      
      resetForm();
      setTimeout(() => setSuccess(''), 3000);
      
    } catch (error) {
      console.error('Save error:', error);
      setErrors({ save: error.message || 'Failed to save product' });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name || '',
      description: product.description || '',
      price: product.price?.toString() || '',
      compare_at_price: product.compare_at_price?.toString() || '',
      inventory_count: product.inventory_count?.toString() || '999',
      image_url: product.image_url || '',
      category: product.category || '',
      features: product.features && product.features.length > 0 ? product.features : [''],
      status: product.status || 'active'
    });
    setShowAddForm(true);
  };

  const handleDelete = async (productId) => {
    if (!confirm('Are you sure you want to delete this product?')) return;
    
    try {
      const response = await fetch(`/api/products/${productId}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete product');
      }
      
      setProducts(prev => prev.filter(p => p.id !== productId));
      setSuccess('Product deleted successfully!');
      setTimeout(() => setSuccess(''), 3000);
      
    } catch (error) {
      console.error('Delete error:', error);
      setErrors({ delete: error.message || 'Failed to delete product' });
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      price: '',
      compare_at_price: '',
      inventory_count: '999',
      image_url: '',
      category: '',
      features: [''],
      status: 'active'
    });
    setEditingProduct(null);
    setShowAddForm(false);
    setErrors({});
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(price);
  };

  if (loading) {
    return (
      <div style={{ 
        minHeight: '100vh',
        background: theme.colors.bgLight,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Loader2 size={24} style={{ animation: 'spin 1s linear infinite' }} />
          <span style={{ fontSize: '16px', color: theme.colors.textGray }}>Loading products...</span>
        </div>
      </div>
    );
  }

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
          maxWidth: '1200px',
          margin: '0 auto',
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
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
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Package size={24} color={theme.colors.primary} />
              <h1 style={{ 
                fontSize: '24px', 
                fontWeight: '700', 
                color: theme.colors.textDark,
                margin: 0
              }}>
                Manage Products
              </h1>
            </div>
          </div>
          
          <button
            onClick={() => setShowAddForm(true)}
            style={{
              background: theme.gradients.primary,
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              padding: '12px 20px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.2s',
              boxShadow: theme.shadows.md
            }}
            onMouseEnter={e => e.target.style.transform = 'translateY(-1px)'}
            onMouseLeave={e => e.target.style.transform = 'translateY(0)'}
          >
            <Plus size={16} />
            Add Product
          </button>
        </div>
      </header>

      {/* Success Message */}
      {success && (
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto 24px',
          padding: '0 24px'
        }}>
          <div style={{
            background: '#d4edda',
            border: `1px solid ${theme.colors.success}`,
            borderRadius: '8px',
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <CheckCircle size={18} color={theme.colors.success} />
            <span style={{ color: theme.colors.success, fontWeight: '600' }}>{success}</span>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '0 24px'
      }}>
        {/* Add/Edit Form */}
        {showAddForm && (
          <div style={{
            background: 'white',
            borderRadius: '20px',
            padding: '32px',
            marginBottom: '32px',
            boxShadow: theme.shadows.lg
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
              <h2 style={{ 
                fontSize: '20px', 
                fontWeight: '700', 
                color: theme.colors.textDark,
                margin: 0
              }}>
                {editingProduct ? 'Edit Product' : 'Add New Product'}
              </h2>
              <button
                onClick={resetForm}
                style={{
                  background: 'none',
                  border: 'none',
                  color: theme.colors.textGray,
                  cursor: 'pointer',
                  padding: '8px',
                  borderRadius: '8px',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={e => e.target.style.background = theme.colors.bgLight}
                onMouseLeave={e => e.target.style.background = 'none'}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
              {/* Product Name */}
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: theme.colors.textDark,
                  marginBottom: '6px'
                }}>
                  Product Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  placeholder="Enter product name"
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: `2px solid ${errors.name ? theme.colors.error : theme.colors.borderLight}`,
                    borderRadius: '8px',
                    fontSize: '16px',
                    outline: 'none',
                    transition: 'border-color 0.2s'
                  }}
                  onFocus={e => e.target.style.borderColor = theme.colors.primary}
                  onBlur={e => e.target.style.borderColor = errors.name ? theme.colors.error : theme.colors.borderLight}
                />
                {errors.name && (
                  <p style={{ 
                    fontSize: '12px', 
                    color: theme.colors.error, 
                    marginTop: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    <AlertCircle size={14} />
                    {errors.name}
                  </p>
                )}
              </div>

              {/* Category */}
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: theme.colors.textDark,
                  marginBottom: '6px'
                }}>
                  Category
                </label>
                <input
                  type="text"
                  value={formData.category}
                  onChange={(e) => handleInputChange('category', e.target.value)}
                  placeholder="e.g., Digital Services, Physical Products"
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: `2px solid ${theme.colors.borderLight}`,
                    borderRadius: '8px',
                    fontSize: '16px',
                    outline: 'none',
                    transition: 'border-color 0.2s'
                  }}
                  onFocus={e => e.target.style.borderColor = theme.colors.primary}
                  onBlur={e => e.target.style.borderColor = theme.colors.borderLight}
                />
              </div>
            </div>

            {/* Description */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '600',
                color: theme.colors.textDark,
                marginBottom: '6px'
              }}>
                Description *
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                placeholder="Describe your product and its benefits"
                rows={4}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: `2px solid ${errors.description ? theme.colors.error : theme.colors.borderLight}`,
                  borderRadius: '8px',
                  fontSize: '16px',
                  outline: 'none',
                  transition: 'border-color 0.2s',
                  resize: 'vertical',
                  fontFamily: 'inherit'
                }}
                onFocus={e => e.target.style.borderColor = theme.colors.primary}
                onBlur={e => e.target.style.borderColor = errors.description ? theme.colors.error : theme.colors.borderLight}
              />
              {errors.description && (
                <p style={{ 
                  fontSize: '12px', 
                  color: theme.colors.error, 
                  marginTop: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  <AlertCircle size={14} />
                  {errors.description}
                </p>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '24px', marginBottom: '24px' }}>
              {/* Price */}
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: theme.colors.textDark,
                  marginBottom: '6px'
                }}>
                  Price *
                </label>
                <div style={{ position: 'relative' }}>
                  <DollarSign size={18} style={{
                    position: 'absolute',
                    left: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: theme.colors.textGray
                  }} />
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.price}
                    onChange={(e) => handleInputChange('price', e.target.value)}
                    placeholder="0.00"
                    style={{
                      width: '100%',
                      padding: '12px 16px 12px 40px',
                      border: `2px solid ${errors.price ? theme.colors.error : theme.colors.borderLight}`,
                      borderRadius: '8px',
                      fontSize: '16px',
                      outline: 'none',
                      transition: 'border-color 0.2s'
                    }}
                    onFocus={e => e.target.style.borderColor = theme.colors.primary}
                    onBlur={e => e.target.style.borderColor = errors.price ? theme.colors.error : theme.colors.borderLight}
                  />
                </div>
                {errors.price && (
                  <p style={{ 
                    fontSize: '12px', 
                    color: theme.colors.error, 
                    marginTop: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    <AlertCircle size={14} />
                    {errors.price}
                  </p>
                )}
              </div>

              {/* Compare At Price */}
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: theme.colors.textDark,
                  marginBottom: '6px'
                }}>
                  Compare At Price
                </label>
                <div style={{ position: 'relative' }}>
                  <DollarSign size={18} style={{
                    position: 'absolute',
                    left: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: theme.colors.textGray
                  }} />
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.compare_at_price}
                    onChange={(e) => handleInputChange('compare_at_price', e.target.value)}
                    placeholder="0.00"
                    style={{
                      width: '100%',
                      padding: '12px 16px 12px 40px',
                      border: `2px solid ${errors.compare_at_price ? theme.colors.error : theme.colors.borderLight}`,
                      borderRadius: '8px',
                      fontSize: '16px',
                      outline: 'none',
                      transition: 'border-color 0.2s'
                    }}
                    onFocus={e => e.target.style.borderColor = theme.colors.primary}
                    onBlur={e => e.target.style.borderColor = errors.compare_at_price ? theme.colors.error : theme.colors.borderLight}
                  />
                </div>
                {errors.compare_at_price && (
                  <p style={{ 
                    fontSize: '12px', 
                    color: theme.colors.error, 
                    marginTop: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    <AlertCircle size={14} />
                    {errors.compare_at_price}
                  </p>
                )}
              </div>

              {/* Inventory */}
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: theme.colors.textDark,
                  marginBottom: '6px'
                }}>
                  Inventory Count
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.inventory_count}
                  onChange={(e) => handleInputChange('inventory_count', e.target.value)}
                  placeholder="999"
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: `2px solid ${theme.colors.borderLight}`,
                    borderRadius: '8px',
                    fontSize: '16px',
                    outline: 'none',
                    transition: 'border-color 0.2s'
                  }}
                  onFocus={e => e.target.style.borderColor = theme.colors.primary}
                  onBlur={e => e.target.style.borderColor = theme.colors.borderLight}
                />
              </div>
            </div>

            {/* Image URL */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '600',
                color: theme.colors.textDark,
                marginBottom: '6px'
              }}>
                Product Image URL
              </label>
              <div style={{ position: 'relative' }}>
                <Image size={18} style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: theme.colors.textGray
                }} />
                <input
                  type="url"
                  value={formData.image_url}
                  onChange={(e) => handleInputChange('image_url', e.target.value)}
                  placeholder="https://example.com/product-image.jpg"
                  style={{
                    width: '100%',
                    padding: '12px 16px 12px 40px',
                    border: `2px solid ${theme.colors.borderLight}`,
                    borderRadius: '8px',
                    fontSize: '16px',
                    outline: 'none',
                    transition: 'border-color 0.2s'
                  }}
                  onFocus={e => e.target.style.borderColor = theme.colors.primary}
                  onBlur={e => e.target.style.borderColor = theme.colors.borderLight}
                />
              </div>
            </div>

            {/* Features */}
            <div style={{ marginBottom: '32px' }}>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '600',
                color: theme.colors.textDark,
                marginBottom: '12px'
              }}>
                Product Features
              </label>
              {formData.features.map((feature, index) => (
                <div key={index} style={{ 
                  display: 'flex', 
                  gap: '8px', 
                  marginBottom: '8px',
                  alignItems: 'center'
                }}>
                  <input
                    type="text"
                    value={feature}
                    onChange={(e) => handleFeatureChange(index, e.target.value)}
                    placeholder={`Feature ${index + 1}`}
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      border: `1px solid ${theme.colors.borderLight}`,
                      borderRadius: '6px',
                      fontSize: '14px',
                      outline: 'none'
                    }}
                  />
                  {formData.features.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeFeature(index)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: theme.colors.error,
                        cursor: 'pointer',
                        padding: '4px'
                      }}
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={addFeature}
                style={{
                  background: 'none',
                  border: `1px dashed ${theme.colors.borderLight}`,
                  borderRadius: '6px',
                  padding: '8px 12px',
                  color: theme.colors.textGray,
                  cursor: 'pointer',
                  fontSize: '14px',
                  width: '100%',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={e => {
                  e.target.style.borderColor = theme.colors.primary;
                  e.target.style.color = theme.colors.primary;
                }}
                onMouseLeave={e => {
                  e.target.style.borderColor = theme.colors.borderLight;
                  e.target.style.color = theme.colors.textGray;
                }}
              >
                + Add Feature
              </button>
            </div>

            {/* Status */}
            <div style={{ marginBottom: '32px' }}>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '600',
                color: theme.colors.textDark,
                marginBottom: '6px'
              }}>
                Status
              </label>
              <select
                value={formData.status}
                onChange={(e) => handleInputChange('status', e.target.value)}
                style={{
                  padding: '12px 16px',
                  border: `2px solid ${theme.colors.borderLight}`,
                  borderRadius: '8px',
                  fontSize: '16px',
                  outline: 'none',
                  background: 'white',
                  cursor: 'pointer'
                }}
              >
                <option value="active">Active</option>
                <option value="draft">Draft</option>
                <option value="archived">Archived</option>
              </select>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={resetForm}
                style={{
                  background: 'none',
                  border: `1px solid ${theme.colors.borderLight}`,
                  borderRadius: '8px',
                  padding: '12px 20px',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: theme.colors.textGray,
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={e => {
                  e.target.style.borderColor = theme.colors.textGray;
                  e.target.style.color = theme.colors.textDark;
                }}
                onMouseLeave={e => {
                  e.target.style.borderColor = theme.colors.borderLight;
                  e.target.style.color = theme.colors.textGray;
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                style={{
                  background: saving ? theme.colors.textGray : theme.gradients.primary,
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '12px 20px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: saving ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'all 0.2s',
                  opacity: saving ? 0.7 : 1
                }}
              >
                {saving ? (
                  <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                ) : (
                  <Save size={16} />
                )}
                {saving ? 'Saving...' : editingProduct ? 'Update Product' : 'Create Product'}
              </button>
            </div>

            {/* Form Errors */}
            {errors.save && (
              <div style={{
                marginTop: '16px',
                padding: '12px 16px',
                background: '#f8d7da',
                border: `1px solid ${theme.colors.error}`,
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <AlertCircle size={18} color={theme.colors.error} />
                <span style={{ color: theme.colors.error, fontSize: '14px' }}>{errors.save}</span>
              </div>
            )}
          </div>
        )}

        {/* Products Grid */}
        <div style={{
          background: 'white',
          borderRadius: '20px',
          padding: '32px',
          boxShadow: theme.shadows.lg
        }}>
          <div style={{ marginBottom: '24px' }}>
            <h2 style={{ 
              fontSize: '20px', 
              fontWeight: '700', 
              color: theme.colors.textDark,
              margin: 0,
              marginBottom: '8px'
            }}>
              Your Products ({products.length})
            </h2>
            <p style={{ 
              fontSize: '14px', 
              color: theme.colors.textGray,
              margin: 0
            }}>
              Manage your product catalog, pricing, and inventory
            </p>
          </div>

          {products.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '60px 20px',
              color: theme.colors.textGray
            }}>
              <Package size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
              <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px' }}>
                No products yet
              </h3>
              <p style={{ fontSize: '14px', marginBottom: '20px' }}>
                Create your first product to start selling
              </p>
              <button
                onClick={() => setShowAddForm(true)}
                style={{
                  background: theme.gradients.primary,
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '12px 20px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <Plus size={16} />
                Add Your First Product
              </button>
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
              gap: '24px'
            }}>
              {products.map((product) => (
                <div
                  key={product.id}
                  style={{
                    border: `1px solid ${theme.colors.borderLight}`,
                    borderRadius: '16px',
                    padding: '20px',
                    background: 'white',
                    transition: 'all 0.2s',
                    position: 'relative'
                  }}
                  onMouseEnter={e => {
                    e.target.style.boxShadow = theme.shadows.md;
                    e.target.style.transform = 'translateY(-2px)';
                  }}
                  onMouseLeave={e => {
                    e.target.style.boxShadow = 'none';
                    e.target.style.transform = 'translateY(0)';
                  }}
                >
                  {/* Product Status Badge */}
                  <div style={{
                    position: 'absolute',
                    top: '12px',
                    right: '12px',
                    padding: '4px 8px',
                    borderRadius: '12px',
                    fontSize: '10px',
                    fontWeight: '600',
                    textTransform: 'uppercase',
                    background: product.status === 'active' ? theme.colors.success : 
                               product.status === 'draft' ? theme.colors.orange : theme.colors.textGray,
                    color: 'white'
                  }}>
                    {product.status}
                  </div>

                  {/* Product Image */}
                  {product.image_url ? (
                    <div style={{
                      width: '100%',
                      height: '160px',
                      borderRadius: '12px',
                      background: `url(${product.image_url})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                      marginBottom: '16px'
                    }} />
                  ) : (
                    <div style={{
                      width: '100%',
                      height: '160px',
                      borderRadius: '12px',
                      background: theme.colors.bgLight,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: '16px',
                      border: `2px dashed ${theme.colors.borderLight}`
                    }}>
                      <Image size={32} color={theme.colors.textGray} />
                    </div>
                  )}

                  {/* Product Info */}
                  <div style={{ marginBottom: '16px' }}>
                    <h3 style={{
                      fontSize: '18px',
                      fontWeight: '700',
                      color: theme.colors.textDark,
                      marginBottom: '8px',
                      lineHeight: '1.3'
                    }}>
                      {product.name}
                    </h3>
                    
                    {product.category && (
                      <span style={{
                        display: 'inline-block',
                        padding: '2px 8px',
                        borderRadius: '12px',
                        background: theme.colors.bgLight,
                        color: theme.colors.textGray,
                        fontSize: '12px',
                        fontWeight: '500',
                        marginBottom: '8px'
                      }}>
                        {product.category}
                      </span>
                    )}
                    
                    <p style={{
                      fontSize: '14px',
                      color: theme.colors.textGray,
                      lineHeight: '1.4',
                      marginBottom: '12px',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden'
                    }}>
                      {product.description}
                    </p>
                    
                    {/* Price */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                      <span style={{
                        fontSize: '20px',
                        fontWeight: '700',
                        color: theme.colors.primary
                      }}>
                        {formatPrice(product.price)}
                      </span>
                      {product.compare_at_price && product.compare_at_price > product.price && (
                        <span style={{
                          fontSize: '14px',
                          color: theme.colors.textGray,
                          textDecoration: 'line-through'
                        }}>
                          {formatPrice(product.compare_at_price)}
                        </span>
                      )}
                    </div>

                    {/* Inventory */}
                    <div style={{
                      fontSize: '12px',
                      color: theme.colors.textGray,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      <Package size={12} />
                      {product.inventory_count > 0 ? 
                        `${product.inventory_count} in stock` : 
                        'Out of stock'
                      }
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{
                    display: 'flex',
                    gap: '8px',
                    paddingTop: '16px',
                    borderTop: `1px solid ${theme.colors.borderLight}`
                  }}>
                    <button
                      onClick={() => handleEdit(product)}
                      style={{
                        flex: 1,
                        background: 'none',
                        border: `1px solid ${theme.colors.primary}`,
                        borderRadius: '8px',
                        padding: '8px 12px',
                        color: theme.colors.primary,
                        fontSize: '12px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={e => {
                        e.target.style.background = theme.colors.primary;
                        e.target.style.color = 'white';
                      }}
                      onMouseLeave={e => {
                        e.target.style.background = 'none';
                        e.target.style.color = theme.colors.primary;
                      }}
                    >
                      <Edit3 size={14} />
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(product.id)}
                      style={{
                        background: 'none',
                        border: `1px solid ${theme.colors.error}`,
                        borderRadius: '8px',
                        padding: '8px 12px',
                        color: theme.colors.error,
                        fontSize: '12px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={e => {
                        e.target.style.background = theme.colors.error;
                        e.target.style.color = 'white';
                      }}
                      onMouseLeave={e => {
                        e.target.style.background = 'none';
                        e.target.style.color = theme.colors.error;
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* CSS Animations */}
      <style jsx>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default ManageProductsPage;
