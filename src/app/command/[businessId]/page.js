// src/app/command/[businessId]/page.js
// Modern Command Center — Swarm Operating System
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import ModernCommandCenter from '@/components/ModernCommandCenter';

export async function generateMetadata({ params }) {
    const { businessId } = await params;

    let meta = {
        title: 'Command Center',
        description: 'Manage your autonomous swarm',
    };

    try {
        const cookieStore = await cookies();
        const supabase = createServerComponentClient({ cookies: () => cookieStore });

        const { data: business } = await supabase
            .from('businesses')
            .select('name, business_data')
            .eq('id', businessId)
            .single();

        if (business) {
            meta.title = `Command Center - ${business.business_data?.businessName || business.name}`;
        }
    } catch (e) {
        console.error('Metadata error:', e);
    }

    return meta;
}

export default async function CommandCenterPage({ params }) {
    const { businessId } = await params;

    let business = null;
    let leads = [];
    let bookings = [];
    let stats = { activeQuotes: 0, pipeline: 0, booked: 0 };

    try {
        const cookieStore = await cookies();
        const supabase = createServerComponentClient({ cookies: () => cookieStore });

        // Fetch business
        const { data: businessRecord, error: bizError } = await supabase
            .from('businesses')
            .select('*')
            .eq('id', businessId)
            .single();

        if (businessRecord && !bizError) {
            business = businessRecord;
        }

        // Fetch recent customers
        const { data: leadsData } = await supabase
            .from('customers')
            .select('*')
            .eq('business_id', businessId)
            .neq('status', 'completed')
            .neq('status', 'archived')
            .order('created_at', { ascending: false })
            .limit(20);

        // Fetch recent bookings (last 30 days and future)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const { data: bookingsData } = await supabase
            .from('bookings')
            .select('*')
            .eq('business_id', businessId)
            .gte('slot_date', thirtyDaysAgo.toISOString().split('T')[0])
            .order('slot_date', { ascending: true });

        if (bookingsData) {
            bookings = bookingsData;
        }

        if (leadsData) {
            leads = leadsData;

            // Calculate stats
            stats.activeQuotes = leadsData.filter(l => l.status === 'new' || l.status === 'quoted' || l.status === 'warranty_activated').length;
            stats.booked = bookingsData?.filter(b => b.status === 'pending' || b.status === 'confirmed').length || 0;

            // Estimate pipeline from bookings
            bookingsData?.forEach(booking => {
                if (booking.estimate && (booking.status === 'pending' || booking.status === 'confirmed')) {
                    const match = booking.estimate.match(/(\d+)/);
                    if (match) {
                        stats.pipeline += parseInt(match[1]) || 0;
                    }
                }
            });
        }

    } catch (err) {
        console.error('Command Center error:', err);
    }

    if (!business) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-black">
                <div className="bg-[#161614] p-8 border border-[#2a2a26] text-center max-w-md">
                    <h1 className="text-2xl font-bold text-white mb-4">🔍 Business Not Found</h1>
                    <p className="text-[#7a7a70]">This command center doesn&apos;t exist or you don&apos;t have access.</p>
                </div>
            </div>
        );
    }

    return (
        <ModernCommandCenter
            business={business}
            initialLeads={leads}
            initialBookings={bookings}
            initialStats={stats}
        />
    );
}
