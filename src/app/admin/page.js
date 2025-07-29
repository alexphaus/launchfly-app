// app/admin/page.js - Admin dashboard for monitoring the system
'use client';
import { useState, useEffect } from 'react';

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [businesses, setBusinesses] = useState([]);
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  async function loadDashboardData() {
    try {
      const response = await fetch('/api/admin/dashboard');
      if (response.ok) {
        const data = await response.json();
        setStats(data.stats);
        setBusinesses(data.businesses);
        setLeads(data.leads);
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    }
    setLoading(false);
  }

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h1>Loading Admin Dashboard...</h1>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '2rem', fontSize: '2.5rem', fontWeight: '700' }}>
        🚀 Launchfly Admin Dashboard
      </h1>

      {/* Stats Overview */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
        gap: '1.5rem',
        marginBottom: '3rem'
      }}>
        <StatCard
          title="Total Businesses"
          value={stats?.totalBusinesses || 0}
          icon="🏢"
          color="#007BFF"
        />
        <StatCard
          title="Active Websites"
          value={stats?.activeWebsites || 0}
          icon="🌐"
          color="#28a745"
        />
        <StatCard
          title="Total Leads"
          value={stats?.totalLeads || 0}
          icon="📧"
          color="#ffc107"
        />
        <StatCard
          title="Revenue Generated"
          value={`$${stats?.totalRevenue || 0}`}
          icon="💰"
          color="#17a2b8"
        />
      </div>

      {/* Recent Businesses */}
      <div style={{
        background: '#ffffff',
        borderRadius: '12px',
        padding: '2rem',
        boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
        marginBottom: '2rem'
      }}>
        <h2 style={{ marginBottom: '1.5rem', fontSize: '1.8rem' }}>
          Recent Businesses
        </h2>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #f0f0f0' }}>
                <th style={tableHeaderStyle}>Business Name</th>
                <th style={tableHeaderStyle}>Subdomain</th>
                <th style={tableHeaderStyle}>Status</th>
                <th style={tableHeaderStyle}>Views</th>
                <th style={tableHeaderStyle}>Created</th>
                <th style={tableHeaderStyle}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {businesses.map((business) => (
                <tr key={business.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                  <td style={tableCellStyle}>{business.name}</td>
                  <td style={tableCellStyle}>
                    <a 
                      href={`https://${business.subdomain}.launchfly.site`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: '#007BFF', textDecoration: 'none' }}
                    >
                      {business.subdomain}
                    </a>
                  </td>
                  <td style={tableCellStyle}>
                    <StatusBadge status={business.status} />
                  </td>
                  <td style={tableCellStyle}>{business.views || 0}</td>
                  <td style={tableCellStyle}>
                    {new Date(business.created_at).toLocaleDateString()}
                  </td>
                  <td style={tableCellStyle}>
                    <button
                      onClick={() => viewBusiness(business.id)}
                      style={{
                        padding: '0.5rem 1rem',
                        background: '#007BFF',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Leads */}
      <div style={{
        background: '#ffffff',
        borderRadius: '12px',
        padding: '2rem',
        boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)'
      }}>
        <h2 style={{ marginBottom: '1.5rem', fontSize: '1.8rem' }}>
          Recent Leads
        </h2>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #f0f0f0' }}>
                <th style={tableHeaderStyle}>Name</th>
                <th style={tableHeaderStyle}>Email</th>
                <th style={tableHeaderStyle}>Business</th>
                <th style={tableHeaderStyle}>Service</th>
                <th style={tableHeaderStyle}>Created</th>
                <th style={tableHeaderStyle}>Status</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr key={lead.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                  <td style={tableCellStyle}>{lead.name}</td>
                  <td style={tableCellStyle}>{lead.email}</td>
                  <td style={tableCellStyle}>{lead.business_name}</td>
                  <td style={tableCellStyle}>{lead.service_interest || 'General'}</td>
                  <td style={tableCellStyle}>
                    {new Date(lead.created_at).toLocaleDateString()}
                  </td>
                  <td style={tableCellStyle}>
                    <StatusBadge status={lead.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, color }) {
  return (
    <div style={{
      background: '#ffffff',
      padding: '1.5rem',
      borderRadius: '12px',
      boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
      borderLeft: `4px solid ${color}`
    }}>
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        marginBottom: '0.5rem'
      }}>
        <span style={{ fontSize: '2rem' }}>{icon}</span>
        <span style={{ fontSize: '2rem', fontWeight: '700', color }}>{value}</span>
      </div>
      <h3 style={{ margin: '0', color: '#666', fontSize: '1rem' }}>{title}</h3>
    </div>
  );
}

function StatusBadge({ status }) {
  const statusColors = {
    pending: '#ffc107',
    generating: '#17a2b8',
    ready: '#28a745',
    failed: '#dc3545',
    new: '#007BFF',
    contacted: '#ffc107',
    qualified: '#17a2b8',
    converted: '#28a745',
    lost: '#dc3545'
  };

  return (
    <span style={{
      padding: '0.25rem 0.75rem',
      borderRadius: '12px',
      background: statusColors[status] || '#6c757d',
      color: '#ffffff',
      fontSize: '0.8rem',
      fontWeight: '600',
      textTransform: 'capitalize'
    }}>
      {status}
    </span>
  );
}

const tableHeaderStyle = {
  padding: '1rem',
  textAlign: 'left',
  fontWeight: '600',
  color: '#333'
};

const tableCellStyle = {
  padding: '1rem',
  textAlign: 'left'
};

function viewBusiness(businessId) {
  // In a real implementation, this would open a detailed view
  alert(`Viewing business ${businessId}`);
}
