// app/future-proof/page.js - Showcase the new approach
'use client';

import { useState } from 'react';

// Define ValueLayers and SuccessGuarantees locally to avoid import issues during build
const ValueLayers = {
  discovery: {
    value: "Find profitable opportunity",
    price: "$97",
    moat: "Market knowledge + real data"
  },
  validation: {
    value: "Prove people will pay",
    price: "$297",
    moat: "Real customer conversations"
  },
  creation: {
    value: "Build the business",
    price: "$0",
    moat: "None - use best AI available"
  },
  acquisition: {
    value: "Bring paying customers", 
    price: "$997 or 10% revenue share",
    moat: "Relationships + reputation"
  },
  scale: {
    value: "Grow to sustainable revenue",
    price: "20% of growth above baseline",
    moat: "Experience + network effects"
  }
};

const SuccessGuarantees = {
  basic: "Website live in 24 hours",
  better: "First customer within 7 days",
  best: "Profitable within 30 days or money back", 
  ultimate: "We manage until you hit revenue goals"
};

export default function FutureProofPage() {
  const [selectedLayer, setSelectedLayer] = useState('best');

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Hero Section */}
      <div className="relative pt-16 pb-32 flex content-center items-center justify-center min-h-screen">
        <div className="container relative mx-auto px-4">
          <div className="items-center flex flex-wrap">
            <div className="w-full lg:w-8/12 px-4 ml-auto mr-auto text-center">
              <div className="pr-12">
                <h1 className="text-5xl font-bold text-gray-900 mb-6">
                  The Future-Proof Approach to 
                  <span className="text-blue-600"> Business Success</span>
                </h1>
                <p className="mt-4 text-xl text-gray-600 leading-relaxed">
                  When AI can generate perfect websites, we focus on what remains valuable: 
                  <span className="font-semibold"> guaranteeing your business success.</span>
                </p>
                
                <div className="mt-12 flex flex-col sm:flex-row gap-4 justify-center">
                  <button className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-8 rounded-lg text-lg transition-all transform hover:scale-105">
                    Start Your Success Partnership
                  </button>
                  <button className="border-2 border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white font-bold py-4 px-8 rounded-lg text-lg transition-all">
                    See How It Works
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* The Uncomfortable Truth */}
      <section className="pb-20 bg-white">
        <div className="container mx-auto px-4">
          <div className="flex flex-wrap justify-center text-center mb-24">
            <div className="w-full lg:w-8/12 px-4">
              <h2 className="text-4xl font-bold text-gray-900 mb-8">
                The Uncomfortable Truth
              </h2>
              <p className="text-lg text-gray-600 mb-12">
                When AI can generate perfect websites, these become worthless:
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                  { icon: '❌', title: 'Your templates', desc: 'AI generates better' },
                  { icon: '❌', title: 'Your website builder', desc: 'AI builds faster' },
                  { icon: '❌', title: 'Your "AI-powered" generation', desc: 'Everyone has AI' },
                  { icon: '❌', title: 'Your technical infrastructure', desc: 'Commoditized' }
                ].map((item, index) => (
                  <div key={index} className="bg-red-50 border border-red-200 rounded-lg p-6">
                    <div className="text-3xl mb-3">{item.icon}</div>
                    <h3 className="font-semibold text-gray-900 mb-2">{item.title}</h3>
                    <p className="text-sm text-gray-600">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* What Remains Valuable */}
      <section className="pb-20 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="flex flex-wrap justify-center text-center mb-24">
            <div className="w-full lg:w-8/12 px-4">
              <h2 className="text-4xl font-bold text-gray-900 mb-8">
                What Actually Remains Valuable
              </h2>
              <p className="text-lg text-gray-600 mb-12">
                Our future-proof business success system:
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                  { 
                    icon: '🎯', 
                    title: 'Customer Acquisition', 
                    desc: 'We bring you paying customers',
                    moat: 'Relationships + reputation'
                  },
                  { 
                    icon: '💰', 
                    title: 'Revenue Generation', 
                    desc: 'We make you money',
                    moat: 'Proven systems'
                  },
                  { 
                    icon: '⚙️', 
                    title: 'Business Operations', 
                    desc: 'We run your business',
                    moat: 'Experience + network'
                  },
                  { 
                    icon: '🛡️', 
                    title: 'Success Guarantee', 
                    desc: 'We ensure you succeed',
                    moat: 'Risk partnership'
                  }
                ].map((item, index) => (
                  <div key={index} className="bg-green-50 border border-green-200 rounded-lg p-6">
                    <div className="text-3xl mb-3">{item.icon}</div>
                    <h3 className="font-semibold text-gray-900 mb-2">{item.title}</h3>
                    <p className="text-sm text-gray-600 mb-3">{item.desc}</p>
                    <div className="bg-green-100 rounded px-2 py-1">
                      <p className="text-xs text-green-800 font-medium">Moat: {item.moat}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Approach Comparison */}
      <section className="pb-20 bg-white">
        <div className="container mx-auto px-4">
          <div className="flex flex-wrap justify-center text-center mb-16">
            <div className="w-full lg:w-8/12 px-4">
              <h2 className="text-4xl font-bold text-gray-900 mb-8">
                The Radical Simplification
              </h2>
            </div>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-6xl mx-auto">
            {/* Current Approach */}
            <div className="bg-red-50 border border-red-200 rounded-lg p-8">
              <h3 className="text-2xl font-bold text-red-800 mb-6">
                Current Approach (Fragile)
              </h3>
              <div className="space-y-4">
                <div className="flex items-center">
                  <div className="w-8 h-8 bg-red-200 rounded-full flex items-center justify-center text-red-800 font-bold mr-4">1</div>
                  <span className="text-gray-700">User fills form</span>
                </div>
                <div className="flex items-center">
                  <div className="w-8 h-8 bg-red-200 rounded-full flex items-center justify-center text-red-800 font-bold mr-4">2</div>
                  <span className="text-gray-700">AI generates website</span>
                </div>
                <div className="flex items-center">
                  <div className="w-8 h-8 bg-red-200 rounded-full flex items-center justify-center text-red-800 font-bold mr-4">3</div>
                  <span className="text-gray-700">Hope for customers</span>
                </div>
                <div className="flex items-center">
                  <div className="w-8 h-8 bg-red-200 rounded-full flex items-center justify-center text-red-800 font-bold mr-4">4</div>
                  <span className="text-gray-700">❌ Often fails</span>
                </div>
              </div>
            </div>

            {/* Future-Proof Approach */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-8">
              <h3 className="text-2xl font-bold text-green-800 mb-6">
                Future-Proof Approach (Antifragile)
              </h3>
              <div className="space-y-4">
                <div className="flex items-center">
                  <div className="w-8 h-8 bg-green-200 rounded-full flex items-center justify-center text-green-800 font-bold mr-4">1</div>
                  <span className="text-gray-700">Success Partnership</span>
                </div>
                <div className="flex items-center">
                  <div className="w-8 h-8 bg-green-200 rounded-full flex items-center justify-center text-green-800 font-bold mr-4">2</div>
                  <span className="text-gray-700">Use whatever tools work</span>
                </div>
                <div className="flex items-center">
                  <div className="w-8 h-8 bg-green-200 rounded-full flex items-center justify-center text-green-800 font-bold mr-4">3</div>
                  <span className="text-gray-700">Generate customers</span>
                </div>
                <div className="flex items-center">
                  <div className="w-8 h-8 bg-green-200 rounded-full flex items-center justify-center text-green-800 font-bold mr-4">4</div>
                  <span className="text-gray-700">✅ Guaranteed results</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Value Layers */}
      <section className="pb-20 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="flex flex-wrap justify-center text-center mb-16">
            <div className="w-full lg:w-8/12 px-4">
              <h2 className="text-4xl font-bold text-gray-900 mb-8">
                Incremental Value Layers
              </h2>
              <p className="text-lg text-gray-600 mb-8">
                Each layer adds value regardless of AI advancement
              </p>
              
              <ValueLayerSelector 
                selected={selectedLayer} 
                onChange={setSelectedLayer}
              />
            </div>
          </div>
          
          <ValueLayerDetails layer={ValueLayers[selectedLayer]} />
        </div>
      </section>

      {/* Success Guarantees */}
      <section className="pb-20 bg-blue-600">
        <div className="container mx-auto px-4">
          <div className="flex flex-wrap justify-center text-center mb-16">
            <div className="w-full lg:w-8/12 px-4">
              <h2 className="text-4xl font-bold text-white mb-8">
                Our Success Guarantees
              </h2>
              <p className="text-xl text-blue-100 mb-12">
                Your success is our business model. We only win when you win.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {Object.entries(SuccessGuarantees).map(([key, guarantee]) => (
                  <div key={key} className="bg-white rounded-lg p-6">
                    <div className="text-2xl mb-3">🛡️</div>
                    <h3 className="font-semibold text-gray-900 mb-2 capitalize">{key}</h3>
                    <p className="text-sm text-gray-600">{guarantee}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="pb-20 bg-white">
        <div className="container mx-auto px-4">
          <div className="flex flex-wrap justify-center text-center">
            <div className="w-full lg:w-8/12 px-4">
              <h2 className="text-4xl font-bold text-gray-900 mb-8">
                Stop Selling Websites. Start Selling Success.
              </h2>
              <p className="text-xl text-gray-600 mb-12">
                When perfect AI agents exist, everyone can build websites. 
                But not everyone can guarantee business success.
              </p>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-8 mb-8">
                <h3 className="text-2xl font-bold text-blue-800 mb-4">
                  That's your moat. Everything else is just tools.
                </h3>
              </div>
              
              <button className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-6 px-12 rounded-lg text-xl transition-all transform hover:scale-105">
                Launch Your Future-Proof Business
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function ValueLayerSelector({ selected, onChange }) {
  return (
    <div className="flex justify-center mb-8">
      <div className="bg-white rounded-lg p-2 shadow-lg">
        {Object.entries(ValueLayers).map(([key, layer]) => (
          <button
            key={key}
            onClick={() => onChange(key)}
            className={`px-4 py-2 rounded-md mr-2 last:mr-0 transition-all ${
              selected === key 
                ? 'bg-blue-600 text-white' 
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {layer.value} - {layer.price}
          </button>
        ))}
      </div>
    </div>
  );
}

function ValueLayerDetails({ layer }) {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-lg p-8 shadow-lg">
        <div className="text-center mb-8">
          <h3 className="text-3xl font-bold text-gray-900 mb-2">{layer.value}</h3>
          <p className="text-4xl font-bold text-blue-600 mb-4">{layer.price}</p>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-blue-800">
              <strong>Defensive Moat:</strong> {layer.moat}
            </p>
          </div>
        </div>
        
        <div className="bg-gray-50 rounded-lg p-6">
          <h4 className="font-semibold text-gray-900 mb-3">
            Why this layer remains valuable:
          </h4>
          <p className="text-gray-600">
            This value layer is AI-resistant because it requires human relationships, 
            market knowledge, proven systems, and risk partnership that AI cannot replicate.
          </p>
        </div>
      </div>
    </div>
  );
}
