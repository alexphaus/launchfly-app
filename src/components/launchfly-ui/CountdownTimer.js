// src/components/launchfly-ui/CountdownTimer.js
'use client';

import { useState, useEffect } from 'react';

export default function CountdownTimer({
  targetDate = null,
  hours = 24,
  title = "⏰ Limited Time Offer",
  subtitle = "Book now and save!",
  variant = 'default', // 'default' | 'urgent' | 'banner'
  showAfterExpiry = false,
  expiryMessage = "Offer has ended"
}) {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    // Calculate target time
    let target;
    if (targetDate) {
      target = new Date(targetDate).getTime();
    } else {
      // Default: hours from now (stored in sessionStorage to persist)
      const storageKey = 'countdown_target_' + hours;
      const stored = sessionStorage.getItem(storageKey);
      if (stored) {
        target = parseInt(stored);
      } else {
        target = Date.now() + (hours * 60 * 60 * 1000);
        sessionStorage.setItem(storageKey, target.toString());
      }
    }

    const updateTimer = () => {
      const now = Date.now();
      const diff = target - now;

      if (diff <= 0) {
        setIsExpired(true);
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeLeft({ days, hours, minutes, seconds });
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [targetDate, hours]);

  if (isExpired && !showAfterExpiry) return null;

  // Urgent variant - red, pulsing
  if (variant === 'urgent') {
    return (
      <div className="bg-red-600 text-white py-4 px-6 rounded-2xl shadow-lg animate-pulse">
        <div className="text-center">
          <div className="text-xl font-bold mb-1">{title}</div>
          {!isExpired ? (
            <>
              <div className="flex justify-center gap-4 mb-2">
                {timeLeft.days > 0 && (
                  <div className="text-center">
                    <div className="text-4xl font-black">{timeLeft.days}</div>
                    <div className="text-xs text-red-200 uppercase">Days</div>
                  </div>
                )}
                <div className="text-center">
                  <div className="text-4xl font-black">{String(timeLeft.hours).padStart(2, '0')}</div>
                  <div className="text-xs text-red-200 uppercase">Hours</div>
                </div>
                <div className="text-4xl font-black">:</div>
                <div className="text-center">
                  <div className="text-4xl font-black">{String(timeLeft.minutes).padStart(2, '0')}</div>
                  <div className="text-xs text-red-200 uppercase">Min</div>
                </div>
                <div className="text-4xl font-black">:</div>
                <div className="text-center">
                  <div className="text-4xl font-black">{String(timeLeft.seconds).padStart(2, '0')}</div>
                  <div className="text-xs text-red-200 uppercase">Sec</div>
                </div>
              </div>
              <div className="text-red-100">{subtitle}</div>
            </>
          ) : (
            <div className="text-red-100">{expiryMessage}</div>
          )}
        </div>
      </div>
    );
  }

  // Banner variant - full width, sticky potential
  if (variant === 'banner') {
    return (
      <div className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white py-3 px-4">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-6">
          <span className="font-bold text-lg">{title}</span>
          {!isExpired ? (
            <div className="flex items-center gap-2 text-lg font-mono font-bold">
              {timeLeft.days > 0 && <span>{timeLeft.days}d</span>}
              <span>{String(timeLeft.hours).padStart(2, '0')}h</span>
              <span>:</span>
              <span>{String(timeLeft.minutes).padStart(2, '0')}m</span>
              <span>:</span>
              <span>{String(timeLeft.seconds).padStart(2, '0')}s</span>
            </div>
          ) : (
            <span className="text-yellow-100">{expiryMessage}</span>
          )}
        </div>
      </div>
    );
  }

  // Default variant
  return (
    <div className="bg-white border-2 border-gray-100 rounded-2xl p-6 shadow-lg">
      <div className="text-center">
        <div className="text-xl font-bold text-gray-900 mb-2">{title}</div>
        {!isExpired ? (
          <>
            <div className="flex justify-center gap-4 mb-3">
              {timeLeft.days > 0 && (
                <div className="bg-gray-100 rounded-lg px-4 py-3">
                  <div className="text-3xl font-black text-gray-900">{timeLeft.days}</div>
                  <div className="text-xs text-gray-500 uppercase">Days</div>
                </div>
              )}
              <div className="bg-gray-100 rounded-lg px-4 py-3">
                <div className="text-3xl font-black text-gray-900">{String(timeLeft.hours).padStart(2, '0')}</div>
                <div className="text-xs text-gray-500 uppercase">Hours</div>
              </div>
              <div className="bg-gray-100 rounded-lg px-4 py-3">
                <div className="text-3xl font-black text-gray-900">{String(timeLeft.minutes).padStart(2, '0')}</div>
                <div className="text-xs text-gray-500 uppercase">Minutes</div>
              </div>
              <div className="bg-gray-100 rounded-lg px-4 py-3">
                <div className="text-3xl font-black text-gray-900">{String(timeLeft.seconds).padStart(2, '0')}</div>
                <div className="text-xs text-gray-500 uppercase">Seconds</div>
              </div>
            </div>
            <div className="text-gray-600">{subtitle}</div>
          </>
        ) : (
          <div className="text-gray-500 py-4">{expiryMessage}</div>
        )}
      </div>
    </div>
  );
}
