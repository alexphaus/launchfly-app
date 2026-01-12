// src/components/launchfly-ui/QuoteFunnel.js
// Mobile-first conversion funnel for instant quotes
'use client';

import { useState, useEffect } from 'react';

export default function QuoteFunnel({
    businessName = "Launchfly Services",
    logoUrl = null,
    phoneNumber = null,
    whatsappNumber = null,
    headline = "Get your service price in 30 seconds.",
    subheadline = "No hidden fees. 100% Free Estimate.",
    urgencyText = "⚡ Response in 2 mins",
    currency = "₱",
    services = [
        { id: 'cleaning', label: 'Cleaning', basePrice: 1200 },
        { id: 'repair', label: 'Repair', basePrice: 500, isRange: true, maxPrice: 1500 },
    ],
    unitLabel = "How many units?",
    businessId = null,
    primaryColor = "#2563eb", // Blue-600
    recentBookings = [
        { name: "Maria from Makati", action: "Booked a cleaning", time: "12 mins ago", avatar: "👩" },
    ],
    trustBadges = [
        { icon: "🛡️", text: "Verified Pro" },
        { icon: "⭐", text: "4.9/5 Rating" },
    ],
    processSteps = [
        { icon: "📱", title: "You Request", desc: "Pick your slot" },
        { icon: "✅", title: "We Confirm", desc: "Get tech photo" },
        { icon: "🎉", title: "Job Done", desc: "Pay after" },
    ],
    isProspect = false, // Show claim banner for prospects
    claimUrl = null, // Custom claim URL
}) {
    const [selectedService, setSelectedService] = useState(services[0]?.id || 'cleaning');
    const [units, setUnits] = useState(1);
    const [whatsappInput, setWhatsappInput] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [currentBookingIndex, setCurrentBookingIndex] = useState(0);

    // Rotate recent bookings
    useEffect(() => {
        if (recentBookings.length > 1) {
            const interval = setInterval(() => {
                setCurrentBookingIndex(prev => (prev + 1) % recentBookings.length);
            }, 5000);
            return () => clearInterval(interval);
        }
    }, [recentBookings.length]);

    // Calculate price based on selection
    const calculatePrice = () => {
        const service = services.find(s => s.id === selectedService);
        if (!service) return { low: 0, high: 0 };

        if (service.isRange) {
            return { low: service.basePrice, high: service.maxPrice || service.basePrice * 3 };
        }

        const low = service.basePrice * units;
        const high = low + (service.priceVariance || 300);
        return { low, high };
    };

    const { low, high } = calculatePrice();

    // Handle form submission
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!whatsappInput.trim()) return;

        setIsSubmitting(true);
        try {
            // Get the selected service for details
            const selectedServiceData = services.find(s => s.id === selectedService);

            // Submit lead to API - format matches /api/leads/submit expectations
            const response = await fetch('/api/leads/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    businessId,
                    formData: {
                        phone: whatsappInput,
                        name: '', // Could add name field later
                        type: 'quote_request',
                        quoteDetails: {
                            estimate: {
                                min: low,
                                max: high,
                                currency: currency,
                            },
                            answers: {
                                service: selectedService,
                                serviceLabel: selectedServiceData?.label || selectedService,
                                units: units,
                            },
                        },
                        source: 'quote-funnel',
                    },
                }),
            });

            if (response.ok) {
                setSubmitted(true);
                // Redirect to WhatsApp if number available
                if (whatsappNumber) {
                    const cleanPhone = whatsappNumber.replace(/\D/g, '');
                    const message = encodeURIComponent(
                        `Hi! I want to request a quote for ${businessName}. Service: ${selectedService} (${units} unit${units > 1 ? 's' : ''}). Estimated: ${currency}${low.toLocaleString()} - ${currency}${high.toLocaleString()}`
                    );
                    // Use native WhatsApp scheme to bypass ISP blocks on wa.me
                    window.location.href = `whatsapp://send?phone=${cleanPhone}&text=${message}`;
                }
            }
        } catch (err) {
            console.error('Submit error:', err);
        } finally {
            setIsSubmitting(false);
        }
    };

    const currentBooking = recentBookings[currentBookingIndex] || recentBookings[0];

    return (
        <div className="max-w-md mx-auto bg-white min-h-screen shadow-2xl relative overflow-hidden">
            {/* Prospect Claim Banner */}
            {isProspect && (
                <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white py-3 px-4 text-center">
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-2">
                        <span className="font-medium text-sm">
                            🎁 This is a preview of your personalized quote funnel
                        </span>
                        <a
                            href={claimUrl || `https://www.launchfly.ai/claim/${businessId}?utm_source=preview&utm_medium=banner`}
                            className="bg-white text-orange-600 px-4 py-1 rounded-full text-xs font-semibold hover:bg-orange-50 transition-colors"
                        >
                            Go Live in 5 Minutes →
                        </a>
                    </div>
                </div>
            )}

            {/* Sticky Header - No Menu */}
            <header className={`sticky ${isProspect ? 'top-0' : 'top-0'} bg-white/95 backdrop-blur z-40 px-5 py-4 border-b border-gray-100 flex justify-between items-center`}>
                <div className="flex items-center gap-2">
                    {logoUrl ? (
                        <img src={logoUrl} alt={businessName} className="w-8 h-8 object-contain rounded-lg" />
                    ) : (
                        <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold"
                            style={{ backgroundColor: primaryColor }}
                        >
                            {businessName.charAt(0)}
                        </div>
                    )}
                    <span className="font-bold text-gray-900 tracking-tight">{businessName}</span>
                </div>
                {phoneNumber && (
                    <a
                        href={`tel:${phoneNumber}`}
                        className="bg-green-100 text-green-700 px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1"
                    >
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
                        </svg>
                        Call
                    </a>
                )}
            </header>

            {/* Hero Section */}
            <div className="px-6 pt-8 pb-4">
                {urgencyText && (
                    <span className="inline-block bg-orange-100 text-orange-600 px-3 py-1 rounded-full text-xs font-bold mb-3">
                        {urgencyText}
                    </span>
                )}
                <h1 className="text-3xl font-bold leading-tight text-slate-900 mb-2">
                    {headline}
                </h1>
                <p className="text-gray-500 text-sm">{subheadline}</p>
            </div>

            {/* The Magic Calculator Card */}
            <div className="px-4 mb-8">
                <div className="bg-white border border-gray-200 rounded-2xl shadow-xl p-5">

                    {/* Step 1: Service Selection */}
                    <div className="mb-6">
                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                            1. What do you need?
                        </label>
                        <div className={`grid gap-3 ${services.length > 2 ? 'grid-cols-2' : 'grid-cols-' + services.length}`}>
                            {services.map(service => (
                                <button
                                    key={service.id}
                                    type="button"
                                    onClick={() => setSelectedService(service.id)}
                                    className={`font-semibold py-3 rounded-xl border transition-all ${selectedService === service.id
                                        ? 'ring-2 ring-blue-600 bg-blue-50 text-blue-700 border-transparent'
                                        : 'bg-white text-gray-600 border-gray-200 hover:border-blue-400'
                                        }`}
                                >
                                    {service.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Step 2: Unit Counter (only show if service isn't range-based) */}
                    {!services.find(s => s.id === selectedService)?.isRange && (
                        <div className="mb-8">
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                                2. {unitLabel}
                            </label>
                            <div className="flex items-center justify-between bg-gray-50 rounded-xl p-2 border border-gray-200">
                                <button
                                    type="button"
                                    onClick={() => setUnits(Math.max(1, units - 1))}
                                    className="w-10 h-10 bg-white rounded-lg shadow-sm text-gray-600 font-bold hover:bg-gray-100"
                                >
                                    -
                                </button>
                                <span className="text-xl font-bold text-gray-900">{units}</span>
                                <button
                                    type="button"
                                    onClick={() => setUnits(units + 1)}
                                    className="w-10 h-10 rounded-lg shadow-sm text-white font-bold hover:opacity-90"
                                    style={{ backgroundColor: primaryColor }}
                                >
                                    +
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Price Display */}
                    <div className="text-center mb-6 bg-slate-50 py-4 rounded-xl border border-slate-100">
                        <p className="text-xs text-gray-500 mb-1">Estimated Total</p>
                        <div className="text-3xl font-black text-slate-900 tracking-tight">
                            {currency}{low.toLocaleString()} - {currency}{high.toLocaleString()}
                        </div>
                        <p className="text-[10px] text-gray-400 mt-1">Based on standard units</p>
                    </div>

                    {/* Lead Capture Form */}
                    {!submitted ? (
                        <form onSubmit={handleSubmit} className="space-y-3">
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
                                    </svg>
                                </div>
                                <input
                                    type="tel"
                                    value={whatsappInput}
                                    onChange={(e) => setWhatsappInput(e.target.value)}
                                    placeholder="Enter WhatsApp Number"
                                    className="w-full bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block pl-10 p-3"
                                    required
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="w-full text-white font-bold py-4 rounded-xl shadow-lg transform active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                                style={{
                                    backgroundColor: primaryColor,
                                    boxShadow: `0 10px 25px -5px ${primaryColor}40`
                                }}
                            >
                                {isSubmitting ? 'Sending...' : 'Check Availability'}
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                </svg>
                            </button>

                            <p className="text-center text-[10px] text-gray-400 flex items-center justify-center gap-1">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                </svg>
                                We send the quote to WhatsApp. No spam.
                            </p>
                        </form>
                    ) : (
                        <div className="text-center py-4">
                            <div className="text-4xl mb-2">✅</div>
                            <p className="font-bold text-green-600">Quote Sent!</p>
                            <p className="text-sm text-gray-500">Check your WhatsApp for details.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Social Proof Section */}
            <div className="px-4 pb-8">
                {/* Recent Booking Ticker */}
                {currentBooking && (
                    <div className="flex items-center gap-3 bg-white p-3 rounded-xl border border-gray-100 shadow-sm mb-4">
                        <div className="relative">
                            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center text-xl">
                                {currentBooking.avatar}
                            </div>
                            <div className="absolute -bottom-1 -right-1 bg-green-500 w-4 h-4 rounded-full border-2 border-white"></div>
                        </div>
                        <div>
                            <p className="text-xs font-bold text-gray-800">{currentBooking.name}</p>
                            <p className="text-[10px] text-gray-500">{currentBooking.action} {currentBooking.time}</p>
                        </div>
                    </div>
                )}

                {/* Trust Badges */}
                {trustBadges.length > 0 && (
                    <div className="flex justify-center gap-6 opacity-70">
                        {trustBadges.map((badge, i) => (
                            <div key={i} className="text-[10px] font-bold flex items-center gap-1 text-gray-600">
                                <span className="text-lg">{badge.icon}</span> {badge.text}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Process Steps */}
            {processSteps.length > 0 && (
                <div className="px-4 pb-12 border-t border-gray-100 pt-8">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 text-center">
                        What Happens Next
                    </p>
                    <div className="flex justify-between">
                        {processSteps.map((step, i) => (
                            <div key={i} className="text-center flex-1">
                                <div className="text-2xl mb-1">{step.icon}</div>
                                <p className="text-xs font-bold text-gray-800">{step.title}</p>
                                <p className="text-[10px] text-gray-500">{step.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
