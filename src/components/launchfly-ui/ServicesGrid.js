// src/components/launchfly-ui/ServicesGrid.js
'use client';

export default function ServicesGrid({
    title = "Services",
    subtitle = "What we offer",
    services = [],
    businessName = "Business"
}) {
    // Default services if none provided
    const defaultServices = [
        { name: 'Cleaning', description: 'We make it better', icon: '🧹' },
        { name: 'Installation', description: 'We make it better', icon: '🔧' },
        { name: 'Repair', description: 'We make it better', icon: '⚡' },
        { name: 'Maintenance', description: 'We make it better', icon: '🔄' }
    ];

    const displayServices = services.length > 0 ? services : defaultServices;

    return (
        <section id="services" className="bg-white py-16 lg:py-24">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Section Header */}
                <div className="mb-12">
                    <h2 className="text-3xl md:text-4xl font-serif font-medium text-slate-900">
                        {title}
                    </h2>
                </div>

                {/* Services Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    {displayServices.slice(0, 4).map((service, index) => (
                        <div key={index} className="group">
                            {/* Service Image */}
                            <div className="relative aspect-[4/3] bg-slate-100 rounded-xl overflow-hidden mb-4">
                                {service.image ? (
                                    <img
                                        src={service.image}
                                        alt={service.name}
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-4xl bg-gradient-to-br from-slate-100 to-slate-200">
                                        {service.icon || '🔧'}
                                    </div>
                                )}
                                {/* Logo Badge Overlay */}
                                <div className="absolute bottom-2 left-2 w-10 h-10 bg-white rounded-full shadow-lg flex items-center justify-center text-lg">
                                    ❄️
                                </div>
                            </div>
                            {/* Service Info */}
                            <h3 className="font-semibold text-slate-900 mb-1">{service.name}</h3>
                            <p className="text-sm text-slate-500">{service.description || 'We make it better'}</p>
                        </div>
                    ))}
                </div>

                {/* Full Service List */}
                {displayServices.length > 4 && (
                    <div className="mt-16 grid lg:grid-cols-2 gap-12 items-center">
                        {/* Image */}
                        <div className="relative aspect-[4/3] bg-slate-100 rounded-xl overflow-hidden">
                            <div className="w-full h-full flex items-center justify-center text-6xl bg-gradient-to-br from-blue-50 to-blue-100">
                                ❄️
                            </div>
                            {/* Logo Overlay */}
                            <div className="absolute bottom-4 left-4 w-16 h-16 bg-white rounded-full shadow-xl flex items-center justify-center">
                                <span className="text-2xl">❄️</span>
                            </div>
                        </div>

                        {/* Service List */}
                        <div>
                            <p className="text-sm text-slate-500 uppercase tracking-widest mb-2">All Services</p>
                            <h3 className="text-3xl font-serif font-medium text-slate-900 mb-6">What we Offer</h3>
                            <ul className="space-y-3">
                                {displayServices.map((service, index) => (
                                    <li key={index} className="flex items-center gap-2 text-slate-600">
                                        <span className="text-slate-400">·</span>
                                        <span>{service.name}</span>
                                    </li>
                                ))}
                                <li className="flex items-center gap-2 text-slate-500 italic">
                                    <span className="text-slate-400">·</span>
                                    <span>And many more..</span>
                                </li>
                            </ul>
                        </div>
                    </div>
                )}
            </div>
        </section>
    );
}
