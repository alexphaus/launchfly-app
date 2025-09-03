/**
 * API endpoint to initialize the Revenue Generation Engine
 * Called after business onboarding to set up all money generation systems
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { RevenueGenerationEngine } from '@/lib/revenue-engine/core';
import { getTemplate } from '@/lib/revenue-engine/business-templates';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export async function POST(request) {
  console.log('=== INITIALIZING REVENUE ENGINE ===');
  
  try {
    const body = await request.json();
    const { businessId, templateId, userPreferences } = body;
    
    if (!businessId) {
      return NextResponse.json(
        { error: 'Business ID is required' },
        { status: 400 }
      );
    }
    
    // Get business details
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', businessId)
      .single();
    
    if (businessError || !business) {
      console.error('Business not found:', businessError);
      return NextResponse.json(
        { error: 'Business not found' },
        { status: 404 }
      );
    }
    
    console.log(`Initializing revenue engine for: ${business.name}`);
    
    // Get or determine template
    let template;
    if (templateId) {
      template = getTemplate(templateId);
    } else {
      // Auto-select template based on business data
      template = await selectBestTemplate(business);
    }
    
    if (!template) {
      console.error('No suitable template found');
      return NextResponse.json(
        { error: 'No suitable business template found' },
        { status: 400 }
      );
    }
    
    console.log(`Using template: ${template.name}`);
    
    // Initialize the revenue engine
    const engine = new RevenueGenerationEngine();
    const result = await engine.initializeForBusiness(
      businessId,
      template,
      userPreferences || {}
    );
    
    // Update business with revenue engine data
    await supabase
      .from('businesses')
      .update({
        revenue_engine_active: true,
        template_id: template.id,
        projected_monthly_revenue: result.projectedMonthlyRevenue,
        estimated_first_sale: new Date(Date.now() + result.timeToFirstSale * 60 * 60 * 1000).toISOString()
      })
      .eq('id', businessId);
    
    // Log success event
    await supabase
      .from('events')
      .insert({
        business_id: businessId,
        type: 'revenue_engine_initialized',
        data: {
          template: template.id,
          streams: result.streams,
          projected_revenue: result.projectedMonthlyRevenue
        },
        created_at: new Date().toISOString()
      });
    
    // Send success notification
    await sendInitializationEmail(business, template, result);
    
    return NextResponse.json({
      success: true,
      message: 'Revenue engine initialized successfully',
      data: {
        businessId: businessId,
        template: {
          id: template.id,
          name: template.name,
          category: template.category
        },
        revenueStreams: result.streams,
        projectedMonthlyRevenue: result.projectedMonthlyRevenue,
        estimatedTimeToFirstSale: `${result.timeToFirstSale} hours`,
        nextSteps: getNextSteps(template)
      }
    });
    
  } catch (error) {
    console.error('Revenue engine initialization failed:', error);
    
    // Log error
    await supabase
      .from('errors')
      .insert({
        type: 'revenue_engine_initialization',
        error: error.message,
        stack: error.stack,
        occurred_at: new Date().toISOString()
      });
    
    return NextResponse.json(
      { 
        error: 'Failed to initialize revenue engine',
        details: error.message 
      },
      { status: 500 }
    );
  }
}

/**
 * Auto-select best template based on business data
 */
async function selectBestTemplate(business) {
  const { getRecommendedTemplate } = await import('@/lib/revenue-engine/business-templates');
  
  // Extract user data from business
  const userData = {
    interests: extractInterests(business),
    experience: business.experience_level || 'beginner',
    budget: business.budget || 'medium',
    goals: business.goals || []
  };
  
  return getRecommendedTemplate(userData);
}

/**
 * Extract interests from business data
 */
function extractInterests(business) {
  const interests = [];
  
  // Parse from business type and description
  const businessType = business.business_type?.toLowerCase() || '';
  const description = business.description?.toLowerCase() || '';
  
  if (businessType.includes('ecommerce') || description.includes('sell')) {
    interests.push('ecommerce');
  }
  
  if (businessType.includes('service') || description.includes('service')) {
    interests.push('services');
  }
  
  if (businessType.includes('coach') || description.includes('coaching')) {
    interests.push('coaching');
  }
  
  if (businessType.includes('digital') || description.includes('online')) {
    interests.push('digital');
  }
  
  if (businessType.includes('content') || description.includes('content')) {
    interests.push('content');
  }
  
  if (businessType.includes('saas') || description.includes('software')) {
    interests.push('software');
  }
  
  return interests.length > 0 ? interests : ['ecommerce']; // Default
}

/**
 * Get next steps for user
 */
function getNextSteps(template) {
  const steps = [
    {
      step: 1,
      title: 'Complete Business Setup',
      description: 'Finish setting up your business profile and branding',
      action: 'Go to Settings',
      completed: false
    },
    {
      step: 2,
      title: 'Connect Payment Processing',
      description: 'Connect Stripe to start accepting payments',
      action: 'Connect Stripe',
      completed: false
    },
    {
      step: 3,
      title: 'Review Products/Services',
      description: `Review and customize your ${template.products ? 'products' : 'services'}`,
      action: 'View Catalog',
      completed: false
    },
    {
      step: 4,
      title: 'Launch Marketing Campaigns',
      description: 'Activate automated marketing to drive traffic',
      action: 'Start Marketing',
      completed: false
    },
    {
      step: 5,
      title: 'Monitor Performance',
      description: 'Track revenue and optimize for growth',
      action: 'View Analytics',
      completed: false
    }
  ];
  
  return steps;
}

/**
 * Send initialization success email
 */
async function sendInitializationEmail(business, template, result) {
  // Import Resend
  const { Resend } = await import('resend');
  const resend = new Resend(process.env.RESEND_API_KEY);
  
  const emailHtml = `
    <h2>🚀 Your Revenue Engine is Live!</h2>
    <p>Hi ${business.owner_name || 'there'},</p>
    <p>Great news! Your ${template.name} business is now fully activated and ready to generate revenue.</p>
    
    <h3>What We've Set Up For You:</h3>
    <ul>
      <li>✅ ${result.streams} revenue streams activated</li>
      <li>✅ Projected monthly revenue: $${result.projectedMonthlyRevenue}</li>
      <li>✅ Expected first sale: Within ${result.timeToFirstSale} hours</li>
      <li>✅ Marketing campaigns: Launching automatically</li>
      <li>✅ Fulfillment: Fully automated</li>
    </ul>
    
    <h3>Your Revenue Streams:</h3>
    <ul>
      ${template.products ? '<li>Product Sales - Direct to consumer</li>' : ''}
      ${template.services ? '<li>Service Delivery - High-ticket offerings</li>' : ''}
      ${template.subscriptions ? '<li>Recurring Revenue - Monthly subscriptions</li>' : ''}
      ${template.digitalProducts ? '<li>Digital Downloads - Passive income</li>' : ''}
      ${template.affiliatePrograms ? '<li>Affiliate Commissions - Partner revenue</li>' : ''}
      <li>Upsells & Cross-sells - Maximize order value</li>
    </ul>
    
    <h3>What Happens Next:</h3>
    <ol>
      <li>Our AI is optimizing your pricing for maximum conversions</li>
      <li>Marketing campaigns will start driving traffic within 1 hour</li>
      <li>You'll receive your first customer inquiry within ${result.timeToFirstSale} hours</li>
      <li>All sales will be automatically fulfilled</li>
      <li>Revenue will be deposited directly to your account</li>
    </ol>
    
    <p><strong>Important:</strong> Make sure to complete your Stripe connection to receive payments.</p>
    
    <a href="https://app.launchfly.com/dashboard/${business.id}" style="display:inline-block;background:#4F46E5;color:white;padding:12px 24px;text-decoration:none;border-radius:8px;margin:20px 0;">View Your Dashboard</a>
    
    <p>Questions? Reply to this email and we'll help you out!</p>
    
    <p>Here's to your success! 🎉</p>
    <p>The Launchfly Team</p>
  `;
  
  try {
    await resend.emails.send({
      from: 'success@launchfly.com',
      to: business.email || business.owner_email,
      subject: `🎉 Your ${template.name} is Live and Ready to Make Money!`,
      html: emailHtml
    });
    
    console.log('Initialization email sent successfully');
  } catch (error) {
    console.error('Failed to send initialization email:', error);
  }
}

/**
 * GET endpoint to check revenue engine status
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const businessId = searchParams.get('businessId');
  
  if (!businessId) {
    return NextResponse.json(
      { error: 'Business ID is required' },
      { status: 400 }
    );
  }
  
  try {
    // Get revenue engine status
    const { data: status, error } = await supabase
      .from('revenue_engine_status')
      .select('*')
      .eq('business_id', businessId)
      .single();
    
    if (error || !status) {
      return NextResponse.json({
        initialized: false,
        message: 'Revenue engine not initialized'
      });
    }
    
    // Get revenue streams
    const { data: streams } = await supabase
      .from('revenue_streams')
      .select('*')
      .eq('business_id', businessId)
      .eq('status', 'active');
    
    // Get recent revenue
    const { data: transactions } = await supabase
      .from('revenue_transactions')
      .select('amount')
      .eq('business_id', businessId)
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());
    
    const monthlyRevenue = transactions?.reduce((sum, t) => sum + parseFloat(t.amount), 0) || 0;
    
    return NextResponse.json({
      initialized: true,
      status: status.status,
      streams: streams?.length || 0,
      projectedMonthlyRevenue: status.projected_monthly_revenue,
      actualMonthlyRevenue: monthlyRevenue,
      lastOptimization: status.last_optimization,
      optimizationVersion: status.optimization_version
    });
    
  } catch (error) {
    console.error('Failed to get revenue engine status:', error);
    return NextResponse.json(
      { error: 'Failed to get status' },
      { status: 500 }
    );
  }
}
