import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Download, Copy, ExternalLink, MessageSquare, Truck, Zap } from 'lucide-react';

export default function LaunchpadAssets({ business, quoteUrl }) {
    const [qrCodeUrl, setQrCodeUrl] = useState('');
    const [copiedScript, setCopiedScript] = useState(false);

    // Script from business data or default template
    const reengagementScript = business?.business_data?.whatsapp?.reengagement ||
        `Hi {{name}}! ❄️ Quick check - is your aircon running as cold as it used to?\n\n` +
        `We have 3 slots left this week for a chemical wash promo (15% off). \n\n` +
        `Reply "BOOK" if you want one! - ${business?.business_name || 'Us'}`;

    // Generate QR Code on mount
    useEffect(() => {
        if (quoteUrl) {
            QRCode.toDataURL(quoteUrl, { width: 400, margin: 2, color: { dark: '#000000', light: '#ffffff' } })
                .then(url => setQrCodeUrl(url))
                .catch(err => console.error('Error generating QR', err));
        }
    }, [quoteUrl]);

    const downloadQr = () => {
        if (!qrCodeUrl) return;
        const link = document.createElement('a');
        link.download = `${business?.business_name?.replace(/\s+/g, '_')}_qr_magnet.png`;
        link.href = qrCodeUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const copyScript = () => {
        navigator.clipboard.writeText(reengagementScript);
        setCopiedScript(true);
        setTimeout(() => setCopiedScript(false), 2000);
    };

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-2xl p-8 text-white shadow-xl relative overflow-hidden">
                <div className="relative z-10">
                    <h2 className="text-3xl font-bold mb-2">🚀 Your Launchfly Launchpad</h2>
                    <p className="text-blue-100 max-w-2xl">
                        Here are the assets we promised. Download them, use them, and fill your schedule.
                    </p>
                </div>
                <div className="absolute right-0 top-0 h-full w-1/3 bg-white/10 skew-x-12 transform translate-x-12"></div>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
                {/* Asset 1: Van QR Magnet */}
                <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center text-orange-600">
                            <Truck size={24} />
                        </div>
                        <div>
                            <h3 className="font-bold text-gray-900">Van QR Magnet</h3>
                            <p className="text-sm text-gray-500">24/7 Lead Capture Machine</p>
                        </div>
                    </div>

                    <div className="flex flex-col items-center justify-center bg-gray-50 rounded-xl p-8 mb-6 border border-dashed border-gray-300">
                        {qrCodeUrl ? (
                            <img src={qrCodeUrl} alt="Quote Funnel QR Code" className="w-48 h-48 rounded-lg shadow-lg" />
                        ) : (
                            <div className="w-48 h-48 bg-gray-200 animate-pulse rounded-lg"></div>
                        )}
                        <p className="text-xs text-gray-400 mt-4 text-center">
                            Points to: <a href={quoteUrl} target="_blank" className="text-blue-600 hover:underline">{quoteUrl}</a>
                        </p>
                    </div>

                    <button
                        onClick={downloadQr}
                        className="w-full flex items-center justify-center gap-2 bg-gray-900 text-white font-semibold py-3 rounded-xl hover:bg-black transition-colors"
                    >
                        <Download size={18} />
                        Download High-Res PNG
                    </button>
                    <p className="text-xs text-center text-gray-500 mt-3">
                        Send this to your sticker printer. Ask for "Outdoor Vinyl Magnet".
                    </p>
                </div>

                {/* Asset 2: Cash Injection Script */}
                <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center text-green-600">
                            <MessageSquare size={24} />
                        </div>
                        <div>
                            <h3 className="font-bold text-gray-900">"Cash Injection" Script</h3>
                            <p className="text-sm text-gray-500">Copy, Paste, Get Bookings.</p>
                        </div>
                    </div>

                    <div className="bg-gray-50 rounded-xl p-6 mb-6 border border-gray-200 relative group">
                        <pre className="whitespace-pre-wrap font-mono text-sm text-gray-700 leading-relaxed">
                            {reengagementScript}
                        </pre>
                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                                onClick={copyScript}
                                className="bg-white p-2 rounded-lg shadow border border-gray-200 hover:bg-gray-50 text-gray-600"
                                title="Copy to clipboard"
                            >
                                {copiedScript ? <CheckCircle size={16} className="text-green-600" /> : <Copy size={16} />}
                            </button>
                        </div>
                    </div>

                    <button
                        onClick={copyScript}
                        className={`w-full flex items-center justify-center gap-2 font-semibold py-3 rounded-xl transition-colors ${copiedScript
                                ? 'bg-green-100 text-green-700'
                                : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                            }`}
                    >
                        {copiedScript ? 'Copied to Clipboard!' : 'Copy Script'}
                    </button>
                    <p className="text-xs text-center text-gray-500 mt-3">
                        Send this via WhatsApp to your last 50 clients.
                    </p>
                </div>
            </div>

            {/* Asset 3: System Status */}
            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center text-purple-600">
                        <Zap size={24} />
                    </div>
                    <div>
                        <h3 className="font-bold text-gray-900">System Status</h3>
                        <p className="text-sm text-gray-500">Your "Digital Receptionist" is Active</p>
                    </div>
                </div>

                <div className="grid sm:grid-cols-3 gap-4">
                    <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl border border-gray-100">
                        <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div>
                        <span className="font-medium text-sm text-gray-700">Instant Quote Engine</span>
                    </div>
                    <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl border border-gray-100">
                        <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div>
                        <span className="font-medium text-sm text-gray-700">Auto-Responder</span>
                    </div>
                    <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl border border-gray-100">
                        <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div>
                        <span className="font-medium text-sm text-gray-700">24/7 Availability</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
