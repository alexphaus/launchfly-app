// src/components/launchfly-ui/BookingToast.js
'use client';
import { useState, useEffect } from 'react';

// Realistic Malaysian/Filipino names for social proof
const NAMES = ['Ahmad', 'Sarah', 'Kumar', 'Maria', 'Lim', 'Chen', 'Ali', 'Diana', 'Raj', 'Amir', 'Siti', 'John', 'Miguel', 'Rosa'];
const AREAS = ['Shah Alam', 'Petaling Jaya', 'Kuala Lumpur', 'Subang Jaya', 'Johor Bahru', 'Penang', 'Selangor', 'Makati', 'Quezon City', 'Cebu'];
const SERVICES = ['General Service', 'Chemical Wash', 'Installation', 'Repair', 'Maintenance'];

function getRandomItem(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function getRandomMinutes() {
    // Between 1 and 15 minutes ago
    return Math.floor(Math.random() * 14) + 1;
}

export default function BookingToast({
    enabled = true,
    interval = 30000, // Show every 30 seconds
    duration = 5000,   // Hide after 5 seconds
    businessName = "this service"
}) {
    const [visible, setVisible] = useState(false);
    const [booking, setBooking] = useState(null);

    useEffect(() => {
        if (!enabled) return;

        const showToast = () => {
            // Generate fake booking
            const newBooking = {
                name: getRandomItem(NAMES),
                area: getRandomItem(AREAS),
                service: getRandomItem(SERVICES),
                minutes: getRandomMinutes()
            };
            setBooking(newBooking);
            setVisible(true);

            // Hide after duration
            setTimeout(() => setVisible(false), duration);
        };

        // Show first toast after 5 seconds
        const firstTimeout = setTimeout(showToast, 5000);

        // Then show every interval
        const intervalId = setInterval(showToast, interval);

        return () => {
            clearTimeout(firstTimeout);
            clearInterval(intervalId);
        };
    }, [enabled, interval, duration]);

    if (!visible || !booking) return null;

    return (
        <div className="fixed bottom-4 left-4 z-50 animate-slideIn">
            <div className="bg-white rounded-lg shadow-2xl border border-slate-200 p-4 max-w-sm flex items-center gap-3">
                {/* Avatar */}
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-600 font-bold text-sm flex-shrink-0">
                    {booking.name.charAt(0)}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-900 font-medium truncate">
                        {booking.name} from {booking.area}
                    </p>
                    <p className="text-xs text-slate-500">
                        Booked {booking.service} • {booking.minutes}m ago
                    </p>
                </div>

                {/* Checkmark */}
                <div className="text-green-500 flex-shrink-0">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                </div>
            </div>

            {/* CSS Animation */}
            <style jsx>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateX(-100%);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        .animate-slideIn {
          animation: slideIn 0.4s ease-out;
        }
      `}</style>
        </div>
    );
}
