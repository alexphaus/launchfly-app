import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generatePDF } from '@/core/pdf-generator';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
);

export async function GET(
    request: NextRequest,
    { params }: { params: { businessId: string } }
) {
    try {
        const { businessId } = params;

        if (!businessId) {
            return NextResponse.json({ error: 'Missing businessId' }, { status: 400 });
        }

        // Fetch business data
        const { data: business, error } = await supabase
            .from('businesses')
            .select('*')
            .eq('id', businessId)
            .single();

        if (error || !business) {
            return NextResponse.json({ error: 'Business not found' }, { status: 404 });
        }

        // Extract content
        const flatData = business.business_data || {};
        const title = flatData.lead_magnet_title || 'Expert Guide';
        const content = flatData.lead_magnet_content || [];
        // Support nested pdfContent or flat
        const pdfContent = flatData.lead_magnet_pdf || flatData.pdfContent || {};

        // Prepare context for PDF generator
        const businessContext = {
            businessName: flatData.businessName || business.name,
            niche: flatData.niche || 'Niche',
            phone: business.phone_number || flatData.phone,
            email: business.email || flatData.email,
            city: flatData.city || flatData.area || '',
            landingPageUrl: business.subdomain
                ? `https://${business.subdomain}.launchfly.com`
                : 'https://launchfly.com',
            // Default images if any
            prospectImages: flatData.prospectImages || []
        };

        // Generate PDF
        // Note: Dynamic import of PDFKit usually needed in Next.js edge/serverless to avoid build issues,
        // but generatePDF helper might handle it. We will try to pass the module if needed.
        // Checking capture/route.js: const PDFDocument = (await import('pdfkit')).default;

        let PDFDocument;
        try {
            PDFDocument = (await import('pdfkit')).default;
        } catch (e) {
            console.error('PDFKit import failed', e);
            return NextResponse.json({ error: 'PDF Generation unavailable' }, { status: 500 });
        }

        const buffer = await generatePDF({ title, content, pdfContent }, PDFDocument, businessContext);

        // Return PDF
        const headers = new Headers();
        headers.set('Content-Type', 'application/pdf');
        headers.set('Content-Disposition', `inline; filename="${title.replace(/[^a-zA-Z0-9]/g, '_')}.pdf"`);
        // headers.set('Cache-Control', 'public, max-age=3600');

        return new NextResponse(buffer, {
            status: 200,
            headers,
        });

    } catch (error: any) {
        console.error('PDF Route Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
