// src/components/launchfly-ui/AboutSection.js
'use client';

export default function AboutSection({
    businessName = "Business Name",
    description = "A reputable and customer-oriented business that specializes in a wide range of solutions.",
    mission = "A reputable and customer-oriented business that specializes in a wide range of solutions.",
    logoEmoji = "❄️",
    logoUrl = null // URL to logo image (from uploaded images)
}) {
    return (
        <>
            {/* About Section - Logo + Text */}
            <section id="about" className="bg-white py-16 lg:py-24">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="grid lg:grid-cols-2 gap-12 items-start">
                        {/* Logo */}
                        <div className="flex justify-center lg:justify-start">
                            {logoUrl ? (
                                <img
                                    src={logoUrl}
                                    alt={businessName}
                                    className="w-48 h-48 object-contain rounded-2xl shadow-xl bg-white p-4"
                                />
                            ) : (
                                <div className="w-48 h-48 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center shadow-xl">
                                    <span className="text-7xl">{logoEmoji}</span>
                                </div>
                            )}
                        </div>

                        {/* Text Content */}
                        <div>
                            <p className="text-sm text-slate-500 uppercase tracking-widest mb-2">About</p>
                            <h2 className="text-3xl md:text-4xl font-serif font-medium text-slate-900 mb-6">
                                {businessName}
                            </h2>
                            <p className="text-lg text-slate-600 font-medium mb-4">Hi, Welcome.</p>
                            <p className="text-slate-600 leading-relaxed">
                                {description}
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Full-width Mission Banner */}
            <section className="relative py-24 bg-blue-600 overflow-hidden">
                {/* Background Pattern */}
                <div className="absolute inset-0 opacity-10">
                    <div className="absolute top-0 left-0 w-96 h-96 bg-white rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2"></div>
                    <div className="absolute bottom-0 right-0 w-96 h-96 bg-white rounded-full blur-3xl translate-x-1/2 translate-y-1/2"></div>
                </div>

                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
                    <p className="text-2xl md:text-3xl lg:text-4xl font-serif font-medium text-white leading-relaxed">
                        "{mission}"
                    </p>
                </div>
            </section>
        </>
    );
}
