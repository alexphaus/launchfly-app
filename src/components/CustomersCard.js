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
  return [];
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
      },
      {
        id: 'mock-anonymous',
        name: 'Website Customer (Example)',
        email: 'No email provided',
        status: 'Converted',
        company: 'N/A',
        lastContacted: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
        activities: [
          { id: 'mock3-1', icon: '🌐', text: 'Visited landing page', time: '1 hour ago' },
          { id: 'mock3-2', icon: '🛒', text: 'Added "Starter Kit" to cart', time: '55 minutes ago' },
          { id: 'mock3-3', icon: '💰', text: 'Purchased "Starter Kit"', time: '50 minutes ago' },
        ]
      },
      {
        id: 'mock-john-smith',
        name: 'John Smith (Example)',
        email: 'john.smith@example.com',
        status: 'Lead',
        company: 'Solutions Co.',
        lastContacted: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
        activities: [
            { id: 'mock2-1', icon: '🔍', text: 'Identified as a high-potential lead in "Tech" industry', time: '3 days ago' },
            { id: 'mock2-2', icon: '📧', text: 'Sent initial outreach email', time: '1 day ago' },
        ]
      },
      {
        id: 'mock-visitor',
        name: 'Website Visitor (Example)',
        email: 'No email provided',
        status: 'Lead',
        company: 'N/A',
        lastContacted: new Date(Date.now() - 1800000).toISOString(), // 30 minutes ago
        activities: [
          { id: 'mock4-1', icon: '🌐', text: 'Visited landing page from Google search', time: '30 minutes ago' },
          { id: 'mock4-2', icon: '👀', text: 'Viewed "Pro Plan" product page', time: '28 minutes ago' },
          { id: 'mock4-3', icon: '🛒', text: 'Added "Pro Plan" to cart', time: '25 minutes ago' },
        ]
      }
    ];
  };


const CustomersCard = ({ business, onViewAll }) => {
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
      // Fetch both activities and actual purchases
      const [activitiesResponse, purchasesResponse] = await Promise.all([
        fetch(`/api/business/${business.id}/activities?limit=100`),
        fetch(`/api/business/${business.id}/purchases`)
      ]);

      const prospects = new Map();

      // Process AI activities first
      if (activitiesResponse.ok) {
        const activitiesData = await activitiesResponse.json();
        if (activitiesData.success && activitiesData.activities) {
          activitiesData.activities.forEach(activity => {
            const email = activity.metadata?.recipientEmail;
            const isPurchase = (activity.type === 'deal_won' || activity.type === 'converted' || activity.text?.toLowerCase().includes('purchase'));

            // Handle email-based prospects
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
              prospect.activities.push({
                id: activity.id,
                icon: activity.icon || '📧',
                text: activity.message || activity.text,
                time: new Date(activity.created_at).toLocaleString(),
                timestamp: activity.created_at // Keep raw timestamp for sorting
              });
              
              // Update status based on activity
              if (activity.type === 'deal_won' || activity.type === 'converted') {
                prospect.status = 'Converted';
              } else if (activity.type === 'lead') {
                prospect.status = 'Lead';
              }
            } else if (isPurchase || activity.type === 'website_purchase' || activity.type === 'anonymous_purchase') {
                // Handle anonymous purchases from activities
                const customerId = `anonymous-${activity.id}`;
                if (!prospects.has(customerId)) {
                    prospects.set(customerId, {
                        id: customerId,
                        name: 'Website Customer',
                        email: 'No email provided',
                        status: 'Converted',
                        company: 'N/A',
                        lastContacted: activity.created_at || new Date().toISOString(),
                        activities: []
                    });
                }
                prospects.get(customerId).activities.push({
                  id: activity.id,
                  icon: activity.icon || '💰',
                  text: activity.message || activity.text,
                  time: new Date(activity.created_at).toLocaleString(),
                  timestamp: activity.created_at // Keep raw timestamp for sorting
                });
            } else if (activity.type === 'visitor_activity' || activity.type === 'page_view' || activity.type === 'cart_activity') {
                // Handle website visitors
                const visitorId = activity.metadata?.visitorId || `visitor-${activity.id}`;
                if (!prospects.has(visitorId)) {
                    prospects.set(visitorId, {
                        id: visitorId,
                        name: 'Website Visitor',
                        email: 'No email provided',
                        status: 'Lead',
                        company: 'N/A',
                        lastContacted: activity.created_at || new Date().toISOString(),
                        activities: []
                    });
                }
                const visitor = prospects.get(visitorId);
                visitor.activities.push({
                  id: activity.id,
                  icon: activity.icon || '🌐',
                  text: activity.message || activity.text,
                  time: new Date(activity.created_at).toLocaleString(),
                  timestamp: activity.created_at // Keep raw timestamp for sorting
                });
                
                if (activity.type === 'cart_activity' || activity.text?.toLowerCase().includes('cart')) {
                    visitor.status = 'Contacted';
                }
            }
          });
        }
      }

      // Process real Stripe purchases
      if (purchasesResponse.ok) {
        const purchasesData = await purchasesResponse.json();
        console.log('💳 Purchases API response:', purchasesData);
        if (purchasesData.success && purchasesData.purchases) {
          purchasesData.purchases.forEach(purchase => {
            const email = purchase.customerEmail;
            const customerId = email || `purchase-${purchase.id}`;
            
            if (!prospects.has(customerId)) {
              prospects.set(customerId, {
                id: customerId,
                name: purchase.customerName || (email ? 'Customer' : 'Anonymous Customer'),
                email: email || 'No email provided',
                status: purchase.status === 'fulfilled' || purchase.status === 'completed' ? 'Converted' : 'Contacted',
                company: 'N/A',
                lastContacted: purchase.createdAt,
                activities: []
              });
            }

            const customer = prospects.get(customerId);
            
            // Add purchase activity
            const purchaseText = purchase.type === 'order' 
              ? `Purchased order for $${purchase.amount} ${purchase.currency?.toUpperCase()}`
              : `Purchased product for $${purchase.amount} ${purchase.currency?.toUpperCase()}`;
              
            customer.activities.push({
              id: purchase.id,
              icon: '💰',
              text: purchaseText,
              time: new Date(purchase.createdAt).toLocaleString(),
              timestamp: purchase.createdAt // Keep raw timestamp for sorting
            });

            // Update status to converted if purchase was successful
            if (purchase.status === 'fulfilled' || purchase.status === 'completed') {
              customer.status = 'Converted';
            }

            // Update last contacted time if this purchase is more recent
            if (new Date(purchase.createdAt) > new Date(customer.lastContacted)) {
              customer.lastContacted = purchase.createdAt;
            }
          });
        }
      } else {
        console.error('❌ Purchases API failed:', purchasesResponse.status, purchasesResponse.statusText);
        const errorText = await purchasesResponse.text();
        console.error('Error details:', errorText);
      }
          
      const customerList = Array.from(prospects.values())
        .map(customer => ({
          ...customer,
          // Sort activities by timestamp, most recent first
          activities: customer.activities.sort((a, b) => 
            new Date(b.timestamp || b.time) - new Date(a.timestamp || a.time)
          )
        }))
        .sort((a, b) => new Date(b.lastContacted) - new Date(a.lastContacted));
      console.log('👥 Total real customers found:', customerList.length);
      const mockCustomers = generateMockCustomers();
      const combinedList = [...mockCustomers, ...customerList];
      setCustomers(combinedList);
      
    } catch (error) {
      console.error('Error fetching customer data:', error);
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
        <button 
          onClick={() => onViewAll && onViewAll()}
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
            transition: 'all 0.2s'
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = theme.colors.bgLight;
            e.currentTarget.style.borderColor = theme.colors.primary;
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.borderColor = theme.colors.borderLight;
          }}
        >
          View All Customers ({customers.length})
          <ChevronRight size={16} />
        </button>
      )}

      <CustomerDetailModal customer={selectedCustomer} onClose={() => setSelectedCustomer(null)} />
    </div>
  );
};

export default CustomersCard;
