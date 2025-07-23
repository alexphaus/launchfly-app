// app/dashboard/loading/page.js
'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function LoadingPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const email = searchParams.get('email');
  
  useEffect(() => {
    const checkSession = async () => {
      try {
        // Poll your API to check if session exists
        const res = await fetch(`/api/check-session?email=${email}`);
        const data = await res.json();
        
        if (data.sessionId) {
          router.push(`${process.env.NEXT_PUBLIC_URL}/dashboard/${sessionId}?onboarding=true`);
        } else {
          // Retry after 2 seconds
          setTimeout(checkSession, 2000);
        }
      } catch (error) {
        setTimeout(checkSession, 2000);
      }
    };
    
    checkSession();
  }, [email]);
  
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4">Creating your business...</p>
      </div>
    </div>
  );
}