'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import './dashboard.css';

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);

  // Mock data - in real app this would come from API
  const dashboardData = {
    revenue: {
      today: '$127',
      thisWeek: '$892',
      thisMonth: '$3,421',
      total: '$3,421',
      trend: '+23%'
    },
    customers: {
      active: 127,
      new: 8,
      messages: 3,
      satisfaction: 4.8
    },
    orders: {
      pending: 2,
      inProgress: 3,
      completed: 42,
      revenue: '$3,421'
    },
    nextActions: [
      { id: 1, title: 'Reply to Sarah M.', type: 'message', urgent: true },
      { id: 2, title: 'Complete order #1247', type: 'order', urgent: true },
      { id: 3, title: 'Review 5-star feedback', type: 'review', urgent: false },
      { id: 4, title: 'Launch email campaign', type: 'marketing', urgent: false }
    ],
    recentActivity: [
      { id: 1, type: 'sale', message: 'New order from David K. - $97', time: '2 hours ago', amount: '$97' },
      { id: 2, type: 'message', message: 'Sarah M. sent a message', time: '3 hours ago' },
      { id: 3, type: 'sale', message: 'New order from Lisa T. - $97', time: '5 hours ago', amount: '$97' },
      { id: 4, type: 'review', message: 'John D. left a 5-star review', time: '8 hours ago' },
      { id: 5, type: 'sale', message: 'New order from Mike R. - $97', time: '12 hours ago', amount: '$97' }
    ]
  };

  useEffect(() => {
    // Check if user is logged in
    const userData = localStorage.getItem('user');
    if (userData) {
      setUser(JSON.parse(userData));
      // Show welcome modal for new users
      const hasSeenWelcome = localStorage.getItem('hasSeenWelcome');
      if (!hasSeenWelcome) {
        setShowWelcomeModal(true);
        localStorage.setItem('hasSeenWelcome', 'true');
      }
    } else {
      router.push('/marketplace');
    }
  }, [router]);

  const closeWelcomeModal = () => {
    setShowWelcomeModal(false);
  };

  if (!user) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      {/* Sidebar */}
      <aside className="dashboard-sidebar">
        <div className="sidebar-header">
          <Link href="/" className="logo">
            <span className="gradient-text">Launchfly</span>
          </Link>
        </div>

        <nav className="sidebar-nav">
          <a 
            className={`nav-item ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <rect x="3" y="3" width="7" height="7" strokeWidth="2"/>
              <rect x="14" y="3" width="7" height="7" strokeWidth="2"/>
              <rect x="14" y="14" width="7" height="7" strokeWidth="2"/>
              <rect x="3" y="14" width="7" height="7" strokeWidth="2"/>
            </svg>
            Overview
          </a>
          
          <a 
            className={`nav-item ${activeTab === 'customers' ? 'active' : ''}`}
            onClick={() => setActiveTab('customers')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" strokeWidth="2"/>
              <circle cx="9" cy="7" r="4" strokeWidth="2"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" strokeWidth="2"/>
            </svg>
            Customers
            {dashboardData.customers.messages > 0 && (
              <span className="badge">{dashboardData.customers.messages}</span>
            )}
          </a>

          <a 
            className={`nav-item ${activeTab === 'orders' ? 'active' : ''}`}
            onClick={() => setActiveTab('orders')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M9 2L3 12h18L15 2M3 12h18v8a1 1 0 01-1 1H4a1 1 0 01-1-1v-8" strokeWidth="2"/>
            </svg>
            Orders
            {dashboardData.orders.pending > 0 && (
              <span className="badge urgent">{dashboardData.orders.pending}</span>
            )}
          </a>

          <a 
            className={`nav-item ${activeTab === 'marketing' ? 'active' : ''}`}
            onClick={() => setActiveTab('marketing')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" strokeWidth="2"/>
            </svg>
            Marketing
          </a>

          <a 
            className={`nav-item ${activeTab === 'analytics' ? 'active' : ''}`}
            onClick={() => setActiveTab('analytics')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M18 20V10M12 20V4M6 20v-6" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            Analytics
          </a>

          <a 
            className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <circle cx="12" cy="12" r="3" strokeWidth="2"/>
              <path d="M12 1v6m0 6v6m11-7h-6m-6 0H1" strokeWidth="2"/>
            </svg>
            Settings
          </a>
        </nav>

        <div className="sidebar-footer">
          <div className="user-info">
            <div className="user-avatar">
              {user.name?.charAt(0).toUpperCase()}
            </div>
            <div className="user-details">
              <span className="user-name">{user.name}</span>
              <span className="user-business">{user.businessName}</span>
            </div>
          </div>
          <button className="logout-btn" onClick={() => {
            localStorage.removeItem('user');
            router.push('/');
          }}>
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="dashboard-main">
        {/* Header */}
        <header className="dashboard-header">
          <div className="header-content">
            <h1>Welcome back, {user.name?.split(' ')[0]}!</h1>
            <p className="header-subtitle">Your business is performing great today</p>
          </div>
          <div className="header-actions">
            <button className="btn-secondary">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <circle cx="12" cy="12" r="1" strokeWidth="2"/>
                <circle cx="12" cy="5" r="1" strokeWidth="2"/>
                <circle cx="12" cy="19" r="1" strokeWidth="2"/>
              </svg>
            </button>
            <button className="btn-primary">
              New Campaign
            </button>
          </div>
        </header>

        {/* Content based on active tab */}
        {activeTab === 'overview' && (
          <div className="dashboard-content">
            {/* Stats Cards */}
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-header">
                  <h3>Today's Revenue</h3>
                  <span className="stat-trend positive">{dashboardData.revenue.trend}</span>
                </div>
                <div className="stat-value">{dashboardData.revenue.today}</div>
                <div className="stat-footer">
                  <span>This week: {dashboardData.revenue.thisWeek}</span>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-header">
                  <h3>Active Customers</h3>
                  <span className="stat-badge">{dashboardData.customers.new} new</span>
                </div>
                <div className="stat-value">{dashboardData.customers.active}</div>
                <div className="stat-footer">
                  <span>{dashboardData.customers.messages} messages waiting</span>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-header">
                  <h3>Orders</h3>
                  <span className="stat-badge urgent">{dashboardData.orders.pending} pending</span>
                </div>
                <div className="stat-value">{dashboardData.orders.completed}</div>
                <div className="stat-footer">
                  <span>{dashboardData.orders.inProgress} in progress</span>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-header">
                  <h3>Satisfaction</h3>
                  <span className="stat-icon">⭐</span>
                </div>
                <div className="stat-value">{dashboardData.customers.satisfaction}</div>
                <div className="stat-footer">
                  <span>Based on 42 reviews</span>
                </div>
              </div>
            </div>

            {/* Main Grid */}
            <div className="overview-grid">
              {/* Next Actions */}
              <div className="card next-actions">
                <div className="card-header">
                  <h2>Next Actions</h2>
                  <button className="view-all-btn">View All</button>
                </div>
                <div className="actions-list">
                  {dashboardData.nextActions.map(action => (
                    <div key={action.id} className={`action-item ${action.urgent ? 'urgent' : ''}`}>
                      <div className="action-icon">
                        {action.type === 'message' && '💬'}
                        {action.type === 'order' && '📦'}
                        {action.type === 'review' && '⭐'}
                        {action.type === 'marketing' && '📢'}
                      </div>
                      <span className="action-title">{action.title}</span>
                      {action.urgent && <span className="urgent-badge">Urgent</span>}
                    </div>
                  ))}
                </div>
              </div>

              {/* Recent Activity */}
              <div className="card recent-activity">
                <div className="card-header">
                  <h2>Recent Activity</h2>
                  <button className="view-all-btn">View All</button>
                </div>
                <div className="activity-list">
                  {dashboardData.recentActivity.map(activity => (
                    <div key={activity.id} className="activity-item">
                      <div className={`activity-icon ${activity.type}`}>
                        {activity.type === 'sale' && '💰'}
                        {activity.type === 'message' && '💬'}
                        {activity.type === 'review' && '⭐'}
                      </div>
                      <div className="activity-details">
                        <span className="activity-message">{activity.message}</span>
                        <span className="activity-time">{activity.time}</span>
                      </div>
                      {activity.amount && (
                        <span className="activity-amount">{activity.amount}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick Stats */}
              <div className="card revenue-chart">
                <div className="card-header">
                  <h2>Revenue Overview</h2>
                  <select className="period-selector">
                    <option>Last 7 days</option>
                    <option>Last 30 days</option>
                    <option>Last 90 days</option>
                  </select>
                </div>
                <div className="chart-placeholder">
                  <div className="chart-bar" style={{ height: '60%' }}>
                    <span className="bar-label">Mon</span>
                  </div>
                  <div className="chart-bar" style={{ height: '80%' }}>
                    <span className="bar-label">Tue</span>
                  </div>
                  <div className="chart-bar" style={{ height: '45%' }}>
                    <span className="bar-label">Wed</span>
                  </div>
                  <div className="chart-bar" style={{ height: '90%' }}>
                    <span className="bar-label">Thu</span>
                  </div>
                  <div className="chart-bar" style={{ height: '70%' }}>
                    <span className="bar-label">Fri</span>
                  </div>
                  <div className="chart-bar today" style={{ height: '95%' }}>
                    <span className="bar-label">Today</span>
                  </div>
                </div>
                <div className="chart-footer">
                  <div className="chart-stat">
                    <span className="stat-label">Total Revenue</span>
                    <span className="stat-value">{dashboardData.revenue.thisMonth}</span>
                  </div>
                  <div className="chart-stat">
                    <span className="stat-label">Avg. Order</span>
                    <span className="stat-value">$97</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'customers' && (
          <div className="dashboard-content">
            <div className="card">
              <h2>Customer Management</h2>
              <p>Your customer management tools will appear here.</p>
            </div>
          </div>
        )}

        {activeTab === 'orders' && (
          <div className="dashboard-content">
            <div className="card">
              <h2>Order Management</h2>
              <p>Your order management tools will appear here.</p>
            </div>
          </div>
        )}

        {activeTab === 'marketing' && (
          <div className="dashboard-content">
            <div className="card">
              <h2>Marketing Campaigns</h2>
              <p>Your marketing campaign tools will appear here.</p>
            </div>
          </div>
        )}

        {activeTab === 'analytics' && (
          <div className="dashboard-content">
            <div className="card">
              <h2>Analytics & Reports</h2>
              <p>Your analytics and reporting tools will appear here.</p>
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="dashboard-content">
            <div className="card">
              <h2>Settings</h2>
              <p>Your account and business settings will appear here.</p>
            </div>
          </div>
        )}
      </main>

      {/* Welcome Modal */}
      {showWelcomeModal && (
        <div className="modal-overlay" onClick={closeWelcomeModal}>
          <div className="welcome-modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={closeWelcomeModal}>×</button>
            
            <div className="welcome-content">
              <h1>🎉 Welcome to Your New Business!</h1>
              <p className="welcome-subtitle">
                Your {user.businessName} is now live and ready to make money
              </p>

              <div className="welcome-stats">
                <div className="welcome-stat">
                  <span className="stat-icon">👥</span>
                  <strong>127 customers</strong>
                  <span>Ready to buy</span>
                </div>
                <div className="welcome-stat">
                  <span className="stat-icon">⏱️</span>
                  <strong>18 hours</strong>
                  <span>To first sale</span>
                </div>
                <div className="welcome-stat">
                  <span className="stat-icon">💰</span>
                  <strong>$97 avg</strong>
                  <span>Per order</span>
                </div>
              </div>

              <div className="welcome-checklist">
                <h3>Your First Steps:</h3>
                <div className="checklist-item">
                  <input type="checkbox" id="step1" defaultChecked />
                  <label htmlFor="step1">Business setup complete</label>
                </div>
                <div className="checklist-item">
                  <input type="checkbox" id="step2" />
                  <label htmlFor="step2">Review your customer messages</label>
                </div>
                <div className="checklist-item">
                  <input type="checkbox" id="step3" />
                  <label htmlFor="step3">Launch your first campaign</label>
                </div>
                <div className="checklist-item">
                  <input type="checkbox" id="step4" />
                  <label htmlFor="step4">Complete pending orders</label>
                </div>
              </div>

              <button className="welcome-cta" onClick={closeWelcomeModal}>
                Let's Get Started! 🚀
              </button>

              <p className="welcome-note">
                Remember: You're guaranteed your first sale within 48 hours or we pay you $100!
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
