// src/app/(marketing)/page.tsx
// Launchfly Agency Sales Page - High-converting landing page

import React from 'react';
import {
    MessageCircle,
    PhoneMissed,
    MessageSquareOff,
    Smartphone,
    Check,
    ShieldCheck
} from 'lucide-react';

export const metadata = {
    title: 'Launchfly - The WhatsApp Booking Machine',
    description: 'Stop missing calls. Start booking jobs. The WhatsApp Receptionist for busy Aircon & Service Pros.',
};

export default function LaunchflyAgencyPage() {
    return (
        <div className="min-h-screen bg-white text-slate-900 font-sans antialiased selection:bg-blue-100">

            {/* 1. NAVBAR */}
            <nav className="fixed w-full bg-white/90 backdrop-blur-sm z-50 border-b border-slate-100">
                <div className="max-w-5xl mx-auto px-6 py-4 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">L</div>
                        <span className="font-bold text-xl tracking-tight">Launchfly</span>
                    </div>
                    <a
                        href="https://wa.me/13203627874"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg font-bold text-sm transition-all flex items-center gap-2 shadow-sm hover:shadow-md"
                    >
                        <MessageCircle className="w-4 h-4" />
                        Talk to Sales
                    </a>
                </div>
            </nav>

            {/* 2. HERO SECTION */}
            <header
                className="pt-32 pb-20 px-6"
                style={{
                    backgroundImage: 'radial-gradient(#3b82f6 1px, transparent 1px)',
                    backgroundSize: '24px 24px'
                }}
            >
                <div className="max-w-4xl mx-auto text-center">
                    {/* Scarcity Badge */}
                    <div className="inline-flex items-center gap-2 bg-blue-50 border border-blue-100 px-4 py-2 rounded-full mb-8 shadow-sm">
                        <span className="relative flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
                        </span>
                        <span className="text-sm font-semibold text-blue-700">Accepting 3 New Clients for Jan 2026</span>
                    </div>

                    <h1 className="text-5xl md:text-7xl font-black text-slate-900 mb-6 leading-tight tracking-tight">
                        Stop Missing Calls.<br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">Start Booking Jobs.</span>
                    </h1>

                    <p className="text-xl text-slate-600 mb-10 max-w-2xl mx-auto leading-relaxed">
                        The &quot;WhatsApp Receptionist&quot; for busy Aircon &amp; Service Pros.
                        It quotes prices, replies to leads, and books appointments while you&apos;re on a ladder.
                    </p>

                    <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                        <a href="#demo" className="w-full sm:w-auto px-8 py-4 bg-slate-900 text-white rounded-xl font-bold text-lg hover:bg-slate-800 transition-all shadow-lg shadow-blue-900/10 hover:shadow-xl hover:-translate-y-1">
                            See The Demo
                        </a>
                        <a href="#pricing" className="w-full sm:w-auto px-8 py-4 bg-white border-2 border-slate-200 text-slate-700 rounded-xl font-bold text-lg hover:border-slate-300 hover:bg-slate-50 transition-all">
                            View Pricing
                        </a>
                    </div>

                    <p className="mt-6 text-sm text-slate-400 font-medium">Trusted by 50+ Pros in Metro Manila</p>
                </div>
            </header>

            {/* 3. THE PAIN POINT (Agitation) */}
            <section className="py-20 bg-slate-50 border-y border-slate-200">
                <div className="max-w-5xl mx-auto px-6">
                    <div className="grid md:grid-cols-2 gap-12 items-center">
                        <div>
                            <h2 className="text-3xl font-bold mb-6 text-slate-900">You are losing money every time you climb a ladder.</h2>
                            <div className="space-y-6">
                                <div className="flex gap-4 group">
                                    <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center shrink-0 group-hover:bg-red-200 transition-colors">
                                        <PhoneMissed className="w-6 h-6 text-red-600" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-lg text-slate-900">The &quot;Missed Call&quot; Problem</h3>
                                        <p className="text-slate-600 mt-1">Phone rings while you&apos;re driving or fixing an AC. You don&apos;t answer. Customer calls the next guy.</p>
                                    </div>
                                </div>
                                <div className="flex gap-4 group">
                                    <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center shrink-0 group-hover:bg-red-200 transition-colors">
                                        <MessageSquareOff className="w-6 h-6 text-red-600" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-lg text-slate-900">The &quot;Hm Po?&quot; Nightmare</h3>
                                        <p className="text-slate-600 mt-1">You spend hours texting &quot;How much?&quot; to people who never reply. It&apos;s a waste of time.</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* The "Old Way" Card */}
                        <div className="bg-white p-6 rounded-2xl shadow-xl border border-slate-100 md:rotate-2 hover:rotate-0 transition-all duration-500 ease-out">
                            <div className="flex items-center gap-3 border-b border-slate-100 pb-4 mb-4">
                                <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                                <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                                <span className="text-xs text-slate-400 font-mono ml-auto">Old Way.exe</span>
                            </div>
                            <div className="space-y-3 font-mono text-sm">
                                <div className="bg-slate-50 p-3 rounded-lg text-slate-500 flex items-center gap-2">
                                    <PhoneMissed className="w-4 h-4" /> Missed Call (0917-XXX-XXXX)
                                </div>
                                <div className="bg-slate-50 p-3 rounded-lg text-slate-500 flex items-center gap-2">
                                    <PhoneMissed className="w-4 h-4" /> Missed Call (0998-XXX-XXXX)
                                </div>
                                <div className="bg-red-50 p-3 rounded-lg text-red-600 font-bold border border-red-100 flex items-center gap-2">
                                    ⚠️ ₱5,000 Potential Revenue LOST.
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* 4. THE SOLUTION (Interactive Demo) */}
            <section id="demo" className="py-24 bg-white">
                <div className="max-w-4xl mx-auto px-6 text-center">
                    <span className="text-blue-600 font-bold tracking-wider uppercase text-sm">The New Way</span>
                    <h2 className="text-4xl font-bold mt-2 mb-12 text-slate-900">Try the &quot;Instant Quote&quot; Engine</h2>

                    <div className="relative group cursor-pointer">
                        {/* Glow Effect */}
                        <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-3xl blur opacity-25 group-hover:opacity-60 transition duration-1000 group-hover:duration-200"></div>

                        <div className="relative bg-white border border-slate-200 rounded-2xl p-8 shadow-2xl text-left">
                            <div className="grid md:grid-cols-2 gap-8 items-center">
                                <div>
                                    <h3 className="text-2xl font-bold mb-4 flex items-center gap-2">
                                        <span className="bg-blue-100 text-blue-700 w-8 h-8 rounded-full flex items-center justify-center text-sm">1</span>
                                        Customer Clicks a Link
                                    </h3>
                                    <p className="text-slate-600 mb-6 pl-10 border-l-2 border-slate-100">Instead of calling, they tap your &quot;Instant Quote&quot; link. They select &quot;Cleaning&quot; and &quot;2 Units&quot;.</p>

                                    <h3 className="text-2xl font-bold mb-4 flex items-center gap-2">
                                        <span className="bg-blue-100 text-blue-700 w-8 h-8 rounded-full flex items-center justify-center text-sm">2</span>
                                        They Get a Price Instantly
                                    </h3>
                                    <p className="text-slate-600 mb-6 pl-10 border-l-2 border-slate-100">Our system calculates the price (e.g., ₱2,400) and shows it immediately. No waiting.</p>

                                    <h3 className="text-2xl font-bold mb-4 flex items-center gap-2">
                                        <span className="bg-blue-100 text-blue-700 w-8 h-8 rounded-full flex items-center justify-center text-sm">3</span>
                                        You Get the Job
                                    </h3>
                                    <p className="text-slate-600 pl-10 border-l-2 border-slate-100">The lead is sent directly to your WhatsApp. &quot;New Job: Cleaning, 2 Units, Makati.&quot;</p>
                                </div>

                                {/* Phone Mockup */}
                                <div className="bg-slate-900 rounded-[2.5rem] p-4 shadow-2xl border-4 border-slate-800 transform group-hover:scale-[1.02] transition-transform duration-300">
                                    <div className="bg-white rounded-[2rem] overflow-hidden h-[400px] w-full flex flex-col items-center justify-center bg-slate-50 border border-slate-200 relative">
                                        {/* Simulated Screen Content */}
                                        <Smartphone className="w-12 h-12 text-slate-300 mb-4" />
                                        <p className="text-slate-400 font-bold mb-2">Interactive Demo</p>
                                        <a
                                            href="/q/demo"
                                            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-full text-sm font-bold shadow-lg shadow-blue-200 transition-all"
                                        >
                                            Tap to Try
                                        </a>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* 5. THE OFFER STACK (Pricing) */}
            <section id="pricing" className="py-24 bg-slate-900 text-white">
                <div className="max-w-3xl mx-auto px-6 text-center">
                    <h2 className="text-4xl font-bold mb-4">
                        ₱15,000 Value. <span className="text-green-400">₱5,000 Price.</span>
                    </h2>
                    <p className="text-slate-400 mb-12 text-lg">I&apos;m building my portfolio. I want you as a Case Study. That&apos;s why the price is this low.</p>

                    <div className="bg-slate-800 rounded-3xl p-8 border border-slate-700 shadow-2xl relative overflow-hidden max-w-lg mx-auto transform hover:scale-[1.01] transition-transform duration-300">
                        <div className="absolute top-0 right-0 bg-green-500 text-slate-900 text-xs font-bold px-3 py-1 rounded-bl-xl">ONE-TIME PAYMENT</div>

                        <div className="space-y-6 text-left mb-8 mt-4">
                            <div className="flex gap-4 items-start">
                                <div className="bg-green-500/20 p-2 rounded-lg text-green-400 shrink-0">
                                    <Check className="w-5 h-5" />
                                </div>
                                <div>
                                    <h4 className="font-bold text-lg">Instant Quote Engine</h4>
                                    <p className="text-slate-400 text-sm mt-1">Replaces your &quot;Contact Us&quot; page. Customers price themselves.</p>
                                </div>
                            </div>
                            <div className="flex gap-4 items-start">
                                <div className="bg-green-500/20 p-2 rounded-lg text-green-400 shrink-0">
                                    <Check className="w-5 h-5" />
                                </div>
                                <div>
                                    <h4 className="font-bold text-lg">24/7 WhatsApp Auto-Reply</h4>
                                    <p className="text-slate-400 text-sm mt-1">Replies instantly while you work. Never miss a lead again.</p>
                                </div>
                            </div>
                            <div className="flex gap-4 items-start">
                                <div className="bg-green-500/20 p-2 rounded-lg text-green-400 shrink-0">
                                    <Check className="w-5 h-5" />
                                </div>
                                <div>
                                    <h4 className="font-bold text-lg">Van QR Magnet Design</h4>
                                    <p className="text-slate-400 text-sm mt-1">Turns your work truck into a 24/7 lead capture machine.</p>
                                </div>
                            </div>
                        </div>

                        <div className="border-t border-slate-700 pt-8">
                            <div className="flex justify-between items-center mb-6">
                                <span className="text-slate-400 font-medium">Setup Fee</span>
                                <span className="text-4xl font-bold tracking-tight">₱5,000</span>
                            </div>
                            <a
                                href="https://wa.me/13203627874?text=Hi%20Launchfly,%20I%20want%20to%20activate%20the%205k%20promo."
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block w-full py-4 bg-green-500 hover:bg-green-400 text-slate-900 font-black text-xl rounded-xl transition-all shadow-lg hover:shadow-green-500/20 text-center"
                            >
                                Activate System Now
                            </a>
                            <p className="mt-4 text-xs text-slate-500 flex justify-center items-center gap-2">
                                <ShieldCheck className="w-4 h-4" /> 30-Day Money Back Guarantee. If you don&apos;t like it, I refund you.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* 6. FAQ (Trust) */}
            <section className="py-20 bg-slate-50 border-t border-slate-200">
                <div className="max-w-2xl mx-auto px-6">
                    <h2 className="text-2xl font-bold mb-8 text-center text-slate-900">Frequently Asked Questions</h2>

                    <div className="space-y-4">
                        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                            <h3 className="font-bold mb-2 text-slate-900">Do I need a computer?</h3>
                            <p className="text-slate-600 text-sm leading-relaxed">No. Everything runs on your phone. You get leads on WhatsApp.</p>
                        </div>
                        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                            <h3 className="font-bold mb-2 text-slate-900">Are there monthly fees?</h3>
                            <p className="text-slate-600 text-sm leading-relaxed">This ₱5,000 package is a one-time setup fee. You own the system.</p>
                        </div>
                        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                            <h3 className="font-bold mb-2 text-slate-900">Can you change the prices?</h3>
                            <p className="text-slate-600 text-sm leading-relaxed">Yes. If your cleaning price goes up, just text me and I update the calculator in 2 minutes.</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* FOOTER */}
            <footer className="py-8 bg-white border-t border-slate-100 text-center text-sm text-slate-400">
                &copy; 2026 Launchfly Services. Metro Manila, Philippines.
            </footer>
        </div>
    );
}
