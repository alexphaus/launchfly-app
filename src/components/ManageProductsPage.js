// src/components/ManageProductsPage.js
import React, { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Edit2, Trash2, Save, X, DollarSign, Package, ImageIcon, Eye, AlertCircle } from 'lucide-react';

const theme = {
  colors: {
    primary: '#007BFF',
    primaryDark: '#0056b3',
    success: '#28a745',
    danger: '#dc3545',
    warning: '#ffc107',
    textDark: '#1A2B48',
    textGray: '#5A6982',
    bgLight: '#F9FAFB',
    white: '#ffffff',
    borderLight: '#E4E7EB',
  },
  shadows: {
    sm: '0 1px 3px rgba(0, 0, 0, 0.1)',
    md: '0 4px 8px rgba(26, 43, 72, 0.1)',
    lg: '0 12px 20px rgba(26, 43, 72, 0.1)',
  },
};

const ProductCard = ({ product, onEdit, onDelete, onPreview }) => (
  <div style={{
    background: 'white',
    borderRadius: '12px',
    padding: '20px',
    boxShadow: theme.shadows.md,
    border: `1px solid ${theme.colors.borderLight}`,
    transition: 'all 0.2s ease'
  }}>
    <div style={{ display: 'flex', gap: '16px' }}>
      {/* Product Image */}
      <div style={{
        width: '80px',
        height: '80px',
        background: product.image_url ? `url(${product.image_url})` : theme.colors.bgLight,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: `1px solid ${theme.colors.borderLight}`
      }}>
        {!product.image_url && <ImageIcon size={24} color={theme.colors.textGray} />}
      </div>
      
      {/* Product Details */}
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '8px' }}>
          <h3 style={{ 
            fontSize: '18px', 
            fontWeight: '700', 
            color: theme.colors.textDark, 
            margin: 0 
          }}>
            {product.name}
          </h3>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => onPreview(product)}
              style={{
                padding: '6px',
                background: theme.colors.bgLight,
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                color: theme.colors.textGray,
                transition: 'all 0.2s'
              }}
              onMouseEnter={e => e.target.style.background = theme.colors.borderLight}
              onMouseLeave={e => e.target.style.background = theme.colors.bgLight}
            >
              <Eye size={16} />
            </button>
            <button
              onClick={() => onEdit(product)}
              style={{
                padding: '6px',
                background: theme.colors.primary,
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                color: 'white',
                transition: 'all 0.2s'
              }}
              onMouseEnter={e => e.target.style.background = theme.colors.primaryDark}
              onMouseLeave={e => e.target.style.background = theme.colors.primary}
            >
              <Edit2 size={16} />
            </button>
            <button
              onClick={() => onDelete(product)}
              style={{
                padding: '6px',
                background: theme.colors.danger,
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                color: 'white',
                transition: 'all 0.2s'
              }}
              onMouseEnter={e => e.target.style.opacity = '0.8'}
              onMouseLeave={e => e.target.style.opacity = '1'}
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>
        
        <p style={{ 
          fontSize: '14px', 
          color: theme.colors.textGray, 
          margin: '0 0 12px 0',
          lineHeight: '1.4'
        }}>
          {product.description || 'No description provided'}
        </p>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <DollarSign size={16} color={theme.colors.success} />
            <span style={{ 
              fontSize: '18px', 
              fontWeight: '700', 
              color: theme.colors.success 
            }}>
              ${typeof product.price === 'number' ? product.price.toFixed(2) : product.price}
            </span>
            {product.compare_at_price && (
              <span style={{ 
                fontSize: '14px', 
                color: theme.colors.textGray, 
                textDecoration: 'line-through',
                marginLeft: '8px'
              }}>
                ${product.compare_at_price}
              </span>
            )}
          </div>
          
          <div style={{
            padding: '4px 8px',
            background: product.status === 'active' ? '#e7f5e7' : '#fff3cd',
            color: product.status === 'active' ? theme.colors.success : theme.colors.warning,
            borderRadius: '12px',
            fontSize: '12px',
            fontWeight: '600',
            textTransform: 'uppercase'
          }}>
            {product.status || 'active'}
          </div>
          
          <div style={{ 
            fontSize: '12px', 
            color: theme.colors.textGray,
            marginLeft: 'auto'
          }}>
            Stock: {product.inventory_count || 999}
          </div>
        </div>
      </div>
    </div>
  </div>
);

const ProductForm = ({ product, onSave, onCancel, isNew = false }) => {
  const [formData, setFormData] = useState({
    name: product?.name || '',
    description: product?.description || '',
    price: product?.price || '',
    compare_at_price: product?.compare_at_price || '',
    inventory_count: product?.inventory_count || 999,
    image_url: product?.image_url || '',
    status: product?.status || 'active'
  });
  
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.name.trim()) {
      newErrors.name = 'Product name is required';
    }
    
    if (!formData.price || isNaN(parseFloat(formData.price)) || parseFloat(formData.price) <= 0) {
      newErrors.price = 'Valid price is required';
    }
    
    if (formData.compare_at_price && (isNaN(parseFloat(formData.compare_at_price)) || parseFloat(formData.compare_at_price) <= parseFloat(formData.price))) {
      newErrors.compare_at_price = 'Compare price must be higher than regular price';
    }
    
    if (formData.inventory_count && (isNaN(parseInt(formData.inventory_count)) || parseInt(formData.inventory_count) < 0)) {
      newErrors.inventory_count = 'Valid inventory count is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setSaving(true);
    try {
      await onSave({
        ...formData,
        price: parseFloat(formData.price),
        compare_at_price: formData.compare_at_price ? parseFloat(formData.compare_at_price) : null,
        inventory_count: parseInt(formData.inventory_count)
      });
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '16px',
        padding: '24px',
        maxWidth: '500px',
        width: '100%',
        maxHeight: '90vh',
        overflow: 'auto',
        boxShadow: theme.shadows.lg
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h2 style={{ fontSize: '24px', fontWeight: '700', color: theme.colors.textDark, margin: 0 }}>
            {isNew ? 'Add New Product' : 'Edit Product'}
          </h2>
          <button
            onClick={onCancel}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '4px',
              color: theme.colors.textGray
            }}
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: theme.colors.textDark, marginBottom: '8px' }}>
              Product Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              style={{
                width: '100%',
                padding: '12px',
                border: `1px solid ${errors.name ? theme.colors.danger : theme.colors.borderLight}`,
                borderRadius: '8px',
                fontSize: '14px',
                outline: 'none',
                transition: 'border-color 0.2s'
              }}
              placeholder="Enter product name"
            />
            {errors.name && (
              <p style={{ fontSize: '12px', color: theme.colors.danger, margin: '4px 0 0 0' }}>
                {errors.name}
              </p>
            )}
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: theme.colors.textDark, marginBottom: '8px' }}>
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              style={{
                width: '100%',
                padding: '12px',
                border: `1px solid ${theme.colors.borderLight}`,
                borderRadius: '8px',
                fontSize: '14px',
                outline: 'none',
                minHeight: '80px',
                resize: 'vertical',
                fontFamily: 'inherit'
              }}
              placeholder="Describe your product"
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: theme.colors.textDark, marginBottom: '8px' }}>
                Price ($) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.price}
                onChange={(e) => handleChange('price', e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: `1px solid ${errors.price ? theme.colors.danger : theme.colors.borderLight}`,
                  borderRadius: '8px',
                  fontSize: '14px',
                  outline: 'none'
                }}
                placeholder="0.00"
              />
              {errors.price && (
                <p style={{ fontSize: '12px', color: theme.colors.danger, margin: '4px 0 0 0' }}>
                  {errors.price}
                </p>
              )}
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: theme.colors.textDark, marginBottom: '8px' }}>
                Compare Price ($)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.compare_at_price}
                onChange={(e) => handleChange('compare_at_price', e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: `1px solid ${errors.compare_at_price ? theme.colors.danger : theme.colors.borderLight}`,
                  borderRadius: '8px',
                  fontSize: '14px',
                  outline: 'none'
                }}
                placeholder="0.00"
              />
              {errors.compare_at_price && (
                <p style={{ fontSize: '12px', color: theme.colors.danger, margin: '4px 0 0 0' }}>
                  {errors.compare_at_price}
                </p>
              )}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: theme.colors.textDark, marginBottom: '8px' }}>
                Inventory Count
              </label>
              <input
                type="number"
                min="0"
                value={formData.inventory_count}
                onChange={(e) => handleChange('inventory_count', e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: `1px solid ${errors.inventory_count ? theme.colors.danger : theme.colors.borderLight}`,
                  borderRadius: '8px',
                  fontSize: '14px',
                  outline: 'none'
                }}
                placeholder="999"
              />
              {errors.inventory_count && (
                <p style={{ fontSize: '12px', color: theme.colors.danger, margin: '4px 0 0 0' }}>
                  {errors.inventory_count}
                </p>
              )}
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: theme.colors.textDark, marginBottom: '8px' }}>
                Status
              </label>
              <select
                value={formData.status}
                onChange={(e) => handleChange('status', e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: `1px solid ${theme.colors.borderLight}`,
                  borderRadius: '8px',
                  fontSize: '14px',
                  outline: 'none',
                  background: 'white'
                }}
              >
                <option value="active">Active</option>
                <option value="draft">Draft</option>
                <option value="archived">Archived</option>
              </select>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: theme.colors.textDark, marginBottom: '8px' }}>
              Image URL
            </label>
            <input
              type="url"
              value={formData.image_url}
              onChange={(e) => handleChange('image_url', e.target.value)}
              style={{
                width: '100%',
                padding: '12px',
                border: `1px solid ${theme.colors.borderLight}`,
                borderRadius: '8px',
                fontSize: '14px',
                outline: 'none'
              }}
              placeholder="https://example.com/image.jpg"
            />
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
            <button
              type="button"
              onClick={onCancel}
              style={{
                flex: 1,
                padding: '12px',
                background: theme.colors.bgLight,
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '600',
                color: theme.colors.textGray,
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              style={{
                flex: 2,
                padding: '12px',
                background: saving ? theme.colors.textGray : theme.colors.primary,
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '600',
                color: 'white',
                cursor: saving ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <Save size={16} />
              {saving ? 'Saving...' : (isNew ? 'Add Product' : 'Update Product')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const ManageProductsPage = ({ business, onBack }) => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingProduct, setEditingProduct] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchProducts();
  }, [business?.id]);

  const fetchProducts = async () => {
    if (!business?.id) return;
    
    setLoading(true);
    try {
      const response = await fetch(`/api/business/manage/products?businessId=${business.id}`);
      const data = await response.json();
      
      if (data.success) {
        setProducts(data.products);
      } else {
        setError('Failed to fetch products');
      }
    } catch (err) {
      console.error('Error fetching products:', err);
      setError('Failed to fetch products');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProduct = async (productData) => {
    try {
      const isNew = !editingProduct;
      const url = '/api/business/manage/products';
      const method = isNew ? 'POST' : 'PUT';
      
      const body = {
        businessId: business.id,
        ...(isNew ? { product: productData } : { productId: editingProduct.id, product: productData })
      };

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const data = await response.json();
      
      if (data.success) {
        await fetchProducts(); // Refresh the list
        setEditingProduct(null);
        setShowAddForm(false);
      } else {
        setError(data.error || 'Failed to save product');
      }
    } catch (err) {
      console.error('Error saving product:', err);
      setError('Failed to save product');
    }
  };

  const handleDeleteProduct = async (product) => {
    if (!confirm(`Are you sure you want to delete "${product.name}"?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/business/manage/products?businessId=${business.id}&productId=${product.id}`, {
        method: 'DELETE'
      });

      const data = await response.json();
      
      if (data.success) {
        await fetchProducts(); // Refresh the list
      } else {
        setError(data.error || 'Failed to delete product');
      }
    } catch (err) {
      console.error('Error deleting product:', err);
      setError('Failed to delete product');
    }
  };

  const handlePreviewProduct = (product) => {
    // Open product in new tab if website is live
    if (business?.subdomain) {
      const productSlug = product.name.toLowerCase().replace(/\s+/g, '-');
      window.open(`https://app.launchfly.ai/sites/${business.subdomain}/product/${productSlug}`, '_blank');
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: theme.colors.bgLight,
      padding: '20px'
    }}>
      <div style={{
        maxWidth: '900px',
        margin: '0 auto'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px' }}>
          <button
            onClick={onBack}
            style={{
              padding: '8px',
              background: 'white',
              border: `1px solid ${theme.colors.borderLight}`,
              borderRadius: '8px',
              cursor: 'pointer',
              color: theme.colors.textGray,
              transition: 'all 0.2s'
            }}
            onMouseEnter={e => e.target.style.background = theme.colors.bgLight}
            onMouseLeave={e => e.target.style.background = 'white'}
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 style={{ fontSize: '32px', fontWeight: '700', color: theme.colors.textDark, margin: 0 }}>
              Manage Products
            </h1>
            <p style={{ fontSize: '16px', color: theme.colors.textGray, margin: '4px 0 0 0' }}>
              Edit prices, descriptions, and add new products
            </p>
          </div>
          <button
            onClick={() => setShowAddForm(true)}
            style={{
              marginLeft: 'auto',
              padding: '12px 20px',
              background: theme.colors.primary,
              border: 'none',
              borderRadius: '8px',
              color: 'white',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.2s'
            }}
            onMouseEnter={e => e.target.style.background = theme.colors.primaryDark}
            onMouseLeave={e => e.target.style.background = theme.colors.primary}
          >
            <Plus size={16} />
            Add Product
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div style={{
            background: '#fee',
            border: `1px solid ${theme.colors.danger}`,
            borderRadius: '8px',
            padding: '12px 16px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            color: theme.colors.danger
          }}>
            <AlertCircle size={16} />
            {error}
            <button
              onClick={() => setError('')}
              style={{
                marginLeft: 'auto',
                background: 'none',
                border: 'none',
                color: theme.colors.danger,
                cursor: 'pointer'
              }}
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* Products List */}
        {loading ? (
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '200px',
            color: theme.colors.textGray
          }}>
            <Package size={32} style={{ marginRight: '12px', opacity: 0.5 }} />
            Loading products...
          </div>
        ) : products.length === 0 ? (
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '40px',
            textAlign: 'center',
            boxShadow: theme.shadows.md
          }}>
            <Package size={48} color={theme.colors.textGray} style={{ marginBottom: '16px', opacity: 0.5 }} />
            <h3 style={{ fontSize: '20px', fontWeight: '600', color: theme.colors.textDark, marginBottom: '8px' }}>
              No products yet
            </h3>
            <p style={{ fontSize: '14px', color: theme.colors.textGray, marginBottom: '20px' }}>
              Add your first product to start selling
            </p>
            <button
              onClick={() => setShowAddForm(true)}
              style={{
                padding: '12px 24px',
                background: theme.colors.primary,
                border: 'none',
                borderRadius: '8px',
                color: 'white',
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {products.map((product, index) => (
              <ProductCard
                key={product.id || index}
                product={product}
                onEdit={setEditingProduct}
                onDelete={handleDeleteProduct}
                onPreview={handlePreviewProduct}
              />
            ))}
          </div>
        )}

        {/* Product Form Modal */}
        {(editingProduct || showAddForm) && (
          <ProductForm
            product={editingProduct}
            onSave={handleSaveProduct}
            onCancel={() => {
              setEditingProduct(null);
              setShowAddForm(false);
            }}
            isNew={showAddForm}
          />
        )}
      </div>
    </div>
  );
};

export default ManageProductsPage;
