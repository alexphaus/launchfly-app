// src/components/EnhancedCustomerCard.js
'use client';

import React, { useState, useEffect } from 'react';
import { Users, ChevronRight, X, Mail, MessageSquare, DollarSign, TrendingUp, Tag } from 'lucide-react';
import { formatRelativeTime } from '@/lib/utils/date-format';
import { calculateEngagementScore, getLeadTemperature, getSuggestedNextAction } from '@/lib/utils/customer-helpers';

const theme = {
  colors: {
    primary: '#007BFF',
    textDark: '#1A2B48',
    textGray: '#5A6982',
    bgLight: '#F9FAFB',
    borderLight: '#E4E7EB',
    success: '#28a745',
    warning: '#f59e0b',
    danger: '#dc3545',
    white: '#ffffff',
  },
  shadows: {
    lg: '0 12px 20px rgba(26, 43, 72, 0.1)',
    xl: '0 24px 32px rgba(26, 43, 72, 0.12)',
  },
};

// Enhanced Customer Detail Modal
const EnhancedCustomerDetailModal = ({ customer, business, onClose, onRefresh }) => {
  const [note, setNote] = useState('');
  const [notes, setNotes] = useState([]);
  const [addingNote, setAddingNote] = useState(false);
  
  // Lock body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  useEffect(() => {
    if (customer) {
      fetchNotes();
    }
  }, [customer]);

  const fetchNotes = async () => {
    try {
      const response = await fetch(`/api/customers/${customer.email}/notes`);
      if (response.ok) {
        const data = await response.json();
        setNotes(data.notes || []);
      }
    } catch (error) {
      console.error('Error fetching notes:', error);
    }
  };

  const handleAddNote = async () => {
    if (!note.trim()) return;
    
    setAddingNote(true);
    try {
      const response = await fetch(`/api/customers/${customer.email}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId: business.id,
          note: note.trim()
        })
      });

      if (response.ok) {
        setNote('');
        await fetchNotes();
      }
    } catch (error) {
      console.error('Error adding note:', error);
    } finally {
      setAddingNote(false);
    }
  };

  const handleSendEmail = () => {
    if (customer.email && customer.email !== 'No email provided') {
      window.location.href = `mailto:${customer.email}`;
    }
  };

  if (!customer) return null;

  const engagementScore = calculateEngagementScore(customer.activities || []);
  const leadTemp = getLeadTemperature(customer);
  const nextAction = getSuggestedNextAction(customer);

  const tempColors = {
    hot: { bg: '#fee2e2', color: '#dc2626', label: '🔥 Hot Lead' },
    warm: { bg: '#fef3c7', color: '#d97706', label: '⚡ Warm Lead' },
    cold: { bg: '#e0f2fe', color: '#0284c7', label: '❄️ Cold Lead' }
  };

  return (
    <div 
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(2px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '20px',
        animation: 'fadeIn 0.2s ease'
      }}
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        style={{
          background: theme.colors.white,
          borderRadius: '20px',
          padding: '28px',
          maxWidth: '520px',
          width: '100%',
          maxHeight: '85vh',
          overflow: 'auto',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.2)',
          animation: 'slideInUp 0.3s ease'
        }}
      >
        {/* Header - Compact */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'start', 
          marginBottom: '20px',
          paddingBottom: '16px',
          borderBottom: `2px solid ${theme.colors.bgLight}`
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px', flexWrap: 'wrap' }}>
              <h2 style={{ 
                fontSize: '22px', 
                fontWeight: '800', 
                color: theme.colors.textDark, 
                margin: 0,
                letterSpacing: '-0.5px'
              }}>
                {customer.name}
              </h2>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                background: tempColors[leadTemp].bg,
                color: tempColors[leadTemp].color,
                padding: '4px 10px',
                borderRadius: '16px',
                fontSize: '12px',
                fontWeight: '700'
              }}>
                {tempColors[leadTemp].label}
              </div>
            </div>
            <p style={{ 
              fontSize: '14px', 
              color: theme.colors.textGray, 
              margin: 0,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}>
              {customer.email}
            </p>
          </div>
          
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '6px',
              color: theme.colors.textGray,
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s',
              flexShrink: 0,
              marginLeft: '12px'
            }}
            onMouseEnter={e => e.target.style.background = theme.colors.bgLight}
            onMouseLeave={e => e.target.style.background = 'transparent'}
          >
            <X size={22} />
          </button>
        </div>

        {/* Quick Stats - Compact Grid */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(2, 1fr)', 
          gap: '10px',
          marginBottom: '18px'
        }}>
          <div style={{
            background: theme.colors.bgLight,
            padding: '10px 12px',
            borderRadius: '10px'
          }}>
            <p style={{ fontSize: '11px', color: theme.colors.textGray, margin: 0, fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
              Company
            </p>
            <p style={{ fontSize: '14px', color: theme.colors.textDark, margin: '4px 0 0 0', fontWeight: '700' }}>
              {customer.company}
            </p>
          </div>
          
          <div style={{
            background: theme.colors.bgLight,
            padding: '10px 12px',
            borderRadius: '10px'
          }}>
            <p style={{ fontSize: '11px', color: theme.colors.textGray, margin: 0, fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
              Status
            </p>
            <p style={{ fontSize: '14px', color: theme.colors.textDark, margin: '4px 0 0 0', fontWeight: '700' }}>
              {customer.status}
            </p>
          </div>
          
          <div style={{
            background: theme.colors.bgLight,
            padding: '10px 12px',
            borderRadius: '10px'
          }}>
            <p style={{ fontSize: '11px', color: theme.colors.textGray, margin: 0, fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
              Engagement
            </p>
            <p style={{ fontSize: '14px', color: theme.colors.textDark, margin: '4px 0 0 0', fontWeight: '700' }}>
              {engagementScore}/100
            </p>
          </div>
          
          <div style={{
            background: theme.colors.bgLight,
            padding: '10px 12px',
            borderRadius: '10px'
          }}>
            <p style={{ fontSize: '11px', color: theme.colors.textGray, margin: 0, fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
              Value
            </p>
            <p style={{ fontSize: '14px', color: theme.colors.textDark, margin: '4px 0 0 0', fontWeight: '700' }}>
              ${customer.totalValue || 0}
            </p>
          </div>
        </div>

        {/* Suggested Next Action - Compact */}
        <div style={{
          background: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)',
          padding: '10px 14px',
          borderRadius: '10px',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'start',
          gap: '10px'
        }}>
          <TrendingUp size={16} color="#0284c7" style={{ marginTop: '2px', flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: '11px', color: '#0369a1', margin: 0, fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
              Next Step
            </p>
            <p style={{ fontSize: '13px', color: '#075985', margin: '4px 0 0 0', fontWeight: '500', lineHeight: '1.4' }}>
              {nextAction}
            </p>
          </div>
        </div>

        {/* Quick Actions - Compact */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '18px' }}>
          <button
            onClick={handleSendEmail}
            disabled={customer.email === 'No email provided'}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: '10px 12px',
              background: customer.email === 'No email provided' 
                ? theme.colors.borderLight 
                : 'linear-gradient(135deg, #007BFF 0%, #0056b3 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              fontSize: '13px',
              fontWeight: '700',
              cursor: customer.email === 'No email provided' ? 'not-allowed' : 'pointer',
              opacity: customer.email === 'No email provided' ? 0.5 : 1,
              transition: 'all 0.2s'
            }}
            onMouseEnter={e => customer.email !== 'No email provided' && (e.target.style.transform = 'translateY(-1px)')}
            onMouseLeave={e => customer.email !== 'No email provided' && (e.target.style.transform = 'translateY(0)')}
          >
            <Mail size={16} />
            Email
          </button>
          
          <button
            onClick={() => document.getElementById('note-input')?.focus()}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: '10px 12px',
              background: 'white',
              color: '#007BFF',
              border: `2px solid #007BFF`,
              borderRadius: '10px',
              fontSize: '13px',
              fontWeight: '700',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseEnter={e => {
              e.target.style.background = '#007BFF';
              e.target.style.color = 'white';
            }}
            onMouseLeave={e => {
              e.target.style.background = 'white';
              e.target.style.color = '#007BFF';
            }}
          >
            <MessageSquare size={16} />
            Note
          </button>
        </div>

        {/* Notes Section - Compact */}
        <div style={{ marginBottom: '18px' }}>
          <h4 style={{ 
            fontSize: '14px', 
            fontWeight: '700', 
            marginBottom: '10px', 
            color: theme.colors.textDark,
            letterSpacing: '-0.2px'
          }}>
            Notes
          </h4>
          
          {/* Add Note - Compact */}
          <div style={{ marginBottom: '12px' }}>
            <textarea
              id="note-input"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add a note..."
              style={{
                width: '100%',
                padding: '10px',
                border: `2px solid ${theme.colors.borderLight}`,
                borderRadius: '8px',
                fontSize: '13px',
                resize: 'vertical',
                minHeight: '60px',
                outline: 'none',
                fontFamily: 'inherit'
              }}
              onFocus={e => e.target.style.borderColor = theme.colors.primary}
              onBlur={e => e.target.style.borderColor = theme.colors.borderLight}
            />
            <button
              onClick={handleAddNote}
              disabled={!note.trim() || addingNote}
              style={{
                marginTop: '6px',
                padding: '6px 14px',
                background: !note.trim() || addingNote ? '#d1d5db' : theme.colors.primary,
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: '700',
                cursor: !note.trim() || addingNote ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s'
              }}
            >
              {addingNote ? 'Saving...' : 'Save Note'}
            </button>
          </div>

          {/* Display Notes */}
          {notes.length > 0 ? (
            <div>
              {notes.map((n, idx) => (
                <div key={idx} style={{
                  background: theme.colors.bgLight,
                  padding: '8px 10px',
                  borderRadius: '6px',
                  marginBottom: '6px'
                }}>
                  <p style={{ fontSize: '13px', color: theme.colors.textDark, margin: 0, lineHeight: '1.4' }}>
                    {n.note}
                  </p>
                  <p style={{ fontSize: '11px', color: theme.colors.textGray, margin: '4px 0 0 0' }}>
                    {formatRelativeTime(n.created_at)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ fontSize: '12px', color: theme.colors.textGray, fontStyle: 'italic', margin: 0 }}>
              No notes yet
            </p>
          )}
        </div>

        {/* Activity History */}
        <div>
          <h4 style={{ 
            fontSize: '14px', 
            fontWeight: '700', 
            marginBottom: '10px', 
            color: theme.colors.textDark,
            letterSpacing: '-0.2px'
          }}>
            Activity History
          </h4>
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '8px'
          }}>
            {customer.activities && customer.activities.length > 0 ? (
              customer.activities.map((activity) => (
                <div key={activity.id} style={{
                  display: 'flex',
                  alignItems: 'start',
                  gap: '10px',
                  padding: '10px',
                  background: theme.colors.bgLight,
                  borderRadius: '8px',
                  transition: 'all 0.2s'
                }}>
                  <span style={{ fontSize: '18px', flexShrink: 0 }}>{activity.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ 
                      fontSize: '13px', 
                      color: theme.colors.textDark, 
                      margin: 0, 
                      fontWeight: '600',
                      lineHeight: '1.3'
                    }}>
                      {activity.text}
                    </p>
                    <p style={{ fontSize: '11px', color: theme.colors.textGray, margin: '4px 0 0 0' }}>
                      {formatRelativeTime(activity.time)}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p style={{ fontSize: '13px', color: theme.colors.textGray, fontStyle: 'italic', textAlign: 'center', padding: '20px 0' }}>
                No activity yet
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const EnhancedCustomersCard = ({ business, onViewAll }) => {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  useEffect(() => {
    if (business?.id) {
      fetchCustomerData();
    }
  }, [business?.id]);

  const fetchCustomerData = async () => {
    setLoading(true);
    try {
      const [activitiesResponse, purchasesResponse] = await Promise.all([
        fetch(`/api/business/${business.id}/activities?limit=100`),
        fetch(`/api/business/${business.id}/purchases`)
      ]);

      const prospects = new Map();

      // Email normalizer to avoid runtime errors and duplicates
      const normalizeEmail = (value) => {
        if (!value) return '';
        if (typeof value === 'string') return value.trim().toLowerCase();
        if (Array.isArray(value)) return String(value[0] || '').trim().toLowerCase();
        if (typeof value === 'object' && value.email) return String(value.email).trim().toLowerCase();
        try {
          return String(value).trim().toLowerCase();
        } catch {
          return '';
        }
      };

      // Process AI activities
      if (activitiesResponse.ok) {
        const activitiesData = await activitiesResponse.json();
        if (activitiesData.success && activitiesData.activities) {
          activitiesData.activities.forEach(activity => {
            // Normalize email for consistent grouping (trim + lowercase)
            const email = normalizeEmail(activity.metadata?.recipientEmail);

            if (email && email.includes('@')) {
              if (!prospects.has(email)) {
                prospects.set(email, {
                  id: email,
                  name: activity.metadata?.recipientName || 'New Prospect',
                  email: email,
                  status: 'Contacted',
                  company: activity.metadata?.recipientCompany || 'N/A',
                  lastContacted: activity.created_at || new Date().toISOString(),
                  totalValue: 0,
                  activities: []
                });
              }

              const prospect = prospects.get(email);
              prospect.activities.push({
                id: activity.id,
                icon: activity.icon || '📧',
                text: activity.message || activity.text,
                time: activity.created_at
              });
              
              // Update status based on activity type
              if (activity.type === 'lead_magnet') prospect.status = 'Lead';
              if (activity.type === 'email_opened') prospect.status = 'Engaged';
              if (activity.type === 'email_clicked') prospect.status = 'Engaged';
              if (activity.type === 'email_replied') prospect.status = 'Engaged';
              if (activity.type === 'deal_won' || activity.type === 'converted') prospect.status = 'Converted';
            }
          });
        }
      }

      // Process purchases
      if (purchasesResponse.ok) {
        const purchasesData = await purchasesResponse.json();
        if (purchasesData.success && purchasesData.purchases) {
          purchasesData.purchases.forEach(purchase => {
            // Normalize email when available
            const normalizedEmail = normalizeEmail(purchase.customerEmail);
            const email = (normalizedEmail && normalizedEmail.includes('@')) ? normalizedEmail : `purchase-${purchase.id}`;

            if (!prospects.has(email)) {
              prospects.set(email, {
                id: email,
                name: purchase.customerName || 'Customer',
                email: normalizedEmail || 'No email provided',
                status: 'Converted',
                company: 'N/A',
                lastContacted: purchase.createdAt,
                totalValue: 0,
                activities: []
              });
            }

            const customer = prospects.get(email);
            customer.totalValue = (customer.totalValue || 0) + (purchase.amount || 0);
            customer.status = 'Converted';
            
            customer.activities.push({
              id: purchase.id,
              icon: '💰',
              text: `Purchased for $${purchase.amount} ${purchase.currency?.toUpperCase()}`,
              time: purchase.createdAt
            });

            if (new Date(purchase.createdAt) > new Date(customer.lastContacted)) {
              customer.lastContacted = purchase.createdAt;
            }
          });
        }
      }
          
      const customerList = Array.from(prospects.values())
        .map(customer => ({
          ...customer,
          // Sort activities by time, most recent first
          activities: customer.activities.sort((a, b) => new Date(b.time) - new Date(a.time))
        }))
        .sort((a, b) => new Date(b.lastContacted) - new Date(a.lastContacted));
      
      setCustomers(customerList);
      
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
      case 'Engaged':
        return { background: '#ddd6fe', color: '#7c3aed' };
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
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
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
          <div>
            <h3 style={{ fontSize: '20px', fontWeight: '700', color: theme.colors.textDark, margin: 0 }}>
              Your Customers
            </h3>
            {customers.length > 0 && (
              <p style={{ fontSize: '14px', color: theme.colors.textGray, margin: '2px 0 0 0' }}>
                {customers.filter(c => c.status === 'Converted').length} converted • {customers.length} total
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Customer List */}
      {loading ? (
        <p style={{ color: theme.colors.textGray }}>Loading customers...</p>
      ) : customers.length === 0 ? (
        <p style={{ color: theme.colors.textGray }}>No customer activity yet. The AI is on the hunt!</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {customers.slice(0, 5).map((customer, index) => {
            return (
              // Use a stable unique key by combining normalized email with index fallback
              <div key={`${customer.id || customer.email || 'customer'}-${index}`} onClick={() => setSelectedCustomer(customer)} style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px',
                background: theme.colors.bgLight,
                borderRadius: '12px',
                border: `1px solid ${theme.colors.borderLight}`,
                cursor: 'pointer',
                transition: 'all 0.2s'
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
                  flexShrink: 0,
                  marginLeft: '8px'
                }}>
                  {customer.name ? customer.name.charAt(0).toUpperCase() : 'C'}
                </div>
                
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: '600', color: theme.colors.textDark, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {customer.name || 'New Prospect'}
                  </p>
                  <p style={{ fontSize: '14px', color: theme.colors.textGray, margin: '2px 0 0 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {customer.email}
                  </p>
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
                
                <ChevronRight size={16} color={theme.colors.textGray} />
              </div>
            );
          })}
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

      {selectedCustomer && (
        <EnhancedCustomerDetailModal 
          customer={selectedCustomer}
          business={business}
          onClose={() => setSelectedCustomer(null)}
          onRefresh={fetchCustomerData}
        />
      )}
    </div>
  );
};

export default EnhancedCustomersCard;

