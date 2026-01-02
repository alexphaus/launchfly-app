// src/components/launchfly-ui/Hero.js
'use client';
import { useState, useMemo } from 'react';

export default function Hero({
  title = "Stay Cool All Year",
  subtitle = "Your Trusted Experts for Professional Service",
  ctaText = "View Services",
  ctaLink = "#services",
  secondaryCtaText,
  secondaryCtaLink,
  backgroundImage,
  showEmailCapture = false,
  businessId,
  businessName = "Business Name",
  phoneNumber,
  whatsappNumber,
  whatsappMessage = "Hi! I'd like to schedule a service.",
  quoteCalculator,
  services = []
}) {
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [status, setStatus] = useState('idle');

  // Quote Wizard State
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);

  // Calculate Estimate
  const estimate = useMemo(() => {
    if (!quoteCalculator) return null;
    let total = quoteCalculator.basePrice;
    Object.entries(answers).forEach(([key, value]) => {
      const question = quoteCalculator.questions.find(q => q.id === key);
      if (question && question.type === 'number') {
        total += (question.multiplier || 0) * Number(value);
      }
    });
    return { min: total, max: Math.round(total * 1.2) };
  }, [answers, quoteCalculator]);

  const handleNextQuestion = (answer) => {
    const question = quoteCalculator?.questions[currentQuestionIndex];
    setAnswers(prev => ({ ...prev, [question.id]: answer }));
    if (currentQuestionIndex < (quoteCalculator?.questions.length || 0) - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    } else {
      setStep(2);
    }
  };

  const handleCapture = async (e) => {
    e.preventDefault();
    if (!phone) return;
    setStatus('loading');
    try {
      const res = await fetch('/api/leads/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId,
          formData: {
            name, email, phone,
            type: 'quote_request',
            quoteDetails: { answers, estimate }
          }
        })
      });
      if (!res.ok) throw new Error('Failed');
      setStatus('success');
    } catch (err) {
      setStatus('error');
    }
  };

  const getWhatsAppLink = () => {
    if (!whatsappNumber) return null;
    const cleanNumber = String(whatsappNumber).replace(/[^0-9]/g, '');
    return `https://api.whatsapp.com/send?phone=${cleanNumber}&text=${encodeURIComponent(whatsappMessage)}`;
  };

  return (
    <>
      {/* CLEAN HERO SECTION */}
      <section className="bg-white py-16 lg:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">

            {/* LEFT: Text Content */}
            <div className="order-2 lg:order-1">
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-serif font-medium text-slate-900 leading-tight mb-6">
                {title}
              </h1>
              <p className="text-lg text-slate-600 mb-8 max-w-lg">
                {subtitle}
              </p>
              <a
                href={ctaLink}
                className="inline-flex items-center px-8 py-4 bg-blue-600 text-white font-semibold rounded-full hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20"
              >
                {ctaText}
              </a>
            </div>

            {/* RIGHT: Quote Wizard Card OR Image */}
            <div className="order-1 lg:order-2">
              {quoteCalculator ? (
                <div className="bg-slate-900 rounded-2xl p-6 shadow-2xl text-white">
                  {/* Business Card Header */}
                  <div className="flex items-center gap-4 mb-6 pb-4 border-b border-slate-700">
                    <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center text-2xl">
                      ❄️
                    </div>
                    <div>
                      <h3 className="font-bold text-lg">{businessName}</h3>
                      <p className="text-slate-400 text-sm">{subtitle}</p>
                    </div>
                  </div>

                  {/* Quote Wizard Steps */}
                  {status === 'success' ? (
                    <div className="text-center py-8">
                      <div className="text-5xl mb-4">✅</div>
                      <h3 className="text-xl font-bold mb-2">Quote Sent!</h3>
                      <p className="text-slate-400">We'll contact you on WhatsApp shortly.</p>
                    </div>
                  ) : step === 0 ? (
                    <div className="text-center py-6">
                      <h3 className="text-xl font-bold mb-2">Get an Instant Quote</h3>
                      <p className="text-slate-400 text-sm mb-6">Answer 2 quick questions</p>
                      <button
                        onClick={() => setStep(1)}
                        className="w-full py-4 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all"
                      >
                        Start Quote →
                      </button>
                    </div>
                  ) : step === 1 && quoteCalculator.questions[currentQuestionIndex] ? (
                    <div>
                      <div className="text-xs text-slate-400 uppercase tracking-widest mb-3">
                        Question {currentQuestionIndex + 1} of {quoteCalculator.questions.length}
                      </div>
                      <h3 className="text-lg font-bold mb-4">
                        {quoteCalculator.questions[currentQuestionIndex].text}
                      </h3>
                      <div className="space-y-2">
                        {quoteCalculator.questions[currentQuestionIndex].type === 'select' ? (
                          quoteCalculator.questions[currentQuestionIndex].options?.map(opt => (
                            <button
                              key={opt}
                              onClick={() => handleNextQuestion(opt)}
                              className="w-full text-left px-4 py-3 bg-slate-800 rounded-lg hover:bg-slate-700 transition-colors"
                            >
                              {opt}
                            </button>
                          ))
                        ) : (
                          <form onSubmit={(e) => { e.preventDefault(); handleNextQuestion(e.target.elements.val.value); }}>
                            <input name="val" type="number" autoFocus
                              className="w-full px-4 py-3 bg-slate-800 rounded-lg text-white mb-3"
                              placeholder="Enter number"
                            />
                            <button type="submit" className="w-full py-3 bg-blue-600 rounded-lg font-bold">Next</button>
                          </form>
                        )}
                      </div>
                    </div>
                  ) : step === 2 ? (
                    <div>
                      {/* Price Display */}
                      <div className="text-center bg-blue-600 -mx-6 -mt-6 rounded-t-xl p-6 mb-6">
                        <p className="text-blue-200 text-sm uppercase tracking-wider mb-1">Estimated Cost</p>
                        <div className="text-4xl font-extrabold">
                          {quoteCalculator.currency} {estimate?.min} - {estimate?.max}
                        </div>
                        <p className="text-blue-200 text-xs mt-2">🔥 27 people requested this week</p>
                      </div>

                      {/* Capture Form */}
                      <form onSubmit={handleCapture} className="space-y-3">
                        <p className="text-center text-slate-400 text-sm mb-2">Enter details to check availability</p>
                        <input
                          type="text" placeholder="Your Name" required
                          value={name} onChange={(e) => setName(e.target.value)}
                          className="w-full px-4 py-3 bg-slate-800 rounded-lg text-white"
                        />
                        <input
                          type="tel" placeholder="WhatsApp Number" required
                          value={phone} onChange={(e) => setPhone(e.target.value)}
                          className="w-full px-4 py-3 bg-slate-800 rounded-lg text-white"
                        />
                        <button
                          type="submit" disabled={status === 'loading'}
                          className="w-full py-4 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 transition-all"
                        >
                          {status === 'loading' ? 'Checking...' : '✓ Check Availability'}
                        </button>
                        <p className="text-xs text-slate-500 text-center">
                          Final price subject to inspection
                        </p>
                      </form>
                    </div>
                  ) : null}

                  {/* Service Thumbnails */}
                  <div className="flex gap-2 mt-6 pt-4 border-t border-slate-700 overflow-x-auto">
                    {['🔧', '🧹', '❄️', '⚡'].map((emoji, i) => (
                      <div key={i} className="w-16 h-12 bg-slate-800 rounded-lg flex items-center justify-center text-xl flex-shrink-0">
                        {emoji}
                      </div>
                    ))}
                  </div>
                </div>
              ) : backgroundImage ? (
                <div className="relative rounded-2xl overflow-hidden shadow-2xl">
                  <img src={backgroundImage} alt={title} className="w-full h-80 object-cover" />
                </div>
              ) : (
                <div className="bg-gradient-to-br from-blue-100 to-blue-200 rounded-2xl h-80 flex items-center justify-center">
                  <span className="text-6xl">🏠</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* TRUST BADGES */}
      <section className="bg-slate-50 py-8 border-y border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-3 gap-8">
            {[
              { icon: '✓', text: 'Fast Response' },
              { icon: '✓', text: 'Trusted Experts' },
              { icon: '✓', text: 'Fair Pricing' }
            ].map((badge, i) => (
              <div key={i} className="flex flex-col items-center text-center">
                <div className="w-12 h-12 rounded-full border-2 border-blue-600 flex items-center justify-center text-blue-600 text-xl mb-2">
                  {badge.icon}
                </div>
                <span className="text-slate-600 text-sm font-medium">{badge.text}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
