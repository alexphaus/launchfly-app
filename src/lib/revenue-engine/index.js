/**
 * Revenue Generation Engine - Main Export
 * Central hub for all money generation components
 */

// Core Engine
export { RevenueGenerationEngine } from './core';
export { default as RevenueEngine } from './core';

// AI Optimization
export { RevenueOptimizer } from './ai-optimizer';
export { default as AIOptimizer } from './ai-optimizer';

// Business Templates
export { 
  BUSINESS_TEMPLATES,
  getTemplate,
  getAllTemplates,
  getTemplatesByCategory,
  getRecommendedTemplate
} from './business-templates';

// Marketplace Integration
export { MarketplaceConnector } from './marketplace-connector';
export { default as Marketplace } from './marketplace-connector';

// Fulfillment System
export { FulfillmentEngine } from './fulfillment-engine';
export { default as Fulfillment } from './fulfillment-engine';

// Email Marketing
export { EmailMarketing } from './email-marketing';
export { default as EmailEngine } from './email-marketing';

// Social Commerce
export { SocialCommerce } from './social-commerce';
export { default as SocialEngine } from './social-commerce';

// Initialize complete revenue system
export async function initializeRevenueSystem(businessId, templateId, preferences = {}) {
  const { RevenueGenerationEngine } = await import('./core');
  const { getTemplate } = await import('./business-templates');
  
  const engine = new RevenueGenerationEngine();
  const template = getTemplate(templateId);
  
  if (!template) {
    throw new Error(`Template ${templateId} not found`);
  }
  
  return await engine.initializeForBusiness(businessId, template, preferences);
}

// Quick revenue check
export async function getRevenueStatus(businessId) {
  const { createClient } = await import('@supabase/supabase-js');
  
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );
  
  const { data: status } = await supabase
    .from('revenue_engine_status')
    .select('*')
    .eq('business_id', businessId)
    .single();
  
  const { data: transactions } = await supabase
    .from('revenue_transactions')
    .select('amount')
    .eq('business_id', businessId);
  
  const totalRevenue = transactions?.reduce((sum, t) => sum + parseFloat(t.amount), 0) || 0;
  
  return {
    initialized: !!status,
    status: status?.status || 'not_initialized',
    streams: status?.streams_count || 0,
    projectedRevenue: status?.projected_monthly_revenue || 0,
    actualRevenue: totalRevenue,
    lastOptimization: status?.last_optimization
  };
}

// Track revenue event
export async function trackRevenue(businessId, amount, source, metadata = {}) {
  const { RevenueGenerationEngine } = await import('./core');
  const engine = new RevenueGenerationEngine();
  
  return await engine.trackRevenue(businessId, amount, source, metadata);
}

// Default export
export default {
  RevenueGenerationEngine,
  RevenueOptimizer,
  BUSINESS_TEMPLATES,
  MarketplaceConnector,
  FulfillmentEngine,
  EmailMarketing,
  SocialCommerce,
  initializeRevenueSystem,
  getRevenueStatus,
  trackRevenue
};
