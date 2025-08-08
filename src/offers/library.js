// src/offers/library.js
// Minimal curated offers library to ensure instant, high-converting SKUs.
// Returns 3 packages tailored to the opportunity but consistent in structure.

function asDollar(amount) {
  try {
    const n = Number(amount);
    if (Number.isFinite(n)) return `$${Math.round(n)}`;
  } catch (_) {}
  return "$97";
}

export function getCuratedOffers(opportunity = {}) {
  const niche = (opportunity.niche || opportunity.businessType || 'business').toLowerCase();
  const label = opportunity.businessName || 'your business';

  // Three opinionated SKUs optimized for a quick first sale and easy fulfillment
  const offers = [
    {
      id: 'lead-gen-starter',
      sku: 'LG-STARTER',
      name: 'Local Lead‑Gen Starter',
      price: asDollar(49),
      description: `"5 booked leads" fast-start offer (e.g., dental whitening, pest control). Includes landing setup + booking + basic automations. Built to close under 48h for ${label}.`,
      category: 'leadgen',
      sop: {
        checklist: [
          'Pick sub-niche + geo',
          'Publish single-page lead magnet',
          'Hook up booking form + notifications',
          'Add Stripe Checkout low-ticket entry',
        ],
        delivery: 'Drive folder + Notion portal; leads sheet shared; weekly recap email'
      }
    },
    {
      id: 'ai-content-sprint',
      sku: 'AI-SPRINT',
      name: 'AI Content Sprint (10 posts + 3 shorts)',
      price: asDollar(97),
      description: `Rapid content package for ${label}: 10 posts + 3 short videos tailored to niche and channel. Includes brand voice + prompt library.`,
      category: 'content',
      sop: {
        checklist: [
          'Collect brand brief',
          'Generate content set with review round',
          'Export assets + schedule posts',
          'Provide prompt pack + usage guide'
        ],
        delivery: 'Drive assets, social scheduler links, Notion content board'
      }
    },
    {
      id: 'website-in-a-day',
      sku: 'WIA-DAY',
      name: 'Website‑in‑a‑Day (Lead Magnet)',
      price: asDollar(297),
      description: `Single-page, conversion‑optimized site for ${label} with lead magnet, checkout, and tracking. Delivered in 24 hours.`,
      category: 'website',
      sop: {
        checklist: [
          'Select template + theme',
          'Wire copy + offers',
          'Attach Stripe Checkout',
          'QA + publish on subdomain'
        ],
        delivery: 'Live site + CMS instructions + weekly metrics email'
      }
    }
  ];

  // Light tailoring for niche in descriptions
  return offers.map(o => ({
    ...o,
    description: o.description.replace('for your business', `for ${label}`).replace('for business', `for ${label}`)
  }));
}
