// src/components/CustomersCard.js
import React, { useState, useEffect } from 'react';
import { Users, Mail, DollarSign, ChevronRight } from 'lucide-react';

const theme = {
  colors: {
    primary: '#007BFF',
    textDark: '#1A2B48',
    textGray: '#5A6982',
    bgLight: '#F9FAFB',
    borderLight: '#E4E7EB',
    success: '#28a745',
  },
  shadows: {
    lg: '0 12px 20px rgba(26, 43, 72, 0.1)',
  },
};

const CustomersCard = ({ business }) => {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (business?.id) {
      fetchCustomers();
    }
  }, [business?.id]);

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/business/${business.id}/customers`);
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setCustomers(data.customers);
        }
      }
    } catch (error) {
      console.error('Error fetching customers:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusStyle = (status) => {
    switch (status) {
      case 'Lead':
        return { background: '#e0f2fe', color: '#0284c7' };
      case 'Contacted':
        return { background: '#fef3c7', color: '#d97706' };
      case 'Converted':
        return { background: '#dcfce7', color: '#16a34a' };
      default:
        return { background: '#f3f4f6', color: '#4b5563' };
    }
  };

  return (
    <div style={{
      background: 'white',
      borderRadius: '20px',
      padding: '24px',
      boxShadow: theme.shadows.lg,
      marginBottom: '24px'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
        <div style={{
          width: '40px',
          height: '40px',
          background: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)',
          borderRadius: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <Users size={24} color="white" />
        </div>
        <h3 style={{ fontSize: '20px', fontWeight: '700', color: theme.colors.textDark }}>
          Your Customers
        </h3>
      </div>

      {loading ? (
        <p style={{ color: theme.colors.textGray }}>Loading customers...</p>
      ) : customers.length === 0 ? (
        <p style={{ color: theme.colors.textGray }}>No customer activity yet. The AI is on the hunt!</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {customers.slice(0, 3).map(customer => (
            <div key={customer.id} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '12px',
              background: theme.colors.bgLight,
              borderRadius: '12px',
              border: `1px solid ${theme.colors.borderLight}`
            }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                background: theme.colors.primary,
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: '600',
                fontSize: '16px'
              }}>
                {customer.name ? customer.name.charAt(0).toUpperCase() : 'C'}
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: '600', color: theme.colors.textDark, margin: 0 }}>{customer.name || 'New Prospect'}</p>
                <p style={{ fontSize: '14px', color: theme.colors.textGray, margin: 0 }}>{customer.email}</p>
              </div>
              <div style={{
                ...getStatusStyle(customer.status),
                padding: '4px 10px',
                borderRadius: '20px',
                fontSize: '12px',
                fontWeight: '600'
              }}>
                {customer.status}
              </div>
            </div>
          ))}
        </div>
      )}

      {customers.length > 3 && (
        <button style={{
          width: '100%',
          marginTop: '20px',
          padding: '12px',
          background: 'transparent',
          border: `1px solid ${theme.colors.borderLight}`,
          borderRadius: '12px',
          color: theme.colors.textDark,
          fontWeight: '600',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px'
        }}>
          View All Customers
          <ChevronRight size={16} />
        </button>
      )}
    </div>
  );
};

export default CustomersCard;
