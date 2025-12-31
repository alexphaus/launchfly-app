'use client';

import { useState } from 'react';

export default function SocialProofWidget({ reviews, businessName, trustBadge }) {
    // Use mock reviews if none provided
    const displayReviews = reviews && reviews.length > 0 ? reviews : [
        {
            author: 'Happy Customer',
            rating: 5,
            text: `Highly recommend ${businessName || 'this service'}! Professional and efficient.`,
            date: 'Recent'
        },
        {
            author: 'Local Resident',
            rating: 5,
            text: 'Great experience from start to finish. Will definitely use again.',
            date: 'Recent'
        },
        {
            author: 'Verified Client',
            rating: 5,
            text: 'Saved me so much time and hassle. Worth every penny!',
            date: 'Recent'
        }
    ];

    const [activeIndex, setActiveIndex] = useState(0);

    const nextReview = () => {
        setActiveIndex((prev) => (prev + 1) % displayReviews.length);
    };

    const prevReview = () => {
        setActiveIndex((prev) => (prev - 1 + displayReviews.length) % displayReviews.length);
    };

    return (
        <div className="py-12 bg-gray-50 border-b border-gray-100">
            <div className="max-w-4xl mx-auto px-4">

                {/* Trust Header */}
                <div className="text-center mb-8">
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Trusted by Locals</h2>
                    <div className="flex items-center justify-center gap-2 text-sm text-gray-600">
                        {trustBadge && (
                            <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-medium">
                                🛡️ {trustBadge}
                            </span>
                        )}
                        <span className="flex items-center gap-1">
                            <span className="text-yellow-400">★★★★★</span>
                            <span>5.0 Average Rating</span>
                        </span>
                    </div>
                </div>

                {/* Review Card */}
                <div className="relative bg-white p-8 rounded-2xl shadow-sm border border-gray-100 max-w-2xl mx-auto">
                    {/* Navigation Buttons */}
                    {displayReviews.length > 1 && (
                        <>
                            <button
                                onClick={prevReview}
                                className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 w-10 h-10 bg-white rounded-full shadow border flex items-center justify-center text-gray-500 hover:text-blue-600 hover:border-blue-200 transition-all z-10"
                                aria-label="Previous review"
                            >
                                ←
                            </button>
                            <button
                                onClick={nextReview}
                                className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 w-10 h-10 bg-white rounded-full shadow border flex items-center justify-center text-gray-500 hover:text-blue-600 hover:border-blue-200 transition-all z-10"
                                aria-label="Next review"
                            >
                                →
                            </button>
                        </>
                    )}

                    {/* Content */}
                    <div className="text-center">
                        <div className="flex justify-center mb-4">
                            {[...Array(displayReviews[activeIndex].rating || 5)].map((_, i) => (
                                <span key={i} className="text-yellow-400 text-xl">★</span>
                            ))}
                        </div>

                        <blockquote className="text-lg text-gray-800 italic mb-6 leading-relaxed">
                            "{displayReviews[activeIndex].text}"
                        </blockquote>

                        <div className="flex items-center justify-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-sm">
                                {displayReviews[activeIndex].author.charAt(0)}
                            </div>
                            <div className="text-left">
                                <div className="font-semibold text-gray-900 line-clamp-1">
                                    {displayReviews[activeIndex].author}
                                </div>
                                <div className="text-xs text-gray-500 flex items-center gap-1">
                                    <span>Verified Customer</span>
                                    <span className="text-blue-500">✓</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Pagination Dots */}
                    {displayReviews.length > 1 && (
                        <div className="flex justify-center gap-1.5 mt-6">
                            {displayReviews.map((_, i) => (
                                <button
                                    key={i}
                                    onClick={() => setActiveIndex(i)}
                                    className={`w-2 h-2 rounded-full transition-all ${i === activeIndex ? 'bg-blue-600 w-4' : 'bg-gray-300'
                                        }`}
                                    aria-label={`Go to review ${i + 1}`}
                                />
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer Badge */}
                <div className="text-center mt-8 opacity-60 grayscale hover:grayscale-0 transition-all duration-500">
                    <div className="flex justify-center items-center gap-4 text-xs font-semibold text-gray-400 uppercase tracking-widest">
                        <span>Verified Reviews from</span>
                        <span className="flex gap-2">
                            <span className="text-[#1877F2]">Facebook</span>
                            <span>•</span>
                            <span className="text-[#4285F4]">Google</span>
                        </span>
                    </div>
                </div>

            </div>
        </div>
    );
}
