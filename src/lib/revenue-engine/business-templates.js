/**
 * 10 Working Business Templates with Real Revenue Models
 * Each template includes complete monetization strategy and proven tactics
 */

export const BUSINESS_TEMPLATES = {
  // 1. AI Content Agency
  'ai-content-agency': {
    id: 'ai-content-agency',
    name: 'AI Content Agency',
    icon: '✍️',
    description: 'Full-service content creation using AI for blogs, social media, and marketing',
    category: 'agency',
    demandLevel: 'high_demand',
    
    revenueModel: {
      productSales: 0,
      services: 3500,
      subscriptions: 2000,
      digital: 500,
      affiliate: 300,
      upsells: 800
    },
    
    products: [],
    
    services: [
      {
        name: 'Blog Content Package',
        description: '10 SEO-optimized blog posts per month',
        category: 'content',
        tiers: [
          {
            name: 'Starter',
            basePrice: 297,
            features: ['5 posts/month', '500 words each', 'Basic SEO'],
            deliveryTime: '48 hours',
            revisions: 1
          },
          {
            name: 'Professional',
            basePrice: 597,
            features: ['10 posts/month', '1000 words each', 'Advanced SEO', 'Images included'],
            deliveryTime: '24 hours',
            revisions: 2
          },
          {
            name: 'Enterprise',
            basePrice: 1497,
            features: ['25 posts/month', '1500+ words', 'Full SEO strategy', 'Custom graphics', 'Content calendar'],
            deliveryTime: '24 hours',
            revisions: 'unlimited'
          }
        ]
      },
      {
        name: 'Social Media Management',
        description: 'Complete social media content and posting',
        category: 'social',
        tiers: [
          {
            name: 'Basic',
            basePrice: 497,
            features: ['3 platforms', '20 posts/month', 'Basic graphics'],
            deliveryTime: 'ongoing',
            revisions: 1
          },
          {
            name: 'Growth',
            basePrice: 997,
            features: ['5 platforms', '40 posts/month', 'Custom graphics', 'Engagement management'],
            deliveryTime: 'ongoing',
            revisions: 2
          },
          {
            name: 'Scale',
            basePrice: 2497,
            features: ['Unlimited platforms', '100+ posts/month', 'Video content', 'Influencer outreach', 'Analytics reports'],
            deliveryTime: 'ongoing',
            revisions: 'unlimited'
          }
        ]
      }
    ],
    
    subscriptions: [
      {
        name: 'Content Unlimited',
        description: 'Unlimited content requests with 48hr turnaround',
        monthlyPrice: 997,
        interval: 'month',
        features: ['Unlimited requests', 'Blog posts', 'Social media', 'Email newsletters', '48hr delivery'],
        trialDays: 7
      }
    ],
    
    digitalProducts: [
      {
        name: 'AI Prompt Library',
        description: '500+ proven prompts for content creation',
        price: 47,
        category: 'templates',
        fileType: 'pdf',
        downloadLimit: 5
      },
      {
        name: 'Content Calendar Template',
        description: '12-month content planning system',
        price: 27,
        category: 'templates',
        fileType: 'xlsx',
        downloadLimit: 5
      }
    ],
    
    affiliatePrograms: [
      {
        name: 'Jasper AI',
        productName: 'Jasper AI Writing Assistant',
        commissionRate: 30,
        cookieDuration: 30,
        affiliateLink: 'https://jasper.ai'
      }
    ],
    
    orderBump: {
      name: 'Rush Delivery',
      description: 'Get your content in 12 hours',
      price: 97
    },
    
    oneTimeOffer: {
      name: 'Content Strategy Session',
      description: '1-hour strategy call to plan your content',
      price: 197
    },
    
    crossSells: [
      'SEO Optimization Package',
      'Email Marketing Templates',
      'Social Media Graphics Pack'
    ],
    
    marketingChannels: ['linkedin', 'facebook_groups', 'cold_email', 'content_marketing'],
    automationLevel: 'high',
    timeToFirstSale: 24
  },

  // 2. E-commerce Dropshipping Store
  'ecommerce-dropship': {
    id: 'ecommerce-dropship',
    name: 'Trending Products Dropship Store',
    icon: '🛍️',
    description: 'Automated dropshipping store selling trending products with high margins',
    category: 'ecommerce',
    demandLevel: 'proven',
    
    revenueModel: {
      productSales: 4000,
      services: 0,
      subscriptions: 500,
      digital: 200,
      affiliate: 400,
      upsells: 1200
    },
    
    products: [
      {
        name: 'Smart Posture Corrector',
        description: 'AI-powered posture correction device',
        basePrice: 39.99,
        category: 'health',
        features: ['Vibration alerts', 'App tracking', '8-hour battery'],
        imageUrl: '/products/posture-corrector.jpg'
      },
      {
        name: 'LED Strip Lights Kit',
        description: 'Color-changing LED lights with app control',
        basePrice: 29.99,
        category: 'home',
        features: ['16 million colors', 'Music sync', 'Voice control'],
        imageUrl: '/products/led-lights.jpg'
      },
      {
        name: 'Portable Blender',
        description: 'USB rechargeable personal blender',
        basePrice: 34.99,
        category: 'kitchen',
        features: ['6 blades', 'Wireless charging', 'Self-cleaning'],
        imageUrl: '/products/portable-blender.jpg'
      },
      {
        name: 'Pet GPS Tracker',
        description: 'Real-time GPS tracking for pets',
        basePrice: 49.99,
        category: 'pets',
        features: ['Waterproof', '30-day battery', 'Activity monitoring'],
        imageUrl: '/products/pet-tracker.jpg'
      }
    ],
    
    subscriptions: [
      {
        name: 'VIP Membership',
        description: 'Get 20% off all orders + free shipping',
        monthlyPrice: 9.99,
        interval: 'month',
        features: ['20% discount', 'Free shipping', 'Early access', 'Exclusive products'],
        trialDays: 0
      }
    ],
    
    digitalProducts: [
      {
        name: 'Dropshipping Success Guide',
        description: 'Complete guide to building a 6-figure store',
        price: 27,
        category: 'guides',
        fileType: 'pdf',
        downloadLimit: 3
      }
    ],
    
    affiliatePrograms: [
      {
        name: 'Amazon Associates',
        productName: 'Related products on Amazon',
        commissionRate: 4,
        cookieDuration: 24,
        affiliateLink: 'https://amazon.com'
      }
    ],
    
    orderBump: {
      name: 'Extended Warranty',
      description: '2-year protection plan',
      price: 9.99
    },
    
    oneTimeOffer: {
      name: 'Mystery Box Bundle',
      description: 'Get 3 surprise trending products (70% off)',
      price: 47
    },
    
    crossSells: [
      'Accessories Bundle',
      'Gift Wrapping Service',
      'Express Shipping'
    ],
    
    physicalProducts: true,
    marketingChannels: ['facebook_ads', 'instagram_ads', 'tiktok_organic', 'influencer'],
    automationLevel: 'high',
    timeToFirstSale: 36
  },

  // 3. Online Coaching Business
  'online-coaching': {
    id: 'online-coaching',
    name: 'Life & Business Coaching',
    icon: '🎯',
    description: 'High-ticket coaching program for entrepreneurs and professionals',
    category: 'coaching',
    demandLevel: 'high_demand',
    
    revenueModel: {
      productSales: 0,
      services: 5000,
      subscriptions: 3000,
      digital: 1000,
      affiliate: 200,
      upsells: 1500
    },
    
    services: [
      {
        name: '1-on-1 Coaching',
        description: 'Personal coaching sessions',
        category: 'coaching',
        tiers: [
          {
            name: 'Single Session',
            basePrice: 297,
            features: ['60 minutes', 'Action plan', 'Email support for 7 days'],
            deliveryTime: 'scheduled',
            revisions: 0
          },
          {
            name: '4-Week Intensive',
            basePrice: 1497,
            features: ['4 weekly calls', 'Custom roadmap', 'Daily Slack support', 'Resources library'],
            deliveryTime: 'scheduled',
            revisions: 'unlimited'
          },
          {
            name: '90-Day Transformation',
            basePrice: 4997,
            features: ['12 calls', 'Done-with-you implementation', 'Group mastermind access', 'Lifetime support'],
            deliveryTime: 'scheduled',
            revisions: 'unlimited'
          }
        ]
      }
    ],
    
    subscriptions: [
      {
        name: 'Coaching Membership',
        description: 'Monthly group coaching and resources',
        monthlyPrice: 497,
        interval: 'month',
        features: ['2 group calls/month', 'Course library', 'Community access', 'Monthly workshops'],
        trialDays: 3
      }
    ],
    
    digitalProducts: [
      {
        name: 'Success Blueprint Course',
        description: '6-week self-paced transformation program',
        price: 297,
        category: 'courses',
        fileType: 'video_course',
        downloadLimit: 'unlimited'
      },
      {
        name: 'Goal Setting Workbook',
        description: 'Complete system for achieving any goal',
        price: 47,
        category: 'workbooks',
        fileType: 'pdf',
        downloadLimit: 5
      }
    ],
    
    affiliatePrograms: [
      {
        name: 'ClickFunnels',
        productName: 'Sales funnel software',
        commissionRate: 40,
        cookieDuration: 45,
        affiliateLink: 'https://clickfunnels.com'
      }
    ],
    
    orderBump: {
      name: 'Accountability Partner Match',
      description: 'Get paired with another member for daily accountability',
      price: 97
    },
    
    oneTimeOffer: {
      name: 'VIP Fast Track',
      description: 'Skip the wait - start tomorrow with priority access',
      price: 497
    },
    
    crossSells: [
      'Advanced Masterclass Series',
      'Personal Brand Building Package',
      'Book Writing Blueprint'
    ],
    
    marketingChannels: ['webinars', 'linkedin', 'podcast_guesting', 'youtube'],
    automationLevel: 'medium',
    timeToFirstSale: 48
  },

  // 4. SaaS Tool Business
  'saas-tool': {
    id: 'saas-tool',
    name: 'Marketing Automation SaaS',
    icon: '🚀',
    description: 'AI-powered marketing automation tool for small businesses',
    category: 'software',
    demandLevel: 'proven',
    
    revenueModel: {
      productSales: 0,
      services: 1000,
      subscriptions: 6000,
      digital: 300,
      affiliate: 500,
      upsells: 800
    },
    
    subscriptions: [
      {
        name: 'Starter Plan',
        description: 'Essential marketing automation',
        monthlyPrice: 47,
        interval: 'month',
        features: ['1,000 contacts', '10,000 emails/month', 'Basic automation', 'Email support'],
        trialDays: 14
      },
      {
        name: 'Growth Plan',
        description: 'Advanced features for growing businesses',
        monthlyPrice: 97,
        interval: 'month',
        features: ['5,000 contacts', '50,000 emails/month', 'Advanced automation', 'A/B testing', 'Priority support'],
        trialDays: 14
      },
      {
        name: 'Scale Plan',
        description: 'Enterprise-grade marketing platform',
        monthlyPrice: 297,
        interval: 'month',
        features: ['Unlimited contacts', 'Unlimited emails', 'Custom workflows', 'API access', 'Dedicated support'],
        trialDays: 14
      }
    ],
    
    services: [
      {
        name: 'Done-For-You Setup',
        description: 'Complete platform setup and configuration',
        category: 'implementation',
        tiers: [
          {
            name: 'Basic Setup',
            basePrice: 497,
            features: ['Account setup', '3 automations', 'Email templates'],
            deliveryTime: '48 hours',
            revisions: 1
          },
          {
            name: 'Full Implementation',
            basePrice: 1497,
            features: ['Complete setup', '10 automations', 'Custom templates', 'Training session'],
            deliveryTime: '5 days',
            revisions: 2
          }
        ]
      }
    ],
    
    digitalProducts: [
      {
        name: 'Email Templates Pack',
        description: '100+ high-converting email templates',
        price: 67,
        category: 'templates',
        fileType: 'zip',
        downloadLimit: 3
      }
    ],
    
    affiliatePrograms: [
      {
        name: 'Zapier',
        productName: 'Automation connector',
        commissionRate: 25,
        cookieDuration: 30,
        affiliateLink: 'https://zapier.com'
      }
    ],
    
    orderBump: {
      name: 'SMS Credits',
      description: 'Add 1,000 SMS credits to your account',
      price: 47
    },
    
    oneTimeOffer: {
      name: 'Lifetime Deal',
      description: 'Pay once, use forever (limited time)',
      price: 997
    },
    
    crossSells: [
      'Advanced Training Course',
      'Custom Integration Service',
      'White Label Rights'
    ],
    
    marketingChannels: ['content_seo', 'product_hunt', 'appsumo', 'cold_outreach'],
    automationLevel: 'very_high',
    timeToFirstSale: 24
  },

  // 5. Digital Course Creator
  'course-creator': {
    id: 'course-creator',
    name: 'Online Course Academy',
    icon: '🎓',
    description: 'Create and sell online courses in any niche',
    category: 'education',
    demandLevel: 'high_demand',
    
    revenueModel: {
      productSales: 3000,
      services: 1500,
      subscriptions: 2000,
      digital: 2000,
      affiliate: 400,
      upsells: 1000
    },
    
    digitalProducts: [
      {
        name: 'Flagship Course',
        description: 'Complete transformation program',
        price: 497,
        category: 'courses',
        fileType: 'video_course',
        downloadLimit: 'unlimited'
      },
      {
        name: 'Mini Course',
        description: 'Quick-win focused training',
        price: 97,
        category: 'courses',
        fileType: 'video_course',
        downloadLimit: 'unlimited'
      },
      {
        name: 'Workshop Recording',
        description: 'Intensive workshop replay',
        price: 197,
        category: 'workshops',
        fileType: 'video',
        downloadLimit: 3
      }
    ],
    
    subscriptions: [
      {
        name: 'All-Access Pass',
        description: 'Access to all courses and future releases',
        monthlyPrice: 97,
        interval: 'month',
        features: ['All courses', 'New releases', 'Live Q&As', 'Community access'],
        trialDays: 7
      }
    ],
    
    services: [
      {
        name: 'Course Creation Service',
        description: 'Done-for-you course creation',
        category: 'production',
        tiers: [
          {
            name: 'Course Outline',
            basePrice: 297,
            features: ['Course structure', 'Module breakdown', 'Learning objectives'],
            deliveryTime: '3 days',
            revisions: 2
          },
          {
            name: 'Full Course Creation',
            basePrice: 2497,
            features: ['Complete course', 'Video scripts', 'Slides', 'Workbooks', 'Sales page'],
            deliveryTime: '14 days',
            revisions: 3
          }
        ]
      }
    ],
    
    affiliatePrograms: [
      {
        name: 'Teachable',
        productName: 'Course platform',
        commissionRate: 30,
        cookieDuration: 90,
        affiliateLink: 'https://teachable.com'
      }
    ],
    
    orderBump: {
      name: 'Certificate of Completion',
      description: 'Professional certificate for course graduates',
      price: 27
    },
    
    oneTimeOffer: {
      name: 'Implementation Bootcamp',
      description: '3-day intensive to implement everything',
      price: 297
    },
    
    crossSells: [
      'Advanced Modules',
      'Group Coaching Add-on',
      'Done-For-You Templates'
    ],
    
    marketingChannels: ['webinars', 'youtube', 'email_marketing', 'affiliates'],
    automationLevel: 'high',
    timeToFirstSale: 36
  },

  // 6. Freelance Services Marketplace
  'freelance-services': {
    id: 'freelance-services',
    name: 'Premium Freelance Services',
    icon: '💼',
    description: 'High-quality freelance services for businesses',
    category: 'services',
    demandLevel: 'proven',
    
    revenueModel: {
      productSales: 0,
      services: 4500,
      subscriptions: 1500,
      digital: 300,
      affiliate: 200,
      upsells: 700
    },
    
    services: [
      {
        name: 'Web Design & Development',
        description: 'Custom websites and web apps',
        category: 'development',
        tiers: [
          {
            name: 'Landing Page',
            basePrice: 497,
            features: ['Single page', 'Mobile responsive', 'Contact form'],
            deliveryTime: '3 days',
            revisions: 2
          },
          {
            name: 'Business Website',
            basePrice: 1997,
            features: ['5 pages', 'CMS', 'SEO optimized', 'Analytics'],
            deliveryTime: '7 days',
            revisions: 3
          },
          {
            name: 'E-commerce Store',
            basePrice: 3997,
            features: ['Full store', 'Payment integration', 'Inventory system', 'Training'],
            deliveryTime: '14 days',
            revisions: 5
          }
        ]
      },
      {
        name: 'Logo & Brand Design',
        description: 'Professional brand identity',
        category: 'design',
        tiers: [
          {
            name: 'Logo Only',
            basePrice: 297,
            features: ['3 concepts', '2 revisions', 'Vector files'],
            deliveryTime: '48 hours',
            revisions: 2
          },
          {
            name: 'Brand Package',
            basePrice: 997,
            features: ['Logo', 'Color palette', 'Typography', 'Brand guide'],
            deliveryTime: '5 days',
            revisions: 3
          }
        ]
      }
    ],
    
    subscriptions: [
      {
        name: 'Unlimited Design Requests',
        description: 'Unlimited design work for a flat monthly fee',
        monthlyPrice: 497,
        interval: 'month',
        features: ['Unlimited requests', '48hr turnaround', 'Unlimited revisions', 'Pause anytime'],
        trialDays: 3
      }
    ],
    
    digitalProducts: [
      {
        name: 'Freelance Proposal Templates',
        description: '20 winning proposal templates',
        price: 37,
        category: 'templates',
        fileType: 'docx',
        downloadLimit: 5
      }
    ],
    
    affiliatePrograms: [
      {
        name: 'Fiverr',
        productName: 'Freelance platform',
        commissionRate: 30,
        cookieDuration: 30,
        affiliateLink: 'https://fiverr.com'
      }
    ],
    
    orderBump: {
      name: 'Express Delivery',
      description: 'Get it 50% faster',
      price: 97
    },
    
    oneTimeOffer: {
      name: 'Source Files Package',
      description: 'Get all original design files',
      price: 197
    },
    
    crossSells: [
      'Maintenance Package',
      'Additional Revisions',
      'Priority Support'
    ],
    
    marketingChannels: ['fiverr', 'upwork', 'linkedin', 'portfolio_sites'],
    automationLevel: 'medium',
    timeToFirstSale: 24
  },

  // 7. Print on Demand Store
  'print-on-demand': {
    id: 'print-on-demand',
    name: 'Custom Print Store',
    icon: '👕',
    description: 'Sell custom printed products without inventory',
    category: 'ecommerce',
    demandLevel: 'proven',
    
    revenueModel: {
      productSales: 3500,
      services: 0,
      subscriptions: 300,
      digital: 200,
      affiliate: 300,
      upsells: 600
    },
    
    products: [
      {
        name: 'Custom T-Shirt',
        description: 'High-quality printed t-shirts',
        basePrice: 24.99,
        category: 'apparel',
        features: ['100% cotton', 'Fade-resistant print', 'Size S-3XL'],
        imageUrl: '/products/tshirt.jpg'
      },
      {
        name: 'Coffee Mug',
        description: 'Ceramic mug with custom design',
        basePrice: 14.99,
        category: 'drinkware',
        features: ['11oz/15oz', 'Dishwasher safe', 'Wraparound print'],
        imageUrl: '/products/mug.jpg'
      },
      {
        name: 'Phone Case',
        description: 'Protective case with custom art',
        basePrice: 19.99,
        category: 'accessories',
        features: ['All phone models', 'Durable material', 'Precise cutouts'],
        imageUrl: '/products/phone-case.jpg'
      },
      {
        name: 'Canvas Print',
        description: 'Gallery-wrapped canvas art',
        basePrice: 39.99,
        category: 'wall-art',
        features: ['Multiple sizes', 'Ready to hang', 'Fade-resistant'],
        imageUrl: '/products/canvas.jpg'
      }
    ],
    
    subscriptions: [
      {
        name: 'Design Club',
        description: 'New exclusive designs monthly',
        monthlyPrice: 9.99,
        interval: 'month',
        features: ['Exclusive designs', '20% discount', 'Early access', 'Free shipping'],
        trialDays: 0
      }
    ],
    
    digitalProducts: [
      {
        name: 'Design Templates Pack',
        description: '100+ ready-to-print designs',
        price: 47,
        category: 'designs',
        fileType: 'ai',
        downloadLimit: 5
      }
    ],
    
    affiliatePrograms: [
      {
        name: 'Printful',
        productName: 'Print fulfillment service',
        commissionRate: 10,
        cookieDuration: 30,
        affiliateLink: 'https://printful.com'
      }
    ],
    
    orderBump: {
      name: 'Gift Packaging',
      description: 'Beautiful gift wrap and personal message',
      price: 4.99
    },
    
    oneTimeOffer: {
      name: 'Bundle Deal',
      description: 'Get 3 items for the price of 2',
      price: 44.99
    },
    
    crossSells: [
      'Matching Accessories',
      'Size Upgrade',
      'Rush Production'
    ],
    
    physicalProducts: true,
    marketingChannels: ['instagram', 'pinterest', 'etsy', 'facebook_ads'],
    automationLevel: 'very_high',
    timeToFirstSale: 48
  },

  // 8. Membership Community
  'membership-community': {
    id: 'membership-community',
    name: 'Premium Membership Community',
    icon: '👥',
    description: 'Exclusive community with premium content and networking',
    category: 'community',
    demandLevel: 'high_demand',
    
    revenueModel: {
      productSales: 500,
      services: 1000,
      subscriptions: 5000,
      digital: 800,
      affiliate: 400,
      upsells: 600
    },
    
    subscriptions: [
      {
        name: 'Community Membership',
        description: 'Full access to community and resources',
        monthlyPrice: 47,
        interval: 'month',
        features: ['Community access', 'Weekly calls', 'Resource library', 'Member directory'],
        trialDays: 7
      },
      {
        name: 'VIP Membership',
        description: 'Premium tier with exclusive benefits',
        monthlyPrice: 197,
        interval: 'month',
        features: ['Everything in Community', 'Monthly 1-on-1', 'VIP events', 'Guest expert sessions'],
        trialDays: 3
      },
      {
        name: 'Annual Membership',
        description: 'Best value - save 2 months',
        monthlyPrice: 470,
        interval: 'year',
        features: ['All VIP features', '2 months free', 'Bonus course', 'Lifetime price lock'],
        trialDays: 0
      }
    ],
    
    services: [
      {
        name: 'Private Mastermind',
        description: 'Small group intensive mastermind',
        category: 'mastermind',
        tiers: [
          {
            name: '6-Month Mastermind',
            basePrice: 2997,
            features: ['8-person max', 'Bi-weekly calls', 'Hot seat sessions', 'Accountability pod'],
            deliveryTime: '6 months',
            revisions: 0
          }
        ]
      }
    ],
    
    digitalProducts: [
      {
        name: 'Community Building Blueprint',
        description: 'How to build a 6-figure community',
        price: 197,
        category: 'courses',
        fileType: 'video_course',
        downloadLimit: 'unlimited'
      }
    ],
    
    affiliatePrograms: [
      {
        name: 'Circle',
        productName: 'Community platform',
        commissionRate: 25,
        cookieDuration: 60,
        affiliateLink: 'https://circle.so'
      }
    ],
    
    orderBump: {
      name: 'Fast Track Onboarding',
      description: '1-on-1 onboarding call to maximize your membership',
      price: 97
    },
    
    oneTimeOffer: {
      name: 'Lifetime Access',
      description: 'Pay once, access forever (limited spots)',
      price: 1997
    },
    
    crossSells: [
      'Expert Workshop Series',
      'Community Manager Training',
      'White Label License'
    ],
    
    marketingChannels: ['referrals', 'content_marketing', 'partnerships', 'webinars'],
    automationLevel: 'medium',
    timeToFirstSale: 36
  },

  // 9. Affiliate Marketing Business
  'affiliate-marketing': {
    id: 'affiliate-marketing',
    name: 'Affiliate Marketing Empire',
    icon: '💰',
    description: 'Build passive income through strategic affiliate marketing',
    category: 'affiliate',
    demandLevel: 'proven',
    
    revenueModel: {
      productSales: 0,
      services: 500,
      subscriptions: 1000,
      digital: 1500,
      affiliate: 4000,
      upsells: 400
    },
    
    affiliatePrograms: [
      {
        name: 'ClickBank Top Products',
        productName: 'High-converting digital products',
        commissionRate: 50,
        cookieDuration: 60,
        affiliateLink: 'https://clickbank.com'
      },
      {
        name: 'Amazon Associates',
        productName: 'Physical products',
        commissionRate: 8,
        cookieDuration: 24,
        affiliateLink: 'https://amazon.com'
      },
      {
        name: 'Bluehost Hosting',
        productName: 'Web hosting service',
        commissionRate: 65,
        cookieDuration: 90,
        affiliateLink: 'https://bluehost.com'
      },
      {
        name: 'ConvertKit Email',
        productName: 'Email marketing platform',
        commissionRate: 30,
        cookieDuration: 60,
        affiliateLink: 'https://convertkit.com'
      },
      {
        name: 'Shopify E-commerce',
        productName: 'E-commerce platform',
        commissionRate: 58,
        cookieDuration: 30,
        affiliateLink: 'https://shopify.com'
      }
    ],
    
    digitalProducts: [
      {
        name: 'Affiliate Marketing Masterclass',
        description: 'Complete system to $10k/month',
        price: 297,
        category: 'courses',
        fileType: 'video_course',
        downloadLimit: 'unlimited'
      },
      {
        name: 'High-Converting Email Swipes',
        description: '50 proven email templates',
        price: 47,
        category: 'templates',
        fileType: 'docx',
        downloadLimit: 5
      },
      {
        name: 'Niche Research Spreadsheet',
        description: 'Find profitable niches fast',
        price: 27,
        category: 'tools',
        fileType: 'xlsx',
        downloadLimit: 3
      }
    ],
    
    subscriptions: [
      {
        name: 'Affiliate Insider Club',
        description: 'Latest strategies and exclusive deals',
        monthlyPrice: 97,
        interval: 'month',
        features: ['Weekly strategy calls', 'Exclusive affiliate deals', 'Done-for-you campaigns', 'Private Facebook group'],
        trialDays: 3
      }
    ],
    
    services: [
      {
        name: 'Done-For-You Affiliate Site',
        description: 'Complete affiliate website setup',
        category: 'setup',
        tiers: [
          {
            name: 'Basic Site',
            basePrice: 497,
            features: ['5-page site', '10 product reviews', 'SEO optimized'],
            deliveryTime: '7 days',
            revisions: 1
          }
        ]
      }
    ],
    
    orderBump: {
      name: 'Traffic Generation Pack',
      description: 'Get 1000 targeted visitors in 30 days',
      price: 97
    },
    
    oneTimeOffer: {
      name: 'Private Affiliate Network Access',
      description: 'Access to exclusive high-paying programs',
      price: 297
    },
    
    crossSells: [
      'Advanced SEO Training',
      'Paid Traffic Mastery',
      'Email List Building System'
    ],
    
    marketingChannels: ['seo', 'youtube', 'paid_ads', 'email_marketing'],
    automationLevel: 'very_high',
    timeToFirstSale: 48
  },

  // 10. AI-Powered Service Business
  'ai-service-business': {
    id: 'ai-service-business',
    name: 'AI Business Solutions',
    icon: '🤖',
    description: 'Provide AI-powered services to businesses',
    category: 'ai_service',
    demandLevel: 'high_demand',
    
    revenueModel: {
      productSales: 0,
      services: 4000,
      subscriptions: 3000,
      digital: 800,
      affiliate: 500,
      upsells: 1200
    },
    
    services: [
      {
        name: 'AI Chatbot Development',
        description: 'Custom AI chatbot for customer service',
        category: 'development',
        tiers: [
          {
            name: 'Basic Chatbot',
            basePrice: 997,
            features: ['FAQ bot', '50 intents', 'Website integration'],
            deliveryTime: '5 days',
            revisions: 2
          },
          {
            name: 'Advanced AI Assistant',
            basePrice: 2997,
            features: ['NLP powered', 'Unlimited intents', 'CRM integration', 'Analytics'],
            deliveryTime: '10 days',
            revisions: 3
          },
          {
            name: 'Enterprise Solution',
            basePrice: 9997,
            features: ['Custom AI model', 'Multi-channel', 'API access', 'Training included'],
            deliveryTime: '30 days',
            revisions: 'unlimited'
          }
        ]
      },
      {
        name: 'AI Content Generation',
        description: 'AI-powered content at scale',
        category: 'content',
        tiers: [
          {
            name: 'Starter Pack',
            basePrice: 497,
            features: ['20 pieces/month', 'Blog posts', 'Social media'],
            deliveryTime: 'monthly',
            revisions: 1
          },
          {
            name: 'Growth Pack',
            basePrice: 997,
            features: ['50 pieces/month', 'All content types', 'SEO optimization'],
            deliveryTime: 'monthly',
            revisions: 2
          },
          {
            name: 'Scale Pack',
            basePrice: 2497,
            features: ['Unlimited content', 'Custom AI training', 'Brand voice'],
            deliveryTime: 'monthly',
            revisions: 'unlimited'
          }
        ]
      },
      {
        name: 'AI Business Automation',
        description: 'Automate repetitive business tasks with AI',
        category: 'automation',
        tiers: [
          {
            name: 'Process Automation',
            basePrice: 1497,
            features: ['3 processes', 'Workflow design', 'Integration setup'],
            deliveryTime: '7 days',
            revisions: 2
          },
          {
            name: 'Department Automation',
            basePrice: 4997,
            features: ['Full department', 'Custom AI models', 'Training', 'Support'],
            deliveryTime: '21 days',
            revisions: 5
          }
        ]
      }
    ],
    
    subscriptions: [
      {
        name: 'AI Tools Suite',
        description: 'Access to all AI tools and updates',
        monthlyPrice: 297,
        interval: 'month',
        features: ['All AI tools', 'New features', 'Priority support', 'API access'],
        trialDays: 7
      },
      {
        name: 'Managed AI Services',
        description: 'Full AI department for your business',
        monthlyPrice: 1997,
        interval: 'month',
        features: ['Dedicated AI team', 'Custom solutions', 'Daily monitoring', 'Monthly optimization'],
        trialDays: 0
      }
    ],
    
    digitalProducts: [
      {
        name: 'AI Implementation Guide',
        description: 'Step-by-step AI adoption for business',
        price: 197,
        category: 'guides',
        fileType: 'pdf',
        downloadLimit: 5
      },
      {
        name: 'AI Prompt Templates',
        description: '1000+ tested prompts for business',
        price: 97,
        category: 'templates',
        fileType: 'xlsx',
        downloadLimit: 5
      }
    ],
    
    affiliatePrograms: [
      {
        name: 'OpenAI',
        productName: 'GPT API credits',
        commissionRate: 20,
        cookieDuration: 30,
        affiliateLink: 'https://openai.com'
      },
      {
        name: 'Jasper AI',
        productName: 'AI writing assistant',
        commissionRate: 30,
        cookieDuration: 45,
        affiliateLink: 'https://jasper.ai'
      }
    ],
    
    orderBump: {
      name: 'Priority Implementation',
      description: 'Jump to the front of the queue',
      price: 297
    },
    
    oneTimeOffer: {
      name: 'AI Strategy Session',
      description: '2-hour deep dive into AI opportunities',
      price: 997
    },
    
    crossSells: [
      'Custom AI Training',
      'Ongoing Optimization',
      'White Label Rights'
    ],
    
    marketingChannels: ['linkedin', 'webinars', 'case_studies', 'partnerships'],
    automationLevel: 'very_high',
    timeToFirstSale: 24
  }
};

/**
 * Get template by ID
 */
export function getTemplate(templateId) {
  return BUSINESS_TEMPLATES[templateId] || null;
}

/**
 * Get all templates
 */
export function getAllTemplates() {
  return Object.values(BUSINESS_TEMPLATES);
}

/**
 * Get templates by category
 */
export function getTemplatesByCategory(category) {
  return Object.values(BUSINESS_TEMPLATES).filter(t => t.category === category);
}

/**
 * Get recommended template based on user data
 */
export function getRecommendedTemplate(userData) {
  // Simple recommendation logic - can be enhanced with ML
  const interests = userData.interests || [];
  const experience = userData.experience || 'beginner';
  const budget = userData.budget || 'low';
  
  // Score each template
  const scores = Object.entries(BUSINESS_TEMPLATES).map(([id, template]) => {
    let score = 0;
    
    // Match interests
    if (interests.includes(template.category)) score += 3;
    
    // Match experience level
    if (experience === 'beginner' && template.automationLevel === 'very_high') score += 2;
    if (experience === 'advanced' && template.automationLevel === 'medium') score += 1;
    
    // Match budget
    if (budget === 'low' && template.revenueModel.subscriptions > 2000) score += 2;
    if (budget === 'high' && template.revenueModel.services > 3000) score += 2;
    
    // Prefer high demand
    if (template.demandLevel === 'high_demand') score += 2;
    
    return { id, score };
  });
  
  // Sort by score and return top template
  scores.sort((a, b) => b.score - a.score);
  return BUSINESS_TEMPLATES[scores[0].id];
}

export default BUSINESS_TEMPLATES;
