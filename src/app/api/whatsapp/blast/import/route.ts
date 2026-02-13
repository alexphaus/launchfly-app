// src/app/api/whatsapp/blast/import/route.ts
// Import external customer contacts for Database Reactivation blasts
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

/**
 * Normalize a phone number to E.164 format.
 * Handles PH (09...) and MY (01...) formats.
 */
function normalizePhone(raw: string, defaultCountry: string = 'PH'): string | null {
    // Strip everything except digits and leading +
    let phone = raw.replace(/[^\d+]/g, '');
    if (!phone || phone.replace(/\D/g, '').length < 7) return null;

    // Already E.164
    if (phone.startsWith('+')) return phone;

    // PH: 09xxxxxxxxx → +639xxxxxxxxx
    if (phone.startsWith('09') && phone.length === 11) {
        return '+63' + phone.substring(1);
    }
    // PH: 639... → +639...
    if (phone.startsWith('63') && phone.length >= 11) {
        return '+' + phone;
    }
    // MY: 01xxxxxxxx → +601xxxxxxxx
    if (phone.startsWith('01') && (phone.length === 10 || phone.length === 11)) {
        return '+60' + phone.substring(1);
    }
    // MY: 601... → +601...
    if (phone.startsWith('60') && phone.length >= 10) {
        return '+' + phone;
    }
    // Fallback: assume country code
    if (defaultCountry === 'MY') {
        return '+60' + phone;
    }
    return '+63' + phone; // Default PH
}

/**
 * Parse a raw text block into contacts.
 * Supports formats:
 *   09171234567
 *   09171234567, Juan
 *   Juan - 09171234567
 *   Juan | 09171234567
 *   +639171234567 Juan Dela Cruz
 */
function parseContacts(rawText: string): Array<{ phone: string; name?: string }> {
    const lines = rawText
        .split(/[\n\r]+/)
        .map(l => l.trim())
        .filter(l => l.length > 0);

    const contacts: Array<{ phone: string; name?: string }> = [];
    const seenPhones = new Set<string>();

    for (const line of lines) {
        // Extract phone number (first sequence of digits, possibly with + prefix)
        const phoneMatch = line.match(/(\+?\d[\d\s\-()]{6,})/);
        if (!phoneMatch) continue;

        const rawPhone = phoneMatch[1];
        const normalized = normalizePhone(rawPhone);
        if (!normalized) continue;
        if (seenPhones.has(normalized)) continue;
        seenPhones.add(normalized);

        // Extract name: everything that's NOT the phone number
        let name: string | undefined;
        const remaining = line
            .replace(rawPhone, '')
            .replace(/^[\s,\-|:]+/, '')
            .replace(/[\s,\-|:]+$/, '')
            .trim();
        if (remaining && remaining.length >= 2 && !/^\d+$/.test(remaining)) {
            name = remaining;
        }

        contacts.push({ phone: normalized, name });
    }

    return contacts;
}

/**
 * POST /api/whatsapp/blast/import
 * 
 * Body: { businessId, contacts: string (raw text), label?: string }
 * 
 * Returns: { imported, skipped, duplicates, total }
 */
export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { businessId, contacts: rawContacts, label } = body;

        if (!businessId) {
            return NextResponse.json({ error: 'Business ID required' }, { status: 400 });
        }
        if (!rawContacts || typeof rawContacts !== 'string' || rawContacts.trim().length === 0) {
            return NextResponse.json({ error: 'Contacts text required' }, { status: 400 });
        }

        const cookieStore = await cookies();
        // @ts-ignore
        const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

        // Verify business exists
        const { data: business, error: bizError } = await supabase
            .from('businesses')
            .select('id, name, business_data')
            .eq('id', businessId)
            .single();

        if (bizError || !business) {
            return NextResponse.json({ error: 'Business not found' }, { status: 404 });
        }

        // Parse contacts
        const parsed = parseContacts(rawContacts);
        if (parsed.length === 0) {
            return NextResponse.json({ 
                error: 'No valid phone numbers found. Paste one number per line (e.g. 09171234567)' 
            }, { status: 400 });
        }

        // Check for existing customers by phone (avoid duplicates)
        const phones = parsed.map(c => c.phone);
        const { data: existing } = await supabase
            .from('customers')
            .select('id, phone')
            .eq('business_id', businessId)
            .in('phone', phones);

        const existingPhones = new Set((existing || []).map((c: any) => c.phone));

        // Import new contacts
        const batchLabel = label || `Import ${new Date().toLocaleDateString()}`;
        const importTag = `reactivation_${Date.now()}`;
        const toInsert = parsed
            .filter(c => !existingPhones.has(c.phone))
            .map(c => ({
                business_id: businessId,
                phone: c.phone,
                name: c.name || null,
                first_name: c.name?.split(' ')[0] || null,
                status: 'imported',
                source: 'reactivation_import',
                notes: `[IMPORTED ${new Date().toISOString()}] ${batchLabel}`,
                tags: [importTag, 'reactivation'],
                accepts_marketing: true,
            }));

        let importedCount = 0;
        if (toInsert.length > 0) {
            // Insert in batches of 50 to avoid payload limits
            for (let i = 0; i < toInsert.length; i += 50) {
                const batch = toInsert.slice(i, i + 50);
                const { data: inserted, error: insertError } = await supabase
                    .from('customers')
                    .insert(batch)
                    .select('id');
                
                if (insertError) {
                    console.error('Import batch error:', insertError);
                } else {
                    importedCount += (inserted || []).length;
                }
            }
        }

        // Also update existing contacts that were already imported - tag them for this batch
        const existingToUpdate = parsed.filter(c => existingPhones.has(c.phone));
        if (existingToUpdate.length > 0) {
            for (const contact of existingToUpdate) {
                await supabase
                    .from('customers')
                    .update({
                        tags: [importTag, 'reactivation'],
                        notes: `[RE-IMPORTED ${new Date().toISOString()}] ${batchLabel}`,
                    })
                    .eq('business_id', businessId)
                    .eq('phone', contact.phone);
            }
        }

        console.log(`📥 Imported ${importedCount} contacts for ${business.name}. Skipped ${existingToUpdate.length} existing. Tag: ${importTag}`);

        return NextResponse.json({
            success: true,
            imported: importedCount,
            duplicates: existingToUpdate.length,
            total: parsed.length,
            invalid: rawContacts.split(/[\n\r]+/).filter(l => l.trim()).length - parsed.length,
            importTag,
            batchLabel,
            message: `Imported ${importedCount} new contacts${existingToUpdate.length > 0 ? ` (${existingToUpdate.length} already existed)` : ''}`
        });

    } catch (error: any) {
        console.error('Import error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
