// src/app/command/[businessId]/page.js
// Mobile-first Command Center Dashboard
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import CommandCenter from '@/components/CommandCenter';

export async function generateMetadata({ params }) {
    const { businessId } = await params;

    let meta = {
        title: 'Command Center',
        description: 'Manage your leads and jobs',
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

        // Fetch recent leads/jobs
        const { data: leadsData } = await supabase
            .from('customers')
            .select('*')
            .eq('business_id', businessId)
            .neq('status', 'completed')
            .neq('status', 'archived')
            .order('created_at', { ascending: false })
            .limit(20);

        if (leadsData) {
            leads = leadsData;

            // Calculate stats
            stats.activeQuotes = leadsData.filter(l => l.status === 'new' || l.status === 'quoted').length;
            stats.booked = leadsData.filter(l => l.status === 'booked' || l.status === 'confirmed').length;

            // Estimate pipeline from notes (quote values)
            leadsData.forEach(lead => {
                if (lead.notes && lead.notes.includes('Estimate:')) {
                    const match = lead.notes.match(/Estimate:.*?(\d+)/);
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
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="bg-white p-8 rounded-lg shadow-lg text-center max-w-md">
                    <h1 className="text-2xl font-bold text-gray-800 mb-4">🔍 Business Not Found</h1>
                    <p className="text-gray-600">This command center doesn&apos;t exist or you don&apos;t have access.</p>
                </div>
            </div>
        );
    }

    return (
        <CommandCenter
            business={business}
            initialLeads={leads}
            initialStats={stats}
        />
    );
}
