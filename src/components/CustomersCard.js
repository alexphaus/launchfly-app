// src/components/CustomersCard.js
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Users, Mail, DollarSign, ChevronRight, TrendingUp, UserPlus } from 'lucide-react';

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
  const router = useRouter();
  const [customers, setCustomers] = useState([]);
  const [stats, setStats] = useState({ total: 0, newThisWeek: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (business?.id) {
      fetchCustomers();
      fetchCustomerStats();
    }
  }, [business?.id]);

  const fetchCustomers = async () => {
    try {
      // Fetch only recent customers for the card preview
      const response = await fetch(`/api/business/${business.id}/customers?limit=3`);
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setCustomers(data.customers);
        }
      }
    } catch (error) {
      console.error('Error fetching recent customers:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomerStats = async () => {
    try {
      const response = await fetch(`/api/business/${business.id}/customers/stats`);
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setStats({
            total: data.stats.totalCustomers,
            newThisWeek: data.stats.newThisWeek,
          });
        }
      }
    } catch (error) {
      console.error('Error fetching customer stats:', error);
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
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
      </div>
      
      {/* Customer Stats */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '16px',
        marginBottom: '24px',
        paddingBottom: '24px',
        borderBottom: `1px solid ${theme.colors.borderLight}`
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <UserPlus size={20} color={theme.colors.primary} />
          <div>
            <p style={{ fontSize: '22px', fontWeight: '700', color: theme.colors.textDark, margin: 0 }}>
              {stats.newThisWeek}
            </p>
            <p style={{ fontSize: '14px', color: theme.colors.textGray, margin: 0 }}>
              New This Week
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <TrendingUp size={20} color={theme.colors.success} />
          <div>
            <p style={{ fontSize: '22px', fontWeight: '700', color: theme.colors.textDark, margin: 0 }}>
              {stats.total}
            </p>
            <p style={{ fontSize: '14px', color: theme.colors.textGray, margin: 0 }}>
              Total Customers
            </p>
          </div>
        </div>
      </div>

      <p style={{ fontSize: '14px', fontWeight: '600', color: theme.colors.textGray, marginBottom: '16px', textTransform: 'uppercase' }}>
        Recent Activity
      </p>

      {loading ? (
        <p style={{ color: theme.colors.textGray, textAlign: 'center' }}>Loading customers...</p>
      ) : customers.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <p style={{ color: theme.colors.textGray }}>No customer activity yet.</p>
          <p style={{ color: theme.colors.textGray, fontSize: '14px' }}>The AI is on the hunt!</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {customers.map(customer => (
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

      {stats.total > 0 && (
        <button 
          onClick={() => router.push(`/dashboard/${business.session_id}/customers`)}
          style={{
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
          gap: '8px',
          transition: 'background 0.2s'
        }}
        onMouseEnter={e => e.target.style.background = theme.colors.bgLight}
        onMouseLeave={e => e.target.style.background = 'transparent'}
        >
          Manage All Customers
          <ChevronRight size={16} />
        </button>
      )}
    </div>
  );
};

export default CustomersCard;
