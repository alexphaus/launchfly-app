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
    
    const title = flatData.lead_magnet_title || nestedData?.lead_magnet?.title || 'Expert Guide';
    const content = flatData.lead_magnet_content || nestedData?.lead_magnet?.content || [];
    const pdfContent = flatData.lead_magnet_pdf || nestedData?.lead_magnet_pdf || {};

    // Prepare business data for PDF
    const businessDataForPdf = {
      businessName: flatData.businessName || business.name || 'Local Business',
      niche: flatData.niche || 'Service',
      phone: business.phone_number || flatData.phone || '',
      email: business.email || flatData.email || '',
      city: flatData.city || flatData.location || 'your area',
      address: flatData.address || '',
      hours: flatData.hours || ''
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
