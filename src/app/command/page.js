'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function CommandRedirect() {
  const router = useRouter();

  useEffect(() => {
    const savedBusinessId = localStorage.getItem('lastBusinessId');
    if (savedBusinessId) {
      router.replace(`/command/${savedBusinessId}`);
    } else {
      window.location.href = '/index.html';
    }
  }, [router]);

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0a08',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#f5f4ef',
      fontFamily: 'system-ui, sans-serif'
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ 
          width: '40px', 
          height: '40px', 
          border: '3px solid #f97316',
          borderTopColor: 'transparent',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          margin: '0 auto 1rem'
        }} />
        <p>Loading your dashboard...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
}