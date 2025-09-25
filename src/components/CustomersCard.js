// src/components/CustomersCard.js
import React, { useState, useEffect } from 'react';
import { Users, ChevronRight, X } from 'lucide-react';

const theme = {
  colors: {
    primary: '#007BFF',
    textDark: '#1A2B48',
    textGray: '#5A6982',
    bgLight: '#F9FAFB',
    borderLight: '#E4E7EB',
    success: '#28a745',
    white: '#ffffff',
  },
  shadows: {
    lg: '0 12px 20px rgba(26, 43, 72, 0.1)',
    xl: '0 24px 32px rgba(26, 43, 72, 0.12)',
  },
};

// --- COMPONENT: Customer Detail Modal ---
const CustomerDetailModal = ({ customer, onClose }) => {
  if (!customer) return null;

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
        background: theme.colors.white,
        borderRadius: '20px',
        padding: '32px',
        maxWidth: '600px',
        width: '100%',
        maxHeight: '80vh',
        overflow: 'auto',
        boxShadow: theme.shadows.xl
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '24px' }}>
          <div>
            <h2 style={{ fontSize: '24px', fontWeight: '700', color: theme.colors.textDark, margin: 0 }}>
              {customer.name}
            </h2>
            <p style={{ fontSize: '16px', color: theme.colors.textGray, margin: '4px 0 0 0' }}>{customer.email}</p>
          </div>
          <button
            onClick={onClose}
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

        {/* Customer Details */}
        <div style={{ marginBottom: '24px', display: 'flex', gap: '16px' }}>
            <div style={{flex: 1}}>
                <p style={{fontSize: '14px', color: theme.colors.textGray, margin: 0}}>Company</p>
                <p style={{fontSize: '16px', color: theme.colors.textDark, margin: '4px 0 0 0', fontWeight: '500'}}>{customer.company}</p>
            </div>
            <div style={{flex: 1}}>
                <p style={{fontSize: '14px', color: theme.colors.textGray, margin: 0}}>Status</p>
                <p style={{fontSize: '16px', color: theme.colors.textDark, margin: '4px 0 0 0', fontWeight: '500'}}>{customer.status}</p>
            </div>
        </div>

        {/* Activity History */}
        <div>
          <h4 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px', color: theme.colors.textDark }}>
            Activity History
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {customer.activities.map((activity) => (
              <div key={activity.id} style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px',
                background: theme.colors.bgLight,
                borderRadius: '8px'
              }}>
                <span style={{ fontSize: '20px' }}>{activity.icon}</span>
                <div style={{flex: 1}}>
                  <p style={{ fontSize: '14px', color: theme.colors.textDark, margin: 0, fontWeight: '500' }}>{activity.text}</p>
                  <p style={{ fontSize: '12px', color: theme.colors.textGray, margin: '4px 0 0 0' }}>{activity.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const generateMockCustomers = () => {
    return [
      {
        id: 'mock-jane-doe',
        name: 'Jane Doe (Example)',
        email: 'jane.doe@example.com',
        status: 'Converted',
        company: 'Innovate Inc.',
        lastContacted: new Date().toISOString(),
        activities: [
          { id: 'mock1-1', icon: '📧', text: 'Sent cold email: "Introduction to Launchfly"', time: '2 days ago' },
          { id: 'mock1-2', icon: '✅', text: 'Opened email', time: '2 days ago' },
          { id: 'mock1-3', icon: '💬', text: 'Replied to email: "Interested, tell me more."', time: '1 day ago' },
          { id: 'mock1-4', icon: '💰', text: 'Purchased "Pro Plan"', time: 'Just now' },
        ]
      }
    ];
  };


const CustomersCard = ({ business }) => {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCustomer, setSelectedCustomer] = useState(null); // State for modal

  useEffect(() => {
    if (business?.id) {
      fetchCustomerData();
    }
  }, [business?.id]);

  const fetchCustomerData = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/business/${business.id}/activities?limit=100`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.activities) {
          const prospects = new Map();
          
          data.activities.forEach(activity => {
            const email = activity.metadata?.recipientEmail;

            // Simple check for customer-related activities
            if (email) {
              if (!prospects.has(email)) {
                prospects.set(email, {
                  id: email,
                  name: activity.metadata?.recipientName || 'New Prospect',
                  email: email,
                  status: 'Contacted', // Default status
                  company: activity.metadata?.recipientCompany || 'N/A',
                  lastContacted: activity.created_at || new Date().toISOString(),
                  activities: []
                });
              }

              const prospect = prospects.get(email);
              prospect.activities.push(activity);
              
              // Simplistic status update logic
              if (activity.type === 'deal_won' || activity.type === 'converted') {
                prospect.status = 'Converted';
              } else if (activity.type === 'lead') {
                prospect.status = 'Lead';
              }
            }
          });
          
          const customerList = Array.from(prospects.values()).sort((a, b) => new Date(b.lastContacted) - new Date(a.lastContacted));
          const mockCustomers = generateMockCustomers();
          const combinedList = [...mockCustomers, ...customerList];
          setCustomers(combinedList);
        }
      }
    } catch (error) {
      console.error('Error fetching customer activities:', error);
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
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
        {customers.length > 0 && 
            <span style={{fontSize: '14px', fontWeight: '500', color: theme.colors.textGray}}>{customers.length} Prospects</span>
        }
      </div>

      {loading ? (
        <p style={{ color: theme.colors.textGray }}>Loading customers...</p>
      ) : customers.length === 0 ? (
        <p style={{ color: theme.colors.textGray }}>No customer activity yet. The AI is on the hunt!</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {customers.slice(0, 5).map(customer => (
            <div key={customer.id} onClick={() => setSelectedCustomer(customer)} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '12px',
              background: theme.colors.bgLight,
              borderRadius: '12px',
              border: `1px solid ${theme.colors.borderLight}`,
              cursor: 'pointer',
              transition: 'background 0.2s'
            }}
            onMouseEnter={e => e.currentTarget.style.background = '#f0f0f0'}
            onMouseLeave={e => e.currentTarget.style.background = theme.colors.bgLight}
            >
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
                fontSize: '16px',
                flexShrink: 0
              }}>
                {customer.name ? customer.name.charAt(0).toUpperCase() : 'C'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontWeight: '600', color: theme.colors.textDark, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{customer.name || 'New Prospect'}</p>
                <p style={{ fontSize: '14px', color: theme.colors.textGray, margin: '2px 0 0 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{customer.email}</p>
              </div>
              <div style={{
                ...getStatusStyle(customer.status),
                padding: '4px 10px',
                borderRadius: '20px',
                fontSize: '12px',
                fontWeight: '600',
                marginLeft: 'auto'
              }}>
                {customer.status}
              </div>
              <ChevronRight size={16} color={theme.colors.textGray} />
            </div>
          ))}
        </div>
      )}

      {customers.length > 5 && (
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
          View All Customers ({customers.length})
          <ChevronRight size={16} />
        </button>
      )}

      <CustomerDetailModal customer={selectedCustomer} onClose={() => setSelectedCustomer(null)} />
    </div>
  );
};

export default CustomersCard;
