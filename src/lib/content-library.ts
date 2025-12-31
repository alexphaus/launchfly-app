/**
 * Content Library for SEA Service SMEs
 * 
 * Pre-made templates, lead magnets, and messaging for each service type.
 * This is the "Done-For-You" content that enables 5-minute onboarding.
 */

// Service type definitions matching the existing sales page
export interface ServiceTemplate {
    id: string;
    name: string;
    emoji: string;
    // Lead Magnet
    leadMagnet: {
        title: string;
        fileName: string;
        items: string[]; // Checklist items
        ctaText: string;
    };
    // Landing Page Copy
    landingPage: {
        headline: string;
        subheadline: string;
        benefits: string[];
        ctaButton: string;
        trustBadge: string;
    };
    // WhatsApp Templates
    whatsapp: {
        greeting: string;
        leadNotification: string; // Sent to owner when lead comes in
        autoReply: string; // Auto-reply to customer inquiry
        followUp24h: string;
        reengagement: string; // For blast feature
    };
    // Email Templates
    email: {
        subject: string;
        body: string;
    };
    // Common pain signals for this service type
    painSignals: string[];
}

export const SERVICE_TEMPLATES: Record<string, ServiceTemplate> = {
    aircon: {
        id: 'aircon',
        name: 'Aircon Service',
        emoji: '❄️',
        leadMagnet: {
            title: '5 Signs Your Aircon Needs Servicing',
            fileName: 'aircon-maintenance-checklist.pdf',
            items: [
                'Weak airflow or uneven cooling',
                'Strange noises or vibrations',
                'Musty or unpleasant smells',
                'Water leaking from indoor unit',
                'Electricity bill suddenly increased',
                'AC takes longer to cool the room',
                'Remote control not responding',
                'Frost or ice on the unit'
            ],
            ctaText: 'Get Your Free Checklist'
        },
        landingPage: {
            headline: '✅ Fast & Reliable Aircon Service',
            subheadline: 'Same-day servicing • Fair pricing • Professional technicians',
            benefits: [
                'Quick response within 2 hours',
                'Transparent pricing - no hidden fees',
                'All brands serviced',
                'Warranty on all repairs'
            ],
            ctaButton: 'WhatsApp Us Now',
            trustBadge: '500+ Happy Customers'
        },
        whatsapp: {
            greeting: 'Thanks for contacting us! 👋 How can we help with your aircon today?',
            leadNotification: '🔔 New Lead!\n\nName: {{name}}\nPhone: {{phone}}\nService: Aircon\nMessage: {{message}}\n\n👉 Reply now: wa.me/{{phone}}',
            autoReply: 'Hi! Thanks for reaching out. We usually reply within 15 minutes. In the meantime, what aircon brand do you have?',
            followUp24h: 'Hi {{name}}! Just checking in - still need help with your aircon? We have slots available today 👍',
            reengagement: '❄️ Aircon not cold enough?\n\nBook a chemical wash this week and get 10% off!\n\nReply "BOOK" to secure your slot.'
        },
        email: {
            subject: 'Your Aircon Maintenance Checklist',
            body: `Hi {{name}},

Thanks for downloading our Aircon Maintenance Checklist!

Here are quick tips to keep your AC running efficiently:
1. Clean filters every 2 weeks
2. Schedule professional servicing every 3-4 months
3. Keep vents unobstructed

Need servicing? Just reply to this email or WhatsApp us!

Best regards,
{{business_name}}`
        },
        painSignals: ['no_booking', 'whatsapp_only', 'slow_replies', 'no_website']
    },

    pest_control: {
        id: 'pest_control',
        name: 'Pest Control',
        emoji: '🐜',
        leadMagnet: {
            title: '7 Signs You Have a Pest Problem',
            fileName: 'pest-warning-signs-checklist.pdf',
            items: [
                'Droppings or urine trails',
                'Gnaw marks on furniture or wires',
                'Strange scratching sounds at night',
                'Nests or shredded paper/fabric',
                'Dead bugs around windows',
                'Unexplained bites on skin',
                'Musty or unusual odors',
                'Grease marks along walls'
            ],
            ctaText: 'Get Your Free Checklist'
        },
        landingPage: {
            headline: '🏠 Protect Your Home From Pests',
            subheadline: 'Safe treatments • Family & pet friendly • Long-lasting results',
            benefits: [
                'Free inspection and quote',
                'Safe for children and pets',
                'All common pests covered',
                '90-day guarantee'
            ],
            ctaButton: 'Book Free Inspection',
            trustBadge: 'Licensed & Insured'
        },
        whatsapp: {
            greeting: 'Thanks for contacting us! 👋 What type of pest issue are you experiencing?',
            leadNotification: '🔔 New Lead!\n\nName: {{name}}\nPhone: {{phone}}\nService: Pest Control\nMessage: {{message}}\n\n👉 Reply now: wa.me/{{phone}}',
            autoReply: 'Hi! We handle all pest types - ants, cockroaches, termites, rats & more. What are you seeing?',
            followUp24h: 'Hi {{name}}! Just following up on your pest enquiry. Still need help? We can do a free inspection 👍',
            reengagement: '🐜 Pest problems?\n\nBook this week and get FREE follow-up treatment!\n\nReply "BOOK" to schedule.'
        },
        email: {
            subject: 'Your Pest Warning Signs Checklist',
            body: `Hi {{name}},

Thanks for downloading our Pest Warning Signs Checklist!

Early detection is key to preventing infestations. If you noticed any of these signs, don't wait - the problem will only get worse.

We offer free inspections with no obligation.

WhatsApp us or reply to this email to schedule!

Best regards,
{{business_name}}`
        },
        painSignals: ['no_booking', 'whatsapp_only', 'slow_replies', 'no_website']
    },

    plumbing: {
        id: 'plumbing',
        name: 'Plumbing',
        emoji: '🔧',
        leadMagnet: {
            title: '6 Plumbing Problems You Shouldn\'t Ignore',
            fileName: 'plumbing-problems-checklist.pdf',
            items: [
                'Slow draining sinks or showers',
                'Low water pressure',
                'Running toilet',
                'Dripping faucets',
                'Water stains on walls/ceiling',
                'Strange gurgling sounds',
                'Unpleasant sewer smells',
                'Visible pipe corrosion'
            ],
            ctaText: 'Get Your Free Checklist'
        },
        landingPage: {
            headline: '🔧 24/7 Emergency Plumbing',
            subheadline: 'Fast response • Upfront pricing • All plumbing issues',
            benefits: [
                'Available 24/7 for emergencies',
                'No call-out fees',
                'Transparent quotes before work',
                'All work guaranteed'
            ],
            ctaButton: 'Call Now',
            trustBadge: 'Licensed Plumber'
        },
        whatsapp: {
            greeting: 'Thanks for contacting us! 👋 What plumbing issue can we help with?',
            leadNotification: '🔔 New Lead!\n\nName: {{name}}\nPhone: {{phone}}\nService: Plumbing\nMessage: {{message}}\n\n👉 Reply now: wa.me/{{phone}}',
            autoReply: 'Hi! Is this an emergency or a regular job? Send a photo of the issue if you can 📸',
            followUp24h: 'Hi {{name}}! Still having plumbing issues? We have availability today if you need us 👍',
            reengagement: '🔧 Water heater acting up?\n\nGet a free water heater inspection this week!\n\nReply "CHECK" to book.'
        },
        email: {
            subject: 'Your Plumbing Problems Checklist',
            body: `Hi {{name}},

Thanks for downloading our Plumbing Problems Checklist!

Small issues can become big (and expensive) problems fast. If you're experiencing any of these signs, it's best to get it checked early.

Need a plumber? Reply to this email or WhatsApp us!

Best regards,
{{business_name}}`
        },
        painSignals: ['no_booking', 'whatsapp_only', 'slow_replies', 'no_website']
    },

    cleaning: {
        id: 'cleaning',
        name: 'Cleaning Service',
        emoji: '🧹',
        leadMagnet: {
            title: 'Home Cleaning Checklist by Pros',
            fileName: 'professional-cleaning-checklist.pdf',
            items: [
                'Dust all surfaces top to bottom',
                'Vacuum and mop all floors',
                'Clean and disinfect bathrooms',
                'Wipe kitchen counters and appliances',
                'Change bedsheets and linens',
                'Empty all trash bins',
                'Clean mirrors and glass',
                'Organize cluttered areas'
            ],
            ctaText: 'Get Your Free Checklist'
        },
        landingPage: {
            headline: '✨ Professional Home Cleaning',
            subheadline: 'Trusted cleaners • Flexible scheduling • Satisfaction guaranteed',
            benefits: [
                'Background-checked cleaners',
                'Bring our own supplies',
                'Book online anytime',
                'Reschedule for free'
            ],
            ctaButton: 'Book Cleaning',
            trustBadge: '1000+ Homes Cleaned'
        },
        whatsapp: {
            greeting: 'Thanks for contacting us! 👋 What type of cleaning do you need?',
            leadNotification: '🔔 New Lead!\n\nName: {{name}}\nPhone: {{phone}}\nService: Cleaning\nMessage: {{message}}\n\n👉 Reply now: wa.me/{{phone}}',
            autoReply: 'Hi! We offer regular cleaning, deep cleaning, and move-in/out cleaning. Which one interests you?',
            followUp24h: 'Hi {{name}}! Just following up - still looking for a cleaner? We have slots this weekend 👍',
            reengagement: '✨ CNY coming up!\n\nBook your deep cleaning now before slots run out!\n\nReply "CLEAN" to check availability.'
        },
        email: {
            subject: 'Your Professional Cleaning Checklist',
            body: `Hi {{name}},

Thanks for downloading our Pro Cleaning Checklist!

Use this as a guide for your cleaning - or let us handle it for you! 

We offer:
• Regular weekly/biweekly cleaning
• One-time deep cleaning
• Move-in/out cleaning

Reply to this email or WhatsApp us to book!

Best regards,
{{business_name}}`
        },
        painSignals: ['no_booking', 'whatsapp_only', 'slow_replies', 'no_website']
    },

    electrical: {
        id: 'electrical',
        name: 'Electrical Service',
        emoji: '⚡',
        leadMagnet: {
            title: '8 Electrical Warning Signs',
            fileName: 'electrical-safety-checklist.pdf',
            items: [
                'Frequent tripping of circuit breaker',
                'Flickering or dimming lights',
                'Burning smell from outlets',
                'Buzzing sounds from switches',
                'Warm or discolored outlets',
                'Sparks when plugging in',
                'Outlets not working',
                'Outdated wiring (>20 years)'
            ],
            ctaText: 'Get Your Free Checklist'
        },
        landingPage: {
            headline: '⚡ Licensed Electrician Services',
            subheadline: 'Safe work • Fair pricing • Available 7 days',
            benefits: [
                'Licensed and certified',
                'Free safety inspection',
                'Upfront pricing',
                'Emergency service available'
            ],
            ctaButton: 'Get Free Quote',
            trustBadge: 'Licensed Electrician'
        },
        whatsapp: {
            greeting: 'Thanks for contacting us! 👋 What electrical issue can we help with?',
            leadNotification: '🔔 New Lead!\n\nName: {{name}}\nPhone: {{phone}}\nService: Electrical\nMessage: {{message}}\n\n👉 Reply now: wa.me/{{phone}}',
            autoReply: 'Hi! Is this an emergency (outage/sparks) or a regular job? Please describe the issue.',
            followUp24h: 'Hi {{name}}! Still need an electrician? We can come by today if you\'re free 👍',
            reengagement: '⚡ Power issues at home?\n\nBook an electrical safety check - special rate this month!\n\nReply "CHECK" to book.'
        },
        email: {
            subject: 'Your Electrical Safety Checklist',
            body: `Hi {{name}},

Thanks for downloading our Electrical Safety Checklist!

⚠️ Warning: Electrical issues can be dangerous. If you noticed any warning signs, please get it checked by a licensed electrician.

We offer free safety inspections. Reply to this email or WhatsApp us!

Best regards,
{{business_name}}`
        },
        painSignals: ['no_booking', 'whatsapp_only', 'slow_replies', 'no_website']
    },

    renovation: {
        id: 'renovation',
        name: 'Renovation',
        emoji: '🏠',
        leadMagnet: {
            title: 'Home Renovation Planning Checklist',
            fileName: 'renovation-planning-checklist.pdf',
            items: [
                'Set a realistic budget (+20% buffer)',
                'Define must-haves vs nice-to-haves',
                'Get 3 quotes from contractors',
                'Check contractor licenses and reviews',
                'Plan for temporary living arrangements',
                'Get all permits in order',
                'Create a realistic timeline',
                'Document everything in writing'
            ],
            ctaText: 'Get Your Free Checklist'
        },
        landingPage: {
            headline: '🏠 Quality Home Renovations',
            subheadline: 'Experienced team • Transparent pricing • On-time delivery',
            benefits: [
                'Free consultation & quote',
                '3D design visualization',
                'No hidden costs',
                'Workmanship warranty'
            ],
            ctaButton: 'Get Free Quote',
            trustBadge: '100+ Projects Completed'
        },
        whatsapp: {
            greeting: 'Thanks for contacting us! 👋 What renovation project are you planning?',
            leadNotification: '🔔 New Lead!\n\nName: {{name}}\nPhone: {{phone}}\nService: Renovation\nMessage: {{message}}\n\n👉 Reply now: wa.me/{{phone}}',
            autoReply: 'Hi! We handle kitchen, bathroom, bedroom, and full home renovations. What are you looking to renovate?',
            followUp24h: 'Hi {{name}}! Still planning your renovation? Happy to arrange a free site visit 👍',
            reengagement: '🏠 Planning a reno?\n\nBook a free consultation this week!\n\nReply "CONSULT" to schedule.'
        },
        email: {
            subject: 'Your Renovation Planning Checklist',
            body: `Hi {{name}},

Thanks for downloading our Renovation Planning Checklist!

A well-planned renovation saves time, money, and stress. Use this checklist to stay organized.

Ready to get started? We offer free consultations and 3D design previews.

Reply to this email or WhatsApp us!

Best regards,
{{business_name}}`
        },
        painSignals: ['no_booking', 'whatsapp_only', 'slow_replies', 'no_website']
    },

    roofing: {
        id: 'roofing',
        name: 'Roofing',
        emoji: '🏗️',
        leadMagnet: {
            title: 'Roof Inspection Checklist',
            fileName: 'roof-inspection-checklist.pdf',
            items: [
                'Missing or damaged tiles/shingles',
                'Visible cracks or holes',
                'Moss or algae growth',
                'Clogged or sagging gutters',
                'Water stains on ceiling',
                'Daylight visible through roof',
                'Curling or buckling materials',
                'High energy bills (poor insulation)'
            ],
            ctaText: 'Get Your Free Checklist'
        },
        landingPage: {
            headline: '🏗️ Professional Roofing Services',
            subheadline: 'Repairs • Replacement • Waterproofing',
            benefits: [
                'Free roof inspection',
                'All roof types handled',
                'Waterproofing specialists',
                '5-year warranty'
            ],
            ctaButton: 'Book Free Inspection',
            trustBadge: 'Roofing Specialists'
        },
        whatsapp: {
            greeting: 'Thanks for contacting us! 👋 What roofing issue can we help with?',
            leadNotification: '🔔 New Lead!\n\nName: {{name}}\nPhone: {{phone}}\nService: Roofing\nMessage: {{message}}\n\n👉 Reply now: wa.me/{{phone}}',
            autoReply: 'Hi! Is there a leak or visible damage? Send photos if you can 📸',
            followUp24h: 'Hi {{name}}! Still having roof issues? We can do a free inspection this week 👍',
            reengagement: '🏗️ Monsoon season coming!\n\nGet a FREE roof checkup before the rains hit!\n\nReply "ROOF" to book.'
        },
        email: {
            subject: 'Your Roof Inspection Checklist',
            body: `Hi {{name}},

Thanks for downloading our Roof Inspection Checklist!

Roof problems only get worse with time. Early detection can save you thousands.

We offer free inspections - no obligation. Reply or WhatsApp us to schedule!

Best regards,
{{business_name}}`
        },
        painSignals: ['no_booking', 'whatsapp_only', 'slow_replies', 'no_website']
    },

    landscaping: {
        id: 'landscaping',
        name: 'Landscaping',
        emoji: '🌳',
        leadMagnet: {
            title: 'Garden Maintenance Checklist',
            fileName: 'garden-maintenance-checklist.pdf',
            items: [
                'Regular lawn mowing (weekly)',
                'Trim hedges and shrubs monthly',
                'Remove dead plants and leaves',
                'Water plants appropriately',
                'Apply fertilizer seasonally',
                'Check for pests and diseases',
                'Prune trees as needed',
                'Maintain pathways and borders'
            ],
            ctaText: 'Get Your Free Checklist'
        },
        landingPage: {
            headline: '🌳 Professional Landscaping',
            subheadline: 'Garden design • Maintenance • Tree services',
            benefits: [
                'Free garden consultation',
                'Regular maintenance packages',
                'Design and installation',
                'All garden sizes welcome'
            ],
            ctaButton: 'Get Free Quote',
            trustBadge: 'Garden Experts'
        },
        whatsapp: {
            greeting: 'Thanks for contacting us! 👋 What garden work do you need?',
            leadNotification: '🔔 New Lead!\n\nName: {{name}}\nPhone: {{phone}}\nService: Landscaping\nMessage: {{message}}\n\n👉 Reply now: wa.me/{{phone}}',
            autoReply: 'Hi! We do lawn care, tree trimming, garden design and more. What do you need help with?',
            followUp24h: 'Hi {{name}}! Still need help with your garden? We can visit for a free quote 👍',
            reengagement: '🌳 Garden looking messy?\n\nBook a garden cleanup this week - special rates!\n\nReply "GARDEN" to book.'
        },
        email: {
            subject: 'Your Garden Maintenance Checklist',
            body: `Hi {{name}},

Thanks for downloading our Garden Maintenance Checklist!

A well-maintained garden adds value to your home and improves quality of life.

Need help? We offer one-time cleanups and regular maintenance packages.

Reply or WhatsApp us!

Best regards,
{{business_name}}`
        },
        painSignals: ['no_booking', 'whatsapp_only', 'slow_replies', 'no_website']
    },

    moving: {
        id: 'moving',
        name: 'Moving Service',
        emoji: '📦',
        leadMagnet: {
            title: 'Moving Day Checklist',
            fileName: 'moving-day-checklist.pdf',
            items: [
                'Book movers 2-4 weeks ahead',
                'Declutter before packing',
                'Label all boxes by room',
                'Pack essentials separately',
                'Notify utilities and change address',
                'Take photos of valuable items',
                'Prepare furniture for transport',
                'Confirm timing with movers'
            ],
            ctaText: 'Get Your Free Checklist'
        },
        landingPage: {
            headline: '📦 Stress-Free Moving',
            subheadline: 'Professional movers • Packing service • All sizes',
            benefits: [
                'Free quote - no obligation',
                'Experienced & careful team',
                'Packing materials included',
                'Insured for peace of mind'
            ],
            ctaButton: 'Get Free Quote',
            trustBadge: 'Trusted Movers'
        },
        whatsapp: {
            greeting: 'Thanks for contacting us! 👋 When and where are you moving?',
            leadNotification: '🔔 New Lead!\n\nName: {{name}}\nPhone: {{phone}}\nService: Moving\nMessage: {{message}}\n\n👉 Reply now: wa.me/{{phone}}',
            autoReply: 'Hi! To give you a quote, we need: 1) Moving date 2) From address 3) To address. Can you share these?',
            followUp24h: 'Hi {{name}}! Still planning your move? We have good availability this month 👍',
            reengagement: '📦 Moving soon?\n\nBook this week for a special discount!\n\nReply "MOVE" to get a quote.'
        },
        email: {
            subject: 'Your Moving Day Checklist',
            body: `Hi {{name}},

Thanks for downloading our Moving Day Checklist!

Moving is stressful, but good planning makes it easier. Use this checklist to stay organized.

Need movers? Reply with your moving date and addresses for a free quote!

Best regards,
{{business_name}}`
        },
        painSignals: ['no_booking', 'whatsapp_only', 'slow_replies', 'no_website']
    },

    auto_repair: {
        id: 'auto_repair',
        name: 'Auto Repair',
        emoji: '🚗',
        leadMagnet: {
            title: 'Car Maintenance Checklist',
            fileName: 'car-maintenance-checklist.pdf',
            items: [
                'Check oil level monthly',
                'Rotate tires every 10,000 km',
                'Replace brake pads when worn',
                'Check battery connections',
                'Replace air filter annually',
                'Inspect belts and hoses',
                'Check tire pressure weekly',
                'Service aircon yearly'
            ],
            ctaText: 'Get Your Free Checklist'
        },
        landingPage: {
            headline: '🚗 Trusted Auto Repair',
            subheadline: 'All makes & models • Fair pricing • Quality parts',
            benefits: [
                'Free diagnostic check',
                'Transparent quotes',
                'Genuine parts available',
                'Warranty on repairs'
            ],
            ctaButton: 'Book Appointment',
            trustBadge: 'Certified Mechanics'
        },
        whatsapp: {
            greeting: 'Thanks for contacting us! 👋 What car issue can we help with?',
            leadNotification: '🔔 New Lead!\n\nName: {{name}}\nPhone: {{phone}}\nService: Auto Repair\nMessage: {{message}}\n\n👉 Reply now: wa.me/{{phone}}',
            autoReply: 'Hi! What\'s the make and model of your car? Also, what issue are you experiencing?',
            followUp24h: 'Hi {{name}}! Still having car trouble? We can take a look today if you bring it in 👍',
            reengagement: '🚗 Car due for service?\n\nBook a full service this week - special price!\n\nReply "SERVICE" to book.'
        },
        email: {
            subject: 'Your Car Maintenance Checklist',
            body: `Hi {{name}},

Thanks for downloading our Car Maintenance Checklist!

Regular maintenance extends your car's life and prevents costly repairs.

Having issues? Bring your car in for a free diagnostic check!

Best regards,
{{business_name}}`
        },
        painSignals: ['no_booking', 'whatsapp_only', 'slow_replies', 'no_website']
    },

    locksmith: {
        id: 'locksmith',
        name: 'Locksmith',
        emoji: '🔐',
        leadMagnet: {
            title: 'Home Security Checklist',
            fileName: 'home-security-checklist.pdf',
            items: [
                'All door locks working properly',
                'Window locks installed',
                'Deadbolts on main doors',
                'Spare keys stored safely',
                'Gate lock functioning',
                'Door hinges secure',
                'Peephole installed',
                'Outdoor lighting adequate'
            ],
            ctaText: 'Get Your Free Checklist'
        },
        landingPage: {
            headline: '🔐 24/7 Locksmith Service',
            subheadline: 'Emergency lockouts • Lock changes • Key cutting',
            benefits: [
                'Available 24/7',
                '30-minute response',
                'No damage entry',
                'All lock types'
            ],
            ctaButton: 'Call Now',
            trustBadge: 'Trusted Locksmith'
        },
        whatsapp: {
            greeting: 'Thanks for contacting us! 👋 Are you locked out or need lock services?',
            leadNotification: '🔔 New Lead!\n\nName: {{name}}\nPhone: {{phone}}\nService: Locksmith\nMessage: {{message}}\n\n👉 Reply now: wa.me/{{phone}}',
            autoReply: 'Hi! Is this an emergency lockout? If so, share your location and we\'ll dispatch immediately!',
            followUp24h: 'Hi {{name}}! Still need locksmith services? We\'re available today 👍',
            reengagement: '🔐 Upgrade your locks!\n\nDigital lock installation - special price this month!\n\nReply "LOCK" for details.'
        },
        email: {
            subject: 'Your Home Security Checklist',
            body: `Hi {{name}},

Thanks for downloading our Home Security Checklist!

Good locks are your first line of defense. If any are faulty or outdated, consider upgrading.

Need a locksmith? We're available 24/7. Reply or WhatsApp us!

Best regards,
{{business_name}}`
        },
        painSignals: ['no_booking', 'whatsapp_only', 'slow_replies', 'no_website']
    },

    other: {
        id: 'other',
        name: 'General Service',
        emoji: '🔨',
        leadMagnet: {
            title: 'Service Request Checklist',
            fileName: 'service-request-checklist.pdf',
            items: [
                'Clearly describe the problem',
                'Take photos if possible',
                'Note when the issue started',
                'List any previous repairs',
                'Prepare your schedule',
                'Ask about pricing upfront',
                'Request a written quote',
                'Check reviews before hiring'
            ],
            ctaText: 'Get Your Free Checklist'
        },
        landingPage: {
            headline: '🔨 Professional Services',
            subheadline: 'Quality work • Fair pricing • Reliable service',
            benefits: [
                'Free quotation',
                'Experienced team',
                'Flexible scheduling',
                'Satisfaction guaranteed'
            ],
            ctaButton: 'Get Quote',
            trustBadge: 'Trusted Professional'
        },
        whatsapp: {
            greeting: 'Thanks for contacting us! 👋 How can we help you today?',
            leadNotification: '🔔 New Lead!\n\nName: {{name}}\nPhone: {{phone}}\nService: General\nMessage: {{message}}\n\n👉 Reply now: wa.me/{{phone}}',
            autoReply: 'Hi! Please describe what you need help with and we\'ll get back to you shortly.',
            followUp24h: 'Hi {{name}}! Just following up - still need our services? 👍',
            reengagement: '👋 Need help with something?\n\nWe\'re running a special this week!\n\nReply "HELP" for details.'
        },
        email: {
            subject: 'Your Service Request Checklist',
            body: `Hi {{name}},

Thanks for downloading our Service Request Checklist!

This will help you communicate your needs clearly and get better service.

Ready to proceed? Reply to this email or WhatsApp us!

Best regards,
{{business_name}}`
        },
        painSignals: ['no_booking', 'whatsapp_only', 'slow_replies', 'no_website']
    }
};

/**
 * Get template by service type ID
 */
export function getServiceTemplate(serviceType: string): ServiceTemplate {
    return SERVICE_TEMPLATES[serviceType] || SERVICE_TEMPLATES.other;
}

/**
 * Get all service types for dropdown
 */
export function getServiceOptions(): { value: string; label: string }[] {
    return Object.entries(SERVICE_TEMPLATES).map(([key, template]) => ({
        value: key,
        label: `${template.emoji} ${template.name}`
    }));
}

/**
 * Fill template placeholders with actual values
 */
export function fillTemplate(
    template: string,
    data: Record<string, string>
): string {
    let result = template;
    for (const [key, value] of Object.entries(data)) {
        result = result.replace(new RegExp(`{{${key}}}`, 'g'), value);
    }
    return result;
}

/**
 * Generate the lead notification message for business owner
 */
export function generateLeadNotification(
    serviceType: string,
    leadData: { name: string; phone: string; message?: string }
): string {
    const template = getServiceTemplate(serviceType);
    return fillTemplate(template.whatsapp.leadNotification, {
        name: leadData.name,
        phone: leadData.phone,
        message: leadData.message || 'No message'
    });
}
