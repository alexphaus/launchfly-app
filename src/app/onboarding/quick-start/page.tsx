'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { trackOnboardingStart, trackStepCompleted, trackValidationError, trackOnboardingCompleted } from '../../../lib/onboarding-analytics';
import { INDUSTRY_TEMPLATES } from '../../../lib/industry-templates';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Map library templates to UI display options
const NICHES = Object.values(INDUSTRY_TEMPLATES).map(t => ({
  id: t.id,
  name: t.name,
  icon: t.emoji,
  description: t.leadMagnet.headline,
  exampleTitle: t.leadMagnet.title
}));

export default function QuickStartOnboarding() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [paymentSessionId, setPaymentSessionId] = useState<string | null>(null);
  const [subdomainStatus, setSubdomainStatus] = useState<{
    checking: boolean;
    available: boolean | null;
    suggestion: string | null;
  }>({ checking: false, available: null, suggestion: null });
  const [isGeneratingAssets, setIsGeneratingAssets] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);

  // Data State
  const [formData, setFormData] = useState({
    niche: '', // aircon, plumbing, etc.
    email: '',
    password: '',
    name: '', // Full Name
    businessName: '',
    whatsappNumber: '',
    socialProofUrl: '', // Facebook Page or Google Maps
    subdomain: '',
    plan: searchParams.get('plan') || 'starter',
  });

  // Derived state
  const selectedNiche = INDUSTRY_TEMPLATES[formData.niche] || null;

  // Track Start
  useEffect(() => {
    trackOnboardingStart('quick-start-v2', formData.niche, formData.plan);

    // Check payment return
    const sessionId = searchParams.get('session_id');
    if (sessionId && searchParams.get('payment') === 'success') {
      setPaymentSessionId(sessionId);
      const subdomain = searchParams.get('subdomain');
      if (subdomain) setFormData(prev => ({ ...prev, subdomain: decodeURIComponent(subdomain) }));
      setCurrentStep(3);
    }
  }, [searchParams]);

  // Auto-generate subdomain from Business Name
  useEffect(() => {
    if (formData.businessName && !formData.subdomain) {
      setFormData(prev => ({
        ...prev,
        subdomain: generateSubdomain(formData.businessName)
      }));
    }
  }, [formData.businessName]);

  const generateSubdomain = (text: string) => {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 25);
  };

  const checkSubdomainAvailability = async (subdomain: string) => {
    if (!subdomain || subdomain.length < 3) return;
    setSubdomainStatus({ checking: true, available: null, suggestion: null });

    try {
      const response = await fetch(`/api/check-subdomain?subdomain=${encodeURIComponent(subdomain)}`);
      const result = await response.json();
      setSubdomainStatus({
        checking: false,
        available: result.available,
        suggestion: result.suggestion
      });
      if (!result.available) {
        setErrors(prev => ({ ...prev, subdomain: 'Unavailable' }));
      } else {
        setErrors(prev => { const n = { ...prev }; delete n.subdomain; return n; });
      }
    } catch (e) {
      console.error(e);
      setSubdomainStatus({ checking: false, available: null, suggestion: null });
    }
  };

  // Debounce check
  useEffect(() => {
    const t = setTimeout(() => {
      if (formData.subdomain) checkSubdomainAvailability(formData.subdomain);
    }, 500);
    return () => clearTimeout(t);
  }, [formData.subdomain]);

  const pollForCompletion = async (sessionId: string) => {
    const pollInterval = setInterval(async () => {
      const { data: session } = await supabase
        .from('sessions')
        .select('stage, progress')
        .eq('id', sessionId)
        .single();

      if (session) {
        setGenerationProgress(session.progress || 0);
        if (session.stage === 'complete' || session.progress === 100) {
          clearInterval(pollInterval);
          setTimeout(() => router.push(`/dashboard/${sessionId}`), 1000);
        }
      }
    }, 2000);
  };

  const validateStep = (step: number) => {
    const newErrors: Record<string, string> = {};

    if (step === 1) {
      if (!formData.niche) newErrors.niche = 'Please select a service type';
    }

    if (step === 2) {
      if (!formData.businessName) newErrors.businessName = 'Business Name is required';
      if (!formData.whatsappNumber) newErrors.whatsappNumber = 'WhatsApp Number is required';
      if (!formData.email) newErrors.email = 'Email is required';
      if (!formData.password) newErrors.password = 'Password is required';
    }

    if (step === 3) {
      if (!formData.subdomain) newErrors.subdomain = 'Subdomain is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) setCurrentStep(prev => prev + 1);
  };

  const handleBack = () => {
    setCurrentStep(prev => prev - 1);
  };

  const handleSubmit = async () => {
    if (!validateStep(currentStep)) return;
    setIsLoading(true);

    try {
      const response = await fetch('/api/wizard/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // Identity
          name: formData.businessName, // Using business name as user name for simplicity or split? Let's use business name
          email: formData.email,
          password: formData.password,

          // Business Data
          niche: formData.niche,
          whatsappNumber: formData.whatsappNumber, // IMPORTANT: New Field
          socialProofUrl: formData.socialProofUrl, // IMPORTANT: New Field
          subdomain: formData.subdomain,

          // Context
          plan: formData.plan,
          paymentSessionId
        })
      });

      if (!response.ok) throw new Error('Failed to create account');
      const result = await response.json();

      // Auto-login
      await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      });

      trackOnboardingCompleted({
        niche: formData.niche,
        subdomain: formData.subdomain,
        sessionId: result.sessionId
      });

      setIsGeneratingAssets(true);
      // Immediate 100% via polling because template is instant
      pollForCompletion(result.sessionId);

    } catch (error: any) {
      console.error(error);
      setErrors({ submit: error.message });
      setIsLoading(false);
    }
  };

  // --- RENDERS ---

  const renderStep1 = () => (
    <div className="max-w-4xl mx-auto px-4">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold text-slate-900 mb-3">What service do you provide?</h1>
        <p className="text-slate-600">We'll build your entire sales funnel based on this.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {NICHES.map(niche => (
          <button
            key={niche.id}
            onClick={() => setFormData(prev => ({ ...prev, niche: niche.id }))}
            className={`p-6 rounded-xl border-2 text-left transition-all hover:shadow-md ${formData.niche === niche.id
                ? 'border-blue-600 bg-blue-50 ring-2 ring-blue-200'
                : 'border-slate-200 hover:border-slate-300 bg-white'
              }`}
          >
            <div className="text-4xl mb-4">{niche.icon}</div>
            <h3 className="font-bold text-lg text-slate-900 mb-1">{niche.name}</h3>
            <p className="text-sm text-slate-500 mb-3">{niche.description}</p>
            <div className="text-xs font-medium text-blue-600 bg-blue-100 py-1 px-2 rounded inline-block">
              🎁 Free Gift: {niche.exampleTitle}
            </div>
          </button>
        ))}
      </div>

      {/* Continue Button fixed at bottom mobile or inline desktop */}
      <div className="mt-8 flex justify-center">
        <button
          onClick={handleNext}
          disabled={!formData.niche}
          className="px-8 py-3 bg-blue-600 text-white rounded-lg font-bold text-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl w-full md:w-auto"
        >
          Next Step →
        </button>
      </div>

      {errors.niche && <p className="text-red-500 text-center mt-2">{errors.niche}</p>}
    </div>
  );

  const renderStep2 = () => (
    <div className="max-w-md mx-auto px-4">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Create Your Account</h1>
        <p className="text-slate-600">We'll send your new leads here.</p>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Business Name</label>
            <input
              type="text"
              value={formData.businessName}
              onChange={e => setFormData(p => ({ ...p, businessName: e.target.value }))}
              className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="e.g. Joe's Aircon Services"
            />
            {errors.businessName && <span className="text-red-500 text-xs">{errors.businessName}</span>}
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">WhatsApp Number</label>
            <input
              type="tel"
              value={formData.whatsappNumber}
              onChange={e => setFormData(p => ({ ...p, whatsappNumber: e.target.value }))}
              className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="+60 12 345 6789"
            />
            <p className="text-xs text-slate-500 mt-1">We'll send lead alerts here instantly. No app required.</p>
            {errors.whatsappNumber && <span className="text-red-500 text-xs">{errors.whatsappNumber}</span>}
          </div>

          <div className="pt-4 border-t border-slate-100">
            <label className="block text-sm font-semibold text-slate-700 mb-1">Email (Login ID)</label>
            <input
              type="email"
              value={formData.email}
              onChange={e => setFormData(p => ({ ...p, email: e.target.value }))}
              className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="joe@gmail.com"
            />
            {errors.email && <span className="text-red-500 text-xs">{errors.email}</span>}
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Password</label>
            <input
              type="password"
              value={formData.password}
              onChange={e => setFormData(p => ({ ...p, password: e.target.value }))}
              className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="******"
            />
            {errors.password && <span className="text-red-500 text-xs">{errors.password}</span>}
          </div>
        </div>

        <div className="mt-8 flex gap-3">
          <button onClick={handleBack} className="flex-1 py-3 text-slate-600 font-medium hover:bg-slate-50 rounded-lg">Back</button>
          <button onClick={handleNext} className="flex-[2] py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 shadow-lg">Next →</button>
        </div>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="max-w-md mx-auto px-4">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Final Touch: Add Trust</h1>
        <p className="text-slate-600">Increase sales by showing you are verified.</p>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">

        {/* Social Proof Input */}
        <div className="mb-6">
          <label className="block text-sm font-semibold text-slate-700 mb-1">Facebook Page or Google Maps Link <span className="text-slate-400 font-normal">(Optional)</span></label>
          <input
            type="url"
            value={formData.socialProofUrl}
            onChange={e => setFormData(p => ({ ...p, socialProofUrl: e.target.value }))}
            className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder="https://facebook.com/joesaircon"
          />
          <p className="text-xs text-slate-500 mt-1">We'll automatically display your 5-star rating on your page.</p>
        </div>

        {/* Subdomain Input */}
        <div className="mb-6">
          <label className="block text-sm font-semibold text-slate-700 mb-1">Your Website Link</label>
          <div className="flex">
            <input
              type="text"
              value={formData.subdomain}
              onChange={e => setFormData(p => ({ ...p, subdomain: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))}
              className={`flex-1 p-3 border rounded-l-lg outline-none ${subdomainStatus.available === false ? 'border-red-500 bg-red-50' :
                  subdomainStatus.available === true ? 'border-green-500 bg-green-50' : 'border-slate-300'
                }`}
            />
            <div className="bg-slate-100 border border-l-0 border-slate-300 p-3 rounded-r-lg text-slate-500 font-medium">
              .launchfly.com
            </div>
          </div>
          {subdomainStatus.available === true && <p className="text-green-600 text-xs mt-1">✓ Available</p>}
          {subdomainStatus.available === false && <p className="text-red-600 text-xs mt-1">✗ Taken</p>}
        </div>

        {errors.submit && <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg mb-4">{errors.submit}</div>}

        <button
          onClick={handleSubmit}
          disabled={isLoading}
          className="w-full py-4 bg-green-600 text-white font-bold text-lg rounded-xl hover:bg-green-700 shadow-xl transition-all transform hover:scale-[1.02]"
        >
          {isLoading ? 'Launching...' : '🚀 Launch My Page Now'}
        </button>
        <button onClick={handleBack} className="w-full mt-4 text-slate-500 text-sm">Back</button>
      </div>
    </div>
  );

  const renderGenerating = () => (
    <div className="max-w-md mx-auto px-4 text-center pt-20">
      <div className="mb-8 relative w-24 h-24 mx-auto">
        <svg className="animate-spin w-full h-full text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      </div>
      <h2 className="text-2xl font-bold text-slate-900 mb-2">Building your funnel...</h2>
      <p className="text-slate-600 mb-6">Writing content, designing layout, and connecting WhatsApp.</p>

      <div className="w-full bg-slate-200 rounded-full h-3 mb-2 overflow-hidden">
        <div
          className="bg-blue-600 h-3 rounded-full transition-all duration-500"
          style={{ width: `${Math.max(10, generationProgress)}%` }}
        ></div>
      </div>
      <p className="text-sm text-slate-500">{generationProgress}% Complete</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 py-8 lg:py-12">
      {/* Header */}
      <div className="fixed top-0 left-0 w-full bg-white/80 backdrop-blur-md border-b border-slate-200 z-50 px-4 py-3">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="text-2xl">⚡</span>
            <span className="font-bold text-slate-900">Launchfly</span>
          </div>
          {!isGeneratingAssets && (
            <div className="flex gap-2 text-sm font-medium text-slate-400">
              <span className={currentStep >= 1 ? "text-blue-600" : ""}>1. Niche</span>
              <span>→</span>
              <span className={currentStep >= 2 ? "text-blue-600" : ""}>2. Account</span>
              <span>→</span>
              <span className={currentStep >= 3 ? "text-blue-600" : ""}>3. Launch</span>
            </div>
          )}
        </div>
      </div>

      <div className="mt-16">
        {isGeneratingAssets ? renderGenerating() : (
          <>
            {currentStep === 1 && renderStep1()}
            {currentStep === 2 && renderStep2()}
            {currentStep === 3 && renderStep3()}
          </>
        )}
      </div>
    </div>
  );
}
