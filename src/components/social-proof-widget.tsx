'use client';

import { useState, useEffect } from 'react';

interface SocialProofWidgetProps {
    facebookUrl?: string;
    googleMapsUrl?: string;
    reviewCount?: number;
    rating?: number;
    showVerifiedBadge?: boolean;
    recentCustomers?: number;
    className?: string;
}

interface ReviewData {
    source: 'facebook' | 'google';
    rating: number;
    reviewCount: number;
    verified: boolean;
}

/**
 * Social Proof Widget
 * 
 * Displays trust indicators for SEA service SME landing pages:
 * - Star ratings from Facebook/Google
 * - Review count
 * - "Verified Local Business" badge
 * - Recent customer count
 */
export default function SocialProofWidget({
    facebookUrl,
    googleMapsUrl,
    reviewCount = 0,
    rating = 4.8,
    showVerifiedBadge = true,
    recentCustomers,
    className = ''
}: SocialProofWidgetProps) {
    const [reviewData, setReviewData] = useState<ReviewData | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    // Render stars
    const renderStars = (rating: number) => {
        const fullStars = Math.floor(rating);
        const hasHalfStar = rating % 1 >= 0.5;
        const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);

        return (
            <div className="flex items-center gap-0.5">
                {[...Array(fullStars)].map((_, i) => (
                    <span key={`full-${i}`} className="text-yellow-400">★</span>
                ))}
                {hasHalfStar && <span className="text-yellow-400">★</span>}
                {[...Array(emptyStars)].map((_, i) => (
                    <span key={`empty-${i}`} className="text-gray-300">★</span>
                ))}
            </div>
        );
    };

    // Auto-fetch reviews from URL if provided (future implementation)
    useEffect(() => {
        if (facebookUrl || googleMapsUrl) {
            // For now, use static data
            // Future: Call API to scrape reviews
            setReviewData({
                source: facebookUrl ? 'facebook' : 'google',
                rating: rating,
                reviewCount: reviewCount,
                verified: true
            });
        }
    }, [facebookUrl, googleMapsUrl, rating, reviewCount]);

    return (
        <div className={`social-proof-widget ${className}`}>
            {/* Compact Version */}
            <div className="flex flex-wrap items-center gap-4 text-sm">

                {/* Rating & Stars */}
                {(rating > 0 || reviewData) && (
                    <div className="flex items-center gap-2 bg-white/90 backdrop-blur-sm px-3 py-2 rounded-full shadow-sm border border-gray-100">
                        {renderStars(reviewData?.rating || rating)}
                        <span className="font-semibold text-gray-800">
                            {(reviewData?.rating || rating).toFixed(1)}
                        </span>
                        {(reviewData?.reviewCount || reviewCount) > 0 && (
                            <span className="text-gray-500">
                                ({reviewData?.reviewCount || reviewCount} reviews)
                            </span>
                        )}
                    </div>
                )}

                {/* Verified Badge */}
                {showVerifiedBadge && (
                    <div className="flex items-center gap-1.5 bg-green-50 px-3 py-2 rounded-full border border-green-200">
                        <svg
                            className="w-4 h-4 text-green-600"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                        >
                            <path
                                fillRule="evenodd"
                                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                clipRule="evenodd"
                            />
                        </svg>
                        <span className="text-green-700 font-medium">Verified Local Business</span>
                    </div>
                )}

                {/* Recent Customers */}
                {recentCustomers && recentCustomers > 0 && (
                    <div className="flex items-center gap-1.5 bg-blue-50 px-3 py-2 rounded-full border border-blue-200">
                        <span className="text-blue-600">👥</span>
                        <span className="text-blue-700 font-medium">
                            {recentCustomers}+ served this month
                        </span>
                    </div>
                )}

                {/* Source Link */}
                {(facebookUrl || googleMapsUrl) && (
                    <a
                        href={facebookUrl || googleMapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-gray-500 hover:text-gray-700 transition-colors"
                    >
                        {facebookUrl ? (
                            <>
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                                </svg>
                                <span className="text-xs underline">View on Facebook</span>
                            </>
                        ) : (
                            <>
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M12 0C5.383 0 0 5.383 0 12s5.383 12 12 12 12-5.383 12-12S18.617 0 12 0zm4.94 17.94h-2.82v-4.41c0-1.05-.02-2.4-1.46-2.4-1.46 0-1.69 1.14-1.69 2.32v4.49H8.15V9h2.71v1.22h.04c.38-.71 1.3-1.46 2.67-1.46 2.85 0 3.38 1.88 3.38 4.32v4.86z" />
                                </svg>
                                <span className="text-xs underline">View on Google</span>
                            </>
                        )}
                    </a>
                )}
            </div>
        </div>
    );
}

/**
 * Inline Social Proof - Minimal version for tight spaces
 */
export function InlineSocialProof({
    rating = 4.8,
    reviewCount = 50
}: {
    rating?: number;
    reviewCount?: number;
}) {
    return (
        <div className="inline-flex items-center gap-1 text-sm">
            <span className="text-yellow-400">★</span>
            <span className="font-medium">{rating.toFixed(1)}</span>
            <span className="text-gray-400">({reviewCount}+ reviews)</span>
        </div>
    );
}

/**
 * Trust Badges Strip - Multiple trust indicators
 */
export function TrustBadgesStrip() {
    return (
        <div className="flex flex-wrap justify-center gap-4 py-4">
            <div className="flex items-center gap-2 text-gray-600">
                <span>✅</span>
                <span className="text-sm">Licensed & Insured</span>
            </div>
            <div className="flex items-center gap-2 text-gray-600">
                <span>⚡</span>
                <span className="text-sm">Fast Response</span>
            </div>
            <div className="flex items-center gap-2 text-gray-600">
                <span>💯</span>
                <span className="text-sm">Satisfaction Guaranteed</span>
            </div>
            <div className="flex items-center gap-2 text-gray-600">
                <span>🏆</span>
                <span className="text-sm">5 Years Experience</span>
            </div>
        </div>
    );
}

/**
 * WhatsApp QR Code component for easy contact
 */
export function WhatsAppQRCode({
    phoneNumber,
    message = "Hi! I'd like to inquire about your services."
}: {
    phoneNumber: string;
    message?: string;
}) {
    const cleanPhone = phoneNumber.replace(/[^0-9]/g, '');
    const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;

    // Generate QR code URL using a free API
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(waUrl)}`;

    return (
        <div className="text-center">
            <img
                src={qrUrl}
                alt="Scan to WhatsApp"
                className="mx-auto rounded-lg shadow-md"
                width={150}
                height={150}
            />
            <p className="text-sm text-gray-500 mt-2">Scan to WhatsApp</p>
        </div>
    );
}
