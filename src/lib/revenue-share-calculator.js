// src/lib/revenue-share-calculator.js
/**
 * Revenue Share Calculator
 * 
 * Calculates Launchfly's cut and business owner's portion based on plan tier
 * - Starter: 20% revenue share until $1k, then 15%
 * - Pro: 10% revenue share until $2k, then 8%  
 * - Scale: 5% revenue share until $5k, then 3%
 */

export function calculateRevenueShare(business, saleAmount) {
  const planTier = business.plan_tier || 'starter';
  const currentRevenue = business.total_revenue || 0;
  
  // Revenue share tiers with performance-based reduction
  const tiers = {
    starter: {
      initial: 0.20, // 20% until $1k
      reduced: 0.15, // 15% after $1k
      threshold: 1000
    },
    pro: {
      initial: 0.10, // 10% until $2k
      reduced: 0.08, // 8% after $2k
      threshold: 2000
    },
    scale: {
      initial: 0.05, // 5% until $5k
      reduced: 0.03, // 3% after $5k
      threshold: 5000
    }
  };

  const tier = tiers[planTier] || tiers.starter;
  const percentage = currentRevenue >= tier.threshold ? tier.reduced : tier.initial;
  
  // Calculate amounts
  const launchflyFee = saleAmount * percentage;
  const businessAmount = saleAmount - launchflyFee;
  
  return {
    saleAmount: saleAmount,
    launchflyFee: launchflyFee,
    businessAmount: businessAmount,
    percentage: percentage,
    planTier: planTier,
    currentRevenue: currentRevenue,
    threshold: tier.threshold,
    isReduced: currentRevenue >= tier.threshold
  };
}
