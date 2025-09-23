// src/app/api/business/[businessId]/customize/route.js
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
      .select('business_data')
      .eq('id', businessId)
      .single();

    if (fetchError || !business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    const currentBusinessData = business.business_data || {};

    // Update business data with new customization
    const updatedBusinessData = {
      ...currentBusinessData,
      // Theme updates
      theme: body.theme ? {
        ...currentBusinessData.theme,
        ...body.theme
      } : currentBusinessData.theme,
      // Content updates
      businessName: body.businessName || currentBusinessData.businessName,
      tagline: body.tagline || currentBusinessData.tagline,
      description: body.description || currentBusinessData.description,
      logo: body.logo || currentBusinessData.logo,
      heroTitle: body.heroTitle || currentBusinessData.heroTitle,
      heroSubtitle: body.heroSubtitle || currentBusinessData.heroSubtitle,
      heroCtaText: body.heroCtaText || currentBusinessData.heroCtaText,
      aboutTitle: body.aboutTitle || currentBusinessData.aboutTitle,
      aboutContent: body.aboutContent || currentBusinessData.aboutContent,
      contactEmail: body.contactEmail || currentBusinessData.contactEmail,
      contactPhone: body.contactPhone || currentBusinessData.contactPhone,
      socialLinks: body.socialLinks ? {
        ...currentBusinessData.socialLinks,
        ...body.socialLinks
      } : currentBusinessData.socialLinks,
      // Layout preferences
      layoutPreferences: body.layoutPreferences ? {
        ...currentBusinessData.layoutPreferences,
        ...body.layoutPreferences
      } : currentBusinessData.layoutPreferences
    };

    // Update business in database
    const { data: updatedBusiness, error: updateError } = await supabase
      .from('businesses')
      .update({
        business_data: updatedBusinessData,
        updated_at: new Date().toISOString()
      })
      .eq('id', businessId)
      .select()
      .single();

    if (updateError) {
      console.error('Database update error:', updateError);
      return NextResponse.json({ error: 'Failed to update business' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true,
      business: updatedBusiness
    });

  } catch (error) {
    console.error('Customize API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
