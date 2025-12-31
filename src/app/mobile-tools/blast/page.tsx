'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import CampaignPanel from '@/components/CampaignPanel';

function BlastContent() {
    const searchParams = useSearchParams();
    const businessId = searchParams.get('bid');

    if (!businessId) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] text-slate-500">
                <div className="text-4xl mb-4">⚠️</div>
                <p>Invalid or missing business link.</p>
            </div>
        );
    }

    return (
        <div className="w-full max-w-md mx-auto">
            <div className="mb-6 text-center">
                <h1 className="text-2xl font-bold text-slate-900">🚀 Weekly Blast</h1>
                <p className="text-slate-600">Send a promo to all your leads.</p>
            </div>
            <CampaignPanel businessId={businessId} />
        </div>
    );
}

export default function MobileBlastPage() {
    return (
        <div className="min-h-screen bg-slate-50 p-4">
            <Suspense fallback={<div className="text-center p-10">Loading...</div>}>
                <BlastContent />
            </Suspense>
        </div>
    );
}
