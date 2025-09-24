// src/app/dashboard/[sessionId]/customers/page.js
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { ArrowLeft, Search, Mail, User, Briefcase, DollarSign } from 'lucide-react';

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
    md: '0 4px 8px rgba(26, 43, 72, 0.1)',
  },
};

const CustomerProfilePanel = ({ customer, onClose }) => {
    if (!customer) return null;
  
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
  
    // Placeholder for activity timeline
    const activityTimeline = [
      { id: 1, type: 'purchase', description: 'Purchased "Pro Plan"', value: '$49.00', time: '2 days ago' },
      { id: 2, type: 'email', description: 'Opened "Welcome to Launchfly"', time: '4 days ago' },
      { id: 3, type: 'lead', description: 'Became a lead from AI Outreach', time: '5 days ago' },
    ];
  
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        width: '420px',
        background: theme.colors.white,
        boxShadow: '-10px 0 30px rgba(0,0,0,0.1)',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        transition: 'transform 0.3s ease-in-out',
        transform: customer ? 'translateX(0)' : 'translateX(100%)',
      }}>
        {/* Panel Header */}
        <div style={{ padding: '24px', borderBottom: `1px solid ${theme.colors.borderLight}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: '20px', fontWeight: '700', color: theme.colors.textDark, margin: 0 }}>Customer Profile</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}>
            <ArrowLeft size={20} />
          </button>
        </div>
  
        {/* Customer Info */}
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', borderBottom: `1px solid ${theme.colors.borderLight}` }}>
          <div style={{
            width: '80px', height: '80px', borderRadius: '50%', background: theme.colors.primary,
            color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '32px', fontWeight: 'bold', marginBottom: '16px'
          }}>
            {customer.name ? customer.name.charAt(0).toUpperCase() : 'C'}
          </div>
          <h3 style={{ margin: 0, fontSize: '22px', fontWeight: '700', color: theme.colors.textDark }}>{customer.name || 'New Prospect'}</h3>
          <p style={{ margin: '4px 0 16px', fontSize: '14px', color: theme.colors.textGray }}>{customer.email}</p>
          <span style={{ ...getStatusStyle(customer.status), padding: '6px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '600' }}>
            {customer.status}
          </span>
        </div>
  
        {/* Activity Timeline */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
            <h4 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: '600', color: theme.colors.textDark }}>Activity</h4>
            {/* NOTE: The activity timeline is using placeholder data. 
                In a real implementation, this would be fetched from an API endpoint 
                for the specific customer.
            */}
            {activityTimeline.map(item => (
              <div key={item.id} style={{ display: 'flex', gap: '16px', marginBottom: '20px' }}>
                <div style={{
                  width: '32px', height: '32px', borderRadius: '50%', background: theme.colors.bgLight,
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  {item.type === 'purchase' && <DollarSign size={16} color={theme.colors.success} />}
                  {item.type === 'email' && <Mail size={16} color={theme.colors.primary} />}
                  {item.type === 'lead' && <User size={16} color={theme.colors.textGray} />}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontSize: '14px', color: theme.colors.textDark }}>{item.description}</p>
                  <p style={{ margin: '2px 0 0', fontSize: '12px', color: theme.colors.textGray }}>{item.time}</p>
                </div>
                {item.value && <p style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: theme.colors.textDark }}>{item.value}</p>}
              </div>
            ))}
        </div>
      </div>
    );
  };

const CustomersPage = () => {
  const params = useParams();
  const router = useRouter();
  const [business, setBusiness] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const supabase = createClientComponentClient();

  useEffect(() => {
    const fetchBusinessAndCustomers = async () => {
      setLoading(true);
      const { data: businessData, error: businessError } = await supabase
        .from('businesses')
        .select('id, session_id')
        .eq('session_id', params.sessionId)
        .single();

      if (businessError || !businessData) {
        console.error('Error fetching business:', businessError);
        router.push('/dashboard');
        return;
      }
      setBusiness(businessData);

      try {
        const response = await fetch(`/api/business/${businessData.id}/customers`);
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

    if (params.sessionId) {
      fetchBusinessAndCustomers();
    }
  }, [params.sessionId]);

  const filteredCustomers = customers
    .filter(customer =>
      (customer.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (customer.email?.toLowerCase() || '').includes(searchTerm.toLowerCase())
    )
    .filter(customer =>
      statusFilter === 'All' || customer.status === statusFilter
    );

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
    <div style={{ background: theme.colors.bgLight, minHeight: '100vh', padding: '32px' }}>
      <div style={{ maxWidth: '1024px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button
              onClick={() => router.push(`/dashboard/${params.sessionId}`)}
              style={{
                background: theme.colors.white,
                border: `1px solid ${theme.colors.borderLight}`,
                borderRadius: '50%',
                padding: '10px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <ArrowLeft size={20} color={theme.colors.textDark} />
            </button>
            <h1 style={{ fontSize: '28px', fontWeight: '700', color: theme.colors.textDark }}>
              Manage Customers
            </h1>
          </div>
        </div>

        {/* Filters */}
        <div style={{
          background: theme.colors.white,
          padding: '20px',
          borderRadius: '16px',
          boxShadow: theme.shadows.md,
          marginBottom: '24px',
          display: 'flex',
          gap: '16px'
        }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <Search size={18} style={{ position: 'absolute', top: '13px', left: '14px', color: theme.colors.textGray }} />
            <input
              type="text"
              placeholder="Search by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 10px 10px 40px',
                borderRadius: '8px',
                border: `1px solid ${theme.colors.borderLight}`,
                fontSize: '14px'
              }}
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              padding: '10px',
              borderRadius: '8px',
              border: `1px solid ${theme.colors.borderLight}`,
              background: 'white',
              fontSize: '14px'
            }}
          >
            <option value="All">All Statuses</option>
            <option value="Lead">Lead</option>
            <option value="Contacted">Contacted</option>
            <option value="Converted">Converted</option>
          </select>
        </div>

        {/* Customer Table */}
        <div style={{
          background: theme.colors.white,
          borderRadius: '16px',
          boxShadow: theme.shadows.md,
          overflow: 'hidden'
        }}>
          {loading ? (
            <p style={{ padding: '40px', textAlign: 'center', color: theme.colors.textGray }}>Loading customers...</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ background: theme.colors.bgLight }}>
                <tr>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', color: theme.colors.textGray, textTransform: 'uppercase' }}>Customer</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', color: theme.colors.textGray, textTransform: 'uppercase' }}>Status</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', color: theme.colors.textGray, textTransform: 'uppercase' }}>Source</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', color: theme.colors.textGray, textTransform: 'uppercase' }}>Signed Up</th>
                </tr>
              </thead>
              <tbody>
                {filteredCustomers.map(customer => (
                  <tr 
                    key={customer.id} 
                    style={{ borderBottom: `1px solid ${theme.colors.borderLight}`, cursor: 'pointer' }}
                    onClick={() => setSelectedCustomer(customer)}
                    onMouseEnter={e => e.currentTarget.style.background = theme.colors.bgLight}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ padding: '16px' }}>
                      <p style={{ fontWeight: '600', color: theme.colors.textDark, margin: 0 }}>{customer.name || 'New Prospect'}</p>
                      <p style={{ fontSize: '14px', color: theme.colors.textGray, margin: 0 }}>{customer.email}</p>
                    </td>
                    <td style={{ padding: '16px' }}>
                      <span style={{
                        ...getStatusStyle(customer.status),
                        padding: '4px 10px',
                        borderRadius: '20px',
                        fontSize: '12px',
                        fontWeight: '600'
                      }}>
                        {customer.status}
                      </span>
                    </td>
                    <td style={{ padding: '16px', fontSize: '14px', color: theme.colors.textGray }}>
                      {customer.source || 'AI Outreach'}
                    </td>
                    <td style={{ padding: '16px', fontSize: '14px', color: theme.colors.textGray }}>
                      {new Date(customer.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {filteredCustomers.length === 0 && !loading && (
             <p style={{ padding: '40px', textAlign: 'center', color: theme.colors.textGray }}>No customers match your search.</p>
          )}
        </div>
      </div>
      <CustomerProfilePanel customer={selectedCustomer} onClose={() => setSelectedCustomer(null)} />
    </div>
  );
};

export default CustomersPage;
