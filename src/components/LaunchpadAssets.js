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

    const generateVanSticker = async () => {
        if (!quoteUrl) return;

        const canvas = document.createElement('canvas');
        const size = 2000; // High res for printing
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');

        // Colors
        const brandBlue = '#0F172A'; // Dark slate/blue for professional look
        const whatsappGreen = '#25D366';

        // 1. Background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, size, size);

        // 2. Thick Border (Inset)
        const borderWidth = 40;
        const margin = 60;
        ctx.strokeStyle = brandBlue;
        ctx.lineWidth = borderWidth;
        ctx.lineJoin = 'round';
        ctx.strokeRect(margin, margin, size - (margin * 2), size - (margin * 2));

        // 3. Headline: BOOK [SERVICE] SERVICE
        const serviceName = (business?.business_data?.niche || 'SERVICE').toUpperCase();
        ctx.fillStyle = brandBlue;
        ctx.font = 'bold 160px "Inter", sans-serif'; // High res font
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';

        // Handle long text wrapping if needed, but for now simple center
        const headlineY = margin + 120;
        ctx.fillText(`BOOK ${serviceName}`, size / 2, headlineY);
        ctx.fillText('SERVICE', size / 2, headlineY + 180);

        // 4. Footer: Scan for Instant Price
        ctx.font = 'bold 90px "Inter", sans-serif';
        ctx.fillText('Scan for Instant Price', size / 2, size - margin - 180);

        // 5. QR Code (High Error Correction for logo overlay)
        const qrSize = 900;
        const qrX = (size - qrSize) / 2;
        const qrY = (size - qrSize) / 2 + 50; // Centered vertically adjusted for text

        try {
            const qrDataUrl = await QRCode.toDataURL(quoteUrl, {
                width: qrSize,
                margin: 1,
                errorCorrectionLevel: 'H', // High error correction for logo
                color: { dark: '#000000', light: '#ffffff' }
            });

            const qrImg = new Image();
            qrImg.src = qrDataUrl;
            await new Promise((resolve) => { qrImg.onload = resolve; });
            ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);

            // 6. WhatsApp Icon Overlay
            const iconSize = qrSize * 0.22; // 22% of QR size
            const iconX = size / 2;
            const iconY = qrY + (qrSize / 2);

            // Green Circle Background
            ctx.beginPath();
            ctx.arc(iconX, iconY, iconSize / 2, 0, Math.PI * 2);
            ctx.fillStyle = '#ffffff'; // White border for contrast
            ctx.fill();

            ctx.beginPath();
            ctx.arc(iconX, iconY, (iconSize / 2) - 10, 0, Math.PI * 2);
            ctx.fillStyle = whatsappGreen;
            ctx.fill();

            // Phone Icon (Simplified path)
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            // Simple phone handset shape
            // Scale and position relative to center
            const s = iconSize * 0.5; // symbol size
            const x = iconX - s / 2;
            const y = iconY - s / 2;
            // Draw a simplified phone handset path or 'W' text if path is too complex for canvas primitives manually
            // Using a "W" for now to ensure reliability, or simpler graphical representation
            ctx.font = `bold ${s}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            // Use unicode phone or WhatsApp 'W'
            // ctx.fillText('📞', iconX, iconY + (s * 0.1)); 

            // Actually, let's draw a nice rounded bubble path (WhatsApp logo shape)
            // Or just a white "WA" text
            // Loading an actual SVG image is safer for quality but requires asset.

            // Drawing simple phone path
            ctx.save();
            ctx.translate(iconX, iconY);
            ctx.scale(s / 24, s / 24); // Scale standard 24px icon path
            ctx.translate(-12, -12); // Center path
            const phonePath = new Path2D("M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z");
            ctx.fill(phonePath);
            ctx.restore();


            // Download
            const link = document.createElement('a');
            const safeName = (business?.name || business?.business_name || 'My_Business').replace(/\s+/g, '_');
            link.download = `${safeName}_Van_Sticker.png`;
            link.href = canvas.toDataURL('image/png');
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

        } catch (err) {
            console.error('Error creating van sticker:', err);
            alert('Failed to generate sticker');
        }
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
                        onClick={generateVanSticker}
                        className="w-full flex items-center justify-center gap-2 bg-gray-900 text-white font-semibold py-3 rounded-xl hover:bg-black transition-colors"
                    >
                        <Download size={18} />
                        Download High-Res / Sticker
                    </button>
                    <p className="text-xs text-center text-gray-500 mt-3">
                        Generates a 2000px print-ready file for your van.
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
