"use client";
import { useState } from 'react';

export default function SetupWizard() {
  const [form, setForm] = useState({
    name: '',
    email: '',
    niche: '',
    skills: '',
    availability: 'part-time',
    subdomain: '',
    budget: 100,
    plan: 'starter'
  });
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  async function onSubmit(e: any) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/wizard/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Submit failed');
      setResult(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">30‑Minute Setup</h1>
      <p className="text-gray-600 mb-6">Tell us a few things and we’ll do the rest. You can be hands‑off after this.</p>

      {result ? (
        <div className="space-y-3">
          <p className="text-green-700">Success! Session created.</p>
          <p>Session: <code>{result.sessionId}</code></p>
          <p>Business: <code>{result.businessId}</code></p>
          <a className="text-blue-600 underline" href={`/dashboard/${result.sessionId}`}>Go to dashboard →</a>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Name">
              <input className="w-full border rounded p-2" value={form.name} onChange={e => update('name', e.target.value)} />
            </Field>
            <Field label="Email">
              <input required type="email" className="w-full border rounded p-2" value={form.email} onChange={e => update('email', e.target.value)} />
            </Field>
          </div>

          <Field label="Niche">
            <input className="w-full border rounded p-2" placeholder="e.g., dental, real estate, creators" value={form.niche} onChange={e => update('niche', e.target.value)} />
          </Field>

          <Field label="Top skills">
            <input className="w-full border rounded p-2" placeholder="copywriting, video, seo" value={form.skills} onChange={e => update('skills', e.target.value)} />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="Availability">
              <select className="w-full border rounded p-2" value={form.availability} onChange={e => update('availability', e.target.value as any)}>
                <option value="part-time">Part-time</option>
                <option value="full-time">Full-time</option>
                <option value="weekends">Weekends</option>
              </select>
            </Field>
            <Field label="Desired subdomain">
              <input className="w-full border rounded p-2" placeholder="yourname" value={form.subdomain} onChange={e => update('subdomain', e.target.value)} />
            </Field>
            <Field label="Daily ad budget ($)">
              <input type="number" min={0} className="w-full border rounded p-2" value={form.budget} onChange={e => update('budget', Number(e.target.value))} />
            </Field>
          </div>

          <Field label="Plan">
            <select className="w-full border rounded p-2" value={form.plan} onChange={e => update('plan', e.target.value as any)}>
              <option value="starter">Starter (0 + 20%)</option>
              <option value="pro">Pro ($97 + 10%)</option>
              <option value="scale">Scale ($297 + 5%)</option>
            </select>
          </Field>

          {error && <p className="text-red-600">{error}</p>}

          <button disabled={submitting} className="bg-black text-white px-4 py-2 rounded">
            {submitting ? 'Submitting…' : 'Start my setup'}
          </button>
        </form>
      )}
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm text-gray-600 mb-1">{label}</span>
      {children}
    </label>
  );
}


