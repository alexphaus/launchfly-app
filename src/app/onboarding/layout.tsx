'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <div className="onboarding-layout">
      <style jsx global>{`
        .onboarding-layout {
          min-height: 100vh;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          position: relative;
          overflow-x: hidden;
        }

        .onboarding-layout::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: 
            radial-gradient(circle at 20% 80%, rgba(120, 119, 198, 0.3) 0%, transparent 50%),
            radial-gradient(circle at 80% 20%, rgba(255, 119, 198, 0.3) 0%, transparent 50%),
            radial-gradient(circle at 40% 40%, rgba(120, 219, 255, 0.2) 0%, transparent 50%);
          pointer-events: none;
        }

        .onboarding-container {
          position: relative;
          z-index: 1;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 2rem;
        }

        .onboarding-card {
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 24px;
          box-shadow: 
            0 32px 64px rgba(0, 0, 0, 0.1),
            0 16px 32px rgba(0, 0, 0, 0.05),
            inset 0 1px 0 rgba(255, 255, 255, 0.5);
          max-width: 600px;
          width: 100%;
          overflow: hidden;
          animation: slideUp 0.6s ease-out;
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .onboarding-header {
          padding: 2rem 2rem 1rem;
          text-align: center;
          border-bottom: 1px solid rgba(0, 0, 0, 0.05);
        }

        .onboarding-logo {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          margin-bottom: 1rem;
        }

        .onboarding-logo-icon {
          font-size: 2rem;
          animation: pulse 2s infinite;
        }

        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }

        .onboarding-logo-text {
          font-size: 1.5rem;
          font-weight: 700;
          color: #1a1a1a;
        }

        .onboarding-progress {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          margin-bottom: 1.5rem;
        }

        .progress-step {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: #e5e7eb;
          transition: all 0.3s ease;
          position: relative;
        }

        .progress-step.active {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          transform: scale(1.2);
        }

        .progress-step.completed {
          background: #10b981;
        }

        .progress-step.completed::after {
          content: '✓';
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          color: white;
          font-size: 8px;
          font-weight: bold;
        }

        .onboarding-content {
          padding: 2rem;
        }

        .onboarding-title {
          font-size: 1.75rem;
          font-weight: 700;
          color: #1a1a1a;
          margin-bottom: 0.5rem;
          text-align: center;
        }

        .onboarding-subtitle {
          color: #6b7280;
          text-align: center;
          margin-bottom: 2rem;
          line-height: 1.6;
        }

        .form-group {
          margin-bottom: 1.5rem;
        }

        .form-label {
          display: block;
          font-weight: 600;
          color: #374151;
          margin-bottom: 0.5rem;
          font-size: 0.9rem;
        }

        .form-input {
          width: 100%;
          padding: 0.875rem 1rem;
          border: 2px solid #e5e7eb;
          border-radius: 12px;
          font-size: 1rem;
          transition: all 0.2s ease;
          background: white;
        }

        .form-input:focus {
          outline: none;
          border-color: #667eea;
          box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }

        .form-input.error {
          border-color: #ef4444;
        }

        .form-error {
          color: #ef4444;
          font-size: 0.875rem;
          margin-top: 0.5rem;
        }

        .btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          padding: 0.875rem 2rem;
          border: none;
          border-radius: 12px;
          font-weight: 600;
          font-size: 1rem;
          cursor: pointer;
          transition: all 0.2s ease;
          text-decoration: none;
          position: relative;
          overflow: hidden;
        }

        .btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .btn-primary {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
        }

        .btn-primary:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(102, 126, 234, 0.4);
        }

        .btn-secondary {
          background: white;
          color: #374151;
          border: 2px solid #e5e7eb;
        }

        .btn-secondary:hover:not(:disabled) {
          background: #f9fafb;
          border-color: #d1d5db;
        }

        .btn-full {
          width: 100%;
        }

        .social-login {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          margin-bottom: 1.5rem;
        }

        .social-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.75rem;
          padding: 0.875rem 1rem;
          border: 2px solid #e5e7eb;
          border-radius: 12px;
          background: white;
          color: #374151;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          text-decoration: none;
        }

        .social-btn:hover {
          background: #f9fafb;
          border-color: #d1d5db;
          transform: translateY(-1px);
        }

        .divider {
          display: flex;
          align-items: center;
          margin: 1.5rem 0;
          color: #9ca3af;
          font-size: 0.875rem;
        }

        .divider::before,
        .divider::after {
          content: '';
          flex: 1;
          height: 1px;
          background: #e5e7eb;
        }

        .divider span {
          padding: 0 1rem;
        }

        .loading-spinner {
          width: 20px;
          height: 20px;
          border: 2px solid transparent;
          border-top: 2px solid currentColor;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        @media (max-width: 640px) {
          .onboarding-container {
            padding: 1rem;
          }
          
          .onboarding-content {
            padding: 1.5rem;
          }
          
          .onboarding-header {
            padding: 1.5rem 1.5rem 1rem;
          }
        }
      `}</style>

      <div className="onboarding-container">
        <div className="onboarding-card">
          {children}
        </div>
      </div>
    </div>
  );
}
