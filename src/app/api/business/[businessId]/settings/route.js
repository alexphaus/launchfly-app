// src/app/api/business/[businessId]/settings/route.js
import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function PUT(request, { params }) {
  try {
    const { businessId } = await params;
    const body = await request.json();

    const cookieStore = await cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

    // Get current business data
    const { data: business, error: fetchError } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', businessId)
      .single();

    if (fetchError || !business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    const currentBusinessData = business.business_data || {};
    const currentFormData = business.form_data || {};

    // Prepare updates
    let businessUpdates = {};
    let businessDataUpdates = { ...currentBusinessData };
    let formDataUpdates = { ...currentFormData };

    // Handle general settings
    if (body.general) {
      const { name, subdomain, description, industry, businessModel, ownerName, ownerEmail, timezone, currency, language } = body.general;
      
      businessUpdates.name = name;
      businessUpdates.subdomain = subdomain;
      
      businessDataUpdates.businessName = name;
      businessDataUpdates.description = description;
      businessDataUpdates.industry = industry;
      businessDataUpdates.businessModel = businessModel;
      businessDataUpdates.timezone = timezone;
      businessDataUpdates.currency = currency;
      businessDataUpdates.language = language;
      
      formDataUpdates.name = ownerName;
      formDataUpdates.email = ownerEmail;
    }

    // Handle domain settings
    if (body.domain) {
      const { customDomain, sslEnabled, redirectWww } = body.domain;
      businessDataUpdates.customDomain = customDomain;
      businessDataUpdates.sslEnabled = sslEnabled;
      businessDataUpdates.redirectWww = redirectWww;
    }

    // Handle advanced settings
    if (body.advanced) {
      const { analyticsId, pixelId, seoTitle, seoDescription, seoKeywords, robotsIndex, enableChat, enableNotifications, maintenanceMode } = body.advanced;
      businessDataUpdates.analyticsId = analyticsId;
      businessDataUpdates.pixelId = pixelId;
      businessDataUpdates.seoTitle = seoTitle;
      businessDataUpdates.seoDescription = seoDescription;
      businessDataUpdates.seoKeywords = seoKeywords;
      businessDataUpdates.robotsIndex = robotsIndex;
      businessDataUpdates.enableChat = enableChat;
      businessDataUpdates.enableNotifications = enableNotifications;
      businessDataUpdates.maintenanceMode = maintenanceMode;
    }

    // Handle simple form data (for backward compatibility)
    if (!body.general && !body.domain && !body.advanced) {
      const { name, subdomain, description, industry, ownerName, ownerEmail, customDomain, seoTitle, seoDescription } = body;
      
      if (name) {
        businessUpdates.name = name;
        businessDataUpdates.businessName = name;
      }
      if (subdomain) businessUpdates.subdomain = subdomain;
      if (description) businessDataUpdates.description = description;
      if (industry) businessDataUpdates.industry = industry;
      if (ownerName) formDataUpdates.name = ownerName;
      if (ownerEmail) formDataUpdates.email = ownerEmail;
      if (customDomain) businessDataUpdates.customDomain = customDomain;
      if (seoTitle) businessDataUpdates.seoTitle = seoTitle;
      if (seoDescription) businessDataUpdates.seoDescription = seoDescription;
    }

    // Update business in database
    const { data: updatedBusiness, error: updateError } = await supabase
      .from('businesses')
      .update({
        ...businessUpdates,
        business_data: businessDataUpdates,
        form_data: formDataUpdates,
        updated_at: new Date().toISOString()
      })
      .eq('id', businessId)
      .select()
      .single();

    if (updateError) {
      console.error('Database update error:', updateError);
      return NextResponse.json({ error: 'Failed to update business settings' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true,
      business: updatedBusiness
    });

  } catch (error) {
    console.error('Settings API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
