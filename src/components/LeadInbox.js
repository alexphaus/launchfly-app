// src/components/LeadInbox.js
/**
 * Lead Inbox Component
 * Organized conversation management with hot prospect flagging
 */

import React, { useState, useEffect } from 'react';
import { 
  Inbox, 
  Fire, 
  TrendingUp, 
  Snowflake, 
  Clock,
  Mail,
  Phone,
  Calendar,
  MessageSquare,
  User,
  Building,
  Tag,
  AlertCircle,
  CheckCircle,
  Send,
  RefreshCw,
  Filter,
  Search,
  ChevronRight,
  Star,
  Zap
} from 'lucide-react';

const LeadInbox = ({ businessId, onLeadSelect }) => {
  const [leads, setLeads] = useState({
    hot: [],
    warm: [],
    lukewarm: [],
    cold: [],
    dead: []
  });
  const [selectedLead, setSelectedLead] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // Theme
  const theme = {
    colors: {
      hot: '#ef4444',
      warm: '#f59e0b',
      lukewarm: '#3b82f6',
      cold: '#6b7280',
      dead: '#374151',
      primary: '#007BFF',
      success: '#10b981',
      background: '#f9fafb',
      white: '#ffffff',
      text: '#1f2937',
      textLight: '#6b7280',
      border: '#e5e7eb'
    }
  };

  useEffect(() => {
    fetchLeads();
    // Refresh every 30 seconds
    const interval = setInterval(fetchLeads, 30000);
    return () => clearInterval(interval);
  }, [businessId]);

  const fetchLeads = async () => {
    if (refreshing) return;
    
    try {
      const response = await fetch(`/api/ai-cofounder/leads?businessId=${businessId}`);
      const data = await response.json();
      
      if (data.success) {
        setLeads(data.organizedInbox);
        
        // Auto-select first hot lead if available
        if (!selectedLead && data.organizedInbox.hot.length > 0) {
          setSelectedLead(data.organizedInbox.hot[0]);
        }
      }
    } catch (error) {
      console.error('Error fetching leads:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchLeads();
  };

  const getFilteredLeads = () => {
    let allLeads = [];
    
    if (filter === 'all') {
      allLeads = [
        ...leads.hot,
        ...leads.warm,
        ...leads.lukewarm,
        ...leads.cold
      ];
    } else {
      allLeads = leads[filter] || [];
    }

    if (searchTerm) {
      return allLeads.filter(lead => 
        lead.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.company?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    return allLeads;
  };

  const LeadCard = ({ lead, temperature }) => {
    const temperatureConfig = {
      hot: { icon: Fire, color: theme.colors.hot, label: 'Hot Lead' },
      warm: { icon: TrendingUp, color: theme.colors.warm, label: 'Warm Lead' },
      lukewarm: { icon: Clock, color: theme.colors.lukewarm, label: 'Lukewarm' },
      cold: { icon: Snowflake, color: theme.colors.cold, label: 'Cold Lead' },
      dead: { icon: AlertCircle, color: theme.colors.dead, label: 'No Response' }
    };

    const config = temperatureConfig[temperature];
    const Icon = config.icon;

    return (
      <div
        onClick={() => {
          setSelectedLead(lead);
          onLeadSelect?.(lead);
        }}
        style={{
          padding: '16px',
          borderBottom: `1px solid ${theme.colors.border}`,
          cursor: 'pointer',
          background: selectedLead?.id === lead.id ? theme.colors.background : theme.colors.white,
          transition: 'all 0.2s',
          position: 'relative'
        }}
        onMouseEnter={e => e.currentTarget.style.background = theme.colors.background}
        onMouseLeave={e => e.currentTarget.style.background = selectedLead?.id === lead.id ? theme.colors.background : theme.colors.white}
      >
        {/* Temperature indicator */}
        <div style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: '4px',
          background: config.color
        }} />

        <div style={{ display: 'flex', alignItems: 'start', gap: '12px', marginLeft: '8px' }}>
          {/* Temperature icon */}
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            background: `${config.color}20`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <Icon size={18} color={config.color} />
          </div>

          {/* Lead info */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span style={{
                fontWeight: '600',
                fontSize: '15px',
                color: theme.colors.text,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}>
                {lead.name || lead.email}
              </span>
              {lead.score >= 80 && (
                <span style={{
                  background: theme.colors.hot,
                  color: 'white',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  fontSize: '11px',
                  fontWeight: '600'
                }}>
                  HOT
                </span>
              )}
              {lead.hasRecentReply && (
                <MessageSquare size={14} color={theme.colors.success} />
              )}
            </div>

            {lead.company && (
              <div style={{
                fontSize: '13px',
                color: theme.colors.textLight,
                marginBottom: '4px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                <Building size={12} />
                {lead.company}
              </div>
            )}

            <div style={{
              display: 'flex',
              gap: '12px',
              fontSize: '12px',
              color: theme.colors.textLight
            }}>
              <span>Score: {lead.score}</span>
              {lead.dayssinceLastContact !== null && (
                <span>{lead.dayssinceLastContact}d ago</span>
              )}
              {lead.follow_up_count > 0 && (
                <span>{lead.follow_up_count} follow-ups</span>
              )}
            </div>

            {lead.needsFollowUp && (
              <div style={{
                marginTop: '8px',
                padding: '4px 8px',
                background: '#fef3c7',
                borderRadius: '4px',
                fontSize: '12px',
                color: '#92400e',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                <Clock size={12} />
                Follow-up needed
              </div>
            )}
          </div>

          {/* Score badge */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '4px'
          }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              background: `conic-gradient(${config.color} ${lead.score * 3.6}deg, ${theme.colors.border} 0deg)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: theme.colors.white,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px',
                fontWeight: '600'
              }}>
                {lead.score}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const TemperatureSection = ({ title, leads, temperature, count }) => {
    const [collapsed, setCollapsed] = useState(false);
    
    const temperatureConfig = {
      hot: { icon: Fire, color: theme.colors.hot },
      warm: { icon: TrendingUp, color: theme.colors.warm },
      lukewarm: { icon: Clock, color: theme.colors.lukewarm },
      cold: { icon: Snowflake, color: theme.colors.cold },
      dead: { icon: AlertCircle, color: theme.colors.dead }
    };

    const config = temperatureConfig[temperature];
    const Icon = config.icon;

    if (leads.length === 0 && filter !== 'all') return null;

    return (
      <div style={{ marginBottom: '24px' }}>
        <div
          onClick={() => setCollapsed(!collapsed)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 16px',
            background: theme.colors.background,
            cursor: 'pointer',
            borderRadius: '8px',
            marginBottom: '8px'
          }}
        >
          <Icon size={18} color={config.color} />
          <span style={{ fontWeight: '600', color: theme.colors.text, flex: 1 }}>
            {title}
          </span>
          <span style={{
            background: `${config.color}20`,
            color: config.color,
            padding: '4px 8px',
            borderRadius: '12px',
            fontSize: '12px',
            fontWeight: '600'
          }}>
            {count || leads.length}
          </span>
          <ChevronRight
            size={16}
            style={{
              transform: collapsed ? 'rotate(0deg)' : 'rotate(90deg)',
              transition: 'transform 0.2s'
            }}
          />
        </div>

        {!collapsed && (
          <div style={{
            background: theme.colors.white,
            borderRadius: '8px',
            overflow: 'hidden',
            border: `1px solid ${theme.colors.border}`
          }}>
            {leads.length > 0 ? (
              leads.map(lead => (
                <LeadCard key={lead.id} lead={lead} temperature={temperature} />
              ))
            ) : (
              <div style={{
                padding: '24px',
                textAlign: 'center',
                color: theme.colors.textLight,
                fontSize: '14px'
              }}>
                No {temperature} leads
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '400px',
        color: theme.colors.textLight
      }}>
        <RefreshCw size={24} className="animate-spin" />
        <span style={{ marginLeft: '12px' }}>Loading leads...</span>
      </div>
    );
  }

  const filteredLeads = getFilteredLeads();
  const totalLeads = Object.values(leads).flat().length;
  const hotLeadsCount = leads.hot.length;

  return (
    <div style={{
      background: theme.colors.white,
      borderRadius: '16px',
      padding: '24px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '24px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Inbox size={20} color="white" />
          </div>
          <div>
            <h3 style={{ fontSize: '20px', fontWeight: '700', color: theme.colors.text, margin: 0 }}>
              Lead Inbox
            </h3>
            <p style={{ fontSize: '14px', color: theme.colors.textLight, margin: 0 }}>
              {totalLeads} total leads • {hotLeadsCount} hot prospects
            </p>
          </div>
        </div>

        <button
          onClick={handleRefresh}
          disabled={refreshing}
          style={{
            background: theme.colors.primary,
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            padding: '8px 16px',
            fontSize: '14px',
            fontWeight: '500',
            cursor: refreshing ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            opacity: refreshing ? 0.6 : 1
          }}
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Hot leads alert */}
      {hotLeadsCount > 0 && (
        <div style={{
          background: 'linear-gradient(135deg, #fef3c7 0%, #fed7aa 100%)',
          border: '1px solid #fbbf24',
          borderRadius: '12px',
          padding: '16px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            background: theme.colors.hot,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            animation: 'pulse 2s infinite'
          }}>
            <Fire size={20} color="white" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: '600', color: '#92400e', marginBottom: '4px' }}>
              🔥 {hotLeadsCount} Hot {hotLeadsCount === 1 ? 'Prospect' : 'Prospects'} Ready!
            </div>
            <div style={{ fontSize: '14px', color: '#78350f' }}>
              These leads are showing strong buying signals. Contact them immediately for best results.
            </div>
          </div>
          <button
            onClick={() => setFilter('hot')}
            style={{
              background: theme.colors.hot,
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              padding: '8px 16px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer'
            }}
          >
            View Hot Leads
          </button>
        </div>
      )}

      {/* Filters and search */}
      <div style={{
        display: 'flex',
        gap: '12px',
        marginBottom: '20px'
      }}>
        <div style={{
          flex: 1,
          position: 'relative'
        }}>
          <Search
            size={18}
            style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: theme.colors.textLight
            }}
          />
          <input
            type="text"
            placeholder="Search leads..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 12px 10px 40px',
              border: `1px solid ${theme.colors.border}`,
              borderRadius: '8px',
              fontSize: '14px',
              outline: 'none'
            }}
          />
        </div>

        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{
            padding: '10px 16px',
            border: `1px solid ${theme.colors.border}`,
            borderRadius: '8px',
            fontSize: '14px',
            outline: 'none',
            background: theme.colors.white,
            cursor: 'pointer'
          }}
        >
          <option value="all">All Leads</option>
          <option value="hot">Hot Only</option>
          <option value="warm">Warm Only</option>
          <option value="lukewarm">Lukewarm Only</option>
          <option value="cold">Cold Only</option>
        </select>
      </div>

      {/* Lead sections */}
      <div>
        {filter === 'all' ? (
          <>
            <TemperatureSection
              title="🔥 Hot Prospects - Ready to Buy"
              leads={leads.hot}
              temperature="hot"
              count={leads.hot.length}
            />
            <TemperatureSection
              title="📈 Warm Leads - Nurture to Convert"
              leads={leads.warm}
              temperature="warm"
              count={leads.warm.length}
            />
            <TemperatureSection
              title="⏰ Lukewarm - Long-term Potential"
              leads={leads.lukewarm}
              temperature="lukewarm"
              count={leads.lukewarm.length}
            />
            <TemperatureSection
              title="❄️ Cold Leads - Need Reactivation"
              leads={leads.cold}
              temperature="cold"
              count={leads.cold.length}
            />
          </>
        ) : (
          <div style={{
            background: theme.colors.white,
            borderRadius: '8px',
            overflow: 'hidden',
            border: `1px solid ${theme.colors.border}`
          }}>
            {filteredLeads.map(lead => (
              <LeadCard key={lead.id} lead={lead} temperature={lead.temperature} />
            ))}
            {filteredLeads.length === 0 && (
              <div style={{
                padding: '48px',
                textAlign: 'center',
                color: theme.colors.textLight
              }}>
                No leads found
              </div>
            )}
          </div>
        )}
      </div>

      {/* CSS for animations */}
      <style jsx>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.05); opacity: 0.8; }
        }
        .animate-spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default LeadInbox;
