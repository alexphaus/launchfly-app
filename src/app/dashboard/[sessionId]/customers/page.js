// src/app/dashboard/[sessionId]/customers/page.js
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Users, ArrowLeft, Search, Filter, Mail, Calendar, DollarSign, User, Loader2 } from 'lucide-react';

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

export default function CustomersPage() {
  const params = useParams();
  const router = useRouter();
  const [customers, setCustomers] = useState([]);
  const [filteredCustomers, setFilteredCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [business, setBusiness] = useState(null);
  
  const supabase = createClientComponentClient();

  useEffect(() => {
    loadBusinessData();
  }, []);

  useEffect(() => {
    if (business?.id) {
      fetchAllCustomers();
    }
  }, [business]);

  useEffect(() => {
    filterCustomers();
  }, [customers, searchQuery, statusFilter]);

  const loadBusinessData = async () => {
    try {
      const { data: session } = await supabase
        .from('sessions')
        .select('*')
        .eq('id', params.sessionId)
        .single();

      if (session) {
        const { data: businessData } = await supabase
          .from('businesses')
          .select('*')
          .eq('session_id', params.sessionId)
          .single();

        setBusiness(businessData);
      }
    } catch (error) {
      console.error('Error loading business data:', error);
    }
  };

  const fetchAllCustomers = async () => {
    setLoading(true);
    try {
      // Fetch both activities and purchases
      const [activitiesResponse, purchasesResponse] = await Promise.all([
        fetch(`/api/business/${business.id}/activities?limit=500`),
        fetch(`/api/business/${business.id}/purchases`)
      ]);

      const prospects = new Map();

      // Process AI activities
      if (activitiesResponse.ok) {
        const activitiesData = await activitiesResponse.json();
        if (activitiesData.success && activitiesData.activities) {
          activitiesData.activities.forEach(activity => {
            const email = activity.metadata?.recipientEmail;

            if (email) {
              if (!prospects.has(email)) {
                prospects.set(email, {
                  id: email,
                  name: activity.metadata?.recipientName || 'New Prospect',
                  email: email,
                  status: 'Contacted',
                  company: activity.metadata?.recipientCompany || 'N/A',
                  lastContacted: activity.created_at || new Date().toISOString(),
                  activities: [],
                  source: 'AI Outreach'
                });
              }

              const prospect = prospects.get(email);
              prospect.activities.push({
                id: activity.id,
                icon: activity.icon || '📧',
                text: activity.message || activity.text,
                time: new Date(activity.created_at).toLocaleString()
              });

              if (activity.type === 'deal_won' || activity.type === 'converted') {
                prospect.status = 'Converted';
              }
            }
          });
        }
      }

      // Process real purchases
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
                activities: [],
                source: 'Website Purchase',
                totalSpent: purchase.amount
              });
            }

            const customer = prospects.get(customerId);
            
            // Calculate total spent
            if (!customer.totalSpent) customer.totalSpent = 0;
            customer.totalSpent += parseFloat(purchase.amount || 0);

            const purchaseText = `Purchased for $${purchase.amount} ${purchase.currency?.toUpperCase()}`;
            customer.activities.push({
              id: purchase.id,
              icon: '💰',
              text: purchaseText,
              time: new Date(purchase.createdAt).toLocaleString()
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

      const customerList = Array.from(prospects.values()).sort((a, b) => 
        new Date(b.lastContacted) - new Date(a.lastContacted)
      );
      
      setCustomers(customerList);
    } catch (error) {
      console.error('Error fetching customers:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterCustomers = () => {
    let filtered = customers;

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(customer => 
        customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        customer.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        customer.company.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(customer => 
        customer.status.toLowerCase() === statusFilter.toLowerCase()
      );
    }

    setFilteredCustomers(filtered);
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

  const getSourceStyle = (source) => {
    switch (source) {
      case 'AI Outreach':
        return { background: '#e0e7ff', color: '#3730a3' };
      case 'Website Purchase':
        return { background: '#f0fdf4', color: '#15803d' };
      default:
        return { background: '#f3f4f6', color: '#4b5563' };
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
        <div className="header-container" style={{
          maxWidth: '720px',
          margin: '0 auto',
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          gap: '16px'
        }}>
          <button
            onClick={() => router.back()}
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
            All Customers
          </h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="main-container" style={{
        maxWidth: '720px',
        margin: '0 auto',
        padding: '0 24px'
      }}>

        {/* Search & Filter Section */}
        <div style={{
          background: 'white',
          borderRadius: '20px',
          padding: '24px',
          marginBottom: '24px',
          boxShadow: theme.shadows.lg
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
            <Search size={24} color={theme.colors.primary} />
            <h2 style={{ fontSize: '20px', fontWeight: '700', color: theme.colors.textDark }}>
              Find Customers
            </h2>
          </div>

          <div className="search-filter-container" style={{ 
            display: 'flex', 
            gap: '16px', 
            alignItems: 'flex-start',
            flexDirection: 'column'
          }}>
            {/* Search Input */}
            <div style={{ position: 'relative', flex: '1', width: '100%', minWidth: '0' }}>
              <Search size={20} style={{
                position: 'absolute',
                left: '16px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: theme.colors.textGray
              }} />
              <input
                type="text"
                placeholder="Search by name, email, or company..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 16px 12px 48px',
                  border: `2px solid ${theme.colors.borderLight}`,
                  borderRadius: '8px',
                  fontSize: '16px',
                  outline: 'none',
                  transition: 'border-color 0.2s',
                  boxSizing: 'border-box'
                }}
                onFocus={e => e.target.style.borderColor = theme.colors.primary}
                onBlur={e => e.target.style.borderColor = theme.colors.borderLight}
              />
            </div>

            {/* Status Filter */}
            <div className="filter-select-container" style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px',
              width: '100%'
            }}>
              <Filter size={20} color={theme.colors.textGray} />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{
                  flex: 1,
                  padding: '12px 16px',
                  border: `2px solid ${theme.colors.borderLight}`,
                  borderRadius: '8px',
                  fontSize: '16px',
                  outline: 'none',
                  cursor: 'pointer',
                  background: 'white',
                  transition: 'border-color 0.2s'
                }}
                onFocus={e => e.target.style.borderColor = theme.colors.primary}
                onBlur={e => e.target.style.borderColor = theme.colors.borderLight}
              >
                <option value="all">All Status</option>
                <option value="lead">Lead</option>
                <option value="contacted">Contacted</option>
                <option value="converted">Converted</option>
              </select>
            </div>
          </div>

          {/* Results Count */}
          <div style={{ 
            marginTop: '16px',
            padding: '12px 16px',
            background: theme.colors.bgLight,
            borderRadius: '8px',
            border: `1px solid ${theme.colors.borderLight}`
          }}>
            <p style={{ 
              fontSize: '14px', 
              color: theme.colors.textGray, 
              margin: 0,
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <Users size={16} />
              Showing {filteredCustomers.length} of {customers.length} customers
            </p>
          </div>
        </div>

        {/* Customer List */}
        {loading ? (
          <div style={{
            background: 'white',
            borderRadius: '20px',
            padding: '60px',
            textAlign: 'center',
            boxShadow: theme.shadows.lg
          }}>
            <Loader2 size={40} color={theme.colors.primary} style={{ 
              animation: 'spin 1s linear infinite',
              margin: '0 auto 16px'
            }} />
            <p style={{ fontSize: '16px', color: theme.colors.textGray }}>Loading customers...</p>
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div style={{
            background: 'white',
            borderRadius: '20px',
            padding: '60px',
            textAlign: 'center',
            boxShadow: theme.shadows.lg
          }}>
            <Users size={48} color={theme.colors.textGray} style={{ margin: '0 auto 16px' }} />
            <h3 style={{ fontSize: '20px', fontWeight: '600', color: theme.colors.textDark, marginBottom: '8px' }}>
              No customers found
            </h3>
            <p style={{ color: theme.colors.textGray, maxWidth: '400px', margin: '0 auto' }}>
              {searchQuery || statusFilter !== 'all' 
                ? 'Try adjusting your search or filter settings above'
                : 'Your customers will appear here as your AI finds and converts prospects'
              }
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {filteredCustomers.map(customer => (
              <div key={customer.id} className="customer-card" style={{
                background: 'white',
                borderRadius: '20px',
                padding: '24px',
                boxShadow: theme.shadows.lg,
                transition: 'all 0.2s',
                cursor: 'pointer',
                border: `2px solid transparent`
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.borderColor = theme.colors.primary;
                e.currentTarget.style.boxShadow = theme.shadows.xl;
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.borderColor = 'transparent';
                e.currentTarget.style.boxShadow = theme.shadows.lg;
              }}
              >
                <div className="customer-card-content" style={{ 
                  display: 'flex', 
                  alignItems: 'start', 
                  gap: '16px',
                  flexDirection: 'column'
                }}>
                  {/* Avatar */}
                  <div style={{
                    width: '64px',
                    height: '64px',
                    background: theme.gradients.primary,
                    borderRadius: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontSize: '24px',
                    fontWeight: '700',
                    flexShrink: 0,
                    alignSelf: 'flex-start'
                  }}>
                    {customer.name.charAt(0).toUpperCase()}
                  </div>

                  {/* Customer Info */}
                  <div style={{ flex: 1, minWidth: '0' }}>
                    {/* Name and Status Row */}
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '12px', 
                      marginBottom: '12px',
                      flexWrap: 'wrap'
                    }}>
                      <h3 className="customer-name" style={{ 
                        fontSize: '20px', 
                        fontWeight: '700', 
                        color: theme.colors.textDark, 
                        margin: 0,
                        wordBreak: 'break-word'
                      }}>
                        {customer.name}
                      </h3>
                      <div style={{
                        ...getStatusStyle(customer.status),
                        padding: '6px 12px',
                        borderRadius: '20px',
                        fontSize: '12px',
                        fontWeight: '600'
                      }}>
                        {customer.status}
                      </div>
                      <div style={{
                        ...getSourceStyle(customer.source),
                        padding: '6px 12px',
                        borderRadius: '20px',
                        fontSize: '12px',
                        fontWeight: '600'
                      }}>
                        {customer.source}
                      </div>
                    </div>

                    {/* Contact Details */}
                    <div className="customer-details" style={{ 
                      display: 'flex', 
                      flexDirection: 'column',
                      gap: '8px',
                      marginBottom: '12px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: '0' }}>
                        <Mail size={16} color={theme.colors.textGray} />
                        <span style={{ 
                          color: theme.colors.textGray,
                          fontSize: '14px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          {customer.email}
                        </span>
                      </div>
                      
                      {customer.totalSpent && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <DollarSign size={16} color={theme.colors.success} />
                          <span style={{ 
                            color: theme.colors.success, 
                            fontWeight: '600',
                            fontSize: '14px'
                          }}>
                            ${customer.totalSpent.toFixed(2)} spent
                          </span>
                        </div>
                      )}
                      
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Calendar size={16} color={theme.colors.textGray} />
                        <span style={{ 
                          color: theme.colors.textGray,
                          fontSize: '14px'
                        }}>
                          {new Date(customer.lastContacted).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    {/* Activity Summary */}
                    <div style={{
                      padding: '12px 16px',
                      background: theme.colors.bgLight,
                      borderRadius: '8px',
                      border: `1px solid ${theme.colors.borderLight}`
                    }}>
                      <p style={{ 
                        color: theme.colors.textGray, 
                        margin: 0,
                        fontSize: '14px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}>
                        <User size={16} />
                        {customer.activities.length} interaction{customer.activities.length !== 1 ? 's' : ''}
                        {customer.company !== 'N/A' && ` • ${customer.company}`}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <style jsx>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        
        @media (min-width: 640px) {
          .search-filter-container {
            flex-direction: row;
            align-items: center;
          }
          
          .filter-select-container {
            width: auto;
            min-width: 200px;
          }
          
          .customer-card-content {
            flex-direction: row;
          }
          
          .customer-details {
            flex-direction: row;
            gap: 24px;
          }
        }
        
        @media (max-width: 639px) {
          .search-filter-container {
            flex-direction: column;
            align-items: stretch;
          }
          
          .filter-select-container {
            width: 100%;
            min-width: auto;
          }
          
          .customer-card-content {
            flex-direction: column;
          }
          
          .customer-details {
            flex-direction: column;
            gap: 8px;
          }
          
          .customer-name {
            font-size: 18px;
          }
        }
        
        @media (max-width: 480px) {
          .main-container {
            padding: 0 16px;
          }
          
          .header-container {
            padding: 0 16px;
          }
          
          .customer-card {
            padding: 16px;
          }
          
          .customer-name {
            font-size: 16px;
          }
        }
      `}</style>
    </div>
  );
}
