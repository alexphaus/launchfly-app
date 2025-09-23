// src/app/api/business/manage/settings/route.js
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// GET - Fetch business settings
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get('businessId');

    if (!businessId) {
      return Response.json({ error: 'Business ID is required' }, { status: 400 });
    }

    const { data: business, error } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', businessId)
      .single();

    if (error || !business) {
      return Response.json({ error: 'Business not found' }, { status: 404 });
    }

    const businessData = business.business_data || {};
    
    // Extract business settings
    const settings = {
      // Basic Info
      businessName: business.name,
      subdomain: business.subdomain,
      description: businessData.description || '',
      industry: businessData.industry || businessData.niche || '',
      
      // Contact Info
      email: businessData.email || business.form_data?.email || '',
      phone: business.phone_number || businessData.phone || '',
      website: businessData.website || `https://app.launchfly.ai/sites/${business.subdomain}`,
      
      // Business Details
      businessType: businessData.businessType || 'service',
      targetAudience: businessData.targetAudience || businessData.target_market || '',
      valueProposition: businessData.valueProposition || businessData.tagline || '',
      
      // Operational Settings
      timezone: businessData.timezone || 'America/New_York',
      currency: businessData.currency || 'USD',
      language: businessData.language || 'en',
      
      // Payment Settings
      stripeConnected: !!business.stripe_connect_account_id,
      bankConnected: !!business.stripe_connect_account_id,
      
      // Notification Settings
      emailNotifications: businessData.emailNotifications !== false, // default true
      smsNotifications: businessData.smsNotifications === true, // default false
      webhookUrl: businessData.webhookUrl || '',
      
      // Business Status
      status: business.status,
      isActive: business.status === 'ready',
      launchDate: business.launch_date,
      trialEndsAt: business.trial_ends_at,
      
      // Advanced Settings
      customDomain: businessData.customDomain || '',
      seoSettings: businessData.seoSettings || {
        metaTitle: businessData.businessName || business.name,
        metaDescription: businessData.tagline || businessData.description || '',
        keywords: []
      },
      
      // Integration Settings
      googleAnalytics: businessData.googleAnalytics || '',
      facebookPixel: businessData.facebookPixel || '',
      
      // AI Settings
      aiAgentEnabled: businessData.aiAgentEnabled !== false, // default true
      autoFulfillment: businessData.autoFulfillment !== false, // default true
      autoMarketing: businessData.autoMarketing !== false // default true
    };

    return Response.json({
      success: true,
      settings
    });

  } catch (error) {
    console.error('Error in settings GET:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT - Update business settings
export async function PUT(request) {
  try {
    const { businessId, settings } = await request.json();

    if (!businessId || !settings) {
      return Response.json({ error: 'Business ID and settings are required' }, { status: 400 });
    }

    // Get current business data
    const { data: business, error: fetchError } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', businessId)
      .single();

    if (fetchError || !business) {
      return Response.json({ error: 'Business not found' }, { status: 404 });
    }

    // Prepare updates for the businesses table
    const businessUpdates = {
      updated_at: new Date().toISOString()
    };

    // Update main business fields if they changed
    if (settings.businessName && settings.businessName !== business.name) {
      businessUpdates.name = settings.businessName;
    }
    
    if (settings.phone && settings.phone !== business.phone_number) {
      businessUpdates.phone_number = settings.phone;
    }

    // Update business_data with new settings
    const updatedBusinessData = {
      ...business.business_data,
      // Basic Info
      businessName: settings.businessName,
      description: settings.description,
      industry: settings.industry,
      
      // Contact Info
      email: settings.email,
      phone: settings.phone,
      website: settings.website,
      
      // Business Details
      businessType: settings.businessType,
      targetAudience: settings.targetAudience,
      valueProposition: settings.valueProposition,
      
      // Operational Settings
      timezone: settings.timezone,
      currency: settings.currency,
      language: settings.language,
      
      // Notification Settings
      emailNotifications: settings.emailNotifications,
      smsNotifications: settings.smsNotifications,
      webhookUrl: settings.webhookUrl,
      
      // Advanced Settings
      customDomain: settings.customDomain,
      seoSettings: settings.seoSettings,
      
      // Integration Settings
      googleAnalytics: settings.googleAnalytics,
      facebookPixel: settings.facebookPixel,
      
      // AI Settings
      aiAgentEnabled: settings.aiAgentEnabled,
      autoFulfillment: settings.autoFulfillment,
      autoMarketing: settings.autoMarketing
    };

    businessUpdates.business_data = updatedBusinessData;

    // Update the business
    const { error: updateError } = await supabase
      .from('businesses')
      .update(businessUpdates)
      .eq('id', businessId);

    if (updateError) {
      console.error('Error updating business settings:', updateError);
      return Response.json({ error: 'Failed to update business settings' }, { status: 500 });
    }

    // If subdomain was changed, we need to handle that specially (requires additional validation)
    if (settings.subdomain && settings.subdomain !== business.subdomain) {
      // Check if subdomain is available
      const { data: existingBusiness } = await supabase
        .from('businesses')
        .select('id')
        .eq('subdomain', settings.subdomain)
        .neq('id', businessId)
        .single();

      if (existingBusiness) {
        return Response.json({ error: 'Subdomain is already taken' }, { status: 400 });
      }

      // Update subdomain
      const { error: subdomainError } = await supabase
        .from('businesses')
        .update({ subdomain: settings.subdomain })
        .eq('id', businessId);

      if (subdomainError) {
        console.error('Error updating subdomain:', subdomainError);
        return Response.json({ error: 'Failed to update subdomain' }, { status: 500 });
      }
    }

    return Response.json({
      success: true,
      message: 'Business settings updated successfully',
      settings: {
        ...settings,
        subdomain: settings.subdomain || business.subdomain
      }
    });

  } catch (error) {
    console.error('Error in settings PUT:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
