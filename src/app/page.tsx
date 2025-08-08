// src/app/page.tsx
"use client";
import { useEffect, useState } from 'react';

type Metrics = {
  ok: boolean;
  spotsLeft: number;
  liveUsers: number;
  totals: { users: number; businesses: number };
  performance: { pctHit1kAllTime: number; pctHit1kLast60d: number };
  ts: string;
};

export default function Home() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    fetch('/api/metrics', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => { if (mounted) setMetrics(d); })
      .catch(e => { if (mounted) setError(e.message); });
    return () => { mounted = false; };
  }, []);

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8">
      <h1 className="text-3xl font-bold mb-6">Launchfly</h1>
      {error && <p className="text-red-600">{error}</p>}
      {!metrics && !error && <p>Loading metrics…</p>}
      {metrics && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-3xl">
          <Stat label="Spots left" value={metrics.spotsLeft} />
          <Stat label="Live users (10 min)" value={metrics.liveUsers} />
          <Stat label="Total users" value={metrics.totals.users} />
          <Stat label="Total businesses" value={metrics.totals.businesses} />
          <Stat label="% hit $1k (all-time)" value={`${metrics.performance.pctHit1kAllTime}%`} />
          <Stat label="% hit $1k (last 60d)" value={`${metrics.performance.pctHit1kLast60d}%`} />
        </div>
      )}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="border rounded-lg p-4">
      <div className="text-sm text-gray-500">{label}</div>
      <div className="text-2xl font-semibold">{value}</div>
    </div>
  );
}
