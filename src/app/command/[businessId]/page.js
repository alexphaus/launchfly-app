// src/app/command/[businessId]/page.js
// Command Center Dashboard — wires real Supabase data into <ModernCommandCenter />.
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import ModernCommandCenter from '@/components/ModernCommandCenter';
import { buildCommandActivities } from '@/lib/assistants/build-command-activities';

export const dynamic = 'force-dynamic';

function getServiceSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_KEY,
    );
}

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

// ── Helpers ──────────────────────────────────────────────────────────────

const MAX_AGENT_STEPS = 10_000; // mirrors workflow-runner's MAX_TOTAL_STEPS

const ACTIVE_TASK_STATUSES = new Set([
    'running', 'pending', 'paused', 'waiting_approval', 'waiting_subtask',
]);

const PLAN_AGENT_LIMIT = { starter: 1, pro: 3, scale: 10 };

function extractAgentNameFromRole(role) {
    if (!role) return null;
    // Strip common preamble: "You are The Researcher — ..."
    let cleaned = role.replace(/^You are\s+/i, '');
    const dashIdx = cleaned.search(/\s[—–-]\s/);
    if (dashIdx > 0 && dashIdx < 60) return cleaned.substring(0, dashIdx).trim();
    // Match "[Name] for this business" or "[Name]. ..."
    const m = cleaned.match(/^(?:the |an? )?(?:AI )?([^.\n]+?)(?:\s+for\s|\s+working\s|\.|\n)/i);
    if (m) return m[1].trim().substring(0, 40);
    return cleaned.substring(0, 30).trim();
}

function normalizeName(name) {
    if (!name) return '';
    return name.toLowerCase().replace(/^(the|a|an)\s+/i, '').trim();
}

const GOAL_DESCRIPTIONS = {
    book_consultation: 'Books consultations and qualifies inbound leads.',
    close_sale: 'Closes deals and converts qualified leads into customers.',
    qualify_lead: 'Qualifies inbound leads from messages and calls.',
    follow_up: 'Follows up with leads to keep the pipeline warm.',
    customer_support: 'Handles customer questions and support tickets.',
    schedule_appointment: 'Schedules appointments and confirms bookings.',
    cold_outreach: 'Runs cold outreach to new prospects.',
};

function deriveDescription(asst) {
    if (asst?.goal && GOAL_DESCRIPTIONS[asst.goal]) return GOAL_DESCRIPTIONS[asst.goal];
    if (asst?.system_prompt) {
        const firstSentence = asst.system_prompt.split(/(?<=[.!?])\s+/)[0] || '';
        const cleaned = firstSentence.trim().replace(/^You are\s+/i, '').replace(/[.!?]+$/, '');
        if (cleaned.length > 6 && cleaned.length < 140) {
            return cleaned.charAt(0).toUpperCase() + cleaned.slice(1) + '.';
        }
    }
    return 'Autonomous AI agent for this business.';
}

function deriveAgentVisuals(asst) {
    const lowerName = (asst?.name || '').toLowerCase();
    const lowerGoal = (asst?.goal || '').toLowerCase();

    if (/memory|consolidat|vector|knowledge|data|brain|research/.test(lowerName)) {
        return { iconKey: 'database', accentColor: '#f97316' };
    }
    if (/ceo|overseer|approver|director|chief|exec|staff/.test(lowerName)) {
        return { iconKey: 'shield', accentColor: '#a855f7' };
    }
    if (/voice|call|caller|phone|retell/.test(lowerName)) {
        return { iconKey: 'phone', accentColor: '#38bdf8' };
    }
    if (/reception/.test(lowerName)) {
        return { iconKey: 'message', accentColor: '#fbbf24' };
    }
    if (/support|operator|customer/.test(lowerName) || /customer|satisfaction|support/.test(lowerGoal)) {
        return { iconKey: 'users', accentColor: '#14b8a6' };
    }
    if (/market|growth|sales|outreach/.test(lowerName) || /close_sale|drive_growth|drive_traffic|cold_outreach/.test(lowerGoal)) {
        return { iconKey: 'trending', accentColor: '#ec4899' };
    }
    if (/workflow|automation|orchestrat|builder/.test(lowerName) || /business_operations|schedule_appointment/.test(lowerGoal)) {
        return { iconKey: 'workflow', accentColor: '#3b82f6' };
    }

    // Deterministic fallback so unnamed/general bots don't all look identical.
    const seed = (asst?.name || asst?.id || 'assistant')
        .split('')
        .reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
    const fallback = [
        { iconKey: 'bot', accentColor: '#22c55e' },
        { iconKey: 'workflow', accentColor: '#3b82f6' },
        { iconKey: 'zap', accentColor: '#f59e0b' },
        { iconKey: 'users', accentColor: '#14b8a6' },
    ][seed % 4];
    return fallback;
}

function statusToUi(status) {
    switch (status) {
        case 'running':
            return { label: 'Running', color: '#22c55e', mode: 'progress', pulse: true };
        case 'pending':
            return { label: 'Queued', color: '#f97316', mode: 'progress', pulse: false };
        case 'waiting_approval':
            return { label: 'Awaiting Approval', color: '#a855f7', mode: 'segmented', pulse: true };
        case 'waiting_subtask':
            return { label: 'Waiting on Sub-Agent', color: '#a855f7', mode: 'progress', pulse: true };
        case 'paused':
            return { label: 'Paused', color: '#a855f7', mode: 'segmented', pulse: false };
        case 'completed':
            return { label: 'Completed', color: '#9ca3af', mode: 'idle', pulse: false };
        case 'failed':
            return { label: 'Failed', color: '#ef4444', mode: 'idle', pulse: false };
        default:
            return { label: 'Idle', color: '#7a7a70', mode: 'idle', pulse: false };
    }
}

function summarizeTaskGoal(goal) {
    if (!goal) return 'Standing by';
    const cleaned = goal.replace(/^\[DELEGATED TASK\]\s*/i, '').trim();
    return cleaned.length > 60 ? cleaned.substring(0, 57) + '…' : cleaned;
}

function humanizeTool(toolName, args) {
    const name = toolName || 'tool';
    const a = args || {};
    switch (name) {
        case 'search_web': return `Searched web for "${(a.query || '').toString().substring(0, 60)}"`;
        case 'scrape_page': return `Scraped ${(a.url || '').toString().replace(/^https?:\/\//, '').substring(0, 60)}`;
        case 'search_google_maps': return `Searched Google Maps for "${(a.query || '').toString().substring(0, 50)}"`;
        case 'save_leads': return `Saved leads to pipeline${a.leads ? ` (${Array.isArray(a.leads) ? a.leads.length : 1})` : ''}`;
        case 'save_memory': return `Saved memory: ${(a.content || '').toString().substring(0, 60)}`;
        case 'search_memory': return `Recalled memories: "${(a.query || '').toString().substring(0, 60)}"`;
        case 'send_whatsapp': return `Sent WhatsApp message`;
        case 'send_email': return `Sent email${a.subject ? `: ${a.subject}` : ''}`;
        case 'send_report': return `Delivered report to owner`;
        case 'make_call': return `Initiated call to lead`;
        case 'manage_calendar': return `Updated calendar`;
        case 'process_payment': return `Processed payment`;
        case 'request_approval': return `Requested approval from owner`;
        case 'delegate_task': return `Delegated to sub-agent: ${(a.goal || '').toString().substring(0, 50)}`;
        case 'query_database': return `Queried database (${a.table || 'records'})`;
        case 'execute_python': return `Ran Python analysis`;
        case 'browse_web': return `Browsed web`;
        case 'analyze_image': return `Analyzed image`;
        case 'process_document': return `Processed document`;
        case 'generate_media': return `Generated ${a.media_type || 'media'}`;
        default: return `Used ${name}`;
    }
}

// ── Main Page ────────────────────────────────────────────────────────────

export default async function CommandCenterPage({ params }) {
    const { businessId } = await params;

    let business = null;
    let leads = [];
    let bookings = [];
    let stats = { activeQuotes: 0, pipeline: 0, booked: 0, activeAgents: 0, agentLimit: 5 };
    let agents = [];
    let activities = [];
    let pendingApproval = null;

    try {
        const cookieStore = await cookies();
        const supabase = createServerComponentClient({ cookies: () => cookieStore });
        const serviceSupabase = getServiceSupabase();

        // Fetch core business
        const { data: businessRecord, error: bizError } = await supabase
            .from('businesses')
            .select('id, name, business_data, plan_tier, subdomain')
            .eq('id', businessId)
            .single();
        if (businessRecord && !bizError) business = businessRecord;

        if (!business) {
            return (
                <div className="min-h-screen flex items-center justify-center bg-gray-50">
                    <div className="bg-white p-8 rounded-lg shadow-lg text-center max-w-md">
                        <h1 className="text-2xl font-bold text-gray-800 mb-4">Business Not Found</h1>
                        <p className="text-gray-600">This command center doesn&apos;t exist or you don&apos;t have access.</p>
                    </div>
                </div>
            );
        }

        // Parallel fetches for everything else
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const [
            customersRes,
            bookingsRes,
            assistantsRes,
            tasksRes,
            approvalsRes,
            activityList,
        ] = await Promise.all([
            serviceSupabase
                .from('customers')
                .select('id, name, first_name, last_name, email, phone, status, notes, last_outbound_type, last_outbound_at, lifetime_value, created_at, updated_at')
                .eq('business_id', businessId)
                .neq('status', 'completed')
                .neq('status', 'archived')
                .order('updated_at', { ascending: false })
                .limit(20),
            serviceSupabase
                .from('bookings')
                .select('id, customer_name, customer_phone, slot_date, slot_time, status, estimate, created_at')
                .eq('business_id', businessId)
                .gte('slot_date', sevenDaysAgo.toISOString().split('T')[0])
                .order('slot_date', { ascending: true }),
            serviceSupabase
                .from('assistants')
                .select('id, name, tone, goal, system_prompt, active, created_at')
                .eq('business_id', businessId)
                .eq('active', true)
                .order('created_at', { ascending: true }),
            serviceSupabase
                .from('agent_tasks')
                .select('id, status, goal, role, steps_used, tool_log, result, created_at, updated_at, parent_task_id')
                .eq('business_id', businessId)
                .gte('updated_at', sevenDaysAgo.toISOString())
                .order('updated_at', { ascending: false })
                .limit(60),
            serviceSupabase
                .from('agent_pending_approvals')
                .select('id, task_id, question, created_at, expires_at')
                .eq('business_id', businessId)
                .is('response', null)
                .gt('expires_at', new Date().toISOString())
                .order('created_at', { ascending: false })
                .limit(5),
            buildCommandActivities(serviceSupabase, businessId, 25).catch((err) => {
                console.warn('[command] buildCommandActivities failed:', err);
                return [];
            }),
        ]);

        leads = customersRes.data || [];
        bookings = bookingsRes.data || [];
        const assistantsRows = assistantsRes.data || [];
        const tasks = tasksRes.data || [];
        const approvals = approvalsRes.data || [];

        if (assistantsRes.error) console.warn('[command] assistants query failed:', assistantsRes.error);
        if (tasksRes.error) console.warn('[command] agent_tasks query failed:', tasksRes.error);
        if (approvalsRes.error) console.warn('[command] approvals query failed:', approvalsRes.error);

        // ── Stats ──
        const activeStatuses = new Set(['lead', 'new', 'qualified', 'contacted', 'quoted', 'warranty_activated']);
        stats.activeQuotes = leads.filter((l) => activeStatuses.has((l.status || '').toLowerCase())).length;
        stats.booked = bookings.filter((b) => b.status === 'pending' || b.status === 'confirmed').length;

        let pipelineFromBookings = 0;
        bookings.forEach((b) => {
            if (!b.estimate || !(b.status === 'pending' || b.status === 'confirmed')) return;
            const m = b.estimate.match(/(\d[\d,]*)/);
            if (m) pipelineFromBookings += parseInt(m[1].replace(/,/g, ''), 10) || 0;
        });
        const pipelineFromLifetime = leads.reduce((sum, l) => sum + (Number(l.lifetime_value) || 0), 0);
        stats.pipeline = Math.round(pipelineFromBookings + pipelineFromLifetime);

        const planTier = business.plan_tier || 'starter';
        stats.agentLimit = PLAN_AGENT_LIMIT[planTier] ?? (assistantsRows.length || 1);

        // ── Match each assistant with its current/most-recent task ──
        agents = assistantsRows.map((asst) => {
            const visuals = deriveAgentVisuals(asst);
            const description = deriveDescription(asst);

            const matched = tasks.filter((t) => {
                const taskAgentName = extractAgentNameFromRole(t.role);
                if (taskAgentName && asst.name && normalizeName(taskAgentName) === normalizeName(asst.name)) return true;
                // Tasks without an explicit role default to the active assistant of the business
                // BUT only if they are the most recent task for the business (to avoid matching old tasks)
                if (!t.role) return true;
                return false;
            });

            // Pick the absolute most recent task for this agent
            const taskForUi = matched[0] || null;
            const currentTask = (taskForUi && ACTIVE_TASK_STATUSES.has(taskForUi.status)) ? taskForUi : null;

            const ui = statusToUi(taskForUi?.status);
            const stepsUsed = currentTask?.steps_used || 0;
            const progress = currentTask
                ? Math.min(100, Math.max(5, Math.round(Math.log10(Math.max(stepsUsed, 1)) / Math.log10(MAX_AGENT_STEPS) * 100)))
                : 0;

            return {
                id: asst.id,
                name: asst.name,
                description,
                iconKey: visuals.iconKey,
                accentColor: visuals.accentColor,
                statusColor: ui.color,
                status: taskForUi?.status || 'idle',
                statusLabel: ui.label,
                statusMode: ui.mode,
                pulse: ui.pulse,
                taskTitle: summarizeTaskGoal(taskForUi?.goal),
                progress,
                hasActiveTask: !!currentTask,
                taskUpdatedAt: taskForUi?.updated_at || null,
            };
        });

        stats.activeAgents = agents.filter((a) => a.hasActiveTask).length;
        if (!stats.activeAgents) stats.activeAgents = agents.length;

        // ── Pending approval (just the most recent, used for the "Need Human Help" CTA) ──
        if (approvals.length > 0) {
            const top = approvals[0];
            pendingApproval = {
                id: top.id,
                taskId: top.task_id,
                question: top.question,
                count: approvals.length,
                createdAt: top.created_at,
            };
        }

        // ── System Log: combine recent agent tool_log entries with the activity feed ──
        const taskLogEntries = [];
        for (const t of tasks.slice(0, 12)) {
            const repName = extractAgentNameFromRole(t.role) || 'Agent';
            const tlog = Array.isArray(t.tool_log) ? t.tool_log : [];
            const recent = tlog.slice(-3);
            for (const tl of recent) {
                if (!tl?.tool || tl.tool.startsWith('__')) continue;
                taskLogEntries.push({
                    id: `${t.id}-${tl.timestamp || Math.random()}`,
                    tag: repName.substring(0, 14),
                    color: '#3b82f6',
                    text: humanizeTool(tl.tool, tl.args),
                    created_at: tl.timestamp || t.updated_at,
                });
            }
        }

        const feedEntries = (activityList || []).map((ev) => ({
            id: ev.id,
            tag: ev.type === 'booking' ? 'Booked' : ev.type === 'call' ? 'Voice' : ev.type === 'quote_followup' ? 'Sequence' : 'Reply',
            color: ev.type === 'booking' ? '#22c55e' : ev.type === 'call' ? '#3b82f6' : ev.type === 'quote_followup' ? '#f97316' : '#a855f7',
            text: `${ev.title} — ${ev.detail}`,
            created_at: ev.created_at,
        }));

        activities = [...taskLogEntries, ...feedEntries]
            .filter((e) => e.created_at)
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            .slice(0, 8);
    } catch (err) {
        console.error('Command Center error:', err);
    }

    return (
        <ModernCommandCenter
            business={business}
            initialLeads={leads}
            initialBookings={bookings}
            initialStats={stats}
            agents={agents}
            activities={activities}
            pendingApproval={pendingApproval}
        />
    );
}
