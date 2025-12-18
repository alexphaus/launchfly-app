// src/app/sites/[subdomain]/page.js
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import * as LaunchflyUI from '@/components/launchfly-ui';
import OptimizedHero from '@/components/launchfly-ui/OptimizedHero';
import ImagePreloader from '@/components/ImagePreloader';
import { LazySection } from '@/components/LazyComponent';
import PerformanceMonitor from '@/components/PerformanceMonitor';
import { TrackingScript, getTrackingConfig } from '@/lib/analytics-tracker';
import { CartProvider } from '@/hooks/useCart';
import VisitorTracker from '@/components/VisitorTracker';
import { 
  getVisitorId, 
  getVisitorSegment, 
  assignVariant, 
  getActiveExperiments,
  recordImpression,
  personalizeContent,
  createDefaultExperiments
} from '@/lib/conversion-optimizer';

// Mock business data for fallback
const mockBusinessData = {
  axceleratebusiness: {
    name: 'Axcelerate Business',
    theme: {
      colors: {
        primary: '#3b82f6',
        secondary: '#1e40af',
        textDark: '#1f2937',
        textGray: '#6b7280',
        borderColor: '#e5e7eb'
      },
      font: 'Inter',
      gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
    },
    layout: [
      {
        component: 'NavBar',
        props: {
          businessName: 'Axcelerate Business',
          links: ['Home', 'About', 'Services', 'Products', 'Contact']
        }
      },
      {
        component: 'Hero',
        props: {
          title: 'Accelerate Your Business Growth',
          subtitle: 'AI-powered solutions to streamline operations and boost productivity',
          buttonText: 'View Products',
          buttonLink: '#products'
        }
      },
      {
        component: 'FeatureGrid',
        props: {
          title: 'Why Choose Us',
          features: [
            {
              title: 'AI Integration',
              description: 'Leverage cutting-edge AI to automate processes',
              icon: '🤖'
            },
            {
              title: 'Scalable Solutions',
              description: 'Grow with confidence using our flexible platform',
              icon: '📈'
            },
            {
              title: 'Expert Support',
              description: '24/7 dedicated support from our expert team',
              icon: '🎯'
            }
          ]
        }
      },
      {
        component: 'TestimonialSlider',
        props: {
          title: 'What Our Clients Say',
          testimonials: [
            {
              name: 'Sarah Johnson',
              role: 'Business Owner',
              content: 'Axcelerate Business completely transformed our operations. We saw 300% growth in efficiency within just 3 months!',
              avatar: '👩‍💼',
              rating: 5
            },
            {
              name: 'Mike Chen',
              role: 'CEO',
              content: 'The AI integration was seamless and the results were immediate. Our productivity has never been higher.',
              avatar: '👨‍💻',
              rating: 5
            },
            {
              name: 'Emily Rodriguez',
              role: 'Operations Manager',
              content: 'Professional, reliable, and incredibly effective. This is exactly what we needed to scale our business.',
              avatar: '👩‍🚀',
              rating: 5
            }
          ]
        }
      },
      {
        component: 'ProductGrid',
        props: {
          title: 'Our Solutions',
          subtitle: 'Choose the perfect package for your business needs',
          products: [
            {
              id: 'ai-starter',
              name: 'AI Starter',
              price: '$299',
              period: 'one-time',
              description: 'Perfect for small businesses getting started with AI',
              icon: '🚀',
              features: [
                'AI-powered automation setup',
                'Basic workflow optimization',  
                'Email support',
                '30-day money-back guarantee'
              ],
              ctaText: 'Get Started'
            },
            {
              id: 'ai-pro',
              name: 'AI Professional',
              price: '$699',
              period: 'one-time',
              description: 'Advanced AI solutions for growing businesses',
              icon: '⭐',
              features: [
                'Everything in Starter',
                'Advanced AI integrations',
                'Custom workflow design',
                'Priority support',
                'Performance analytics'
              ],
              ctaText: 'Go Pro',
              popular: true
            },
            {
              id: 'ai-enterprise',
              name: 'AI Enterprise',
              price: '$1,499',
              period: 'one-time',
              description: 'Complete AI transformation for large organizations',
              icon: '💎',
              features: [
                'Everything in Professional',
                'Dedicated AI consultant',
                'Custom AI development',
                'SLA guarantee',
                'Unlimited revisions'
              ],
              ctaText: 'Contact Sales'
            }
          ]
        }
      },
      {
        component: 'Footer',
        props: {
          companyName: 'Axcelerate Business',
          links: [
            { href: '#privacy', label: 'Privacy Policy' },
            { href: '#terms', label: 'Terms of Service' }
          ]
        }
      }
    ]
  },
  innovativesolutionshub: {
    name: 'Innovative Solutions Hub',
    theme: {
      colors: {
        primary: '#10b981',
        secondary: '#059669',
        textDark: '#1f2937',
        textGray: '#6b7280',
        borderColor: '#e5e7eb'
      },
      font: 'Inter',
      gradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
    },
    layout: [
      {
        component: 'NavBar',
        props: {
          businessName: 'Innovative Solutions Hub',
          links: ['Home', 'About', 'Solutions', 'Contact']
        }
      },
      {
        component: 'Hero',
        props: {
          title: 'Transform Your Business with Innovation',
          subtitle: 'Cutting-edge solutions that drive growth and efficiency for modern businesses',
          buttonText: 'Get Started',
          buttonLink: '#contact'
        }
      },
      {
        component: 'FeatureGrid',
        props: {
          title: 'Our Solutions',
          features: [
            {
              title: 'Digital Transformation',
              description: 'Modernize your operations with our comprehensive digital solutions',
              icon: '🚀'
            },
            {
              title: 'Innovation Strategy',
              description: 'Strategic guidance to stay ahead in competitive markets',
              icon: '💡'
            },
            {
              title: 'Technology Integration',
              description: 'Seamlessly integrate new technologies into your workflow',
              icon: '⚙️'
            }
          ]
        }
      },
      {
        component: 'Footer',
        props: {
          companyName: 'Innovative Solutions Hub',
          links: [
            { href: '#privacy', label: 'Privacy Policy' },
            { href: '#terms', label: 'Terms of Service' }
          ]
        }
      }
    ]
  }
};

// A wrapper to inject theme variables
function ThemedLayout({ theme, children }) {
  if (!theme) return <main>{children}</main>;
  
  const style = {
    '--primary': theme.colors?.primary || '#3b82f6',
    '--secondary': theme.colors?.secondary || '#1e40af',
    '--text-dark': theme.colors?.textDark || '#1f2937',
    '--text-gray': theme.colors?.textGray || '#6b7280',
    '--border-color': theme.colors?.borderColor || '#e5e7eb',
    '--gradient-bg': theme.gradient || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    '--font-family': theme.font ? `'${theme.font}', sans-serif` : 'system-ui, sans-serif',
  };
  
  return <main style={style}>{children}</main>;
}

function generateSmartTestimonials(businessData) {
  const niche = businessData.niche?.toLowerCase() || 'service';
  const name = businessData.businessName || businessData.lead_magnet_title || 'Pro Services';
  const type = businessData.leadMagnet?.lead_magnet_title?.toLowerCase().includes('checklist') ? 'checklist' : 'guide';
  
  // Generate niche-specific testimonials
  const nicheTestimonials = {
    landscape: [
      {
        name: 'Jennifer M.',
        role: 'Homeowner',
        content: `My lawn was a mess until I found ${name}. Their guide showed me exactly what to look for when hiring a landscaper. Now my yard is the envy of the neighborhood!`,
        avatar: '👩',
        rating: 5
      },
      {
        name: 'Michael T.',
        role: 'Property Owner',
        content: `The pricing guide saved me from getting overcharged. I used their checklist to compare 3 different landscaping companies and made an informed decision.`,
        avatar: '👨',
        rating: 5
      },
      {
        name: 'Sarah L.',
        role: 'First-time Homeowner',
        content: `As a new homeowner, I had no idea where to start with my yard. This free ${type} was a lifesaver - clear, practical, and actually useful!`,
        avatar: '👩‍🦰',
        rating: 5
      }
    ],
    clean: [
      {
        name: 'Amanda R.',
        role: 'Busy Professional',
        content: `I was skeptical about hiring a cleaning service until I read their ${type}. Now I know exactly what questions to ask and what to expect!`,
        avatar: '👩',
        rating: 5
      },
      {
        name: 'David K.',
        role: 'Homeowner',
        content: `The checklist helped me understand the difference between deep cleaning and regular cleaning. ${name} really knows their stuff.`,
        avatar: '👨',
        rating: 5
      },
      {
        name: 'Lisa M.',
        role: 'Rental Property Owner',
        content: `Managing rentals means I need reliable cleaners. This guide helped me set clear expectations and find the right service for my properties.`,
        avatar: '👩‍🦰',
        rating: 5
      }
    ],
    default: [
      {
        name: 'Jennifer M.',
        role: 'Local Resident',
        content: `I was worried about finding a trustworthy ${niche} provider, but this free ${type} put my mind at ease. It's clear that ${name} knows exactly what they are doing.`,
        avatar: '👩',
        rating: 5
      },
      {
        name: 'Michael T.',
        role: 'Homeowner',
        content: `This is exactly the information I was looking for. Most companies hide their pricing or process, but ${name} was transparent from the start.`,
        avatar: '👨',
        rating: 5
      },
      {
        name: 'Sarah L.',
        role: 'Client',
        content: `Super helpful resource! I used the ${type} to evaluate my options and it saved me so much time. Highly recommend giving them a call.`,
        avatar: '👩‍🦰',
        rating: 5
      }
    ]
  };

  // Match niche to testimonial set
  if (niche.includes('landscape') || niche.includes('lawn') || niche.includes('garden')) {
    return nicheTestimonials.landscape;
  }
  if (niche.includes('clean') || niche.includes('maid') || niche.includes('janitorial')) {
    return nicheTestimonials.clean;
  }
  
  return nicheTestimonials.default;
}

function generateSmartFeatures(businessData) {
  const niche = businessData.niche || 'Service';
  const businessName = businessData.businessName || 'Our Team';
  
  return [
    {
      title: `Expert ${niche} Solutions`,
      description: `Get professional ${niche.toLowerCase()} advice tailored to your specific situation from ${businessName}.`,
      icon: '🧠'
    },
    {
      title: 'Save Time & Money',
      description: 'Our proven process helps you avoid costly mistakes and get the job done right the first time.',
      icon: '💰'
    },
    {
      title: 'Guaranteed Results',
      description: 'We stand behind our work with a satisfaction guarantee. Your peace of mind is our priority.',
      icon: '🛡️'
    }
  ];
}

function getThemeForNiche(niche) {
  const n = niche?.toLowerCase() || '';
  
  // Real Estate / Law / Corporate (Navy & Gold/Slate)
  if (n.includes('estate') || n.includes('law') || n.includes('attorney') || n.includes('consult') || n.includes('agency')) {
    return {
      gradient: 'linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%)', // Blue-900 to Blue-800
      colors: {
        primary: '#1e40af', // Blue-800
        secondary: '#172554', // Blue-950
        textDark: '#172554',
        borderColor: '#dbeafe'
      }
    };
  }

  // Green: Landscaping, Gardening, Nature, Money/Finance
  if (n.includes('landscape') || n.includes('garden') || n.includes('lawn') || n.includes('tree') || n.includes('finance') || n.includes('money')) {
    return {
      gradient: 'linear-gradient(135deg, #064e3b 0%, #059669 100%)', // Green-900 to Green-600
      colors: {
        primary: '#059669', // Green-600
        secondary: '#064e3b', // Green-900
        textDark: '#064e3b',
        borderColor: '#d1fae5'
      }
    };
  }
  
  // Cyan/Teal: Cleaning, Pool, Medical, Dental
  if (n.includes('clean') || n.includes('wash') || n.includes('maid') || n.includes('pool') || n.includes('dental') || n.includes('med') || n.includes('doctor')) {
    return {
      gradient: 'linear-gradient(135deg, #0e7490 0%, #06b6d4 100%)', // Cyan-700 to Cyan-500
      colors: {
        primary: '#0891b2', // Cyan-600
        secondary: '#155e75', // Cyan-800
        textDark: '#164e63',
        borderColor: '#cffafe'
      }
    };
  }
  
  // Red/Orange: Fitness, Gym, Emergency, Fire, Security
  if (n.includes('fitness') || n.includes('gym') || n.includes('train') || n.includes('sport') || n.includes('fire') || n.includes('security')) {
    return {
      gradient: 'linear-gradient(135deg, #991b1b 0%, #dc2626 100%)', // Red-800 to Red-600
      colors: {
        primary: '#dc2626', // Red-600
        secondary: '#991b1b', // Red-800
        textDark: '#7f1d1d',
        borderColor: '#fee2e2'
      }
    };
  }

  // Purple/Pink: Beauty, Salon, Spa, Creative, Yoga
  if (n.includes('beauty') || n.includes('salon') || n.includes('spa') || n.includes('hair') || n.includes('makeup') || n.includes('design') || n.includes('yoga')) {
    return {
      gradient: 'linear-gradient(135deg, #701a75 0%, #c026d3 100%)', // Fuchsia-800 to Fuchsia-600
      colors: {
        primary: '#c026d3', // Fuchsia-600
        secondary: '#701a75', // Fuchsia-800
        textDark: '#701a75',
        borderColor: '#fae8ff'
      }
    };
  }

  // Warm/Construction: Construction, Wood, Carpenter, Handyman, Roofing (Amber/Orange)
  if (n.includes('construct') || n.includes('build') || n.includes('wood') || n.includes('carpenter') || n.includes('roof') || n.includes('handy') || n.includes('renovat')) {
    return {
      gradient: 'linear-gradient(135deg, #7c2d12 0%, #ea580c 100%)', // Orange-900 to Orange-600
      colors: {
        primary: '#ea580c', // Orange-600
        secondary: '#7c2d12', // Orange-900
        textDark: '#7c2d12',
        borderColor: '#ffedd5'
      }
    };
  }

  // Default Professional Blue (Plumbing, HVAC, Electrician, Legal, etc.)
  return {
    gradient: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)', // Slate-900 to Blue-900
    colors: {
      primary: '#2563eb', // Blue-600
      secondary: '#1e40af', // Blue-800
      textDark: '#1e293b',
      borderColor: '#e2e8f0'
    }
  };
}

export async function generateMetadata({ params }) {
  const { businessId } = await params;
  
  // Default metadata
  let meta = {
    title: 'Local Business Expert Guide',
    description: 'Download our free expert guide and solve your problems today.',
  };

  try {
    const cookieStore = await cookies();
    const supabase = createServerComponentClient({ cookies: () => cookieStore });
    
    // Look up by ID for preview pages (supports both 'ready' and 'prospect' status)
    const { data: business } = await supabase
      .from('businesses')
      .select('business_data')
      .eq('id', businessId)
      .in('status', ['ready', 'prospect'])
      .single();

    if (business?.business_data) {
      const bd = business.business_data;
      const lm = bd.leadMagnet;
      
      meta.title = lm?.landing_page?.hero_headline || `${bd.businessName || 'Expert'} - Free Guide`;
      meta.description = lm?.landing_page?.hero_subheadline || `Get professional ${bd.niche || 'service'} advice. Download our free guide now.`;
      
      // Open Graph images would go here if we had them
    }
  } catch (e) {
    console.error('Metadata error:', e);
  }

  return {
    title: meta.title,
    description: meta.description,
    openGraph: {
      title: meta.title,
      description: meta.description,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: meta.title,
      description: meta.description,
    }
  };
}

export default async function DynamicWebsite({ params }) {
  // Await params to fix Next.js 15 requirement
  const { businessId: paramBusinessId } = await params;
  
  let businessData = null;
  let businessId = null;
  let business = null;
  let isProspect = false;
  
  try {
    // Try to get data from Supabase first - lookup by ID for preview pages
    const cookieStore = await cookies();
    const supabase = createServerComponentClient({ cookies: () => cookieStore });
    
    // Support both 'ready' and 'prospect' status for preview pages
    const { data: businessRecord, error } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', paramBusinessId)
      .in('status', ['ready', 'prospect'])
      .single();

    if (businessRecord && !error) {
      business = businessRecord;
      businessData = businessRecord.business_data;
      businessId = businessRecord.id;
      isProspect = businessRecord.status === 'prospect';
      console.log('✅ Loaded from database:', businessId, isProspect ? '(prospect)' : '');
      
      // Initialize experiments if not exists (only for non-prospect)
      if (!isProspect && !businessData.experiments) {
        businessData.experiments = createDefaultExperiments();
        // Update business with default experiments
        await supabase
          .from('businesses')
          .update({ 
            business_data: businessData,
            updated_at: new Date().toISOString()
          })
          .eq('id', businessId);
      }
      // Note: Visitor tracking is handled client-side via VisitorTracker to avoid SSR reference issues
    } else {
      console.log('📦 Business not found for ID:', paramBusinessId);
    }
  } catch (err) {
    console.log('⚠️  Database error:', err.message);
  }
  
  // No mock data fallback for preview pages - they need a real business
  if (!businessData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white p-8 rounded-lg shadow-lg text-center max-w-md">
          <h1 className="text-2xl font-bold text-gray-800 mb-4">🔍 Preview Not Found</h1>
          <p className="text-gray-600 mb-4">This preview link may have expired or doesn&apos;t exist.</p>
          <div className="text-sm text-gray-500 space-y-1">
            <p>Preview links expire after 14 days.</p>
            <p className="mt-4">
              <a href="/" className="text-blue-600 hover:underline">
                Return to Homepage →
              </a>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Get visitor tracking data
  const cookieStore = await cookies();
  const visitorId = await getVisitorId(cookieStore);
  
  // Create segments based on available headers
  // Note: In production, you'd get these from the actual request headers
  const segments = {
    device: 'desktop',
    timeOfDay: new Date().getHours() < 12 ? 'morning' : 'afternoon',
    trafficSource: 'direct',
    returning: false
  };
  
  // Get active experiments and assign variants
  let heroVariant = null;
  if (businessId) {
    const experiments = await getActiveExperiments(businessId, 'Hero');
    if (experiments.length > 0) {
      const assignment = assignVariant(visitorId, experiments);
      if (assignment) {
        heroVariant = assignment;
        // Record impression
        await recordImpression({
          businessId,
          visitorId,
          experimentId: assignment.experimentId,
          variantId: assignment.variantId,
          component: 'Hero',
          segments
        });
      }
    }
  }
  
  const theme = businessData.theme || {};
  let layout = businessData.layout || [];

  // Special layout for Lead Magnet Funnels
  if (businessData.leadMagnet) {
    const lm = businessData.leadMagnet;
    const pdfContent = businessData.lead_magnet_pdf || {};
    const conversionOffer = businessData.conversion_offer || {};
    
    // Resolve the niche from multiple sources
    const resolvedNiche = businessData.niche || business?.form_data?.niche || business?.form_data?.leadMagnetTopic || 'service';
    
    // Enhanced business type detection (emergency, visual, event, coaching, retail, local_service)
    const businessType = businessData.businessType || (() => {
      const combinedText = `${resolvedNiche || ''} ${JSON.stringify(lm) || ''}`.toLowerCase();
      
      // EMERGENCY detection (plumber, electrician, locksmith, towing, etc.)
      const emergencyKeywords = ['plumber', 'plumbing', 'electrician', 'electrical', 'locksmith', 
        'towing', 'emergency', '24/7', '24 hour', 'urgent', 'hvac', 'heating', 'cooling', 
        'ac repair', 'water damage', 'flood', 'leak', 'burst pipe', 'power outage', 'roofing',
        'roofer', 'storm damage', 'fire damage', 'restoration', 'appliance repair'];
      if (emergencyKeywords.some(k => combinedText.includes(k))) return 'emergency';
      
      // VISUAL detection (salon, spa, design, photography, etc.)
      const visualKeywords = ['salon', 'spa', 'beauty', 'hair', 'nail', 'makeup', 'tattoo',
        'photographer', 'photography', 'videographer', 'interior design', 'graphic design',
        'web design', 'florist', 'wedding', 'event planner', 'decorator', 'aesthetician',
        'lash', 'brow', 'skincare', 'facial', 'massage', 'wellness'];
      if (visualKeywords.some(k => combinedText.includes(k))) return 'visual';
      
      // EVENT detection (highest priority)
      const eventKeywords = ['event', 'workshop', 'webinar', 'seminar', 'conference', 'summit',
        'master class', 'masterclass', 'bootcamp', 'retreat', 'session', 'ticket', 'registration',
        'register', 'reserve', 'limited seats', 'pax', 'per person', 'jan ', 'feb ', 'mar ',
        'apr ', 'may ', 'jun ', 'jul ', 'aug ', 'sep ', 'oct ', 'nov ', 'dec ', '2025', '2026',
        'zumba', 'yoga class', 'dance class', 'fitness class', 'jam session'];
      const eventPatterns = [/\d{1,2}\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i, /rm\s*\d+/i];
      const hasEventKeyword = eventKeywords.some(k => combinedText.includes(k));
      const hasEventPattern = eventPatterns.some(p => p.test(combinedText));
      if (hasEventKeyword && hasEventPattern) return 'event';
      
      // COACHING detection
      const coachingKeywords = ['coach', 'consultant', 'mentor', 'trainer', 'advisor', 'expert', 
        'strategist', 'therapist', 'counselor', 'speaker', 'author', 'creator', 'life coach',
        'business coach', 'executive coach', 'career coach', 'health coach'];
      if (coachingKeywords.some(k => combinedText.includes(k))) return 'coaching';
      
      // RETAIL detection (restaurant, cafe, shop, store, etc.)
      const retailKeywords = ['restaurant', 'cafe', 'coffee', 'bakery', 'pizzeria', 'bar', 'pub',
        'shop', 'store', 'retail', 'boutique', 'grocery', 'market', 'food truck', 'catering',
        'menu', 'dine', 'takeout', 'delivery', 'reservation'];
      if (retailKeywords.some(k => combinedText.includes(k))) return 'retail';
      
      return 'local_service';
    })();
    
    const isEmergency = businessType === 'emergency';
    const isVisual = businessType === 'visual';
    const isCoaching = businessType === 'coaching';
    const isEvent = businessType === 'event';
    const isRetail = businessType === 'retail';
    
    // Ensure benefits is an array
    const benefits = Array.isArray(lm.landing_page?.benefits) ? lm.landing_page.benefits : [];
    
    const features = benefits.length > 0 
      ? benefits.map(b => ({
          title: b,
          description: isEvent
            ? 'Experience this firsthand at the event.'
            : isCoaching 
              ? 'Proven strategies used by successful clients to achieve breakthrough results.'
              : 'Practical steps you can implement immediately to see results.',
          icon: '✅'
        }))
      : generateSmartFeatures({ ...businessData, niche: resolvedNiche });

    // Professional Service Theme Defaults (Dynamic based on Niche and Type)
    const nicheTheme = isEmergency
      ? { 
          gradient: 'linear-gradient(135deg, rgba(185, 28, 28, 0.95) 0%, rgba(220, 38, 38, 0.9) 100%)',
          colors: { primary: '#dc2626', secondary: '#b91c1c', accent: '#ef4444' }
        }
      : isVisual
        ? { 
            gradient: 'linear-gradient(135deg, rgba(124, 58, 237, 0.95) 0%, rgba(219, 39, 119, 0.9) 100%)',
            colors: { primary: '#8b5cf6', secondary: '#db2777', accent: '#ec4899' }
          }
        : isEvent
          ? { 
              gradient: 'linear-gradient(135deg, rgba(239, 68, 68, 0.95) 0%, rgba(245, 158, 11, 0.9) 100%)',
              colors: { primary: '#ef4444', secondary: '#f59e0b', accent: '#fbbf24' }
            }
          : isCoaching 
            ? { 
                gradient: 'linear-gradient(135deg, rgba(124, 58, 237, 0.95) 0%, rgba(168, 85, 247, 0.9) 100%)',
                colors: { primary: '#7c3aed', secondary: '#a855f7', accent: '#c084fc' }
              }
            : isRetail
              ? { 
                  gradient: 'linear-gradient(135deg, rgba(234, 88, 12, 0.95) 0%, rgba(249, 115, 22, 0.9) 100%)',
                  colors: { primary: '#ea580c', secondary: '#f97316', accent: '#fb923c' }
                }
              : getThemeForNiche(resolvedNiche);
    if (!theme.gradient || theme.gradient.includes('#667eea')) {
      theme.gradient = nicheTheme.gradient;
      theme.colors = {
        ...theme.colors,
        ...nicheTheme.colors
      };
    }

    // Get the business name from multiple sources
    const resolvedBusinessName = businessData.businessName || business?.name || lm.business_name || businessData.lead_magnet_title || (isEvent ? 'Event Host' : isCoaching ? 'Expert Coach' : 'Local Business');

    // Construct the High-Value Layout (different for each archetype)
    layout = [
      {
        component: 'NavBar',
        props: {
          businessName: resolvedBusinessName,
          links: isEmergency
            ? [
                { label: 'Services', href: '#services' },
                { label: 'Why Us', href: '#trust' },
                { label: 'Call Now', href: `tel:${business?.phone_number || businessData?.phone || ''}` }
              ]
            : isVisual
              ? [
                  { label: 'Services', href: '#services' },
                  { label: 'Gallery', href: '#gallery' },
                  { label: 'Book Now', href: '#book' }
                ]
              : isEvent
                ? [
                    { label: 'Event', href: '#hero' },
                    { label: 'Details', href: '#event-details' },
                    { label: 'Register', href: '#register' }
                  ]
                : isCoaching 
                  ? [
                      { label: 'Blueprint', href: '#hero' },
                      { label: 'Framework', href: '#framework' },
                      { label: 'About', href: '#about' }
                    ]
                  : isRetail
                    ? [
                        { label: 'Menu', href: '#menu' },
                        { label: 'About', href: '#about' },
                        { label: 'Contact', href: '#contact' }
                      ]
                    : [
                        { label: 'Guide', href: '#hero' },
                        { label: 'Common Mistakes', href: '#problems' },
                        { label: 'About', href: '#about' }
                      ],
          ctaText: isEmergency ? '📞 Call Now' : isVisual ? 'Book Appointment' : isEvent ? 'Register Now' : isCoaching ? 'Get Blueprint' : isRetail ? 'View Menu' : 'Get Guide',
          ctaLink: isEmergency ? `tel:${business?.phone_number || businessData?.phone || ''}` : '#hero'
        }
      },
      {
        component: 'Hero',
        props: {
          title: lm.landing_page?.hero_headline || (isEmergency
            ? `🚨 ${resolvedNiche || 'Emergency'} Service – Fast Response`
            : isVisual
              ? `✨ Transform Your Look with ${resolvedBusinessName}`
              : isEvent
                ? `${lm.event_name || resolvedNiche || 'Join Our Event'}`
                : isCoaching 
                  ? `Transform Your ${resolvedNiche || 'Results'} Today`
                  : isRetail
                    ? `Welcome to ${resolvedBusinessName}`
                    : `Get Your Free ${resolvedNiche || 'Expert'} Guide`),
          subtitle: lm.landing_page?.hero_subheadline || (isEmergency
            ? `Available 24/7 • ${businessData.responseTime || '30 min'} response time • Licensed & Insured`
            : isVisual
              ? `Experience premium ${resolvedNiche?.toLowerCase() || 'beauty'} services tailored just for you.`
              : isEvent
                ? `📅 ${lm.event_date || lm.landing_page?.event_date || 'Coming Soon'} | ⏰ ${lm.event_time || lm.landing_page?.event_time || ''} | 📍 ${lm.venue || lm.landing_page?.venue || ''}`
                : isCoaching
                  ? `Discover the proven framework that has helped hundreds achieve breakthrough ${resolvedNiche ? resolvedNiche.toLowerCase() : 'results'}.`
                  : isRetail
                    ? `${businessData.tagline || 'Delicious food, great atmosphere, unforgettable experience.'}`
                    : `Learn exactly how to solve your ${resolvedNiche ? resolvedNiche.toLowerCase() : 'business'} problems today with our step-by-step blueprint.`),
          ctaText: lm.landing_page?.cta_text || (isEmergency 
            ? `📞 Call Now – ${business?.phone_number || businessData?.phone || 'Get Help'}`
            : isVisual
              ? 'Book Your Appointment'
              : isEvent 
                ? `Reserve My Spot – ${lm.landing_page?.pricing?.individual || conversionOffer.headline || 'Register Now'}`
                : isCoaching ? 'Get My Free Blueprint' : isRetail ? 'See Our Menu' : 'Download Free Guide'),
          showEmailCapture: !isEmergency && !isRetail,
          businessId: businessId,
          // WhatsApp integration (for events and local service)
          whatsappNumber: isCoaching ? null : (business?.phone_number || businessData?.phone || businessData?.whatsapp),
          whatsappMessage: isEmergency
            ? `Hi! I need urgent ${resolvedNiche || 'help'}. Can you send someone right away?`
            : isEvent
              ? `Hi! I'd like to register for ${lm.event_name || 'the event'} on ${lm.event_date || 'the upcoming date'}. Please let me know the next steps!`
              : isCoaching 
                ? null
                : (businessData?.whatsapp_message || `Hi! I just downloaded your ${lm.lead_magnet?.title || 'guide'} and I'd like to schedule a free inspection. When is your earliest availability?`),
          // Urgency/scarcity
          urgencyText: isEmergency
            ? '🚨 Available 24/7 – Call Now for Immediate Help'
            : isEvent
              ? `🔥 Limited Spots – ${lm.event_date || 'Register Now!'}`
              : isCoaching 
                ? (conversionOffer.headline || 'Limited spots available for strategy calls')
                : (conversionOffer.headline || (businessData?.lead_magnet_pdf?.coupon_expiry ? `Offer expires: ${businessData?.lead_magnet_pdf?.coupon_expiry}` : null)),
          limitedSlots: isEvent ? 20 : (isCoaching || isEmergency ? null : 5),
          couponCode: isCoaching || isEvent || isEmergency ? null : (conversionOffer.offer_code || businessData?.lead_magnet_pdf?.coupon_code),
          // Trust badges
          trustBadges: isEmergency
            ? (lm.landing_page?.trust_badges || ['Licensed & Insured', '24/7 Emergency', '30-Min Response', 'Satisfaction Guaranteed'])
            : isVisual
              ? (lm.landing_page?.trust_badges || ['5-Star Rated', 'Expert Stylists', 'Premium Products'])
              : isEvent 
                ? (lm.landing_page?.trust_badges || ['Professional Instructor', 'Limited Spots', 'All Levels Welcome'])
                : isCoaching 
                  ? (lm.landing_page?.trust_badges || ['Trusted by 500+ clients', 'Proven framework', 'Results guaranteed']) 
                  : null,
          // Event-specific pricing display
          eventPricing: isEvent ? lm.landing_page?.pricing : null,
          // Dynamic background overlay based on niche theme
          backgroundOverlay: theme.gradient || 'linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 58, 138, 0.9) 100%)'
        }
      }
    ];

    // EMERGENCY ARCHETYPE: Add Trust Badges and Sticky Call
    if (isEmergency) {
      layout.push({
        component: 'TrustBadges',
        props: {
          badges: businessData.trustBadges || [
            { icon: '🛡️', label: 'Licensed & Insured' },
            { icon: '⚡', label: '30-Min Response' },
            { icon: '✅', label: 'Background Checked' },
            { icon: '💯', label: 'Satisfaction Guaranteed' }
          ],
          variant: 'emergency',
          showRating: true,
          rating: businessData.rating || 4.9,
          reviewCount: businessData.reviewCount || 150,
          id: 'trust'
        }
      });
    }

    // VISUAL ARCHETYPE: Add Image Gallery
    if (isVisual && (businessData.galleryImages || businessData.portfolioImages)) {
      layout.push({
        component: 'ImageGallery',
        props: {
          title: 'Our Work',
          subtitle: 'See the transformations',
          images: businessData.galleryImages || businessData.portfolioImages || [],
          variant: 'masonry',
          columns: 3,
          id: 'gallery'
        }
      });
    }

    // VISUAL ARCHETYPE: Add Pricing Menu
    if (isVisual && businessData.services) {
      layout.push({
        component: 'PricingMenu',
        props: {
          title: 'Our Services',
          items: businessData.services || [],
          variant: 'elegant',
          currency: businessData.currency || 'RM',
          showBookButton: true,
          id: 'services'
        }
      });
    }

    // RETAIL ARCHETYPE: Add Menu/Pricing
    if (isRetail && (businessData.menuItems || businessData.products)) {
      layout.push({
        component: 'PricingMenu',
        props: {
          title: businessData.menuTitle || 'Our Menu',
          subtitle: businessData.menuSubtitle || 'Fresh ingredients, amazing flavors',
          items: businessData.menuItems || businessData.products || [],
          variant: 'card',
          currency: businessData.currency || 'RM',
          showBookButton: false,
          id: 'menu'
        }
      });
    }

    // EVENT ARCHETYPE: Add Countdown Timer
    if (isEvent && lm.event_date) {
      layout.push({
        component: 'CountdownTimer',
        props: {
          targetDate: lm.event_date,
          title: '⏰ Event Starts In',
          subtitle: 'Don\'t miss out!',
          variant: 'urgent'
        }
      });
    }

    // For EVENT: Add Event Details Section
    if (isEvent) {
      // What to Expect section
      const whatToExpect = pdfContent.what_to_expect || lm.landing_page?.benefits?.map(b => ({ title: b, description: '' })) || [];
      if (whatToExpect.length > 0) {
        layout.push({
          component: 'FeatureGrid',
          props: {
            title: 'What You Will Experience',
            subtitle: 'Join us for an unforgettable session',
            features: whatToExpect.slice(0, 5).map((item, i) => ({
              title: item.title,
              description: item.description || '',
              icon: ['🎉', '💪', '🎯', '✨', '🏆'][i] || '🎯'
            })),
            id: 'event-details'
          }
        });
      }
      
      // Instructor/Speaker Bio section
      if (pdfContent.instructor_bio || lm.landing_page?.instructor_bio) {
        layout.push({
          component: 'AboutCoach',
          props: {
            title: `Meet Your Instructor: ${lm.landing_page?.instructor_name || 'Guest Instructor'}`,
            bio: pdfContent.instructor_bio || lm.landing_page?.instructor_bio,
            imageUrl: businessData.instructorImageUrl,
            businessName: lm.landing_page?.instructor_name || 'Featured Instructor',
            id: 'instructor'
          }
        });
      }
    }

    // For EMERGENCY: Add Service Features
    if (isEmergency) {
      layout.push({
        component: 'FeatureGrid',
        props: {
          title: 'Why Choose Us',
          subtitle: 'Fast, reliable, and professional service',
          features: [
            {
              title: 'Rapid Response',
              description: 'Our team arrives within 30 minutes of your call, ready to solve your problem.',
              icon: '⚡'
            },
            {
              title: 'Licensed Professionals',
              description: 'All technicians are fully licensed, insured, and background-checked.',
              icon: '🛡️'
            },
            {
              title: 'Upfront Pricing',
              description: 'No hidden fees. Get a clear quote before any work begins.',
              icon: '💰'
            },
            {
              title: 'Guaranteed Work',
              description: 'Not satisfied? We\'ll make it right or your money back.',
              icon: '✅'
            }
          ],
          id: 'services'
        }
      });
    }

    // For Coaching: Add Framework Section
    else if (isCoaching && pdfContent.framework_steps && pdfContent.framework_steps.length > 0) {
      layout.push({
        component: 'FeatureGrid',
        props: {
          title: pdfContent.framework_name || 'The Transformation Framework',
          subtitle: 'The proven process that gets results',
          features: pdfContent.framework_steps.slice(0, 5).map((step, i) => ({
            title: `Step ${step.step || i + 1}: ${step.title}`,
            description: step.description,
            icon: ['🎯', '📋', '🚀', '⚡', '🏆'][i] || '✨'
          })),
          id: 'framework'
        }
      });
    }
    
    // For Coaching: Show common struggles instead of mistakes
    if (isCoaching && pdfContent.common_struggles && pdfContent.common_struggles.length > 0) {
      layout.push({
        component: 'FeatureGrid',
        props: {
          title: 'Sound Familiar?',
          subtitle: 'These are the challenges my clients overcome',
          features: pdfContent.common_struggles.slice(0, 3).map(s => ({
            title: s.title,
            description: s.description,
            icon: '😔'
          })),
          id: 'struggles'
        }
      });
    }
    // 1. Problem Agitation Section (Common Mistakes) - For Local Service ONLY (not events, emergency, visual, retail)
    else if (!isCoaching && !isEvent && !isEmergency && !isVisual && !isRetail && pdfContent.common_mistakes && pdfContent.common_mistakes.length > 0) {
      layout.push({
        component: 'FeatureGrid',
        props: {
          title: 'Are You Making These Costly Mistakes?',
          subtitle: `Most ${resolvedNiche || 'homeowners'} ignore these signs until it's too late.`,
          features: pdfContent.common_mistakes.slice(0, 3).map(m => ({
            title: m.title,
            description: m.description,
            icon: '⚠️'
          })),
          id: 'problems'
        }
      });
    }

    // 2. Value/Solution Section (Quick Tips from full PDF, or Preview Tips from prospect phase)
    // Skip this for Events, Emergency, Visual (they have their own sections above)
    const previewTips = lm.lead_magnet?.preview_tips || [];
    
    if (!isEvent && !isEmergency && !isVisual && !isRetail && pdfContent.quick_tips && pdfContent.quick_tips.length > 0) {
      // Full PDF content available (post-purchase)
      layout.push({
        component: 'FeatureGrid',
        props: {
          title: isCoaching ? 'Quick Wins You Can Implement Today' : 'What You Can Do Right Now',
          subtitle: isCoaching 
            ? 'Start seeing results immediately with these actionable strategies'
            : 'Immediate steps to protect your property and save money.',
          features: pdfContent.quick_tips.slice(0, 3).map(t => ({
            title: t.title,
            description: t.description,
            icon: '💡'
          })),
          id: 'tips'
        }
      });
    } else if (!isEvent && !isEmergency && !isVisual && !isRetail && previewTips.length > 0) {
      // Preview tips from prospect phase (pre-purchase) - shows real value!
      layout.push({
        component: 'FeatureGrid',
        props: {
          title: 'Sneak Peek: What\'s Inside Your Guide',
          subtitle: 'Here are just 3 of the valuable tips you\'ll get:',
          features: previewTips.map(tip => ({
            title: tip.title,
            description: tip.description,
            icon: '💡'
          })),
          id: 'tips'
        }
      });
    } else if (!isEvent && !isEmergency && !isVisual && !isRetail) {
      // Fallback to benefits if nothing else (not for events)
      layout.push({
        component: 'FeatureGrid',
        props: {
          title: isCoaching ? 'What You Will Discover' : 'What You Will Learn',
          subtitle: isCoaching ? 'Inside this expert blueprint' : 'Inside this free expert guide',
          features: features,
          id: 'what-you-learn'
        }
      });
    }

    // 3. Social Proof (Case Study + Testimonials)
    const testimonials = businessData.testimonials || generateSmartTestimonials({ ...businessData, niche: resolvedNiche, businessName: resolvedBusinessName });
    
    // Inject Case Study as a "Featured Success Story" if available (different format for events)
    if (pdfContent.case_study && !isEvent) {
      const caseStudy = isCoaching 
        ? {
            name: pdfContent.case_study.customer_name || 'Recent Client',
            role: 'Transformation Story',
            content: `Before: ${pdfContent.case_study.before || pdfContent.case_study.problem}\n\nAfter: ${pdfContent.case_study.after || pdfContent.case_study.result}`,
            avatar: '⭐',
            rating: 5
          }
        : {
            name: pdfContent.case_study.customer_name || 'Recent Client',
            role: pdfContent.case_study.location || 'Local Homeowner',
            content: `Problem: ${pdfContent.case_study.problem}\n\nSolution: ${pdfContent.case_study.solution}\n\nResult: ${pdfContent.case_study.result}`,
            avatar: '⭐',
            rating: 5
          };
      // Add to beginning of testimonials
      testimonials.unshift(caseStudy);
    }
    
    // For events: Add past attendee testimonials if available
    if (isEvent && pdfContent.testimonials && pdfContent.testimonials.length > 0) {
      pdfContent.testimonials.forEach(t => {
        testimonials.unshift({
          name: t.name,
          role: 'Past Attendee',
          content: t.quote,
          avatar: '🎉',
          rating: 5
        });
      });
    }
    
    // For coaching: Add client_results if available
    if (isCoaching && pdfContent.client_results && pdfContent.client_results.length > 0) {
      pdfContent.client_results.forEach(result => {
        testimonials.push({
          name: result.name,
          role: 'Client Success',
          content: `${result.before} → ${result.after}${result.quote ? `\n\n"${result.quote}"` : ''}`,
          avatar: '🌟',
          rating: 5
        });
      });
    }

    layout.push({
      component: 'TestimonialSlider',
      props: {
        title: isEmergency
          ? 'What Our Customers Say'
          : isVisual
            ? 'Client Transformations'
            : isEvent 
              ? 'What Past Attendees Say' 
              : isCoaching 
                ? 'Client Transformation Stories' 
                : isRetail
                  ? 'What Our Customers Say'
                  : 'Real Results from Local Neighbors',
        testimonials: testimonials
      }
    });

    // 4. About the Expert/Host (skip for events - already shown instructor above)
    if (!isEvent && !isEmergency) {
      layout.push({
        component: 'AboutCoach',
        props: {
          title: isCoaching ? 'Meet Your Guide' : isVisual ? 'About Us' : isRetail ? 'Our Story' : 'Meet Your Local Expert',
          bio: lm.landing_page?.about_coach || lm.landing_page?.about_business || pdfContent.authority_bio || (isCoaching 
            ? `${resolvedBusinessName} is a trusted ${resolvedNiche || 'expert'} who has helped hundreds of clients achieve transformational results.`
            : isVisual
              ? `${resolvedBusinessName} is your premier destination for ${resolvedNiche || 'beauty services'}. Our skilled team delivers exceptional results every time.`
              : isRetail
                ? `Welcome to ${resolvedBusinessName}! We take pride in serving our community with quality and passion.`
                : `Expert service provider specializing in ${resolvedNiche || 'serving our local community'}.`),
          imageUrl: businessData.avatarUrl,
          businessName: resolvedBusinessName,
          credentials: isCoaching ? (pdfContent.credentials || lm.landing_page?.trust_badges) : null,
          id: 'about'
        }
      });
    } else if (isEvent) {
      // For events: Add host info section
      layout.push({
        component: 'AboutCoach',
        props: {
          title: `Hosted by ${resolvedBusinessName}`,
          bio: lm.landing_page?.about_host || `${resolvedBusinessName} organizes exciting events and experiences for the community.`,
          imageUrl: businessData.avatarUrl,
          businessName: resolvedBusinessName,
          id: 'host'
        }
      });
    }

    // 5. Final CTA (different for each archetype)
    layout.push({
      component: 'CallToAction',
      props: {
        title: isEmergency
          ? '🚨 Need Help Now? Call Us Immediately!'
          : isVisual
            ? 'Ready for Your Transformation?'
            : isEvent
              ? `Secure Your Spot – ${lm.event_date || 'Register Now!'}`
              : isCoaching 
                ? (conversionOffer.headline || 'Ready to Transform Your Results?')
                : isRetail
                  ? 'Visit Us Today!'
                  : (conversionOffer.headline || `Ready to get your ${lm.lead_magnet?.title || 'Free Guide'}?`),
        subtitle: isEmergency
          ? `Our team is standing by 24/7. Fast response, fair pricing, guaranteed work.`
          : isVisual
            ? 'Book your appointment today and experience the difference.'
            : isEvent
              ? `${lm.landing_page?.pricing?.individual || conversionOffer.headline || 'Limited spots available'} | ${lm.landing_page?.pricing?.group || ''}`
              : isCoaching
                ? (conversionOffer.subheadline || 'Book a free strategy call to discover how we can work together to achieve your goals.')
                : isRetail
                  ? `${businessData.address || 'Find us at our location'} • ${businessData.hours || 'Open daily'}`
                  : (conversionOffer.subheadline || 'Get instant access to this expert resource and start solving your problem today.'),
        ctaText: isEmergency
          ? `📞 Call Now: ${business?.phone_number || businessData?.phone || 'Get Help'}`
          : isVisual
            ? 'Book Your Appointment'
            : isEvent
              ? (conversionOffer.cta_text || 'Reserve My Spot Now')
              : isCoaching 
                ? (conversionOffer.cta_text || 'Book My Free Strategy Call')
                : isRetail
                  ? 'Get Directions'
                  : (conversionOffer.cta_text || 'Download Now'),
        ctaLink: isEmergency 
          ? `tel:${business?.phone_number || businessData?.phone || ''}`
          : isVisual
            ? (businessData.bookingUrl || '#hero')
            : isEvent ? '#hero' : (isCoaching ? (businessData.calendarUrl || businessData.bookingUrl || '#hero') : isRetail ? (businessData.mapUrl || '#contact') : '#hero'),
        secondaryCtaText: isEmergency
          ? 'WhatsApp Us'
          : isVisual
            ? 'WhatsApp Us'
            : isEvent
              ? ((business?.phone_number || businessData?.phone) ? 'WhatsApp Us' : null)
              : isCoaching 
                ? 'Get the Blueprint First'
                : isRetail
                  ? 'View Menu'
                  : ((business?.phone_number || businessData?.phone) ? 'Call Us Now' : null),
        secondaryCtaLink: isEmergency || isVisual
          ? ((business?.phone_number || businessData?.phone) ? `https://wa.me/${(business?.phone_number || businessData?.phone).replace(/\D/g, '')}?text=${encodeURIComponent(`Hi! I need ${isEmergency ? 'urgent ' : ''}${resolvedNiche || 'help'}.`)}` : null)
          : isEvent
            ? ((business?.phone_number || businessData?.phone) ? `https://wa.me/${(business?.phone_number || businessData?.phone).replace(/\D/g, '')}?text=${encodeURIComponent(`Hi! I'd like to register for ${lm.event_name || 'the event'}`)}` : null)
            : isCoaching 
              ? '#hero'
              : isRetail
                ? '#menu'
                : ((business?.phone_number || businessData?.phone) ? `tel:${business?.phone_number || businessData?.phone}` : null),
        id: isEmergency ? 'contact' : 'register'
      }
    });

    // 6. Footer
    layout.push({
      component: 'Footer',
      props: {
        businessName: resolvedBusinessName,
        email: business?.form_data?.prospectEmail || businessData.email,
        phone: business?.form_data?.prospectPhone || businessData.phone,
        address: business?.form_data?.prospectAddress || businessData.address
      }
    });
  }
  // If no layout exists or layout is empty, create a fallback layout
  else if (!layout || layout.length === 0) {
    console.log('Creating fallback layout for:', subdomain);
    
    // Detect if this is an e-commerce business
    const isEcommerce = businessData.businessModel === 'ecommerce' || 
                       businessData.isEcommerce ||
                       (businessData.products && businessData.products.some(p => p.category || p.sku || p.variants));
    
    layout = [
      {
        component: 'NavBar',
        props: {
          businessName: businessData.businessName || businessData.name || 'Your Business',
          logo: businessData.logo || '🚀',
          links: isEcommerce ? 
            ['Home', 'Products', 'Categories', 'About', 'Contact'] :
            ['About', 'Services', 'Pricing', 'Contact'],
          ctaText: 'Get Started',
          isEcommerce: isEcommerce
        }
      },
      {
        component: 'Hero',
        props: {
          title: businessData.tagline || 'Transform Your Vision Into Reality',
          subtitle: `Welcome to ${businessData.businessName || businessData.name || 'Your Business'}`,
          ctaText: isEcommerce ? 'Shop Now' : 'Get Started Today'
        }
      },
      {
        component: 'FeatureGrid',
        props: {
          title: 'Why Choose Us',
          features: businessData.products?.slice(0, 3).map(product => ({
            icon: '⭐',
            title: product.name,
            description: product.description
          })) || [
            { icon: '⚡', title: 'Fast Results', description: 'Quick and efficient solutions' },
            { icon: '🎯', title: 'Targeted Approach', description: 'Customized for your needs' },
            { icon: '🚀', title: 'Growth Focused', description: 'Built for success' }
          ]
        }
      },
      {
        component: 'TestimonialSlider',
        props: {
          title: `What Our ${isEcommerce ? 'Customers' : 'Clients'} Say`,
          testimonials: businessData.testimonials || []
        }
      },
      ...(isEcommerce ? [{
        component: 'EcommerceProductGrid',
        props: {
          title: 'Featured Products',
          subtitle: 'Discover our amazing collection',
          products: businessData.products || [],
          categories: [...new Set((businessData.products || []).map(p => p.category).filter(Boolean))]
        }
      }] : [{
        component: 'PricingTable',
        props: {
          title: 'Choose Your Plan',
          plans: businessData.products?.map(product => ({
            name: product.name,
            price: product.price,
            description: product.description,
            features: product.features || ['Feature 1', 'Feature 2', 'Feature 3'],
            ctaText: 'Get Started',
            popular: false
          })) || []
        }
      }]),
      {
        component: 'CallToAction',
        props: {
          title: isEcommerce ? 'Start Shopping Today' : 'Ready to Get Started?',
          subtitle: isEcommerce ? 'Discover amazing products with fast shipping' : 'Join us today and transform your business',
          ctaText: isEcommerce ? 'Browse Products' : 'Start Now'
        }
      },
      {
        component: 'Footer',
        props: {
          businessName: businessData.businessName || businessData.name || 'Your Business',
          logo: businessData.logo || '🚀',
          description: businessData.tagline || 'Professional solutions for your success'
        }
      }
    ];
  }

  // Generate tracking configuration
  const trackingConfig = getTrackingConfig(
    visitorId, 
    businessId,
    heroVariant ? {
      experimentId: heroVariant.experimentId,
      variantId: heroVariant.variantId
    } : null
  );

  return (
    <CartProvider>
      <ThemedLayout theme={theme}>
        <div className="dynamic-website">
          {/* Prospect Preview Banner */}
          {isProspect && (
            <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white py-3 px-4 text-center sticky top-0 z-50 shadow-lg">
              <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4">
                <span className="font-medium">
                  🎁 This is a preview of your personalized lead capture funnel
                </span>
                <a 
                  href={`https://www.launchfly.ai/claim/${businessId}?utm_source=preview&utm_medium=banner`}
                  className="bg-white text-orange-600 px-4 py-1 rounded-full text-sm font-semibold hover:bg-orange-50 transition-colors"
                >
                  Claim This Funnel →
                </a>
              </div>
            </div>
          )}
          
          {/* Visitor tracking for analytics */}
          <VisitorTracker businessId={businessId} subdomain={business?.subdomain} />
          
          {/* Inject tracking script */}
          <TrackingScript config={trackingConfig} />
          
          {/* Performance monitoring */}
          <PerformanceMonitor businessId={businessId} enabled={!!businessId} />
          
          {/* Optimized image preloading for e-commerce products */}
          {businessData.products && businessData.products.length > 0 && (
            <ImagePreloader 
              products={businessData.products} 
              priority="high" 
              maxImages={6} 
            />
          )}
          
          {layout.map((section, index) => {
            // Use OptimizedHero for Hero components
            if (section.component === 'Hero' && heroVariant) {
              const personalizedProps = personalizeContent(
                { ...section.props, ...heroVariant.variant.props },
                segments,
                businessData
              );
              
              return (
                <OptimizedHero
                  key={index}
                  {...personalizedProps}
                  variant={heroVariant.variant}
                  segments={segments}
                />
              );
            }
            
            // Handle e-commerce product grids with lazy loading
            if (section.component === 'EcommerceProductGrid') {
              // Populate products from business data if not already set
              const props = { ...section.props };
              if (!props.products || props.products.length === 0) {
                props.products = businessData.products || [];
              }
              
              // Extract categories from products
              if (!props.categories || props.categories.length === 0) {
                const categories = [...new Set(
                  (props.products || [])
                    .map(p => p.category)
                    .filter(Boolean)
                )];
                props.categories = categories;
              }
              
              return (
                <LazySection key={index} rootMargin="50px">
                  <LaunchflyUI.EcommerceProductGrid
                    {...props}
                  />
                </LazySection>
              );
            }
            
            const Component = LaunchflyUI[section.component];
            if (!Component) {
              console.warn(`Component ${section.component} not found`);
              return null;
            }
            
            // Lazy load non-critical components (everything except Hero and NavBar)
            if (['Hero', 'NavBar'].includes(section.component)) {
              return <Component key={index} {...section.props} />;
            } else {
              return (
                <LazySection key={index} rootMargin="100px">
                  <Component {...section.props} />
                </LazySection>
              );
            }
          })}

          {/* Sticky Call Button (Mobile Only) - Speed to Lead */}
          {(business?.phone_number || businessData?.phone) && (
            businessData?.businessType === 'emergency' ? (
              <LaunchflyUI.StickyCallButton
                phone={business?.phone_number || businessData?.phone}
                text="Call Now"
                subtext="Available 24/7"
                variant="emergency"
              />
            ) : (
              <a 
                href={`tel:${business?.phone_number || businessData?.phone}`}
                className="fixed bottom-6 right-6 z-50 bg-green-500 hover:bg-green-600 text-white p-4 rounded-full shadow-xl flex items-center justify-center md:hidden transition-transform hover:scale-110"
                style={{ width: '64px', height: '64px' }}
                aria-label="Call Now"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                </svg>
              </a>
            )
          )}
        </div>
      </ThemedLayout>
    </CartProvider>
  );
}
