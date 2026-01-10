import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabaseInstance: SupabaseClient | null = null;

function getSupabase() {
    if (!supabaseInstance) {
        supabaseInstance = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );
    }
    return supabaseInstance;
}

// Service type mappings from Google Maps categories (Spanish/English)
const SERVICE_TYPE_MAPPINGS: Record<string, string> = {
    'aire acondicionado': 'aircon',
    'air conditioning': 'aircon',
    'aircon': 'aircon',
    'refriger': 'aircon',
    'pest control': 'pest_control',
    'plumb': 'plumbing',
    'fontanería': 'plumbing',
    'electric': 'electrical',
    'eléctric': 'electrical',
    'limpieza': 'cleaning',
    'cleaning': 'cleaning',
    'reparación de automóviles': 'auto_repair',
    'auto': 'auto_repair',
    'car': 'auto_repair',
    'taller': 'auto_repair',
    'roofing': 'roofing',
    'landscaping': 'landscaping',
    'moving': 'moving',
    'locksmith': 'locksmith',
    'renovation': 'renovation',
};

// Country code detection for Philippines (default for this dataset)
const COUNTRY_CODES: Record<string, string> = {
    'philippines': '+63',
    'manila': '+63',
    'paranaque': '+63',
    'muntinlupa': '+63',
    'las piñas': '+63',
    'malaysia': '+60',
    'kuala lumpur': '+60',
    'singapore': '+65',
};

function detectServiceType(category: string): string {
    if (!category) return 'other';
    const lower = category.toLowerCase();

    for (const [keyword, serviceType] of Object.entries(SERVICE_TYPE_MAPPINGS)) {
        if (lower.includes(keyword)) {
            return serviceType;
        }
    }
    return 'other';
}

function cleanPhoneNumber(raw: string, context: string = ''): string | null {
    if (!raw) return null;

    // Remove all non-numeric except +
    let phone = raw.replace(/[^\d+]/g, '');
    if (!phone || phone.length < 7) return null;

    // Detect country from context
    let countryCode = '+63'; // Default to Philippines
    const lowerContext = context.toLowerCase();
    for (const [keyword, code] of Object.entries(COUNTRY_CODES)) {
        if (lowerContext.includes(keyword)) {
            countryCode = code;
            break;
        }
    }

    // Handle various formats
    if (phone.startsWith('+')) {
        return phone;
    }

    // Remove leading zeros
    phone = phone.replace(/^0+/, '');

    // If starts with country code without +, add it
    if (phone.startsWith('63') && phone.length >= 12) {
        return '+' + phone;
    }
    if (phone.startsWith('60') && phone.length >= 11) {
        return '+' + phone;
    }

    // Add country code
    return countryCode + phone;
}

function extractAreaFromAddress(addressParts: string[]): string {
    // Join all address-like columns and extract meaningful location
    const combined = addressParts.filter(Boolean).join(', ');

    // Try to find city/area patterns
    const patterns = [
        /(?:Brgy\.?|Barangay)\s+([^,]+)/i,
        /,\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s*(?:City|Metro)?/,
        /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+City/i,
    ];

    for (const pattern of patterns) {
        const match = combined.match(pattern);
        if (match) return match[1].trim();
    }

    // Fallback: return first meaningful chunk
    const chunks = combined.split(',').map(s => s.trim()).filter(s => s.length > 3);
    return chunks[0] || 'Metro Manila';
}

interface ParsedRow {
    business_name: string;
    service_type: string;
    area: string;
    whatsapp_number: string | null;
    website_url: string | null;
    google_maps_url: string | null;
    rating: string | null;
    review_count: number | null;
    raw_data: string;
}

function parseGoogleMapsCSV(csvContent: string): ParsedRow[] {
    const lines = csvContent.split('\n').filter(line => line.trim());
    const results: ParsedRow[] = [];

    // Skip header row(s) - detect by looking for URL pattern
    for (const line of lines) {
        const columns = line.split('\t');

        // Skip if doesn't start with Google Maps URL
        if (!columns[0]?.includes('google.com/maps')) {
            continue;
        }

        // Extract data from columns
        const googleUrl = columns[0]?.trim() || '';
        const businessName = columns[1]?.trim() || '';
        const rating = columns[2]?.trim().replace(',', '.') || null; // Convert European decimal
        const reviewCountRaw = columns[3]?.trim() || '';
        const category = columns[4]?.trim() || '';

        // Skip if no business name
        if (!businessName) continue;

        // Extract review count from "(58)" format
        const reviewMatch = reviewCountRaw.match(/\((\d+)\)/);
        const reviewCount = reviewMatch ? parseInt(reviewMatch[1]) : null;

        // Find phone number in remaining columns (format: "0927 588 6236" or "(02) 8246 4997")
        let phone: string | null = null;
        let website: string | null = null;
        const addressParts: string[] = [];

        for (let i = 5; i < columns.length; i++) {
            const col = columns[i]?.trim();
            if (!col) continue;

            // Check for phone patterns
            if (/^\+?\d[\d\s()-]{7,}/.test(col) && !phone) {
                phone = col;
            }
            // Check for website
            else if (col.startsWith('http') && !website) {
                website = col;
            }
            // Otherwise might be address
            else if (col.length > 3 && !['Cómo llegar', 'Sitio web', 'A domicilio', 'Servicios en las instalaciones', 'No hay reseñas', 'Estimaciones online', 'Compra en tienda'].includes(col)) {
                addressParts.push(col);
            }
        }

        // Clean and format data
        const cleanedPhone = cleanPhoneNumber(phone || '', businessName + ' ' + addressParts.join(' '));

        results.push({
            business_name: businessName,
            service_type: detectServiceType(category),
            area: extractAreaFromAddress(addressParts),
            whatsapp_number: cleanedPhone,
            website_url: website,
            google_maps_url: googleUrl || null,
            rating,
            review_count: reviewCount,
            raw_data: columns.join(' | '),
        });
    }

    return results;
}

export async function POST(request: NextRequest) {
    try {
        const supabase = getSupabase();
        const body = await request.json();
        const { csvData } = body;

        if (!csvData || typeof csvData !== 'string') {
            return NextResponse.json(
                { error: 'Missing or invalid csvData' },
                { status: 400 }
            );
        }

        // Parse CSV
        const parsed = parseGoogleMapsCSV(csvData);

        if (parsed.length === 0) {
            return NextResponse.json(
                { error: 'No valid rows found in CSV. Make sure it\'s tab-separated Google Maps export.' },
                { status: 400 }
            );
        }

        // Get existing phone numbers to detect duplicates
        const phones = parsed.map(p => p.whatsapp_number).filter(Boolean);
        const { data: existing } = await supabase
            .from('hunter_prospects')
            .select('whatsapp_number')
            .in('whatsapp_number', phones);

        const existingPhones = new Set((existing || []).map(e => e.whatsapp_number));

        // Prepare records for insertion
        const toInsert: any[] = [];
        const skipped: string[] = [];
        const errors: string[] = [];

        for (const row of parsed) {
            // Skip if no phone
            if (!row.whatsapp_number) {
                errors.push(`${row.business_name}: No valid phone number`);
                continue;
            }

            // Skip duplicates
            if (existingPhones.has(row.whatsapp_number)) {
                skipped.push(`${row.business_name}: Phone already exists`);
                continue;
            }

            // Add to insert batch
            toInsert.push({
                business_name: row.business_name,
                service_type: row.service_type,
                area: row.area,
                whatsapp_number: row.whatsapp_number,
                website_url: row.website_url,
                google_maps_url: row.google_maps_url,
                source: 'google_maps',
                pain_signals: [],
                notes: row.rating ? `Rating: ${row.rating}${row.review_count ? ` (${row.review_count} reviews)` : ''}` : null,
                raw_context: row.raw_data,
                status: 'new',
            });

            // Track to prevent duplicates within same import
            existingPhones.add(row.whatsapp_number);
        }

        // Bulk insert
        let imported = 0;
        if (toInsert.length > 0) {
            const { data, error } = await supabase
                .from('hunter_prospects')
                .insert(toInsert)
                .select('id');

            if (error) {
                console.error('Bulk insert error:', error);
                return NextResponse.json(
                    { error: `Database error: ${error.message}` },
                    { status: 500 }
                );
            }

            imported = data?.length || 0;
        }

        return NextResponse.json({
            success: true,
            imported,
            skipped: skipped.length,
            errors: errors.length,
            details: {
                skipped: skipped.slice(0, 10), // Show first 10
                errors: errors.slice(0, 10),
            },
            total_parsed: parsed.length,
        });

    } catch (err: any) {
        console.error('CSV import error:', err);
        return NextResponse.json(
            { error: err.message },
            { status: 500 }
        );
    }
}
