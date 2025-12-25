// src/app/api/business/update-content/route.js
// API to update editable business content (headline, phone, prices, etc.)

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export async function POST(request) {
  try {
    const { businessId, updates, sessionId } = await request.json();

    if (!businessId) {
      return Response.json({ error: 'Missing businessId' }, { status: 400 });
    }

    // Fetch current business
    const { data: business, error: fetchError } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', businessId)
      .single();

    if (fetchError || !business) {
      return Response.json({ error: 'Business not found' }, { status: 404 });
    }

    // Merge updates into business_data
    const currentData = business.business_data || {};
    const updatedData = {
      ...currentData,
      // Direct fields
      businessName: updates.businessName || currentData.businessName,
      phone: updates.phone || currentData.phone,
      address: updates.address || currentData.address,
      
      // Landing page updates
      landing_page: {
        ...(currentData.landing_page || {}),
        headline: updates.headline || currentData.landing_page?.headline,
        subheadline: updates.subheadline || currentData.landing_page?.subheadline,
        cta_text: updates.ctaText || currentData.landing_page?.cta_text,
      },
      
      // Lead magnet updates
      lead_magnet_title: updates.leadMagnetTitle || currentData.lead_magnet_title,
      
      // PDF content updates (price ranges)
      lead_magnet_pdf: {
        ...(currentData.lead_magnet_pdf || {}),
        price_ranges: updates.priceRanges || currentData.lead_magnet_pdf?.price_ranges,
        coupon_code: updates.couponCode || currentData.lead_magnet_pdf?.coupon_code,
        coupon_offer: updates.couponOffer || currentData.lead_magnet_pdf?.coupon_offer,
      },
      
      // Track edit history
      last_edited_at: new Date().toISOString(),
      edit_count: (currentData.edit_count || 0) + 1,
    };

    // Update business
    const { error: updateError } = await supabase
      .from('businesses')
      .update({
        business_data: updatedData,
        phone_number: updates.phone || business.phone_number,
        name: updates.businessName || business.name,
      })
      .eq('id', businessId);

    if (updateError) {
      console.error('Update error:', updateError);
      return Response.json({ error: 'Failed to update' }, { status: 500 });
    }

    // Log activity
    await supabase.from('ai_activities').insert({
      business_id: businessId,
      type: 'content_edit',
      icon: '✏️',
      message: 'Landing page content updated',
      details: `Updated: ${Object.keys(updates).filter(k => updates[k]).join(', ')}`,
    });

    return Response.json({ 
      success: true, 
      message: 'Content updated successfully',
      updatedFields: Object.keys(updates).filter(k => updates[k])
    });

  } catch (error) {
    console.error('Content update error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
