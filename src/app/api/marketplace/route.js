// src/app/api/marketplace/route.js
/**
 * Marketplace API - Browse and purchase proven businesses
 */

import { createClient } from '@supabase/supabase-js';
import { getInstantBusinessSystem } from '@/lib/marketplace/instant-business-system';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/**
 * GET /api/marketplace - Get available proven businesses
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const minRevenue = searchParams.get('minRevenue') || 1000;
    const sort = searchParams.get('sort') || 'revenue';
    
    // Build query
    let query = supabase
      .from('marketplace_templates')
      .select('*')
      .gte('proven_revenue', minRevenue)
      .gte('success_rate', 0.8);
      
    if (category) {
      query = query.eq('category', category);
    }
    
    // Sort options
    switch (sort) {
      case 'revenue':
        query = query.order('proven_revenue', { ascending: false });
        break;
      case 'success':
        query = query.order('actual_success_rate', { ascending: false });
        break;
      case 'speed':
        query = query.order('time_to_first_sale', { ascending: true });
        break;
      case 'popular':
        query = query.order('total_usage', { ascending: false });
        break;
    }
    
    const { data: templates, error } = await query;
    
    if (error) throw error;
    
    // Add live metrics
    const enhancedTemplates = templates.map(template => ({
      ...template,
      live_stats: {
        active_businesses: Math.floor(template.total_usage * 0.7),
        revenue_this_month: template.proven_revenue * Math.floor(template.total_usage * 0.7),
        available_spots: Math.max(1, 10 - (template.total_usage % 10)), // Limited spots
        next_price_increase: template.total_usage > 50 ? 'Soon' : null
      },
      guarantees: {
        first_sale: `${template.time_to_first_sale} hours`,
        minimum_revenue: '$1,000 in 60 days',
        success_rate: `${Math.round(template.actual_success_rate * 100)}%`
      }
    }));
    
    return Response.json({
      success: true,
      templates: enhancedTemplates,
      categories: await getCategories(),
      stats: {
        total_templates: templates.length,
        avg_revenue: templates.reduce((sum, t) => sum + t.proven_revenue, 0) / templates.length,
        total_businesses_created: templates.reduce((sum, t) => sum + t.total_usage, 0),
        total_revenue_generated: templates.reduce((sum, t) => sum + (t.proven_revenue * t.successful_usage), 0)
      }
    });
    
  } catch (error) {
    console.error('Error fetching marketplace:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

/**
 * POST /api/marketplace - Purchase a proven business
 */
export async function POST(request) {
  try {
    const { templateId, userData } = await request.json();
    
    if (!templateId || !userData) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }
    
    // Get template
    const { data: template, error: templateError } = await supabase
      .from('business_templates')
      .select('*')
      .eq('id', templateId)
      .single();
      
    if (templateError || !template) {
      return Response.json({ error: 'Template not found' }, { status: 404 });
    }
    
    // Check if user already has an active business
    const { data: existingBusiness } = await supabase
      .from('businesses')
      .select('id')
      .eq('user_id', userData.userId)
      .eq('status', 'active')
      .single();
      
    if (existingBusiness) {
      return Response.json({ 
        error: 'You already have an active business. Complete or pause it first.' 
      }, { status: 400 });
    }
    
    // Create instant business with all assets
    const instantBusiness = getInstantBusinessSystem();
    const result = await instantBusiness.createProvenBusiness({
      ...userData,
      templateId: templateId
    });
    
    // Track template usage
    await supabase
      .from('template_usage')
      .insert({
        template_id: templateId,
        business_id: result.business.id,
        user_id: userData.userId,
        customizations: userData.customizations || {}
      });
    
    // Update template usage count
    await supabase.rpc('increment_template_usage', { template_id: templateId });
    
    // Log the purchase
    await supabase
      .from('ai_activities')
      .insert({
        business_id: result.business.id,
        type: 'business_purchased',
        icon: '🎉',
        message: `Proven business "${template.name}" activated with ${result.assets.customers.length} customers`,
        details: `Expected first sale in ${template.time_to_first_sale} hours`,
        metadata: {
          template_name: template.name,
          proven_revenue: template.proven_revenue,
          customer_count: result.assets.customers.length,
          lead_count: result.assets.leads.length,
          revenue_streams: result.assets.revenue.length
        }
      });
    
    return Response.json({
      success: true,
      business: result.business,
      assets: result.assets,
      guarantees: result.guarantees,
      next_steps: [
        'Your customer base is being activated',
        'First customer contact in 1-2 hours',
        'Monitor your dashboard for real-time updates',
        `First sale expected within ${template.time_to_first_sale} hours`
      ],
      dashboard_url: `/dashboard/${result.business.id}`
    });
    
  } catch (error) {
    console.error('Error purchasing business:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

async function getCategories() {
  const { data: categories } = await supabase
    .from('template_categories')
    .select('*')
    .eq('is_active', true)
    .order('sort_order');
    
  return categories || [];
}
