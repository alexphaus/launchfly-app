'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface NicheTemplate {
  id: string;
  name: string;
  icon: string;
  description: string;
  leadMagnetType: string;
  targetAudience: string;
  exampleTitle: string;
}

const NICHE_TEMPLATES: NicheTemplate[] = [
  {
    id: 'plumbing',
    name: 'Plumbing',
    icon: '🔧',
    description: 'For plumbers needing more emergency calls and big jobs.',
    leadMagnetType: 'Price Guide / Checklist',
    targetAudience: 'Homeowners',
    exampleTitle: '"2025 Plumbing Price Guide"'
  },
  {
    id: 'hvac',
    name: 'HVAC & AC',
    icon: '❄️',
    description: 'For HVAC pros wanting seasonal maintenance contracts.',
    leadMagnetType: 'Efficiency Checklist',
    targetAudience: 'Homeowners',
    exampleTitle: '"AC Efficiency Self-Audit Checklist"'
  },
  {
    id: 'roofing',
    name: 'Roofing',
    icon: '🏠',
    description: 'For roofers looking for storm damage claims.',
    leadMagnetType: 'Inspection Guide',
    targetAudience: 'Homeowners',
    exampleTitle: '"Storm Damage Self-Inspection Guide"'
  },
  {
    id: 'landscaping',
    name: 'Landscaping',
    icon: '🌳',
    description: 'For landscapers wanting recurring maintenance clients.',
    leadMagnetType: 'Seasonal Calendar',
    targetAudience: 'Homeowners',
    exampleTitle: '"Native Plant & Watering Calendar"'
  },
  {
    id: 'real-estate',
    name: 'Real Estate',
    icon: '🏡',
    description: 'For agents needing seller leads in specific neighborhoods.',
    leadMagnetType: 'Market Report',
    targetAudience: 'Home Sellers',
    exampleTitle: '"Neighborhood Price Report 2025"'
  },
  {
    id: 'gym-fitness',
    name: 'Local Gym / Trainer',
    icon: '💪',
    description: 'For local gyms wanting new members walking in.',
    leadMagnetType: 'Meal Plan / Pass',
    targetAudience: 'Locals wanting to get fit',
    exampleTitle: '"7-Day Meal Prep Plan & Day Pass"'
  }
];

export default function TemplatesPage() {
  const router = useRouter();
  const [selectedNiche, setSelectedNiche] = useState<string | null>(null);

  const handleSelectNiche = (nicheId: string) => {
    // Redirect to the quick-start onboarding with the selected niche
    router.push(`/onboarding/quick-start?niche=${nicheId}`);
  };

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <Link href="/" className="inline-flex items-center text-blue-600 hover:text-blue-800 mb-8 font-medium transition-colors">
            ← Back to Home
          </Link>
          <h1 className="text-4xl font-bold text-slate-900 mb-4">
            Choose Your Business Type
          </h1>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto">
            Select your industry, and we'll generate a high-converting lead magnet funnel to get you more booked appointments.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
          {NICHE_TEMPLATES.map((template) => (
            <div 
              key={template.id}
              onClick={() => handleSelectNiche(template.id)}
              className="bg-white rounded-2xl p-8 shadow-sm hover:shadow-xl border-2 border-transparent hover:border-blue-500 transition-all cursor-pointer group"
            >
              <div className="text-4xl mb-6 group-hover:scale-110 transition-transform duration-300">
                {template.icon}
              </div>
              
              <h3 className="text-xl font-bold text-slate-900 mb-2">
                {template.name}
              </h3>
              
              <p className="text-slate-600 mb-6 text-sm leading-relaxed">
                {template.description}
              </p>

              <div className="bg-blue-50 rounded-xl p-4 mb-6">
                <div className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-1">
                  Includes
                </div>
                <div className="text-sm font-medium text-slate-800">
                  {template.leadMagnetType}
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  e.g. {template.exampleTitle}
                </div>
              </div>

              <button className="w-full py-3 px-4 bg-white border-2 border-blue-600 text-blue-600 rounded-xl font-semibold group-hover:bg-blue-600 group-hover:text-white transition-all">
                Select Niche →
              </button>
            </div>
          ))}
        </div>

        <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-2xl p-8 text-center text-white shadow-lg">
          <h3 className="text-2xl font-bold mb-4">Don't see your niche?</h3>
          <p className="text-slate-300 mb-8 max-w-2xl mx-auto">
            No problem! You can define a custom niche and our AI will adapt the entire funnel to your specific expertise.
          </p>
          <button 
            onClick={() => router.push('/onboarding/quick-start?niche=custom')}
            className="inline-block bg-white text-slate-900 py-3 px-8 rounded-xl font-bold hover:bg-blue-50 transition-colors"
          >
            Create Custom Niche
          </button>
        </div>
      </div>
    </div>
  );
}
