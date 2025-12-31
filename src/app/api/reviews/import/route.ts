/**
 * Reviews Import API
 * Fetches and stores business reviews from Google/Facebook for social proof
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
);

interface ReviewsImportRequest {
    businessId: string;
    source: 'google' | 'facebook' | 'manual';
    // For Google Places
    googlePlaceId?: string;
    googleMapsUrl?: string;
    // For Facebook
    facebookPageUrl?: string;
    // For manual entry
    manualData?: {
        rating: number;
        reviewCount: number;
        reviews?: Array<{ author: string; text: string; rating: number }>;
    };
}

// Extract Google Place ID from Maps URL
function extractGooglePlaceId(url: string): string | null {
    // Try ChIJ format (place_id)
    const placeIdMatch = url.match(/place_id[=:]([^&\s]+)/i);
    if (placeIdMatch) return placeIdMatch[1];

    // Try CID format
    const cidMatch = url.match(/cid[=:](\d+)/i);
    if (cidMatch) return `cid:${cidMatch[1]}`;

    // Try to extract from /place/ URL
    const placeMatch = url.match(/\/place\/([^\/]+)/);
    if (placeMatch) return null; // Need API call to resolve

    return null;
}

// Scrape basic info from Google Maps public page (fallback)
async function scrapeGoogleMapsBasic(url: string): Promise<{ rating: number; reviewCount: number } | null> {
    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; Launchfly/1.0)'
            }
        });
        const html = await response.text();

        // Try to find rating in meta tags or structured data
        const ratingMatch = html.match(/\"aggregateRating\"[^}]*\"ratingValue\"[:\s]*([0-9.]+)/);
        const countMatch = html.match(/\"aggregateRating\"[^}]*\"reviewCount\"[:\s]*([0-9,]+)/);

        if (ratingMatch) {
            return {
                rating: parseFloat(ratingMatch[1]),
                reviewCount: countMatch ? parseInt(countMatch[1].replace(',', '')) : 0
            };
        }

        // Fallback: look for aria labels
        const ariaMatch = html.match(/aria-label="([0-9.]+) stars[\s,]+([0-9,]+) reviews?"/i);
        if (ariaMatch) {
            return {
                rating: parseFloat(ariaMatch[1]),
                reviewCount: parseInt(ariaMatch[2].replace(',', ''))
            };
        }

        return null;
    } catch (error) {
        console.error('Google Maps scrape failed:', error);
        return null;
    }
}

// Scrape Facebook page rating (public pages only)
async function scrapeFacebookRating(url: string): Promise<{ rating: number; reviewCount: number } | null> {
    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; Launchfly/1.0)'
            }
        });
        const html = await response.text();

        // Look for rating in structured data or visible elements
        const ratingMatch = html.match(/\"ratingValue\"[:\s]*([0-9.]+)/);
        const countMatch = html.match(/\"ratingCount\"[:\s]*([0-9,]+)/);

        if (ratingMatch) {
            return {
                rating: parseFloat(ratingMatch[1]),
                reviewCount: countMatch ? parseInt(countMatch[1].replace(',', '')) : 0
            };
        }

        return null;
    } catch (error) {
        console.error('Facebook scrape failed:', error);
        return null;
    }
}

export async function POST(request: NextRequest) {
    try {
        const body: ReviewsImportRequest = await request.json();
        const { businessId, source, googleMapsUrl, facebookPageUrl, manualData } = body;

        if (!businessId) {
            return NextResponse.json({ error: 'businessId required' }, { status: 400 });
        }

        // Get business
        const { data: business, error: bizError } = await supabase
            .from('businesses')
            .select('*')
            .eq('id', businessId)
            .single();

        if (bizError || !business) {
            return NextResponse.json({ error: 'Business not found' }, { status: 404 });
        }

        let socialProof: {
            source: string;
            rating: number;
            reviewCount: number;
            verified: boolean;
            lastUpdated: string;
            reviews?: Array<{ author: string; text: string; rating: number }>;
        } | null = null;

        // Import based on source
        if (source === 'google' && googleMapsUrl) {
            const scraped = await scrapeGoogleMapsBasic(googleMapsUrl);
            if (scraped) {
                socialProof = {
                    source: 'google',
                    rating: scraped.rating,
                    reviewCount: scraped.reviewCount,
                    verified: true,
                    lastUpdated: new Date().toISOString()
                };
            }
        } else if (source === 'facebook' && facebookPageUrl) {
            const scraped = await scrapeFacebookRating(facebookPageUrl);
            if (scraped) {
                socialProof = {
                    source: 'facebook',
                    rating: scraped.rating,
                    reviewCount: scraped.reviewCount,
                    verified: true,
                    lastUpdated: new Date().toISOString()
                };
            }
        } else if (source === 'manual' && manualData) {
            socialProof = {
                source: 'manual',
                rating: manualData.rating,
                reviewCount: manualData.reviewCount,
                verified: false, // Manual entries not auto-verified
                lastUpdated: new Date().toISOString(),
                reviews: manualData.reviews
            };
        }

        if (!socialProof) {
            return NextResponse.json({
                error: 'Could not fetch reviews. Try manual entry.',
                hint: 'Public pages only. Private or restricted pages cannot be scraped.'
            }, { status: 400 });
        }

        // Update business with social proof data
        const updatedBusinessData = {
            ...(business.business_data || {}),
            social_proof: socialProof
        };

        const { error: updateError } = await supabase
            .from('businesses')
            .update({ business_data: updatedBusinessData })
            .eq('id', businessId);

        if (updateError) {
            return NextResponse.json({ error: 'Failed to save reviews' }, { status: 500 });
        }

        // Log activity
        await supabase
            .from('ai_activities')
            .insert({
                business_id: businessId,
                type: 'reviews_imported',
                icon: '⭐',
                message: `Reviews Imported from ${source}`,
                details: `${socialProof.rating} stars, ${socialProof.reviewCount} reviews`,
                metadata: socialProof
            });

        return NextResponse.json({
            success: true,
            socialProof
        });

    } catch (error: any) {
        console.error('Reviews import error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// GET: Fetch current social proof for a business
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get('businessId');

    if (!businessId) {
        return NextResponse.json({ error: 'businessId required' }, { status: 400 });
    }

    const { data: business, error } = await supabase
        .from('businesses')
        .select('business_data')
        .eq('id', businessId)
        .single();

    if (error || !business) {
        return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    const socialProof = business.business_data?.social_proof || null;

    return NextResponse.json({ socialProof });
}
