'use client';

import { useEffect, useState } from 'react';

interface SocialProofData {
    source: string;
    rating: number;
    reviewCount: number;
    verified: boolean;
    lastUpdated: string;
}

interface SocialProofBadgeProps {
    businessId?: string;
    data?: SocialProofData;
    style?: 'compact' | 'full' | 'floating';
    className?: string;
}

// Star rating component
function Stars({ rating }: { rating: number }) {
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);

    return (
        <span className="inline-flex gap-0.5">
            {[...Array(fullStars)].map((_, i) => (
                <span key={`full-${i}`} className="text-yellow-400">★</span>
            ))}
            {hasHalfStar && <span className="text-yellow-400">★</span>}
            {[...Array(emptyStars)].map((_, i) => (
                <span key={`empty-${i}`} className="text-gray-300">★</span>
            ))}
        </span>
    );
}

// Source icon
function SourceIcon({ source }: { source: string }) {
    switch (source) {
        case 'google':
            return <span className="text-sm">🔍</span>;
        case 'facebook':
            return <span className="text-sm">📘</span>;
        default:
            return <span className="text-sm">⭐</span>;
    }
}

export default function SocialProofBadge({
    businessId,
    data: propData,
    style = 'compact',
    className = ''
}: SocialProofBadgeProps) {
    const [data, setData] = useState<SocialProofData | null>(propData || null);
    const [loading, setLoading] = useState(!propData && !!businessId);

    // Fetch data if not provided as prop
    useEffect(() => {
        if (!propData && businessId) {
            fetch(`/api/reviews/import?businessId=${businessId}`)
                .then(res => res.json())
                .then(result => {
                    if (result.socialProof) {
                        setData(result.socialProof);
                    }
                })
                .catch(console.error)
                .finally(() => setLoading(false));
        }
    }, [businessId, propData]);

    if (loading) {
        return (
            <div className={`animate-pulse bg-gray-100 rounded-lg h-8 w-32 ${className}`} />
        );
    }

    if (!data) {
        return null; // Don't render if no social proof
    }

    // Compact style - just rating + count
    if (style === 'compact') {
        return (
            <div className={`inline-flex items-center gap-2 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-full shadow-sm border border-gray-100 ${className}`}>
                <Stars rating={data.rating} />
                <span className="text-sm font-semibold text-gray-800">{data.rating.toFixed(1)}</span>
                <span className="text-xs text-gray-500">({data.reviewCount} reviews)</span>
                {data.verified && <span className="text-xs text-green-600">✓</span>}
            </div>
        );
    }

    // Full style - with source and "Verified" label
    if (style === 'full') {
        return (
            <div className={`bg-white rounded-xl shadow-lg p-4 border border-gray-100 ${className}`}>
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-yellow-50 rounded-full flex items-center justify-center">
                        <span className="text-2xl">⭐</span>
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="text-2xl font-bold text-gray-900">{data.rating.toFixed(1)}</span>
                            <Stars rating={data.rating} />
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                            <span>{data.reviewCount} reviews</span>
                            <SourceIcon source={data.source} />
                            <span className="capitalize">{data.source}</span>
                            {data.verified && (
                                <span className="text-green-600 font-medium">✓ Verified</span>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Floating style - bottom right corner badge
    if (style === 'floating') {
        return (
            <div className={`fixed bottom-4 right-4 bg-white rounded-xl shadow-xl p-3 border border-gray-200 z-50 ${className}`}>
                <div className="flex items-center gap-2">
                    <div className="w-10 h-10 bg-yellow-50 rounded-full flex items-center justify-center">
                        <span className="text-xl">⭐</span>
                    </div>
                    <div>
                        <div className="flex items-center gap-1">
                            <span className="text-lg font-bold text-gray-900">{data.rating.toFixed(1)}</span>
                            <Stars rating={data.rating} />
                        </div>
                        <div className="text-xs text-gray-500">
                            {data.reviewCount} reviews on {data.source}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return null;
}

// Trust badges row component
export function TrustBadgesRow({ businessId }: { businessId: string }) {
    return (
        <div className="flex flex-wrap items-center justify-center gap-4 py-4">
            <SocialProofBadge businessId={businessId} style="compact" />

            {/* Static trust badges */}
            <div className="inline-flex items-center gap-1.5 bg-green-50 px-3 py-1.5 rounded-full text-sm">
                <span>✅</span>
                <span className="text-green-700 font-medium">Verified Business</span>
            </div>

            <div className="inline-flex items-center gap-1.5 bg-blue-50 px-3 py-1.5 rounded-full text-sm">
                <span>🛡️</span>
                <span className="text-blue-700 font-medium">Trusted & Insured</span>
            </div>
        </div>
    );
}
