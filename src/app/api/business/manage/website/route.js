// src/app/api/business/manage/website/route.js
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// GET - Fetch website customization data
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get('businessId');

    if (!businessId) {
      return Response.json({ error: 'Business ID is required' }, { status: 400 });
    }

    const { data: business, error } = await supabase
      .from('businesses')
      .select('business_data, name')
      .eq('id', businessId)
      .single();

    if (error || !business) {
      return Response.json({ error: 'Business not found' }, { status: 404 });
    }

    const businessData = business.business_data || {};
    
    // Extract website customization data
    const websiteData = {
      businessName: businessData.businessName || business.name,
      tagline: businessData.tagline || businessData.hero?.tagline || '',
      description: businessData.description || businessData.hero?.description || '',
      logo: businessData.logo || '🚀',
      theme: businessData.theme || {
        colors: {
          primary: '#007BFF',
          secondary: '#00B8D9',
          accent: '#28a745',
          text: '#1A2B48',
          textLight: '#5A6982'
        },
        gradient: 'linear-gradient(135deg, #007BFF 0%, #00B8D9 100%)',
        font: 'Inter, system-ui, sans-serif'
      },
      hero: businessData.hero || {
        title: businessData.businessName || business.name,
        subtitle: businessData.tagline || '',
        description: businessData.description || '',
        ctaText: 'Get Started',
        backgroundType: 'gradient'
      },
      about: businessData.about || {
        title: 'About Us',
        content: businessData.description || 'We provide exceptional services to help you succeed.',
        mission: 'Our mission is to deliver outstanding value to our customers.',
        vision: 'We envision a world where everyone can achieve their goals.'
      },
      contact: businessData.contact || {
        email: businessData.email || '',
        phone: businessData.phone || '',
        address: businessData.address || '',
        socialMedia: businessData.socialMedia || {}
      }
    };

    return Response.json({
      success: true,
      websiteData
    });

  } catch (error) {
    console.error('Error in website GET:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT - Update website customization data
export async function PUT(request) {
  try {
    const { businessId, websiteData } = await request.json();

    if (!businessId || !websiteData) {
      return Response.json({ error: 'Business ID and website data are required' }, { status: 400 });
    }

    // Get current business data
    const { data: business, error: fetchError } = await supabase
      .from('businesses')
      .select('business_data, name')
      .eq('id', businessId)
      .single();

    if (fetchError || !business) {
      return Response.json({ error: 'Business not found' }, { status: 404 });
    }

    // Update business_data with new website customization
    const updatedBusinessData = {
      ...business.business_data,
      businessName: websiteData.businessName,
      tagline: websiteData.tagline,
      description: websiteData.description,
      logo: websiteData.logo,
      theme: websiteData.theme,
      hero: {
        ...business.business_data?.hero,
        ...websiteData.hero,
        title: websiteData.hero?.title || websiteData.businessName,
        subtitle: websiteData.hero?.subtitle || websiteData.tagline,
        description: websiteData.hero?.description || websiteData.description
      },
      about: websiteData.about,
      contact: websiteData.contact
    };

    // Also update the business name in the main table if changed
    const updates = {
      business_data: updatedBusinessData,
      updated_at: new Date().toISOString()
    };

    if (websiteData.businessName && websiteData.businessName !== business.name) {
      updates.name = websiteData.businessName;
    }

    const { error: updateError } = await supabase
      .from('businesses')
      .update(updates)
      .eq('id', businessId);

    if (updateError) {
      console.error('Error updating website data:', updateError);
      return Response.json({ error: 'Failed to update website data' }, { status: 500 });
    }

    return Response.json({
      success: true,
      message: 'Website data updated successfully',
      websiteData: {
        businessName: websiteData.businessName,
        tagline: websiteData.tagline,
        description: websiteData.description,
        logo: websiteData.logo,
        theme: websiteData.theme,
        hero: updatedBusinessData.hero,
        about: websiteData.about,
        contact: websiteData.contact
      }
    });

  } catch (error) {
    console.error('Error in website PUT:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
