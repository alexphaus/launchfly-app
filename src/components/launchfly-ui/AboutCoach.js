// src/components/launchfly-ui/AboutCoach.js
'use client';

export default function AboutCoach({ 
  title = "About Your Coach",
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
        
        <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-2xl p-8 md:p-12 border border-blue-100">
          <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
            <div className="flex-shrink-0">
              <div className="w-32 h-32 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-5xl shadow-lg">
                👤
              </div>
            </div>
            <div className="flex-1 text-center md:text-left">
              <h3 className="text-2xl font-bold mb-4" style={{ color: 'var(--text-dark, #1f2937)' }}>
                {businessName || 'Your Expert Coach'}
              </h3>
              <p className="text-lg leading-relaxed" style={{ color: 'var(--text-gray, #6b7280)' }}>
                {bio}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

