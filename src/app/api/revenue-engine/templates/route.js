/**
 * API endpoint for business template selection and application
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAllTemplates, getTemplate } from '@/lib/revenue-engine/business-templates';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/**
 * GET - Retrieve available business templates
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const templateId = searchParams.get('id');
    const category = searchParams.get('category');
    
    if (templateId) {
      // Get specific template
      const template = getTemplate(templateId);
      
      if (!template) {
        return NextResponse.json(
          { error: 'Template not found' },
          { status: 404 }
        );
      }
      
      // Enhance with performance data
      const enhancedTemplate = await enhanceTemplateWithMetrics(template);
      
      return NextResponse.json({
        success: true,
        template: enhancedTemplate
      });
    }
    
    // Get all templates
    let templates = getAllTemplates();
    
    // Filter by category if provided
    if (category) {
      templates = templates.filter(t => t.category === category);
    }
    
    // Enhance templates with real performance metrics
    const enhancedTemplates = await Promise.all(
      templates.map(t => enhanceTemplateWithMetrics(t))
    );
    
    // Sort by success rate and revenue potential
    enhancedTemplates.sort((a, b) => {
      const scoreA = (a.metrics.successRate * a.revenueModel.total) / 100;
      const scoreB = (b.metrics.successRate * b.revenueModel.total) / 100;
      return scoreB - scoreA;
    });
    
    return NextResponse.json({
      success: true,
      templates: enhancedTemplates,
      count: enhancedTemplates.length
    });
    
  } catch (error) {
    console.error('Failed to get templates:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve templates' },
      { status: 500 }
    );
  }
}

/**
 * POST - Apply a template to a business
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { businessId, templateId } = body;
    
    if (!businessId || !templateId) {
      return NextResponse.json(
        { error: 'Business ID and Template ID are required' },
        { status: 400 }
      );
    }
    
    // Get business
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', businessId)
      .single();
    
    if (businessError || !business) {
      return NextResponse.json(
        { error: 'Business not found' },
        { status: 404 }
      );
    }
    
    // Get template
    const template = getTemplate(templateId);
    
    if (!template) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      );
    }
    
    console.log(`Applying template ${template.name} to business ${business.name}`);
    
    // Apply template to business
    const result = await applyTemplate(business, template);
    
    // Update business with template
    await supabase
      .from('businesses')
      .update({
        template_id: templateId,
        template_applied_at: new Date().toISOString(),
        business_model: template.revenueModel,
        projected_revenue: calculateTotalRevenue(template.revenueModel)
      })
      .eq('id', businessId);
    
    // Log template application
    await supabase
      .from('events')
      .insert({
        business_id: businessId,
        type: 'template_applied',
        data: {
          template_id: templateId,
          template_name: template.name,
          products_created: result.productsCreated,
          services_created: result.servicesCreated
        },
        created_at: new Date().toISOString()
      });
    
    return NextResponse.json({
      success: true,
      message: `Template "${template.name}" applied successfully`,
      data: {
        businessId: businessId,
        templateId: templateId,
        productsCreated: result.productsCreated,
        servicesCreated: result.servicesCreated,
        subscriptionsCreated: result.subscriptionsCreated,
        projectedRevenue: calculateTotalRevenue(template.revenueModel),
        timeToFirstSale: template.timeToFirstSale
      }
    });
    
  } catch (error) {
    console.error('Failed to apply template:', error);
    return NextResponse.json(
      { error: 'Failed to apply template', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * Apply template to business
 */
async function applyTemplate(business, template) {
  let productsCreated = 0;
  let servicesCreated = 0;
  let subscriptionsCreated = 0;
  
  // Create products
  if (template.products && template.products.length > 0) {
    for (const product of template.products) {
      await supabase
        .from('products')
        .insert({
          business_id: business.id,
          name: product.name,
          description: product.description,
          price: product.basePrice,
          category: product.category,
          features: product.features,
          image_url: product.imageUrl,
          status: 'active'
        });
      productsCreated++;
    }
  }
  
  // Create services
  if (template.services && template.services.length > 0) {
    for (const service of template.services) {
      await supabase
        .from('services')
        .insert({
          business_id: business.id,
          name: service.name,
          description: service.description,
          category: service.category,
          tiers: service.tiers,
          status: 'active'
        });
      servicesCreated++;
    }
  }
  
  // Create subscription plans
  if (template.subscriptions && template.subscriptions.length > 0) {
    for (const subscription of template.subscriptions) {
      await supabase
        .from('subscription_plans')
        .insert({
          business_id: business.id,
          name: subscription.name,
          description: subscription.description,
          monthly_price: subscription.monthlyPrice,
          features: subscription.features,
          trial_days: subscription.trialDays,
          status: 'active'
        });
      subscriptionsCreated++;
    }
  }
  
  // Create digital products
  if (template.digitalProducts && template.digitalProducts.length > 0) {
    for (const digital of template.digitalProducts) {
      await supabase
        .from('digital_products')
        .insert({
          business_id: business.id,
          name: digital.name,
          description: digital.description,
          price: digital.price,
          category: digital.category,
          file_type: digital.fileType,
          download_limit: digital.downloadLimit,
          status: 'active'
        });
    }
  }
  
  // Setup affiliate programs
  if (template.affiliatePrograms && template.affiliatePrograms.length > 0) {
    for (const affiliate of template.affiliatePrograms) {
      await supabase
        .from('affiliate_programs')
        .insert({
          business_id: business.id,
          name: affiliate.name,
          product_name: affiliate.productName,
          commission_rate: affiliate.commissionRate,
          cookie_duration: affiliate.cookieDuration,
          affiliate_link: affiliate.affiliateLink,
          status: 'active'
        });
    }
  }
  
  return {
    productsCreated,
    servicesCreated,
    subscriptionsCreated
  };
}

/**
 * Enhance template with real metrics
 */
async function enhanceTemplateWithMetrics(template) {
  // Get performance data from businesses using this template
  const { data: businesses } = await supabase
    .from('businesses')
    .select('total_revenue, created_at')
    .eq('template_id', template.id)
    .not('total_revenue', 'is', null);
  
  let metrics = {
    totalBusinesses: businesses?.length || 0,
    averageRevenue: 0,
    successRate: 0,
    topRevenue: 0
  };
  
  if (businesses && businesses.length > 0) {
    const revenues = businesses.map(b => b.total_revenue);
    metrics.averageRevenue = revenues.reduce((a, b) => a + b, 0) / revenues.length;
    metrics.successRate = businesses.filter(b => b.total_revenue > 1000).length / businesses.length;
    metrics.topRevenue = Math.max(...revenues);
  } else {
    // Use template defaults if no real data
    metrics.averageRevenue = calculateTotalRevenue(template.revenueModel);
    metrics.successRate = getDefaultSuccessRate(template.demandLevel);
    metrics.topRevenue = metrics.averageRevenue * 3;
  }
  
  // Calculate total potential revenue
  const totalRevenue = calculateTotalRevenue(template.revenueModel);
  
  return {
    ...template,
    metrics,
    revenueModel: {
      ...template.revenueModel,
      total: totalRevenue
    }
  };
}

/**
 * Calculate total revenue from model
 */
function calculateTotalRevenue(revenueModel) {
  return Object.values(revenueModel).reduce((sum, val) => {
    return sum + (typeof val === 'number' ? val : 0);
  }, 0);
}

/**
 * Get default success rate based on demand level
 */
function getDefaultSuccessRate(demandLevel) {
  const rates = {
    'high_demand': 0.85,
    'proven': 0.75,
    'new': 0.60,
    'experimental': 0.45
  };
  
  return rates[demandLevel] || 0.70;
}
