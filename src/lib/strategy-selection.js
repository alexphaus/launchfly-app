// src/lib/strategy-selection.js
// Heuristic strategy selector (v0) with explainability and guardrails

import { logActivity, ActivityTypes } from './activity-logger';

/**
 * Compute channel fit scores and produce a plan JSON the orchestrator can run
 * @param {string} businessId
 * @param {object} businessData
 * @returns {Promise<{ plan: object }>} plan with channels, caps, KPIs, rationale
 */
export async function selectAcquisitionStrategy(businessId, businessData) {
  const analysis = analyzeBusinessHeuristics(businessData);
  const plan = composePlan(analysis, businessData);

  // Log the selected plan for observability
  await logActivity(businessId, {
    type: ActivityTypes.STRATEGY_SELECTED,
    icon: '🧭',
    message: `AI selected acquisition strategy: ${plan.strategy_id}`,
    details: 'Initial channel mix, caps, and KPIs set',
    metadata: plan,
  });

  return { plan };
}

function analyzeBusinessHeuristics(businessData) {
  const niche = (businessData?.niche || businessData?.businessName || '').toLowerCase();
  const products = businessData?.products || [];
  const productText = JSON.stringify(products).toLowerCase();

  const isB2B = /consult|b2b|enterprise|retainer|saas|agency|audit|advis/i.test(productText);
  const hasLocalIntent = /yoga|plumb|dental|clinic|repair|spa|fitness|local|landscap|clean|real estate|roof/i.test(
    niche
  );
  const isCreator = /course|coaching|content|creator|newsletter|prompt|ebook|template|workshop/i.test(
    productText
  );

  return { isB2B, hasLocalIntent, isCreator };
}

function composePlan(analysis, businessData) {
  const baseCaps = defaultCaps(businessData);
  const kpis = { target_cpl_ql: 40, min_samples: { email_sends: 200, ad_impressions: 1000 } };
  const rationale = [];
  const channels = [];

  if (analysis.hasLocalIntent && !analysis.isB2B) {
    // Local service (e.g., Yoga) → social + content + paid local
    channels.push(
      { name: 'content', weight: 0.4, daily_cap_usd: baseCaps.content, stop_loss_usd: baseCaps.content * 2 },
      { name: 'social', weight: 0.4, daily_cap_usd: baseCaps.social, stop_loss_usd: baseCaps.social * 2 },
      { name: 'paid', weight: 0.2, daily_cap_usd: baseCaps.paid, stop_loss_usd: baseCaps.paid * 2 }
    );
    rationale.push('Local intent and visual niche → prioritize IG/TikTok + content, test small paid.');
  } else if (analysis.isB2B) {
    // B2B expert/consultant → cold email + LinkedIn + content
    channels.push(
      { name: 'cold_email', weight: 0.5, daily_cap_sends: 40, stop_loss_usd: 25 },
      { name: 'content', weight: 0.3, daily_cap_usd: baseCaps.content, stop_loss_usd: baseCaps.content * 2 },
      { name: 'social', weight: 0.2, daily_cap_usd: baseCaps.social, stop_loss_usd: baseCaps.social * 2 }
    );
    rationale.push('High ACV B2B → outbound + thought leadership.');
  } else if (analysis.isCreator) {
    channels.push(
      { name: 'content', weight: 0.5, daily_cap_usd: baseCaps.content, stop_loss_usd: baseCaps.content * 2 },
      { name: 'social', weight: 0.3, daily_cap_usd: baseCaps.social, stop_loss_usd: baseCaps.social * 2 },
      { name: 'paid', weight: 0.2, daily_cap_usd: baseCaps.paid, stop_loss_usd: baseCaps.paid * 2 }
    );
    rationale.push('Creator model → content-first with light paid to seed.');
  } else {
    channels.push(
      { name: 'content', weight: 0.34, daily_cap_usd: baseCaps.content, stop_loss_usd: baseCaps.content * 2 },
      { name: 'social', weight: 0.33, daily_cap_usd: baseCaps.social, stop_loss_usd: baseCaps.social * 2 },
      { name: 'paid', weight: 0.33, daily_cap_usd: baseCaps.paid, stop_loss_usd: baseCaps.paid * 2 }
    );
    rationale.push('Default diversified mix with tight caps.');
  }

  return {
    strategy_id: 'adaptive_v0_heuristics',
    experiment_id: `exp_${Date.now()}`,
    channels,
    kpis,
    rationale,
    dry_run: process.env.ACQUISITION_DRY_RUN === 'true',
  };
}

function defaultCaps(_businessData) {
  const global = Number(process.env.ACQUISITION_GLOBAL_DAILY_CAP_USD || 100);
  const content = Math.round(global * 0.3);
  const social = Math.round(global * 0.3);
  const paid = Math.round(global * 0.4);
  return { content, social, paid, global };
}

export function isChannelEnabled(plan, channelName) {
  return plan.channels.some((c) => c.name === channelName);
}


