'use client';

import { MessageCircle } from 'lucide-react';

export default function ClaimButton({ businessId, businessName }) {
  const handleActivate = () => {
    // Pre-filled WhatsApp message to Alex
    const launchflyNumber = '639627459049';
    const name = businessName || 'my business';
    const message = encodeURIComponent(
      `Hi Alex! I just saw the demo for ${name}. It looks great. I want to activate it for the ₱5,000 promo. How do I pay?`
    );

    // Use native scheme on mobile, web URL on desktop
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (isMobile) {
      window.location.href = `whatsapp://send?phone=${launchflyNumber}&text=${message}`;
    } else {
      window.open(`https://api.whatsapp.com/send?phone=${launchflyNumber}&text=${message}`, '_blank');
    }
  };

  return (
    <button
      onClick={handleActivate}
      className="flex items-center justify-center gap-2 w-full bg-gradient-to-r from-green-500 to-green-600 text-white py-4 px-6 rounded-xl font-bold text-lg hover:from-green-600 hover:to-green-700 transition-all shadow-lg hover:shadow-xl"
    >
      <MessageCircle size={20} />
      Go Live in 5 Minutes →
    </button>
  );
}
