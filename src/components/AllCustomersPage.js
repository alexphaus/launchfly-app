// src/components/AllCustomersPage.js
'use client';

import React, { useState, useEffect } from 'react';
import { ArrowLeft, Users, Search, Filter, Mail, Phone, Calendar, DollarSign, X, Download } from 'lucide-react';
import { exportToCSV, downloadCSV } from '@/lib/utils/customer-helpers';

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

// Customer Detail Modal
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
        <div style={{ marginBottom: '24px', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            <div style={{flex: 1, minWidth: '120px'}}>
                <p style={{fontSize: '14px', color: theme.colors.textGray, margin: 0}}>Company</p>
                <p style={{fontSize: '16px', color: theme.colors.textDark, margin: '4px 0 0 0', fontWeight: '500'}}>{customer.company}</p>
            </div>
            <div style={{flex: 1, minWidth: '120px'}}>
                <p style={{fontSize: '14px', color: theme.colors.textGray, margin: 0}}>Status</p>
                <p style={{fontSize: '16px', color: theme.colors.textDark, margin: '4px 0 0 0', fontWeight: '500'}}>{customer.status}</p>
            </div>
        </div>

        {/* Activity History */}
        <div>
          <h4 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px', color: theme.colors.textDark }}>
            Activity History
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '300px', overflowY: 'auto' }}>
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

const AllCustomersPage = ({ business, onBack }) => {
  const [customers, setCustomers] = useState([]);
  const [filteredCustomers, setFilteredCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (business?.id) {
      fetchAllCustomers();
    }
  }, [business?.id]);

  useEffect(() => {
    // Filter customers based on search and status
    let filtered = customers;

    if (searchTerm) {
      filtered = filtered.filter(customer => 
        customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer.company.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(customer => 
        customer.status.toLowerCase() === statusFilter.toLowerCase()
      );
    }

    setFilteredCustomers(filtered);
  }, [customers, searchTerm, statusFilter]);

  const fetchAllCustomers = async () => {
    setLoading(true);
    try {
      // Fetch both activities and actual purchases
      const [activitiesResponse, purchasesResponse] = await Promise.all([
        fetch(`/api/business/${business.id}/activities?limit=200`),
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
                  status: 'Contacted',
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
              
              if (activity.type === 'deal_won' || activity.type === 'converted') {
                prospect.status = 'Converted';
              } else if (activity.type === 'lead') {
                prospect.status = 'Lead';
              }
            } else if (isPurchase || activity.type === 'website_purchase' || activity.type === 'anonymous_purchase') {
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

            if (purchase.status === 'fulfilled' || purchase.status === 'completed') {
              customer.status = 'Converted';
            }

            if (new Date(purchase.createdAt) > new Date(customer.lastContacted)) {
              customer.lastContacted = purchase.createdAt;
            }
          });
        }
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
      setCustomers(customerList);
      
    } catch (error) {
      console.error('Error fetching all customers:', error);
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

  const handleExport = async () => {
    setExporting(true);
    try {
      const csvContent = exportToCSV(filteredCustomers);
      downloadCSV(csvContent, `customers-${business.name || 'export'}-${Date.now()}.csv`);
    } catch (error) {
      console.error('Error exporting customers:', error);
    } finally {
      setExporting(false);
    }
  };

  const statusCounts = {
    all: customers.length,
    lead: customers.filter(c => c.status === 'Lead').length,
    contacted: customers.filter(c => c.status === 'Contacted').length,
    converted: customers.filter(c => c.status === 'Converted').length,
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
          maxWidth: '1200px',
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
            <span style={{ display: window.innerWidth > 640 ? 'inline' : 'none' }}>Back to Dashboard</span>
          </button>
          
          <div style={{ 
            height: '24px', 
            width: '1px', 
            background: theme.colors.borderLight 
          }} />
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
            <Users size={24} color={theme.colors.primary} />
            <h1 style={{ 
              fontSize: '24px', 
              fontWeight: '700', 
              color: theme.colors.textDark,
              margin: 0
            }}>
              All Customers
            </h1>
            <span style={{
              background: theme.colors.primary,
              color: 'white',
              padding: '4px 12px',
              borderRadius: '20px',
              fontSize: '14px',
              fontWeight: '600'
            }}>
              {customers.length}
            </span>
          </div>
          
          {/* Export CSV Button */}
          {customers.length > 0 && (
            <button
              onClick={handleExport}
              disabled={exporting}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 20px',
                background: 'white',
                border: `2px solid ${theme.colors.borderLight}`,
                borderRadius: '12px',
                color: theme.colors.textDark,
                fontSize: '14px',
                fontWeight: '600',
                cursor: exporting ? 'not-allowed' : 'pointer',
                opacity: exporting ? 0.6 : 1,
                transition: 'all 0.2s'
              }}
              onMouseEnter={e => !exporting && (e.target.style.borderColor = theme.colors.primary)}
              onMouseLeave={e => !exporting && (e.target.style.borderColor = theme.colors.borderLight)}
            >
              <Download size={16} />
              {exporting ? 'Exporting...' : 'Export CSV'}
            </button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '0 24px'
      }}>

        {/* Search and Filter Bar */}
        <div style={{
          background: 'white',
          borderRadius: '20px',
          padding: '24px',
          marginBottom: '24px',
          boxShadow: theme.shadows.lg
        }}>
          <div style={{
            display: 'flex',
            flexDirection: window.innerWidth > 768 ? 'row' : 'column',
            gap: '16px',
            alignItems: window.innerWidth > 768 ? 'center' : 'stretch'
          }}>
            {/* Search */}
            <div style={{ flex: 1, position: 'relative' }}>
              <Search size={20} style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: theme.colors.textGray
              }} />
              <input
                type="text"
                placeholder="Search customers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 12px 12px 44px',
                  border: `2px solid ${theme.colors.borderLight}`,
                  borderRadius: '12px',
                  fontSize: '16px',
                  outline: 'none',
                  transition: 'border-color 0.2s'
                }}
                onFocus={e => e.target.style.borderColor = theme.colors.primary}
                onBlur={e => e.target.style.borderColor = theme.colors.borderLight}
              />
            </div>

            {/* Status Filter */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {[
                { key: 'all', label: 'All', count: statusCounts.all },
                { key: 'converted', label: 'Converted', count: statusCounts.converted },
                { key: 'contacted', label: 'Contacted', count: statusCounts.contacted },
                { key: 'lead', label: 'Leads', count: statusCounts.lead }
              ].map(filter => (
                <button
                  key={filter.key}
                  onClick={() => setStatusFilter(filter.key)}
                  style={{
                    background: statusFilter === filter.key ? theme.colors.primary : 'transparent',
                    color: statusFilter === filter.key ? 'white' : theme.colors.textGray,
                    border: `2px solid ${statusFilter === filter.key ? theme.colors.primary : theme.colors.borderLight}`,
                    borderRadius: '20px',
                    padding: '8px 16px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  {filter.label}
                  <span style={{
                    background: statusFilter === filter.key ? 'rgba(255,255,255,0.3)' : theme.colors.bgLight,
                    padding: '2px 8px',
                    borderRadius: '10px',
                    fontSize: '12px'
                  }}>
                    {filter.count}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Customers List */}
        <div style={{
          background: 'white',
          borderRadius: '20px',
          padding: '24px',
          boxShadow: theme.shadows.lg
        }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: theme.colors.textGray }}>
              Loading customers...
            </div>
          ) : filteredCustomers.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: theme.colors.textGray }}>
              {searchTerm || statusFilter !== 'all' ? 'No customers match your filters' : 'No customers found'}
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: window.innerWidth > 768 ? 'repeat(auto-fill, minmax(350px, 1fr))' : '1fr',
              gap: '16px'
            }}>
              {filteredCustomers.map(customer => (
                <div
                  key={customer.id}
                  onClick={() => setSelectedCustomer(customer)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    padding: '20px',
                    background: theme.colors.bgLight,
                    borderRadius: '16px',
                    border: `2px solid ${theme.colors.borderLight}`,
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = '#f0f0f0';
                    e.currentTarget.style.borderColor = theme.colors.primary;
                    e.currentTarget.style.transform = 'translateY(-2px)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = theme.colors.bgLight;
                    e.currentTarget.style.borderColor = theme.colors.borderLight;
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  <div style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '50%',
                    background: theme.gradients.primary,
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: '700',
                    fontSize: '20px',
                    flexShrink: 0
                  }}>
                    {customer.name ? customer.name.charAt(0).toUpperCase() : 'C'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 style={{
                      fontSize: '18px',
                      fontWeight: '600',
                      color: theme.colors.textDark,
                      margin: '0 0 4px 0',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}>
                      {customer.name || 'New Prospect'}
                    </h3>
                    <p style={{
                      fontSize: '14px',
                      color: theme.colors.textGray,
                      margin: '0 0 8px 0',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}>
                      {customer.email}
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                      <div style={{
                        ...getStatusStyle(customer.status),
                        padding: '4px 12px',
                        borderRadius: '20px',
                        fontSize: '12px',
                        fontWeight: '600'
                      }}>
                        {customer.status}
                      </div>
                      <span style={{ fontSize: '12px', color: theme.colors.textGray }}>
                        {customer.activities.length} activities
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Customer Detail Modal */}
      {selectedCustomer && (
        <CustomerDetailModal
          customer={selectedCustomer}
          onClose={() => setSelectedCustomer(null)}
        />
      )}

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

export default AllCustomersPage;
