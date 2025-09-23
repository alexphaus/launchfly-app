// src/components/UserProfile.js
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { User, Settings, CreditCard, LogOut, ChevronDown, Mail, Smartphone } from 'lucide-react';

const UserProfile = ({ theme, session, business }) => {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Set user data from session and business data
  useEffect(() => {
    if (session && business) {
      // Extract user data from business form_data or session
      const formData = business.form_data || {};
      const userName = formData.name || formData.full_name || business.owner_name || 'User';
      const userEmail = formData.email || business.email || business.owner_email;
      const userPlan = business.plan || formData.plan || 'starter';
      
      // Map plan names to display names
      const planDisplayMap = {
        'starter': 'Starter',
        'pro': 'Pro',
        'professional': 'Pro',
        'scale': 'Scale',
        'enterprise': 'Enterprise'
      };
      
      const user = {
        name: userName,
        email: userEmail,
        avatar: null, // Could be added later from user profile
        subscription: planDisplayMap[userPlan] || 'Starter',
        isAuthenticated: true, // User is authenticated if we have session and business data
        provider: 'email' // Since they signed up with email in onboarding
      };
      
      setUser(user);
    } else {
      // No session/business data means not authenticated
      setUser({
        name: 'User',
        email: '',
        avatar: null,
        subscription: 'Free',
        isAuthenticated: false
      });
    }
  }, [session, business]);

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    try {
      // Implement Google Sign-In
      console.log('Google Sign-In initiated');
      // Add your Google OAuth implementation here
      // Example: await signInWithGoogle();
      
      // Mock successful sign-in
      setTimeout(() => {
        setUser({
          name: 'John Doe',
          email: 'john@gmail.com',
          avatar: null,
          subscription: 'Pro',
          isAuthenticated: true,
          provider: 'google'
        });
        setIsLoading(false);
        setIsOpen(false);
      }, 1500);
    } catch (error) {
      console.error('Google sign-in error:', error);
      setIsLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    setIsLoading(true);
    try {
      // Implement Apple Sign-In
      console.log('Apple Sign-In initiated');
      // Add your Apple OAuth implementation here
      
      // Mock successful sign-in
      setTimeout(() => {
        setUser({
          name: 'John Doe',
          email: 'john@icloud.com',
          avatar: null,
          subscription: 'Pro',
          isAuthenticated: true,
          provider: 'apple'
        });
        setIsLoading(false);
        setIsOpen(false);
      }, 1500);
    } catch (error) {
      console.error('Apple sign-in error:', error);
      setIsLoading(false);
    }
  };

  const handleEmailSignIn = () => {
    // Redirect to email sign-in page or open modal
    console.log('Email sign-in initiated');
    // You can implement a modal or redirect to /auth/login
  };

  const handleLogout = () => {
    setUser({
      ...user,
      isAuthenticated: false
    });
    setIsOpen(false);
    // Add logout logic here
    console.log('User logged out');
  };

  const getInitials = (name) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getSubscriptionColor = (subscription) => {
    switch (subscription?.toLowerCase()) {
      case 'pro': return '#10b981';
      case 'premium': return '#8b5cf6';
      case 'enterprise': return '#f59e0b';
      default: return theme.colors.textGray;
    }
  };

  if (!user) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Profile Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 p-1 rounded-full hover:bg-gray-100 transition-colors cursor-pointer"
        style={{
          background: isOpen ? theme.colors.bgLight : 'transparent'
        }}
      >
        {/* Avatar */}
        <div
          className="flex items-center justify-center rounded-full text-white font-semibold text-sm"
          style={{
            width: '40px',
            height: '40px',
            background: user.isAuthenticated 
              ? `linear-gradient(135deg, ${theme.colors.primary} 0%, ${theme.colors.primaryDark} 100%)`
              : theme.colors.textGray,
            border: user.isAuthenticated ? `2px solid ${getSubscriptionColor(user.subscription)}` : 'none'
          }}
        >
          {user.avatar ? (
            <img 
              src={user.avatar} 
              alt={user.name}
              className="w-full h-full rounded-full object-cover"
            />
          ) : (
            getInitials(user.name)
          )}
        </div>

        {/* Dropdown Arrow */}
        
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border z-50"
          style={{
            border: `1px solid ${theme.colors.borderLight}`,
            boxShadow: theme.shadows.xl
          }}
        >
          {user.isAuthenticated ? (
            <>
              {/* User Info Header */}
              <div className="p-4 border-b" style={{ borderColor: theme.colors.borderLight }}>
                <div className="flex items-center gap-3">
                  <div
                    className="flex items-center justify-center rounded-full text-white font-semibold"
                    style={{
                      width: '48px',
                      height: '48px',
                      background: `linear-gradient(135deg, ${theme.colors.primary} 0%, ${theme.colors.primaryDark} 100%)`,
                      border: `2px solid ${getSubscriptionColor(user.subscription)}`
                    }}
                  >
                    {user.avatar ? (
                      <img 
                        src={user.avatar} 
                        alt={user.name}
                        className="w-full h-full rounded-full object-cover"
                      />
                    ) : (
                      getInitials(user.name)
                    )}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">{user.name}</h3>
                    <p className="text-sm text-gray-600">{user.email}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span 
                        className="text-xs px-2 py-1 rounded-full text-white font-medium"
                        style={{ background: getSubscriptionColor(user.subscription) }}
                      >
                        {user.subscription || 'Free'}
                      </span>
                      {user.provider && (
                        <span className="text-xs text-gray-500 capitalize">
                          via {user.provider}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Menu Items */}
              <div className="py-2">
                <button
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                  onClick={() => {
                    if (session?.id) {
                      router.push(`/dashboard/${session.id}/settings`);
                    }
                    setIsOpen(false);
                  }}
                >
                  <Settings size={18} style={{ color: theme.colors.textGray }} />
                  <span className="text-gray-700">Settings</span>
                </button>

                <button
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                  onClick={() => {
                    console.log('Subscription clicked');
                    setIsOpen(false);
                  }}
                >
                  <CreditCard size={18} style={{ color: theme.colors.textGray }} />
                  <div className="flex-1">
                    <span className="text-gray-700">Subscription</span>
                    <p className="text-xs text-gray-500">Manage your plan</p>
                  </div>
                </button>

                <div className="border-t my-2" style={{ borderColor: theme.colors.borderLight }}></div>

                <button
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-red-50 transition-colors text-red-600"
                  onClick={handleLogout}
                >
                  <LogOut size={18} />
                  <span>Sign Out</span>
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Sign In Options */}
              <div className="p-4">
                <h3 className="font-semibold text-gray-900 mb-4 text-center">
                  Sign in to Launchfly
                </h3>

                {/* Google Sign In */}
                <button
                  onClick={handleGoogleSignIn}
                  disabled={isLoading}
                  className="w-full flex items-center justify-center gap-3 p-3 border rounded-lg hover:bg-gray-50 transition-colors mb-3"
                  style={{ 
                    borderColor: theme.colors.borderLight,
                    opacity: isLoading ? 0.6 : 1
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  <span className="text-gray-700">
                    {isLoading ? 'Signing in...' : 'Continue with Google'}
                  </span>
                </button>

                {/* Apple Sign In */}
                <button
                  onClick={handleAppleSignIn}
                  disabled={isLoading}
                  className="w-full flex items-center justify-center gap-3 p-3 border rounded-lg hover:bg-gray-50 transition-colors mb-3"
                  style={{ 
                    borderColor: theme.colors.borderLight,
                    opacity: isLoading ? 0.6 : 1
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="#000">
                    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                  </svg>
                  <span className="text-gray-700">
                    {isLoading ? 'Signing in...' : 'Continue with Apple'}
                  </span>
                </button>

                {/* Email Sign In */}
                <button
                  onClick={handleEmailSignIn}
                  disabled={isLoading}
                  className="w-full flex items-center justify-center gap-3 p-3 border rounded-lg hover:bg-gray-50 transition-colors"
                  style={{ 
                    borderColor: theme.colors.borderLight,
                    opacity: isLoading ? 0.6 : 1
                  }}
                >
                  <Mail size={18} style={{ color: theme.colors.textGray }} />
                  <span className="text-gray-700">Continue with Email</span>
                </button>

                <p className="text-xs text-gray-500 text-center mt-4">
                  By signing in, you agree to our Terms of Service and Privacy Policy
                </p>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default UserProfile;
