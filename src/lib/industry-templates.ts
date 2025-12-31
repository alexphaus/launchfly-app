/**
 * Industry Templates - Done-For-You Content Library
 * Pre-built lead magnets, WhatsApp scripts, and follow-up sequences
 * for SEA service SMEs
 */

export interface IndustryTemplate {
    id: string;
    name: string;
    emoji: string;
    keywords: string[]; // For auto-detection
    leadMagnet: {
        title: string;
        headline: string;
        benefits: string[];
        content: Array<{ title: string; body: string }>;
        pdfContent: {
            diagnostic_questions: string[];
            common_mistakes: string[];
            quick_tips: string[];
            price_ranges?: string[];
        };
    };
    whatsappScripts: {
        opener: string;
        followUp1: string;
        followUp2: string;
        closingPush: string;
    };
    emailSequence: Array<{
        day: number;
        subject: string;
        body: string;
    }>;
    colorScheme: {
        primary: string;
        secondary: string;
        accent: string;
    };
}

export const INDUSTRY_TEMPLATES: Record<string, IndustryTemplate> = {
    aircon: {
        id: 'aircon',
        name: 'Aircon Services',
        emoji: '❄️',
        keywords: ['aircon', 'air-con', 'aircond', 'ac service', 'hvac', 'cooling', 'pendingin'],
        leadMagnet: {
            title: '5 Ways to Lower Your AC Bill',
            headline: 'Save RM50-150/month on electricity with these simple tips',
            benefits: [
                'Reduce monthly electricity bills by 20-30%',
                'Extend your aircon lifespan by 5+ years',
                'Know when to service vs when to replace',
                'Avoid costly breakdowns during hot season'
            ],
            content: [
                {
                    title: '1. Clean Your Filters Monthly',
                    body: 'Dirty filters make your AC work 15% harder. Remove the filter, rinse with water, let dry for 30 minutes, then replace. Do this every 2-4 weeks for optimal cooling and lower bills.'
                },
                {
                    title: '2. Set Temperature to 24-25°C',
                    body: 'Every degree below 24°C increases energy use by 6-8%. Setting your AC to 24-25°C with a ceiling fan gives the same comfort at half the cost.'
                },
                {
                    title: '3. Service Every 3-4 Months',
                    body: 'Professional servicing cleans the gas lines, checks refrigerant levels, and clears drainage. This prevents the #1 cause of AC breakdowns: frozen coils from low gas.'
                },
                {
                    title: '4. Seal Your Room Properly',
                    body: 'Check for gaps under doors and around windows. A 1cm gap can reduce cooling efficiency by 25%. Use door sweeps and weather strips to keep cool air in.'
                },
                {
                    title: '5. Know the Warning Signs',
                    body: 'Water dripping, weak airflow, strange smells, or ice on the unit = call a technician immediately. Ignoring these can lead to RM500-2000 repairs vs RM80-150 for early servicing.'
                }
            ],
            pdfContent: {
                diagnostic_questions: [
                    'Is your AC making unusual noises?',
                    'Do you notice weak airflow from the vents?',
                    'Is there water leaking from the indoor unit?',
                    'Does the AC take longer than 10 minutes to cool?',
                    'When was your last professional service?'
                ],
                common_mistakes: [
                    'Running AC at 16°C thinking it cools faster (it doesn\'t)',
                    'Never cleaning filters until AC breaks down',
                    'Ignoring water drips until it damages ceiling',
                    'Servicing only once a year instead of every 3-4 months',
                    'Covering outdoor unit reducing airflow efficiency'
                ],
                quick_tips: [
                    'Turn AC on 15 min before you need the room cool',
                    'Use timer function to auto-off at night',
                    'Keep curtains closed during peak sun hours',
                    'Ceiling fan + AC at 25°C = better than AC at 18°C'
                ],
                price_ranges: [
                    'Basic service: RM60-100',
                    'Chemical wash: RM120-180',
                    'Gas top-up: RM80-150',
                    'Full overhaul: RM200-350'
                ]
            }
        },
        whatsappScripts: {
            opener: 'Hi boss 👋 You still handling aircon jobs around {area}?\n\nI made a simple WhatsApp booking page for {business_name} that auto-collects customer details while you\'re on the job — so you don\'t miss enquiries.\n\nWant to see? 😄',
            followUp1: 'Hi boss 👋 Just checking — did you see my message yesterday?\n\nNo rush, just want to know if this is relevant for you 👍',
            followUp2: 'Quick one boss 🙂\n\nMost aircon technicians I spoke to miss enquiries when they\'re servicing on-site.\nThat\'s why I built this — auto-reply + capture details so leads don\'t disappear.\n\nIf this isn\'t for you, just tell me "not now" 👍',
            closingPush: 'Last message from me boss 👍\n\nShould I send you the preview, or skip for now?'
        },
        emailSequence: [
            {
                day: 1,
                subject: 'Your AC Bill-Saving Guide is Here! 🎁',
                body: 'Hi there!\n\nThanks for downloading our guide. Here\'s how to start saving on your electricity bill this month.\n\nThe #1 tip most people miss: Clean your filters every 2-4 weeks, not just during service. This alone can cut your bill by 15%.\n\nNeed a professional service? We\'re just a WhatsApp away!\n\nStay cool,\n{business_name}'
            },
            {
                day: 3,
                subject: 'Quick question about your AC...',
                body: 'Hi!\n\nJust checking in — did you try any of the tips from the guide?\n\nIf your AC is showing any warning signs (weak airflow, water drips, strange smell), it\'s best to get it checked before the hot season rush.\n\nWe have slots available this week if you need a quick service 👍\n\nBest,\n{business_name}'
            },
            {
                day: 7,
                subject: 'Limited slots this week',
                body: 'Hi!\n\nQuick heads up — our schedule is filling up for this week.\n\nIf you\'ve been meaning to service your AC, now\'s a good time to book. Regular servicing keeps your unit running efficiently and prevents costly breakdowns.\n\nReply to this email or WhatsApp us to book a slot!\n\nCheers,\n{business_name}'
            }
        ],
        colorScheme: {
            primary: '#0369a1',
            secondary: '#0ea5e9',
            accent: '#38bdf8'
        }
    },

    pest_control: {
        id: 'pest_control',
        name: 'Pest Control',
        emoji: '🐜',
        keywords: ['pest', 'termite', 'roach', 'ant', 'rodent', 'fumigation', 'serangga', 'anai-anai', 'tikus'],
        leadMagnet: {
            title: '7 Signs You Need Pest Treatment Now',
            headline: 'Don\'t wait until it\'s too late — catch infestations early',
            benefits: [
                'Identify pest problems before they spread',
                'Save thousands in property damage',
                'Protect your family\'s health',
                'Know DIY vs professional treatment'
            ],
            content: [
                {
                    title: '1. Droppings or Urine Trails',
                    body: 'Small dark pellets near walls, under sinks, or in cupboards indicate rodents or roaches. Fresh droppings are dark and moist; old ones are dry and crumbly. Multiple areas = active infestation.'
                },
                {
                    title: '2. Hollow-Sounding Wood',
                    body: 'Tap wooden furniture, door frames, and skirting boards. A hollow sound means termites may be eating from inside. By the time you see damage outside, 60% of the wood may already be destroyed.'
                },
                {
                    title: '3. Unusual Sounds at Night',
                    body: 'Scratching in walls or ceilings, especially at night, indicates rats or squirrels. Soft clicking could be termites. Don\'t ignore these sounds — they get worse quickly.'
                },
                {
                    title: '4. Musty or Oily Odors',
                    body: 'Roaches leave an oily smell. Rodents have a musty, ammonia odor from urine. Bed bugs smell sweet and musty. If you notice unusual smells, investigate immediately.'
                },
                {
                    title: '5. Small Holes in Walls or Packaging',
                    body: 'Gnaw marks on food packaging, small holes in walls, or bite marks on wires are signs of rodents. This is also a fire hazard if they\'re chewing electrical wires.'
                },
                {
                    title: '6. Wings or Shed Skins',
                    body: 'Finding small piles of wings near windows or doors indicates termite swarmers. Shed skins near beds or furniture could mean bed bugs or roaches. These are breeding signs.'
                },
                {
                    title: '7. Daytime Pest Sightings',
                    body: 'Most pests are nocturnal. If you see roaches or rats during the day, it usually means the population is so large they\'re competing for space. This requires immediate professional treatment.'
                }
            ],
            pdfContent: {
                diagnostic_questions: [
                    'Have you seen any pests during daytime?',
                    'Do you notice small droppings in your kitchen?',
                    'Is there any hollow-sounding wood in your home?',
                    'Do you hear scratching sounds at night?',
                    'When was your last pest inspection?'
                ],
                common_mistakes: [
                    'Only treating visible pests, not the source',
                    'Using supermarket sprays that just scatter pests',
                    'Waiting until infestation is severe',
                    'Not sealing entry points after treatment',
                    'Ignoring early warning signs'
                ],
                quick_tips: [
                    'Store food in airtight containers',
                    'Fix water leaks — pests need water to survive',
                    'Seal cracks around pipes and windows',
                    'Don\'t stack cardboard boxes — termites love them',
                    'Regular inspection every 6-12 months'
                ],
                price_ranges: [
                    'General pest spray: RM80-150',
                    'Termite inspection: RM150-300',
                    'Termite treatment: RM800-3000+',
                    'Rodent control: RM200-500'
                ]
            }
        },
        whatsappScripts: {
            opener: 'Hi boss 👋 You still handling pest control jobs around {area}?\n\nI made a simple WhatsApp booking page for {business_name} that auto-collects customer details while you\'re on-site — so you don\'t miss enquiries.\n\nWant to see? 😄',
            followUp1: 'Hi boss 👋 Just checking — did you see my message?\n\nNo rush at all 👍',
            followUp2: 'Quick one boss 🙂\n\nMost pest control pros I spoke to lose enquiries when they\'re doing treatments.\nThis tool catches those leads for you automatically.\n\nStill interested to see?',
            closingPush: 'Last message from me boss 👍\n\nShould I send the preview link, or not for you?'
        },
        emailSequence: [
            {
                day: 1,
                subject: 'Your Pest Warning Signs Guide 🔍',
                body: 'Hi!\n\nThanks for downloading our guide on pest warning signs.\n\nThe most important thing: early detection saves you thousands. A termite colony can cause RM10,000+ in damage if left untreated for a year.\n\nIf you\'ve noticed any signs from our guide, don\'t wait — get a professional inspection.\n\nWe\'re here to help!\n\n{business_name}'
            },
            {
                day: 3,
                subject: 'Did you spot any warning signs?',
                body: 'Hi!\n\nJust checking in — have you had a chance to inspect your home using our guide?\n\nRemember, the most dangerous pests (termites, bed bugs) are often invisible until the damage is done.\n\nIf you\'d like a professional inspection, we offer free assessments for new customers.\n\nReply to book!\n\n{business_name}'
            },
            {
                day: 7,
                subject: 'Protect your home this season',
                body: 'Hi!\n\nRainy season = pest breeding season. This is when termites swarm and roach populations explode.\n\nNow is the best time for a preventive treatment before it becomes an infestation.\n\nLet us know if you\'d like to schedule a visit!\n\n{business_name}'
            }
        ],
        colorScheme: {
            primary: '#16a34a',
            secondary: '#22c55e',
            accent: '#4ade80'
        }
    },

    plumbing: {
        id: 'plumbing',
        name: 'Plumbing Services',
        emoji: '🔧',
        keywords: ['plumb', 'pipe', 'drain', 'leak', 'toilet', 'paip', 'bocor', 'tersumbat', 'tandas'],
        leadMagnet: {
            title: 'Home Leak Prevention Checklist',
            headline: 'Catch leaks early and save thousands in water damage',
            benefits: [
                'Reduce water bills by fixing hidden leaks',
                'Prevent costly ceiling and wall damage',
                'Know when it\'s DIY vs call a plumber',
                'Emergency checklist for burst pipes'
            ],
            content: [
                {
                    title: '1. Check Your Water Meter',
                    body: 'Turn off all water in your home. Check the meter, wait 2 hours, check again. If it moved, you have a hidden leak. This simple test can catch leaks that waste RM50-200/month in water bills.'
                },
                {
                    title: '2. Inspect Under All Sinks',
                    body: 'Look for moisture, mold, or water stains under kitchen and bathroom sinks monthly. Feel the pipes — wetness or mineral buildup indicates slow leaks that damage cabinets over time.'
                },
                {
                    title: '3. Test Your Toilets',
                    body: 'Add food coloring to the tank. If color appears in the bowl without flushing after 30 minutes, you have a leak. A running toilet can waste 200+ liters per day.'
                },
                {
                    title: '4. Check Water Heater Area',
                    body: 'Look for pools of water or rust around your water heater. A failing water heater often shows warning signs 6-12 months before bursting. Replacement is cheaper than water damage.'
                },
                {
                    title: '5. Examine Exposed Pipes',
                    body: 'Look for green stains on brass fittings, orange/yellow on steel pipes, or white deposits. These indicate corrosion and future leaks. Outdoor pipe insulation should be intact.'
                }
            ],
            pdfContent: {
                diagnostic_questions: [
                    'Has your water bill increased unexpectedly?',
                    'Do you hear water running when taps are off?',
                    'Are there water stains on ceilings or walls?',
                    'Do your drains empty slowly?',
                    'Is there low water pressure in some areas?'
                ],
                common_mistakes: [
                    'Ignoring small drips ("it\'s just a little leak")',
                    'Using chemical drain cleaners that damage pipes',
                    'Over-tightening fittings causing cracks',
                    'Not knowing where the main shut-off valve is',
                    'DIY repairs without proper tools'
                ],
                quick_tips: [
                    'Know your main water shut-off location',
                    'Never pour grease down drains',
                    'Use drain screens to catch hair/debris',
                    'Insulate exposed pipes in cold areas',
                    'Check hose connections on washing machines'
                ],
                price_ranges: [
                    'Minor leak repair: RM80-150',
                    'Clogged drain clearing: RM100-200',
                    'Toilet repair: RM100-250',
                    'Pipe replacement: RM200-500+'
                ]
            }
        },
        whatsappScripts: {
            opener: 'Hi boss 👋 You still handling plumbing jobs around {area}?\n\nI made a simple WhatsApp booking page for {business_name} that auto-collects customer details while you\'re fixing pipes — so you don\'t miss enquiries.\n\nWant to see? 😄',
            followUp1: 'Hi boss 👋 Just checking — did you catch my message?\n\nNo worries if busy 👍',
            followUp2: 'Quick one boss 🙂\n\nMost plumbers miss calls when they\'re under sinks or in ceilings.\nThis tool catches those leads for you automatically.\n\nWant to take a look?',
            closingPush: 'Last message from me boss 👍\n\nPreview link — yes or skip?'
        },
        emailSequence: [
            {
                day: 1,
                subject: 'Your Leak Prevention Checklist 🔧',
                body: 'Hi!\n\nThanks for downloading our leak prevention checklist.\n\nPro tip: The water meter test in Step 1 is the fastest way to detect hidden leaks. Try it this weekend!\n\nIf you find a leak or need help, we\'re just a message away.\n\n{business_name}'
            },
            {
                day: 3,
                subject: 'Did you try the water meter test?',
                body: 'Hi!\n\nJust checking in — did you try the leak detection test from our guide?\n\nHidden leaks are responsible for 30% of water bills in older homes. Catching them early saves big money.\n\nNeed a professional inspection? We can help!\n\n{business_name}'
            },
            {
                day: 7,
                subject: 'Before it becomes an emergency...',
                body: 'Hi!\n\nMost plumbing emergencies start as small issues that get ignored.\n\nIf you\'ve been meaning to fix that slow drain, dripping tap, or running toilet — now\'s a good time before it becomes urgent.\n\nReply to schedule a visit!\n\n{business_name}'
            }
        ],
        colorScheme: {
            primary: '#2563eb',
            secondary: '#3b82f6',
            accent: '#60a5fa'
        }
    },

    cleaning: {
        id: 'cleaning',
        name: 'Cleaning Services',
        emoji: '🧹',
        keywords: ['cleaning', 'cleaner', 'housekeep', 'maid', 'pembersihan', 'cuci', 'home cleaning'],
        leadMagnet: {
            title: 'Deep Clean vs Regular Clean: What You Actually Need',
            headline: 'Stop overpaying for cleaning — get exactly what your home needs',
            benefits: [
                'Know which cleaning type saves you money',
                'Checklist for evaluating cleaning services',
                'Questions to ask before hiring',
                'Red flags to avoid bad cleaners'
            ],
            content: [
                {
                    title: 'Regular Cleaning: What\'s Included',
                    body: 'Dusting, vacuuming, mopping, bathroom wipe-down, kitchen surface cleaning. Best for: Weekly or bi-weekly maintenance of already-clean homes. Time: 2-3 hours for average home.'
                },
                {
                    title: 'Deep Cleaning: What\'s Included',
                    body: 'Everything in regular PLUS: inside appliances, behind furniture, grout scrubbing, window tracks, fan blades, cabinet interiors. Best for: First-time cleans, post-renovation, seasonal deep clean. Time: 4-8 hours.'
                },
                {
                    title: 'Move-In/Move-Out Cleaning',
                    body: 'Deep clean + inside all cabinets/closets, all fixtures polished, walls spot-cleaned, garage/balcony. Required by most landlords. Takes 6-10 hours depending on home condition.'
                },
                {
                    title: 'How to Choose the Right Service',
                    body: 'Rule of thumb: Start with a deep clean, then maintain with regular cleaning every 1-2 weeks. If you haven\'t had professional cleaning in 6+ months, you need deep clean first.'
                },
                {
                    title: 'Questions to Ask Before Booking',
                    body: '1) What\'s included in your price? 2) Do you bring supplies or should I? 3) Are you insured? 4) How do you handle breakages? 5) Can I see reviews from past customers?'
                }
            ],
            pdfContent: {
                diagnostic_questions: [
                    'When was your last professional deep clean?',
                    'Do you have pets or kids at home?',
                    'Is anyone in the household sensitive to dust/chemicals?',
                    'What areas need the most attention?',
                    'Do you have any special requests or restrictions?'
                ],
                common_mistakes: [
                    'Booking regular clean when you need deep clean',
                    'Not specifying important areas upfront',
                    'Choosing the cheapest option without checking reviews',
                    'Not confirming what\'s included in the price',
                    'Expecting deep clean results at regular clean prices'
                ],
                quick_tips: [
                    'Clear countertops before cleaner arrives',
                    'Point out problem areas at the start',
                    'Tip good cleaners to keep them coming back',
                    'Schedule recurring cleans for best rates',
                    'Ask for the same cleaner each time for consistency'
                ],
                price_ranges: [
                    'Regular clean (3hr): RM80-150',
                    'Deep clean: RM200-400',
                    'Move-out clean: RM300-600',
                    'Carpet/sofa: RM100-300'
                ]
            }
        },
        whatsappScripts: {
            opener: 'Hi boss 👋 You still doing cleaning jobs around {area}?\n\nI made a simple WhatsApp booking page for {business_name} that collects customer details automatically — so you don\'t miss bookings while cleaning.\n\nWant to see? 😄',
            followUp1: 'Hi boss 👋 Just checking — did you see my message?\n\nNo rush 👍',
            followUp2: 'Quick one boss 🙂\n\nMost cleaning services miss bookings when they\'re busy at a job.\nThis catches those leads for you.\n\nInterested to take a look?',
            closingPush: 'Last message from me boss 👍\n\nShould I send the preview?'
        },
        emailSequence: [
            {
                day: 1,
                subject: 'Your Cleaning Guide is Here! ✨',
                body: 'Hi!\n\nThanks for downloading our cleaning guide.\n\nThe key takeaway: Start with a deep clean if it\'s been a while, then maintain with regular cleaning. This actually saves money long-term!\n\nReady to book? Just reply to this email!\n\n{business_name}'
            },
            {
                day: 3,
                subject: 'Quick question...',
                body: 'Hi!\n\nWas our guide helpful in deciding what type of cleaning you need?\n\nIf you\'re still unsure, just reply with a brief description of your situation and we\'ll recommend the best option for you!\n\n{business_name}'
            },
            {
                day: 7,
                subject: 'Slots filling up this week',
                body: 'Hi!\n\nJust a heads up — our schedule is getting busy!\n\nIf you\'ve been meaning to book a cleaning, this week would be a good time to lock in a slot.\n\nReply to book or check availability!\n\n{business_name}'
            }
        ],
        colorScheme: {
            primary: '#7c3aed',
            secondary: '#8b5cf6',
            accent: '#a78bfa'
        }
    },

    electrical: {
        id: 'electrical',
        name: 'Electrical Services',
        emoji: '⚡',
        keywords: ['electric', 'wiring', 'socket', 'fuse', 'elektrik', 'pendawaian', 'electrician'],
        leadMagnet: {
            title: 'Home Electrical Safety Checklist',
            headline: 'Protect your family and prevent electrical fires',
            benefits: [
                'Identify dangerous electrical issues early',
                'Know when to call an electrician immediately',
                'Understand your home\'s electrical capacity',
                'Prevent common electrical accidents'
            ],
            content: [
                {
                    title: '1. Check Your Circuit Breaker Box',
                    body: 'Open your panel and look for: burnt smell, discolored breakers, buzzing sounds, or warm spots. These indicate dangerous wiring issues. If breakers trip frequently, your circuits are overloaded.'
                },
                {
                    title: '2. Test All Outlets',
                    body: 'Outlets should grip plugs firmly. Loose outlets cause arcing (sparks) which can start fires. Warm or discolored outlets need immediate attention. Test GFCI outlets in wet areas monthly.'
                },
                {
                    title: '3. Inspect Visible Wiring',
                    body: 'Look for frayed, cracked, or exposed wires anywhere in your home. Rodents often chew wires in hidden areas. If you see bare copper, turn off that circuit immediately.'
                },
                {
                    title: '4. Check for Overloaded Circuits',
                    body: 'Signs: Flickering lights when appliances turn on, warm outlet covers, need for many extension cords. Each circuit has a limit — typically 15-20 amps. Major appliances need dedicated circuits.'
                },
                {
                    title: '5. Warning Signs to Never Ignore',
                    body: 'Burning smell without visible source, sparks from outlets, frequent bulb burnouts, shock when touching appliances, buzzing switches. These are emergencies — call an electrician immediately.'
                }
            ],
            pdfContent: {
                diagnostic_questions: [
                    'How old is your home\'s electrical wiring?',
                    'Do breakers trip frequently?',
                    'Have you added major appliances recently?',
                    'Do lights flicker or dim unexpectedly?',
                    'Are any outlets/switches warm to touch?'
                ],
                common_mistakes: [
                    'Using extension cords as permanent wiring',
                    'Overloading circuits with multiple high-wattage items',
                    'Ignoring frequently tripping breakers',
                    'DIY electrical work without permits/knowledge',
                    'Using wrong bulb wattage in fixtures'
                ],
                quick_tips: [
                    'Never overload power strips',
                    'Replace two-prong outlets with grounded ones',
                    'Use surge protectors for electronics',
                    'Schedule inspection for homes 25+ years old',
                    'Keep water away from electrical sources'
                ],
                price_ranges: [
                    'Outlet replacement: RM50-100',
                    'Light installation: RM80-150',
                    'Panel inspection: RM150-300',
                    'Wiring upgrade: RM500-2000+'
                ]
            }
        },
        whatsappScripts: {
            opener: 'Hi boss 👋 You still handling electrical jobs around {area}?\n\nI made a simple WhatsApp booking page for {business_name} that captures customer enquiries while you\'re on-site — so you don\'t miss calls.\n\nWant to see? 😄',
            followUp1: 'Hi boss 👋 Just checking — did you catch my message?\n\nNo worries if busy! 👍',
            followUp2: 'Quick one boss 🙂\n\nMost electricians miss calls when they\'re up ladders or in ceiling spaces.\nThis tool catches those leads automatically.\n\nInterested?',
            closingPush: 'Last message from me boss 👍\n\nPreview — yes or skip?'
        },
        emailSequence: [
            {
                day: 1,
                subject: 'Your Electrical Safety Checklist ⚡',
                body: 'Hi!\n\nThanks for downloading our electrical safety guide.\n\nThe most important point: Never ignore burning smells or warm outlets. These are warning signs of potential electrical fires.\n\nIf you found any issues during your check, let us know — we can help!\n\n{business_name}'
            },
            {
                day: 3,
                subject: 'Did you check your circuit breaker?',
                body: 'Hi!\n\nJust checking in — did you have a chance to run through our safety checklist?\n\nMany homes have electrical issues that go unnoticed until something goes wrong. A quick inspection now can prevent major problems later.\n\nNeed help? We offer safety inspections!\n\n{business_name}'
            },
            {
                day: 7,
                subject: 'Before the next power surge...',
                body: 'Hi!\n\nWith the rainy season here, power surges and outages are more common.\n\nNow is a good time to check your surge protectors and consider a professional electrical inspection.\n\nReply to schedule!\n\n{business_name}'
            }
        ],
        colorScheme: {
            primary: '#ca8a04',
            secondary: '#eab308',
            accent: '#facc15'
        }
    },

    // Additional templates for future expansion
    roofing: {
        id: 'roofing',
        name: 'Roofing Services',
        emoji: '🏠',
        keywords: ['roof', 'gutter', 'atap', 'bumbung', 'leaking roof'],
        leadMagnet: {
            title: 'Roof Maintenance Seasonal Guide',
            headline: 'Extend your roof\'s life by 10+ years with proper care',
            benefits: [
                'Prevent costly water damage',
                'Know when repairs vs replacement needed',
                'Seasonal maintenance checklist',
                'Signs of hidden roof damage'
            ],
            content: [
                {
                    title: '1. Inspect After Every Storm',
                    body: 'Look for: missing/cracked tiles, debris accumulation, damaged flashing around vents. Binoculars from ground level work for initial check. Any damage should be addressed within 2 weeks.'
                },
                {
                    title: '2. Clean Gutters Twice Yearly',
                    body: 'Clogged gutters cause water to back up under roof tiles, leading to leaks and rot. Clean before and after rainy season. Check downspouts are draining away from foundation.'
                },
                {
                    title: '3. Check for Interior Warning Signs',
                    body: 'Water stains on ceilings, peeling paint near roofline, mold in attic, daylight visible through roof boards. These indicate active leaks that need immediate attention.'
                },
                {
                    title: '4. Trim Overhanging Branches',
                    body: 'Branches scratching roof surface damage protective coating. Falling branches during storms cause major damage. Keep trees 3+ meters from roof edge.'
                },
                {
                    title: '5. Know Your Roof\'s Age',
                    body: 'Concrete tiles: 30-50 years. Metal roofing: 40-70 years. Clay tiles: 50+ years. If your roof is approaching these ages, schedule a professional inspection before problems appear.'
                }
            ],
            pdfContent: {
                diagnostic_questions: [
                    'How old is your current roof?',
                    'Do you notice any missing or cracked tiles?',
                    'Are there water stains on your ceiling?',
                    'When were gutters last cleaned?',
                    'Any leak during heavy rain?'
                ],
                common_mistakes: [
                    'Ignoring small leaks until they become big',
                    'Walking on roof without proper safety',
                    'Pressure washing tiles (damages coating)',
                    'Not cleaning gutters regularly',
                    'Patching instead of proper repair'
                ],
                quick_tips: [
                    'Check roof after every major storm',
                    'Keep gutters clear of leaves',
                    'Address moss/algae growth early',
                    'Get inspection every 3-5 years',
                    'Document roof condition with photos'
                ],
                price_ranges: [
                    'Gutter cleaning: RM100-200',
                    'Tile replacement: RM50-150/tile',
                    'Leak repair: RM200-500',
                    'Full replacement: RM5000-20000+'
                ]
            }
        },
        whatsappScripts: {
            opener: 'Hi boss 👋 You still doing roofing jobs around {area}?\n\nI made a simple WhatsApp booking page for {business_name} that captures customer enquiries automatically.\n\nWant to see? 😄',
            followUp1: 'Hi boss 👋 Just checking — did you see my message?\n\nNo rush 👍',
            followUp2: 'Quick one boss — most roofers miss calls when on top of roofs.\nThis tool catches those leads for you.\n\nInterested?',
            closingPush: 'Last message from me boss 👍\n\nShould I send the preview?'
        },
        emailSequence: [
            {
                day: 1,
                subject: 'Your Roof Maintenance Guide 🏠',
                body: 'Hi!\n\nThanks for downloading our roof care guide.\n\nKey tip: Most roof damage starts small and gets worse with each rain. Catching issues early saves thousands.\n\nNeed an inspection? We\'re here to help!\n\n{business_name}'
            },
            {
                day: 3,
                subject: 'Checked your roof lately?',
                body: 'Hi!\n\nJust checking in — have you noticed any of the warning signs from our guide?\n\nWith rainy season approaching, now\'s the best time for repairs while it\'s still dry.\n\nReply if you need an assessment!\n\n{business_name}'
            },
            {
                day: 7,
                subject: 'Before the next heavy rain...',
                body: 'Hi!\n\nQuick reminder — small roof issues become big problems during monsoon season.\n\nIf you\'ve been putting off repairs, now\'s the time to act!\n\nLet us know if you need help.\n\n{business_name}'
            }
        ],
        colorScheme: {
            primary: '#dc2626',
            secondary: '#ef4444',
            accent: '#f87171'
        }
    }
};

/**
 * Get template by industry ID
 */
export function getTemplateById(id: string): IndustryTemplate | undefined {
    return INDUSTRY_TEMPLATES[id];
}

/**
 * Auto-detect industry from niche/keywords
 */
export function detectIndustry(niche: string): string {
    const searchText = niche.toLowerCase();

    for (const [id, template] of Object.entries(INDUSTRY_TEMPLATES)) {
        if (template.keywords.some(keyword => searchText.includes(keyword))) {
            return id;
        }
    }

    return 'other';
}

/**
 * Get all available templates for selection
 */
export function getAllTemplates(): Array<{ id: string; name: string; emoji: string }> {
    return Object.values(INDUSTRY_TEMPLATES).map(t => ({
        id: t.id,
        name: t.name,
        emoji: t.emoji
    }));
}

/**
 * Generate complete business data from template
 */
export function generateFromTemplate(
    templateId: string,
    businessInfo: { name: string; phone: string; area: string; email?: string }
): object {
    const template = INDUSTRY_TEMPLATES[templateId];
    if (!template) return {};

    // Replace placeholders in scripts
    const replaceVars = (text: string) =>
        text
            .replace(/{business_name}/g, businessInfo.name)
            .replace(/{area}/g, businessInfo.area)
            .replace(/{phone}/g, businessInfo.phone);

    return {
        businessName: businessInfo.name,
        niche: template.name,
        phone: businessInfo.phone,
        email: businessInfo.email || '',
        city: businessInfo.area,
        template: templateId,
        lead_magnet_title: template.leadMagnet.title,
        lead_magnet_headline: template.leadMagnet.headline,
        lead_magnet_benefits: template.leadMagnet.benefits,
        lead_magnet_content: template.leadMagnet.content,
        lead_magnet_pdf: template.leadMagnet.pdfContent,
        email_sequence: template.emailSequence.map(e => ({
            ...e,
            body: replaceVars(e.body)
        })),
        whatsapp_scripts: {
            opener: replaceVars(template.whatsappScripts.opener),
            followUp1: replaceVars(template.whatsappScripts.followUp1),
            followUp2: replaceVars(template.whatsappScripts.followUp2),
            closingPush: replaceVars(template.whatsappScripts.closingPush)
        },
        design_preferences: {
            colorScheme: template.colorScheme
        }
    };
}
