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
  category: 'local' | 'coaching' | 'consulting';
}

const CATEGORIES = [
  { id: 'all', name: 'All Templates', icon: '✨' },
  { id: 'local', name: 'Local Services', icon: '🏠' },
  { id: 'coaching', name: 'Coaching', icon: '🧭' },
  { id: 'consulting', name: 'Consulting', icon: '💼' },
];

const NICHE_TEMPLATES: NicheTemplate[] = [
  // Service Businesses
  {
    id: 'plumbing',
    name: 'Plumbing',
    icon: '🔧',
    description: 'For plumbers needing more emergency calls and big jobs.',
    leadMagnetType: 'Price Guide / Checklist',
    targetAudience: 'Homeowners',
    exampleTitle: '"2025 Plumbing Price Guide"',
    category: 'local'
  },
  {
    id: 'hvac',
    name: 'HVAC & AC',
    icon: '❄️',
    description: 'For HVAC pros wanting seasonal maintenance contracts.',
    leadMagnetType: 'Efficiency Checklist',
    targetAudience: 'Homeowners',
    exampleTitle: '"AC Efficiency Self-Audit Checklist"',
    category: 'local'
  },
  {
    id: 'roofing',
    name: 'Roofing',
    icon: '🏠',
    description: 'For roofers looking for storm damage claims.',
    leadMagnetType: 'Inspection Guide',
    targetAudience: 'Homeowners',
    exampleTitle: '"Storm Damage Self-Inspection Guide"',
    category: 'local'
  },
  {
    id: 'landscaping',
    name: 'Landscaping',
    icon: '🌳',
    description: 'For landscapers wanting recurring maintenance clients.',
    leadMagnetType: 'Seasonal Calendar',
    targetAudience: 'Homeowners',
    exampleTitle: '"Native Plant & Watering Calendar"',
    category: 'local'
  },
  {
    id: 'real-estate',
    name: 'Real Estate',
    icon: '🏡',
    description: 'For agents needing seller leads in specific neighborhoods.',
    leadMagnetType: 'Market Report',
    targetAudience: 'Home Sellers',
    exampleTitle: '"Neighborhood Price Report 2025"',
    category: 'local'
  },
  {
    id: 'gym-fitness',
    name: 'Local Gym / Trainer',
    icon: '💪',
    description: 'For local gyms wanting new members walking in.',
    leadMagnetType: 'Meal Plan / Pass',
    targetAudience: 'Locals wanting to get fit',
    exampleTitle: '"7-Day Meal Prep Plan & Day Pass"',
    category: 'local'
  },
  // Coaching
  {
    id: 'business-coach',
    name: 'Business Coach',
    icon: '📈',
    description: 'For coaches helping entrepreneurs scale their business.',
    leadMagnetType: 'Strategy Framework',
    targetAudience: 'Business Owners',
    exampleTitle: '"5-Step Business Growth Blueprint"',
    category: 'coaching'
  },
  {
    id: 'life-coach',
    name: 'Life Coach',
    icon: '🧭',
    description: 'For coaches helping clients find clarity and purpose.',
    leadMagnetType: 'Self-Assessment',
    targetAudience: 'Individuals seeking change',
    exampleTitle: '"Life Clarity Self-Assessment"',
    category: 'coaching'
  },
  {
    id: 'career-coach',
    name: 'Career Coach',
    icon: '💼',
    description: 'For coaches helping professionals land dream jobs.',
    leadMagnetType: 'Resume/Interview Guide',
    targetAudience: 'Job Seekers',
    exampleTitle: '"Interview Prep Cheat Sheet"',
    category: 'coaching'
  },
  {
    id: 'health-coach',
    name: 'Health & Wellness Coach',
    icon: '🧘',
    description: 'For coaches helping clients transform their health.',
    leadMagnetType: 'Wellness Plan',
    targetAudience: 'Health-conscious individuals',
    exampleTitle: '"30-Day Wellness Kickstart Guide"',
    category: 'coaching'
  },
  // Consulting
  {
    id: 'marketing-consultant',
    name: 'Marketing Consultant',
    icon: '🎯',
    description: 'For consultants helping businesses get more customers.',
    leadMagnetType: 'Marketing Audit',
    targetAudience: 'Small Business Owners',
    exampleTitle: '"Marketing Gaps Checklist"',
    category: 'consulting'
  },
  {
    id: 'financial-advisor',
    name: 'Financial Advisor',
    icon: '💰',
    description: 'For advisors helping clients build wealth.',
    leadMagnetType: 'Planning Guide',
    targetAudience: 'Professionals 35-55',
    exampleTitle: '"Retirement Readiness Calculator"',
    category: 'consulting'
  },
  {
    id: 'hr-consultant',
    name: 'HR Consultant',
    icon: '👥',
    description: 'For consultants helping companies with hiring & culture.',
    leadMagnetType: 'Hiring Toolkit',
    targetAudience: 'Business Owners & HR Leaders',
    exampleTitle: '"Interview Question Bank"',
    category: 'consulting'
  },
  {
    id: 'it-consultant',
    name: 'IT Consultant',
    icon: '💻',
    description: 'For consultants helping businesses with tech decisions.',
    leadMagnetType: 'Security Audit',
    targetAudience: 'Small Business Owners',
    exampleTitle: '"Cybersecurity Checklist for SMBs"',
    category: 'consulting'
  }
];

export default function TemplatesPage() {
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const handleSelectNiche = (nicheId: string) => {
    // Redirect to the quick-start onboarding with the selected niche
    router.push(`/onboarding/quick-start?niche=${nicheId}`);
  };

  const filteredTemplates = selectedCategory === 'all' 
    ? NICHE_TEMPLATES 
    : NICHE_TEMPLATES.filter(t => t.category === selectedCategory);

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
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

        {/* Category Tabs */}
        <div className="flex flex-wrap justify-center gap-3 mb-10">
          {CATEGORIES.map((category) => (
            <button
              key={category.id}
              onClick={() => setSelectedCategory(category.id)}
              className={`px-5 py-2.5 rounded-full font-medium transition-all ${
                selectedCategory === category.id
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-200'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <span className="mr-2">{category.icon}</span>
              {category.name}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
          {filteredTemplates.map((template) => (
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
