// src/components/launchfly-ui/AboutCoach.js
'use client';

export default function AboutCoach({ 
  title = "About Us",
  bio = "",
  businessName = ""
}) {
  if (!bio) return null;

  return (
    <section className="py-20 bg-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4" style={{ color: 'var(--text-dark, #1f2937)' }}>
            {title}
          </h2>
        </div>
        
        <div className="bg-white rounded-2xl p-8 md:p-12 border border-slate-100 shadow-xl shadow-slate-200/50">
          <div className="flex flex-col md:flex-row items-center md:items-start gap-8">
            <div className="flex-shrink-0">
              <div className="w-24 h-24 rounded-full bg-slate-900 flex items-center justify-center text-4xl font-bold text-white shadow-lg ring-4 ring-slate-50">
                {businessName ? businessName.charAt(0).toUpperCase() : 'B'}
              </div>
            </div>
            <div className="flex-1 text-center md:text-left">
              <h3 className="text-2xl font-bold mb-4 text-slate-900">
                {businessName || 'Local Business Owner'}
              </h3>
              <div className="w-12 h-1 bg-blue-600 rounded-full mb-6 mx-auto md:mx-0"></div>
              <p className="text-lg leading-relaxed text-slate-600">
                {bio}
              </p>
              
              <div className="mt-8 flex flex-wrap justify-center md:justify-start gap-4">
                <div className="px-4 py-2 bg-slate-50 rounded-lg text-sm font-medium text-slate-600 border border-slate-200">
                  Licensed & Insured
                </div>
                <div className="px-4 py-2 bg-slate-50 rounded-lg text-sm font-medium text-slate-600 border border-slate-200">
                  Local Expert
                </div>
                <div className="px-4 py-2 bg-slate-50 rounded-lg text-sm font-medium text-slate-600 border border-slate-200">
                  Satisfaction Guaranteed
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}


