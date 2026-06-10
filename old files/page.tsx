'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';

export default function Home() {
  const [templates, setTemplates] = useState<any[]>([]);
  const [stats, setStats] = useState({
    totalRevenue: 2346789,
    activeBusinesses: 847,
    successRate: 92,
    spotsLeft: 13
  });
  const [timeLeft, setTimeLeft] = useState({ hours: 23, minutes: 47, seconds: 52 });

  useEffect(() => {
    // Fetch marketplace data
    fetchMarketplaceData();
    
    // Countdown timer
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev.seconds > 0) return { ...prev, seconds: prev.seconds - 1 };
        if (prev.minutes > 0) return { hours: prev.hours, minutes: prev.minutes - 1, seconds: 59 };
        if (prev.hours > 0) return { hours: prev.hours - 1, minutes: 59, seconds: 59 };
        return { hours: 23, minutes: 59, seconds: 59 };
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const fetchMarketplaceData = async () => {
    try {
      const response = await fetch('/api/marketplace?sort=popular&limit=3');
      const data = await response.json();
      if (data.success) {
        setTemplates(data.templates.slice(0, 3));
        if (data.stats) {
          setStats(prev => ({ ...prev, ...data.stats }));
        }
      }
    } catch (error) {
      console.error('Error fetching marketplace:', error);
    }
  };

  const testimonials = [
    {
      name: "Sarah Chen",
      business: "AI Resume Writer",
      revenue: "$3,847",
      timeframe: "first month",
      image: "https://randomuser.me/api/portraits/women/68.jpg",
      quote: "I made my first sale 6 hours after buying the business. This is unreal!"
    },
    {
      name: "Michael Rodriguez",
      business: "Local SEO Agency",
      revenue: "$5,200",
      timeframe: "6 weeks",
      image: "https://randomuser.me/api/portraits/men/75.jpg",
      quote: "The 50 warm leads converted into 8 clients in the first week alone."
    },
    {
      name: "Emma Thompson",
      business: "Newsletter Empire",
      revenue: "$2,100",
      timeframe: "month 2",
      image: "https://randomuser.me/api/portraits/women/44.jpg",
      quote: "233 paying subscribers and growing. The AI does everything for me."
    }
  ];

  const guarantees = [
    {
      icon: "⚡",
      title: "First Sale in 48 Hours",
      description: "Or we pay you $100 cash",
      highlight: "$100"
    },
    {
      icon: "🎯",
      title: "$1,000 in 60 Days",
      description: "Or we work for free until you hit it",
      highlight: "$1,000"
    },
    {
      icon: "🤖",
      title: "100% Done For You",
      description: "AI runs everything on autopilot",
      highlight: "0 hours"
    }
  ];

  return (
    <div className="min-h-screen bg-black text-white overflow-x-hidden">
      {/* Announcement Bar */}
      <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white py-3 px-4 text-center relative overflow-hidden">
        <div className="relative z-10 flex items-center justify-center gap-2 text-sm md:text-base font-medium">
          <span>✨</span>
          <span>New: Get started with any proven business today</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="absolute top-16 left-0 right-0 z-50 px-6 md:px-12">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            Launchfly
          </div>
          <div className="flex gap-6 items-center">
            <Link href="/marketplace" className="text-gray-300 hover:text-white transition">
              Browse Businesses
            </Link>
            <Link href="/login" className="text-gray-300 hover:text-white transition">
              Login
            </Link>
            <Link 
              href="/marketplace" 
              className="bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-2 rounded-full font-semibold hover:shadow-lg hover:shadow-purple-500/25 transition"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center px-6 md:px-12 pt-20">
        {/* Background Effects */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500 rounded-full blur-3xl opacity-20"></div>
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-pink-500 rounded-full blur-3xl opacity-20"></div>
        </div>

        <div className="relative z-10 max-w-6xl mx-auto text-center">
          {/* Trust Badge */}
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full mb-8">
            <span className="text-green-400">✓</span>
            <span className="text-sm">{stats.activeBusinesses} businesses making money right now</span>
          </div>

          {/* Main Headline */}
          <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
            Own a Profitable Online Business
            <span className="block bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              From Day One
            </span>
          </h1>

          {/* Subheadline */}
          <p className="text-xl md:text-2xl text-gray-300 mb-8 max-w-3xl mx-auto">
            We've already done the hard work. You get a complete business with customers 
            <strong className="text-white"> who are ready to buy today</strong>. We handle all the tech, 
            and your first sale is guaranteed in 48 hours.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <Link 
              href="/marketplace" 
              className="bg-gradient-to-r from-purple-600 to-pink-600 px-10 py-5 rounded-full text-xl font-bold hover:shadow-xl hover:shadow-purple-500/25 transition transform hover:scale-105"
            >
              Start Making Money Today →
            </Link>
            <button className="border border-gray-600 px-8 py-5 rounded-full text-lg font-semibold hover:bg-white/10 transition text-gray-300">
              See How It Works
            </button>
          </div>

          {/* Live Stats */}
          <div className="grid grid-cols-3 gap-8 max-w-2xl mx-auto">
            <div>
              <div className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">
                ${Math.floor(stats.totalRevenue / 1000)}k+
              </div>
              <div className="text-gray-400 text-sm">Total Revenue Generated</div>
            </div>
            <div>
              <div className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                {stats.successRate}%
              </div>
              <div className="text-gray-400 text-sm">Success Rate</div>
            </div>
            <div>
              <div className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-orange-400 to-red-400 bg-clip-text text-transparent">
                24h
              </div>
              <div className="text-gray-400 text-sm">Avg First Sale</div>
            </div>
          </div>

          {/* Trust Message */}
          <div className="mt-12 inline-flex items-center gap-2 text-gray-400">
            <span className="text-green-400">✓</span>
            <span>Join {stats.spotsLeft} people who started this week</span>
          </div>
        </div>
      </section>

      {/* Visual Proof Section */}
      <section className="py-20 px-6 md:px-12">
        <div className="max-w-6xl mx-auto">
          <div className="bg-gradient-to-r from-purple-900/20 to-pink-900/20 backdrop-blur-sm rounded-3xl p-8 md:p-12 border border-purple-500/20">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
              How You Make Your First Sale Today
            </h2>
            
            <div className="grid md:grid-cols-3 gap-8">
              {/* Step 1 */}
              <div className="text-center">
                <div className="bg-purple-600/20 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">
                  1
                </div>
                <h3 className="text-xl font-semibold mb-2">2:00 PM</h3>
                <p className="text-gray-400">Choose & buy proven business with 50+ warm customers</p>
                <div className="mt-4 bg-black/50 rounded-lg p-4">
                  <div className="text-sm text-gray-500">What you get:</div>
                  <div className="text-green-400 text-sm mt-1">✓ 50-200 customers</div>
                  <div className="text-green-400 text-sm">✓ Active campaigns</div>
                  <div className="text-green-400 text-sm">✓ Revenue streams</div>
                </div>
              </div>

              {/* Step 2 */}
              <div className="text-center">
                <div className="bg-pink-600/20 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">
                  2
                </div>
                <h3 className="text-xl font-semibold mb-2">6:00 PM</h3>
                <p className="text-gray-400">AI contacts your customers & handles conversations</p>
                <div className="mt-4 bg-black/50 rounded-lg p-4">
                  <div className="text-sm text-gray-500">Happening now:</div>
                  <div className="text-blue-400 text-sm mt-1">→ Emails sending</div>
                  <div className="text-blue-400 text-sm">→ DMs automated</div>
                  <div className="text-blue-400 text-sm">→ Ads running</div>
                </div>
              </div>

              {/* Step 3 */}
              <div className="text-center">
                <div className="bg-green-600/20 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">
                  3
                </div>
                <h3 className="text-xl font-semibold mb-2">8:00 PM</h3>
                <p className="text-gray-400">Your first $97 sale notification arrives!</p>
                <div className="mt-4 bg-black/50 rounded-lg p-4 border border-green-500/50">
                  <div className="text-sm text-gray-500">Stripe notification:</div>
                  <div className="text-green-400 font-semibold mt-1">💰 You earned $97</div>
                  <div className="text-gray-500 text-sm">Customer: Sarah M.</div>
                </div>
              </div>
            </div>

            <div className="text-center mt-12">
              <div className="inline-flex items-center gap-2 bg-green-500/20 px-6 py-3 rounded-full">
                <span className="text-green-400">✓</span>
                <span>Most users make their first sale within 24 hours</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Proven Businesses */}
      <section className="py-20 px-6 md:px-12 bg-gray-900/50">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-bold text-center mb-4">
            Choose Your Ready-to-Run Business
          </h2>
          <p className="text-xl text-gray-400 text-center mb-12 max-w-3xl mx-auto">
            Each business below is already profitable and comes with <strong className="text-white">customers waiting for you</strong>
          </p>

          <div className="grid md:grid-cols-3 gap-8 mb-12">
            {templates.length > 0 ? templates.map((template, idx) => (
              <div key={idx} className="bg-black/50 backdrop-blur-sm rounded-2xl p-8 border border-gray-800 hover:border-purple-500/50 transition group">
                {/* Header */}
                <div className="flex justify-between items-start mb-6">
                  <h3 className="text-2xl font-bold">{template.name}</h3>
                  <span className="bg-red-500/20 text-red-400 px-3 py-1 rounded-full text-sm">
                    {template.live_stats?.available_spots || 3} left
                  </span>
                </div>

                {/* Revenue Display */}
                <div className="mb-6">
                  <div className="text-4xl font-bold bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">
                    ${template.proven_revenue}
                  </div>
                  <div className="text-gray-400">per month proven</div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-gray-800/50 rounded-lg p-3">
                    <div className="text-sm text-gray-400">First Sale</div>
                    <div className="font-semibold">{template.time_to_first_sale}h avg</div>
                  </div>
                  <div className="bg-gray-800/50 rounded-lg p-3">
                    <div className="text-sm text-gray-400">Success Rate</div>
                    <div className="font-semibold">{Math.round(template.success_rate * 100)}%</div>
                  </div>
                </div>

                {/* What's Included */}
                                  <div className="space-y-2 mb-6">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-green-400">✓</span>
                      <span>List of customers who need this service now</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-green-400">✓</span>
                      <span>We're already finding you new customers</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-green-400">✓</span>
                      <span>All work is done automatically for you</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-green-400">✓</span>
                      <span>Pricing and sales process already tested</span>
                    </div>
                  </div>

                {/* CTA */}
                <Link 
                  href={`/marketplace/${template.id}`}
                  className="block w-full bg-gradient-to-r from-purple-600 to-pink-600 text-center py-3 rounded-full font-semibold group-hover:shadow-lg group-hover:shadow-purple-500/25 transition"
                >
                  Get This Business →
                </Link>
              </div>
            )) : (
              // Placeholder templates
              <>
                <div className="bg-black/50 backdrop-blur-sm rounded-2xl p-8 border border-gray-800 hover:border-purple-500/50 transition group">
                  <div className="flex justify-between items-start mb-6">
                    <h3 className="text-2xl font-bold">AI Resume Writer</h3>
                    <span className="bg-red-500/20 text-red-400 px-3 py-1 rounded-full text-sm">3 left</span>
                  </div>
                  <div className="mb-6">
                    <div className="text-4xl font-bold bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">$3,400</div>
                    <div className="text-gray-400">per month proven</div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-gray-800/50 rounded-lg p-3">
                      <div className="text-sm text-gray-400">First Sale</div>
                      <div className="font-semibold">18h avg</div>
                    </div>
                    <div className="bg-gray-800/50 rounded-lg p-3">
                      <div className="text-sm text-gray-400">Success Rate</div>
                      <div className="font-semibold">92%</div>
                    </div>
                  </div>
                  <div className="space-y-2 mb-6">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-green-400">✓</span>
                      <span>Includes a list of 147 clients who need this service now</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-green-400">✓</span>
                      <span>We're already contacting potential customers for you</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-green-400">✓</span>
                      <span>All resumes are created automatically</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-green-400">✓</span>
                      <span>Pricing already tested to maximize sales</span>
                    </div>
                  </div>
                  <Link href="/marketplace" className="block w-full bg-gradient-to-r from-purple-600 to-pink-600 text-center py-3 rounded-full font-semibold group-hover:shadow-lg group-hover:shadow-purple-500/25 transition">
                    Get This Business →
                  </Link>
                </div>

                <div className="bg-black/50 backdrop-blur-sm rounded-2xl p-8 border border-gray-800 hover:border-purple-500/50 transition group">
                  <div className="flex justify-between items-start mb-6">
                    <h3 className="text-2xl font-bold">Local SEO Agency</h3>
                    <span className="bg-red-500/20 text-red-400 px-3 py-1 rounded-full text-sm">5 left</span>
                  </div>
                  <div className="mb-6">
                    <div className="text-4xl font-bold bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">$5,200</div>
                    <div className="text-gray-400">per month proven</div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-gray-800/50 rounded-lg p-3">
                      <div className="text-sm text-gray-400">First Sale</div>
                      <div className="font-semibold">36h avg</div>
                    </div>
                    <div className="bg-gray-800/50 rounded-lg p-3">
                      <div className="text-sm text-gray-400">Success Rate</div>
                      <div className="font-semibold">88%</div>
                    </div>
                  </div>
                  <div className="space-y-2 mb-6">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-green-400">✓</span>
                      <span>List of 82 businesses who need better online visibility</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-green-400">✓</span>
                      <span>We're already reaching out to potential clients</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-green-400">✓</span>
                      <span>All technical work is done automatically</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-green-400">✓</span>
                      <span>High-value monthly service packages ready</span>
                    </div>
                  </div>
                  <Link href="/marketplace" className="block w-full bg-gradient-to-r from-purple-600 to-pink-600 text-center py-3 rounded-full font-semibold group-hover:shadow-lg group-hover:shadow-purple-500/25 transition">
                    Get This Business →
                  </Link>
                </div>

                <div className="bg-black/50 backdrop-blur-sm rounded-2xl p-8 border border-gray-800 hover:border-purple-500/50 transition group">
                  <div className="flex justify-between items-start mb-6">
                    <h3 className="text-2xl font-bold">Newsletter Empire</h3>
                    <span className="bg-red-500/20 text-red-400 px-3 py-1 rounded-full text-sm">8 left</span>
                  </div>
                  <div className="mb-6">
                    <div className="text-4xl font-bold bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">$2,100</div>
                    <div className="text-gray-400">per month proven</div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-gray-800/50 rounded-lg p-3">
                      <div className="text-sm text-gray-400">First Sale</div>
                      <div className="font-semibold">12h avg</div>
                    </div>
                    <div className="bg-gray-800/50 rounded-lg p-3">
                      <div className="text-sm text-gray-400">Success Rate</div>
                      <div className="font-semibold">94%</div>
                    </div>
                  </div>
                  <div className="space-y-2 mb-6">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-green-400">✓</span>
                      <span>233 people already paying for this newsletter</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-green-400">✓</span>
                      <span>We're already bringing you new subscribers</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-green-400">✓</span>
                      <span>All content is created automatically each week</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-green-400">✓</span>
                      <span>Multiple subscription options to maximize income</span>
                    </div>
                  </div>
                  <Link href="/marketplace" className="block w-full bg-gradient-to-r from-purple-600 to-pink-600 text-center py-3 rounded-full font-semibold group-hover:shadow-lg group-hover:shadow-purple-500/25 transition">
                    Get This Business →
                  </Link>
                </div>
              </>
            )}
          </div>

          <div className="text-center">
            <Link 
              href="/marketplace" 
              className="inline-flex items-center gap-2 text-purple-400 hover:text-purple-300 transition"
            >
              <span>View all 20+ proven businesses</span>
              <span>→</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Guarantees Section */}
      <section className="py-20 px-6 md:px-12">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-bold text-center mb-4">
            Your Success is Guaranteed
          </h2>
          <p className="text-xl text-gray-400 text-center mb-12 max-w-3xl mx-auto">
            We're so confident in our system, we guarantee your results with real money.
          </p>

          <div className="grid md:grid-cols-3 gap-8">
            {guarantees.map((guarantee, idx) => (
              <div key={idx} className="bg-gradient-to-b from-purple-900/20 to-pink-900/20 backdrop-blur-sm rounded-2xl p-8 border border-purple-500/20 text-center">
                <div className="text-5xl mb-4">{guarantee.icon}</div>
                <h3 className="text-2xl font-bold mb-2">{guarantee.title}</h3>
                <p className="text-gray-400 mb-4">{guarantee.description}</p>
                <div className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                  {guarantee.highlight}
                </div>
              </div>
            ))}
          </div>

          <div className="text-center mt-12">
            <div className="inline-flex items-center gap-2 bg-green-500/20 px-6 py-3 rounded-full">
              <span className="text-green-400">✓</span>
              <span>{stats.successRate}% of our {stats.activeBusinesses} users are profitable</span>
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof */}
      <section className="py-20 px-6 md:px-12 bg-gray-900/50">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-bold text-center mb-12">
            Real Results From Real People
          </h2>

          <div className="grid md:grid-cols-3 gap-8 mb-12">
            {testimonials.map((testimonial, idx) => (
              <div key={idx} className="bg-black/50 backdrop-blur-sm rounded-2xl p-8 border border-gray-800">
                <div className="flex items-center gap-4 mb-6">
                  <img 
                    src={testimonial.image} 
                    alt={testimonial.name}
                    className="w-16 h-16 rounded-full"
                  />
                  <div>
                    <div className="font-semibold">{testimonial.name}</div>
                    <div className="text-sm text-gray-400">{testimonial.business}</div>
                  </div>
                </div>
                <p className="text-gray-300 mb-4 italic">"{testimonial.quote}"</p>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-2xl font-bold text-green-400">{testimonial.revenue}</div>
                    <div className="text-sm text-gray-400">{testimonial.timeframe}</div>
                  </div>
                  <div className="text-yellow-400">★★★★★</div>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-gradient-to-r from-purple-900/20 to-pink-900/20 backdrop-blur-sm rounded-2xl p-8 border border-purple-500/20">
            <div className="grid md:grid-cols-4 gap-8 text-center">
              <div>
                <div className="text-3xl font-bold mb-2">4.9/5</div>
                <div className="text-gray-400">Average Rating</div>
              </div>
              <div>
                <div className="text-3xl font-bold mb-2">6 hours</div>
                <div className="text-gray-400">Fastest First Sale</div>
              </div>
              <div>
                <div className="text-3xl font-bold mb-2">$12,847</div>
                <div className="text-gray-400">Highest Month 1</div>
              </div>
              <div>
                <div className="text-3xl font-bold mb-2">89%</div>
                <div className="text-gray-400">Would Recommend</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works - simplified for space */}
      <section className="py-20 px-6 md:px-12">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-bold text-center mb-12">
            How It Works
          </h2>
          
          <div className="grid md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                1
              </div>
              <h3 className="text-xl font-semibold mb-2">Choose Business</h3>
              <p className="text-gray-400 text-sm">Pick from proven $1k-6k/mo models</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                2
              </div>
              <h3 className="text-xl font-semibold mb-2">Get Customers</h3>
              <p className="text-gray-400 text-sm">50-200 warm leads instantly</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                3
              </div>
              <h3 className="text-xl font-semibold mb-2">AI Sells</h3>
              <p className="text-gray-400 text-sm">Automated outreach & closing</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                4
              </div>
              <h3 className="text-xl font-semibold mb-2">Get Paid</h3>
              <p className="text-gray-400 text-sm">First sale avg 24 hours</p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 px-6 md:px-12">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-bold text-center mb-12">
            Common Questions
          </h2>
          
          <div className="space-y-6">
            <div className="bg-black/50 backdrop-blur-sm rounded-2xl p-8 border border-gray-800">
              <h3 className="text-2xl font-bold mb-4 text-purple-400">
                This seems too good to be true. What's the catch?
              </h3>
              <p className="text-gray-300 text-lg leading-relaxed">
                There's no catch. We build and test dozens of online businesses internally. We find the customers, 
                prove the business can make money, and then package it for a new owner. You get to skip all the risk 
                and failure of the startup phase. We only make money when we successfully sell a profitable business, 
                so it's in our interest to make sure you succeed from day one.
              </p>
            </div>

            <div className="bg-black/50 backdrop-blur-sm rounded-2xl p-8 border border-gray-800">
              <h3 className="text-2xl font-bold mb-4 text-purple-400">
                Do I need any technical skills or experience?
              </h3>
              <p className="text-gray-300 text-lg leading-relaxed">
                No technical skills required. We handle all the technology, customer outreach, and business operations. 
                You simply own the business and collect the profits. If you can check email and follow simple instructions, 
                you can run one of these businesses.
              </p>
            </div>

            <div className="bg-black/50 backdrop-blur-sm rounded-2xl p-8 border border-gray-800">
              <h3 className="text-2xl font-bold mb-4 text-purple-400">
                What if I don't make money?
              </h3>
              <p className="text-gray-300 text-lg leading-relaxed">
                We guarantee your first sale within 48 hours or we pay you $100 cash. If you don't make $1,000 in your 
                first 60 days, we keep working for free until you do. These aren't just promises - they're contractual 
                guarantees with automatic payouts.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 px-6 md:px-12 bg-gradient-to-b from-purple-900/20 to-pink-900/20">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-5xl md:text-6xl font-bold mb-6">
            Ready to Start
            <span className="block bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              Making Money?
            </span>
          </h2>
          
          <p className="text-xl text-gray-300 mb-12">
            Join {stats.activeBusinesses} people already earning with proven businesses
          </p>

          <Link 
            href="/marketplace" 
            className="inline-block bg-gradient-to-r from-purple-600 to-pink-600 px-12 py-6 rounded-full text-2xl font-bold hover:shadow-xl hover:shadow-purple-500/25 transition transform hover:scale-105 mb-8"
          >
            Get Your Business Now →
          </Link>

          <div className="flex flex-col sm:flex-row gap-6 justify-center items-center text-gray-300">
            <div className="flex items-center gap-2">
              <span className="text-green-400">✓</span>
              <span>First sale in 48 hours guaranteed</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-green-400">✓</span>
              <span>$1,000 in 60 days or we work free</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-green-400">✓</span>
              <span>No risk - cancel anytime</span>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 md:px-12 border-t border-gray-800">
        <div className="max-w-6xl mx-auto text-center">
          <p className="text-gray-400 text-sm">
            © 2024 Launchfly. All rights reserved. | 
            <Link href="/terms" className="hover:text-white"> Terms</Link> | 
            <Link href="/privacy" className="hover:text-white"> Privacy</Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
