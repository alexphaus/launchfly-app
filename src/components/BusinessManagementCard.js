// src/components/BusinessManagementCard.js
import React, { useState } from 'react';
import { Edit, Palette, Settings, ChevronRight } from 'lucide-react';
import ManageProductsPage from './ManageProductsPage';
import CustomizeWebsitePage from './CustomizeWebsitePage';
import BusinessSettingsPage from './BusinessSettingsPage';

const theme = {
  colors: {
    primary: '#007BFF',
    textDark: '#1A2B48',
    textGray: '#5A6982',
    bgLight: '#F9FAFB',
    borderLight: '#E4E7EB',
  },
  shadows: {
    lg: '0 12px 20px rgba(26, 43, 72, 0.1)',
  },
};

const ManagementAction = ({ icon, title, description, onClick }) => (
  <button
    onClick={onClick}
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: '16px',
      padding: '16px',
      background: 'white',
      border: `1px solid ${theme.colors.borderLight}`,
      borderRadius: '12px',
      cursor: 'pointer',
      transition: 'all 0.2s',
      textAlign: 'left',
      width: '100%'
    }}
    onMouseEnter={e => {
      e.currentTarget.style.borderColor = theme.colors.primary;
      e.currentTarget.style.transform = 'translateY(-2px)';
      e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 123, 255, 0.1)';
    }}
    onMouseLeave={e => {
      e.currentTarget.style.borderColor = theme.colors.borderLight;
      e.currentTarget.style.transform = 'translateY(0)';
      e.currentTarget.style.boxShadow = 'none';
    }}
  >
    <div style={{
      width: '40px',
      height: '40px',
      background: theme.colors.bgLight,
      borderRadius: '8px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: theme.colors.primary
    }}>
      {icon}
    </div>
    <div style={{ flex: 1 }}>
      <p style={{ fontWeight: '600', fontSize: '16px', color: theme.colors.textDark, margin: 0 }}>
        {title}
      </p>
      <p style={{ fontSize: '14px', color: theme.colors.textGray, margin: 0 }}>
        {description}
      </p>
    </div>
    <ChevronRight size={20} color={theme.colors.textGray} />
  </button>
);

const BusinessManagementCard = ({ business }) => {
  const [currentPage, setCurrentPage] = useState(null);

  if (!business) return null;

  // Handle navigation to different management pages
  const handleNavigation = (page) => {
    setCurrentPage(page);
  };

  const handleBack = () => {
    setCurrentPage(null);
  };

  // Render the appropriate page based on currentPage state
  if (currentPage === 'products') {
    return <ManageProductsPage business={business} onBack={handleBack} />;
  }

  if (currentPage === 'website') {
    return <CustomizeWebsitePage business={business} onBack={handleBack} />;
  }

  if (currentPage === 'settings') {
    return <BusinessSettingsPage business={business} onBack={handleBack} />;
  }

  // Default: Show the management card with options
  return (
    <div style={{
      background: 'white',
      borderRadius: '20px',
      padding: '24px',
      boxShadow: theme.shadows.lg,
      marginBottom: '24px'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
        <div style={{
          width: '40px',
          height: '40px',
          background: 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)',
          borderRadius: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <Settings size={24} color="white" />
        </div>
        <h3 style={{ fontSize: '20px', fontWeight: '700', color: theme.colors.textDark }}>
          Manage Your Business
        </h3>
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <ManagementAction 
          icon={<Edit size={20} />}
          title="Manage Products"
          description="Edit prices, descriptions, and add new products."
          onClick={() => handleNavigation('products')}
        />
        <ManagementAction 
          icon={<Palette size={20} />}
          title="Customize Website"
          description="Change colors, fonts, and marketing copy."
          onClick={() => handleNavigation('website')}
        />
        <ManagementAction 
          icon={<Settings size={20} />}
          title="Business Settings"
          description="Update your business name and other details."
          onClick={() => handleNavigation('settings')}
        />
      </div>
    </div>
  );
};

export default BusinessManagementCard;
