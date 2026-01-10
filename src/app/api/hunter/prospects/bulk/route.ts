// /api/hunter/prospects/bulk/route.ts
// Bulk import prospects from CSV data (e.g., Google Maps scrapes)

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
);

interface ProspectInput {
    business_name: string;
    whatsapp_number: string;
    service_type?: string;
    area?: string;
    source?: string;
    pain_signals?: string[];
    notes?: string;
    rating?: number;
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { prospects } = body as { prospects: ProspectInput[] };

        if (!prospects || !Array.isArray(prospects) || prospects.length === 0) {
            return NextResponse.json({ error: 'No prospects provided' }, { status: 400 });
        }

        // Filter out invalid entries (must have business_name and valid phone)
        const validProspects = prospects.filter(p =>
            p.business_name &&
            p.whatsapp_number &&
            /^\+63\d{10}$/.test(p.whatsapp_number)
        );

        if (validProspects.length === 0) {
            return NextResponse.json({
                error: 'No valid prospects found after filtering',
                details: 'Prospects must have business_name and valid +63 mobile number'
            }, { status: 400 });
        }

        // Check for duplicates by phone number
        const phoneNumbers = validProspects.map(p => p.whatsapp_number);
        const { data: existing } = await supabase
            .from('hunter_prospects')
            .select('whatsapp_number')
            .in('whatsapp_number', phoneNumbers);

        const existingPhones = new Set((existing || []).map(e => e.whatsapp_number));

        // Filter out duplicates
        const newProspects = validProspects.filter(p => !existingPhones.has(p.whatsapp_number));

        if (newProspects.length === 0) {
            return NextResponse.json({
                success: true,
                imported: 0,
                duplicates: validProspects.length,
                message: 'All prospects already exist in the database'
            });
        }

        // Prepare prospects for insertion
        const prospectsToInsert = newProspects.map(p => ({
            business_name: p.business_name,
            whatsapp_number: p.whatsapp_number,
            service_type: p.service_type || 'other',
            area: p.area || 'Unknown',
            source: p.source || 'google_maps',
            pain_signals: p.pain_signals || [],
            notes: p.notes || '',
            status: 'new',
        }));

        // Bulk insert
        const { data, error } = await supabase
            .from('hunter_prospects')
            .insert(prospectsToInsert)
            .select();

        if (error) {
            console.error('Bulk insert error:', error);
            return NextResponse.json({ error: 'Failed to insert prospects', details: error.message }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            imported: data?.length || 0,
            duplicates: validProspects.length - newProspects.length,
            skipped: prospects.length - validProspects.length,
            message: `Imported ${data?.length} prospects successfully`
        });

    } catch (error) {
        console.error('Bulk import error:', error);
        return NextResponse.json({ error: 'Failed to process bulk import' }, { status: 500 });
    }
}
