import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get('businessId');

    if (!businessId) {
      return Response.json({ error: 'Missing businessId' }, { status: 400 });
    }

    // Get business data
    const { data: business, error: bizError } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', businessId)
      .single();

    if (bizError || !business) {
      return Response.json({ error: 'Business not found' }, { status: 404 });
    }

    // Extract lead magnet data
    const flatData = business.business_data;
    const nestedData = business.business_data?.leadMagnet;
    const formData = business.form_data || {};
    
    const title = flatData.lead_magnet_title || nestedData?.lead_magnet_title || nestedData?.lead_magnet?.title || 'Expert Guide';
    const content = flatData.lead_magnet_content || nestedData?.lead_magnet_content || nestedData?.lead_magnet?.content || [];
    const pdfContent = flatData.lead_magnet_pdf || nestedData?.pdf_content || {};
    
    // Log the pdfContent to debug event data
    console.log(`📥 [Download] PDF Content event_name: ${pdfContent.event_name || 'NOT SET'}`);
    console.log(`📥 [Download] PDF Content event_details: ${JSON.stringify(pdfContent.event_details || {})}`);

    // Prepare business data for PDF
    const businessDataForPdf = {
      businessName: flatData.businessName || nestedData?.business_name || business.name || 'Local Business',
      niche: flatData.niche || formData.niche || formData.leadMagnetTopic || 'Service',
      phone: business.phone_number || flatData.phone || formData.phone || '',
      email: business.email || flatData.email || formData.email || '',
      city: flatData.city || flatData.location || formData.city || 'your area',
      address: flatData.address || '',
      hours: flatData.hours || '',
      bookingUrl: business.booking_url || flatData.booking_url || '',
      subdomain: business.subdomain || '',
      landingPageUrl: business.subdomain ? `${process.env.NEXT_PUBLIC_APP_URL || 'https://launchfly.app'}/sites/${business.subdomain}` : '',
      design_preferences: flatData.design_preferences || {},
      businessType: flatData.businessType || nestedData?.businessType,
      // Pass event-specific data explicitly
      eventName: pdfContent.event_name || flatData.event_name,
      eventDate: pdfContent.event_details?.date || flatData.event_date,
      eventTime: pdfContent.event_details?.time || flatData.event_time,
      venue: pdfContent.event_details?.venue || flatData.venue
    };

    // Generate PDF
    const PDFDocument = (await import('pdfkit')).default;
    const { generatePDF } = await import('@/core/pdf-generator');
    
    const pdfBuffer = await generatePDF(
      { title, content, pdfContent }, 
      PDFDocument, 
      businessDataForPdf
    );

    const fileName = title 
      ? `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`
      : 'expert-guide.pdf';

    // Return PDF as downloadable file
    return new Response(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    });

  } catch (error) {
    console.error('PDF download error:', error);
    return Response.json({ error: 'Failed to generate PDF' }, { status: 500 });
  }
}
