// src/components/ManageProductsPage.js
'use client';

import React, { useState, useEffect } from 'react';
import { PlusCircle, Edit, Trash2, X, Loader2, DollarSign, Package } from 'lucide-react';

const theme = {
  colors: {
    primary: '#007BFF',
    primaryDark: '#0056b3',
    success: '#28a745',
    danger: '#dc3545',
    textDark: '#1A2B48',
    textGray: '#5A6982',
    bgLight: '#F9FAFB',
    white: '#ffffff',
    borderLight: '#E4E7EB',
  },
  shadows: {
    md: '0 4px 8px rgba(26, 43, 72, 0.1)',
    lg: '0 12px 20px rgba(26, 43, 72, 0.1)',
  },
};

const ProductModal = ({ product, onClose, onSave, businessId }) => {
  const [formData, setFormData] = useState(
    product || { name: '', price: '', description: '', image_url: '' }
  );
  const [isSaving, setIsSaving] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    
    const url = product
      ? '/api/business/manage/products'
      : '/api/business/manage/products';
    
    const method = product ? 'PUT' : 'POST';

    const body = {
        businessId: businessId,
        product: formData,
    }
    if(product) {
        body.productId = product.id
    }

    try {
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (result.success) {
        onSave(result.product);
        onClose();
      } else {
        alert(`Error: ${result.error}`);
      }
    } catch (error) {
      console.error('Error saving product:', error);
      alert('An error occurred while saving the product.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0, 0, 0, 0.5)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }}>
      <div style={{
        background: theme.colors.white, borderRadius: '12px',
        padding: '24px', width: '100%', maxWidth: '500px',
        boxShadow: theme.shadows.lg
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: '700', color: theme.colors.textDark }}>
            {product ? 'Edit Product' : 'Add New Product'}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
            <X size={24} color={theme.colors.textGray} />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <input type="text" name="name" placeholder="Product Name" value={formData.name} onChange={handleChange} required style={inputStyle} />
            <input type="number" name="price" placeholder="Price" value={formData.price} onChange={handleChange} required style={inputStyle} />
            <textarea name="description" placeholder="Description" value={formData.description} onChange={handleChange} style={{...inputStyle, minHeight: '100px'}} />
            <input type="text" name="image_url" placeholder="Image URL (optional)" value={formData.image_url} onChange={handleChange} style={inputStyle} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
            <button type="button" onClick={onClose} style={{...buttonStyle, background: theme.colors.bgLight, color: theme.colors.textDark}}>
              Cancel
            </button>
            <button type="submit" disabled={isSaving} style={{...buttonStyle, background: theme.colors.primary, color: 'white'}}>
              {isSaving ? <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} /> : 'Save Product'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const ManageProductsPage = ({ business }) => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  
  useEffect(() => {
    if (business) {
      fetchProducts();
    }
  }, [business]);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/business/manage/products?businessId=${business.id}`);
      const data = await response.json();
      if (data.success) {
        setProducts(data.products);
      }
    } catch (error) {
      console.error('Error fetching products:', error);
    }
    setLoading(false);
  };

  const handleSaveProduct = (savedProduct) => {
    if (selectedProduct) {
      setProducts(products.map(p => p.id === savedProduct.id ? savedProduct : p));
    } else {
      setProducts([savedProduct, ...products]);
    }
    setSelectedProduct(null);
  };
  
  const handleDeleteProduct = async (productId) => {
    if (confirm('Are you sure you want to delete this product?')) {
      try {
        const response = await fetch(`/api/business/manage/products?businessId=${business.id}&productId=${productId}`, {
          method: 'DELETE',
        });
        const result = await response.json();
        if (result.success) {
          setProducts(products.filter(p => p.id !== productId));
        } else {
          alert(`Error: ${result.error}`);
        }
      } catch (error) {
        console.error('Error deleting product:', error);
        alert('An error occurred while deleting the product.');
      }
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '24px' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 'bold', color: theme.colors.textDark }}>Manage Products</h1>
        <button onClick={() => { setSelectedProduct(null); setIsModalOpen(true); }} style={{...buttonStyle, background: theme.colors.primary, color: 'white', display: 'flex', alignItems: 'center', gap: '8px'}}>
          <PlusCircle size={20} />
          Add Product
        </button>
      </header>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', color: theme.colors.primary }} />
          <p style={{ marginTop: '12px', color: theme.colors.textGray }}>Loading products...</p>
        </div>
      ) : products.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', background: theme.colors.bgLight, borderRadius: '12px' }}>
          <Package size={48} color={theme.colors.textGray} />
          <h3 style={{ marginTop: '16px', fontSize: '20px', color: theme.colors.textDark }}>No Products Found</h3>
          <p style={{ color: theme.colors.textGray }}>Get started by adding your first product.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {products.map(product => (
            <div key={product.id} style={{
              display: 'flex', alignItems: 'center', gap: '16px',
              padding: '16px', background: 'white',
              borderRadius: '12px', boxShadow: theme.shadows.md,
            }}>
              {product.image_url ? (
                <img src={product.image_url} alt={product.name} style={{ width: '64px', height: '64px', borderRadius: '8px', objectFit: 'cover' }} />
              ) : (
                <div style={{ width: '64px', height: '64px', borderRadius: '8px', background: theme.colors.bgLight, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                  <Package size={32} color={theme.colors.textGray} />
                </div>
              )}
              <div style={{ flex: 1 }}>
                <h4 style={{ fontSize: '18px', fontWeight: '600', color: theme.colors.textDark }}>{product.name}</h4>
                <p style={{ color: theme.colors.textGray, fontSize: '14px', margin: '4px 0 0' }}>{product.description}</p>
              </div>
              <div style={{ fontSize: '18px', fontWeight: 'bold', color: theme.colors.textDark }}>
                ${typeof product.price === 'string' ? parseFloat(product.price.replace('$', '')) : product.price}
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => { setSelectedProduct(product); setIsModalOpen(true); }} style={{...iconButtonStyle, color: theme.colors.primary}}>
                  <Edit size={20} />
                </button>
                <button onClick={() => handleDeleteProduct(product.id)} style={{...iconButtonStyle, color: theme.colors.danger}}>
                  <Trash2 size={20} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {isModalOpen && (
        <ProductModal
          product={selectedProduct}
          onClose={() => setIsModalOpen(false)}
          onSave={handleSaveProduct}
          businessId={business.id}
        />
      )}
    </div>
  );
};

const inputStyle = {
  width: '100%',
  padding: '12px',
  borderRadius: '8px',
  border: `1px solid ${theme.colors.borderLight}`,
  fontSize: '16px',
};

const buttonStyle = {
  padding: '10px 20px',
  borderRadius: '8px',
  border: 'none',
  fontSize: '16px',
  fontWeight: '600',
  cursor: 'pointer',
  transition: 'all 0.2s',
};

const iconButtonStyle = {
  background: 'none',
  border: 'none',
  padding: '8px',
  cursor: 'pointer',
  borderRadius: '50%',
}

export default ManageProductsPage;
