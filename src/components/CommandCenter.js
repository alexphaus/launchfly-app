// src/components/CommandCenter.js
// Mobile-first Command Center Dashboard - "The WhatsApp OS for Service Pros"
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import {
    Settings, Snowflake, Wrench, MessageCircle, CheckCircle,
    Calendar, Megaphone, QrCode, Bot, Phone, Clock, X,
    Zap, TrendingUp, Users, ChevronRight, Download, Upload, Trash2, Image as ImageIcon
} from 'lucide-react';
import QRCodeLib from 'qrcode';
import RevenuePulse from './RevenuePulse';

export default function CommandCenter({ business, initialLeads = [], initialBookings = [], initialStats = {} }) {
    const [leads, setLeads] = useState(initialLeads);
    const [bookings, setBookings] = useState(initialBookings);
    const [stats, setStats] = useState({
        activeQuotes: initialStats.activeQuotes || 0,
        pipeline: initialStats.pipeline || 0,
        booked: initialStats.booked || 0,
    });
    const [showBlastModal, setShowBlastModal] = useState(false);
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const [showScheduleModal, setShowScheduleModal] = useState(false);
    const [showTopUpModal, setShowTopUpModal] = useState(false);
    const [showSlotSettingsModal, setShowSlotSettingsModal] = useState(false);
    const [selectedLead, setSelectedLead] = useState(null);
    const [scheduleDate, setScheduleDate] = useState('tomorrow');
    const [scheduleTime, setScheduleTime] = useState('morning');
    const [sendingBlast, setSendingBlast] = useState(false);
    const [savingSlots, setSavingSlots] = useState(false);

    // Blast enhancement states
    const [blastSegments, setBlastSegments] = useState(null);
    const [blastTemplates, setBlastTemplates] = useState([]);
    const [selectedSegment, setSelectedSegment] = useState('all_old_leads');
    const [selectedTemplate, setSelectedTemplate] = useState('promo_10off');
    const [customMessage, setCustomMessage] = useState('');
    const [loadingSegments, setLoadingSegments] = useState(false);

    // AI Sales Assistant wizard states
    const [deployStep, setDeployStep] = useState(1);
    const [selectedGoal, setSelectedGoal] = useState(null);
    const [selectedPlaybook, setSelectedPlaybook] = useState(null);

    // Import contacts states (Database Reactivation)
    const [blastTab, setBlastTab] = useState('blast'); // 'blast' | 'import'
    const [importText, setImportText] = useState('');
    const [importLabel, setImportLabel] = useState('');
    const [importing, setImporting] = useState(false);
    const [importResult, setImportResult] = useState(null);

    // Arrival Window settings state - "Blue Collar Scheduling"
    // Wider windows that work better for technicians with unpredictable schedules
    const defaultSlots = [
        { id: 'morning', label: '9am - 12pm window', start: '09:00', end: '12:00', enabled: true },
        { id: 'afternoon', label: '1pm - 5pm window', start: '13:00', end: '17:00', enabled: true },
    ];
    const [slotSettings, setSlotSettings] = useState(
        business?.slot_settings?.slots || defaultSlots
    );
    const [maxPerWindow, setMaxPerWindow] = useState(
        business?.slot_settings?.max_per_window || 3
    );

    // Logo upload state
    const logoFileRef = useRef(null);
    const [uploadingLogo, setUploadingLogo] = useState(false);
    const existingImages = business?.business_data?.images || business?.business_data?.prospectImages || [];
    const existingLogo = existingImages.find(img => img.type === 'logo');
    const [currentLogoUrl, setCurrentLogoUrl] = useState(existingLogo?.url || null);

    // Wallet/Credits state
    const [blastCredits, setBlastCredits] = useState(business?.blast_credits || 0);
    const COST_PER_MESSAGE = 5;

    const supabase = createClientComponentClient();
    const businessData = business?.business_data || {};
    const businessName = businessData.businessName || business?.name || 'Your Business';
    const currency = businessData.currency || '₱';
    const niche = businessData.niche || 'Service';

    // Real-time subscription for new leads
    useEffect(() => {
        if (!business?.id) return;

        // Subscribe to customers table
        const customersChannel = supabase
            .channel('command-leads')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'customers',
                    filter: `business_id=eq.${business.id}`
                },
                (payload) => {
                    if (payload.eventType === 'INSERT') {
                        setLeads(prev => [payload.new, ...prev].slice(0, 20));
                        setStats(prev => ({ ...prev, activeQuotes: prev.activeQuotes + 1 }));
                    } else if (payload.eventType === 'UPDATE') {
                        setLeads(prev => prev.map(l => l.id === payload.new.id ? payload.new : l));
                    }
                }
            )
            .subscribe();

        // Subscribe to bookings table
        const bookingsChannel = supabase
            .channel('command-bookings')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'bookings',
                    filter: `business_id=eq.${business.id}`
                },
                (payload) => {
                    if (payload.eventType === 'INSERT') {
                        setBookings(prev => [payload.new, ...prev]);
                        // Update stats
                        if (payload.new.status === 'pending' || payload.new.status === 'confirmed') {
                            setStats(prev => ({ ...prev, booked: prev.booked + 1 }));
                            // Add to pipeline
                            const match = payload.new.estimate?.match(/(\d+)/);
                            if (match) {
                                setStats(prev => ({ ...prev, pipeline: prev.pipeline + parseInt(match[1]) }));
                            }
                        }
                    } else if (payload.eventType === 'UPDATE') {
                        setBookings(prev => prev.map(b => b.id === payload.new.id ? payload.new : b));
                    } else if (payload.eventType === 'DELETE') {
                        setBookings(prev => prev.filter(b => b.id !== payload.old.id));
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(customersChannel);
            supabase.removeChannel(bookingsChannel);
        };
    }, [business?.id]);

    // Format time ago
    const timeAgo = (date) => {
        const now = new Date();
        const then = new Date(date);
        const diffMs = now - then;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        return `${diffDays}d ago`;
    };

    // Format time from 24h to 12h format
    const formatTime = (time24) => {
        if (!time24) return '';
        const [hours, minutes] = time24.split(':').map(Number);
        const period = hours >= 12 ? 'pm' : 'am';
        const hours12 = hours % 12 || 12;
        return `${hours12}${period}`;
    };

    // Get service icon
    const getServiceIcon = (notes) => {
        if (!notes) return <Wrench className="w-6 h-6" />;
        const lower = notes.toLowerCase();
        if (lower.includes('clean')) return <Snowflake className="w-6 h-6" />;
        if (lower.includes('repair') || lower.includes('leak')) return <Wrench className="w-6 h-6" />;
        return <Zap className="w-6 h-6" />;
    };

    // Get service color
    const getServiceColor = (notes) => {
        if (!notes) return 'bg-slate-100 text-slate-600';
        const lower = notes.toLowerCase();
        if (lower.includes('clean')) return 'bg-blue-100 text-blue-600';
        if (lower.includes('repair')) return 'bg-orange-100 text-orange-600';
        return 'bg-purple-100 text-purple-600';
    };

    // Parse lead details from notes
    const parseLeadDetails = (lead) => {
        let service = niche;
        let estimate = null;
        let details = {};

        if (lead.notes) {
            // Parse JOB QUOTE REQUEST format
            const estimateMatch = lead.notes.match(/Estimate:\s*([^\n]+)/);
            if (estimateMatch) estimate = estimateMatch[1].trim();

            const detailsMatch = lead.notes.match(/Details:\s*({.*})/);
            if (detailsMatch) {
                try {
                    details = JSON.parse(detailsMatch[1]);
                    if (details.serviceLabel) service = details.serviceLabel;
                    if (details.units) service += ` (${details.units} Unit${details.units > 1 ? 's' : ''})`;
                } catch (e) { }
            }
        }

        return { service, estimate, details };
    };

    // Get lead status badge
    const getStatusBadge = (lead) => {
        const status = lead.status || 'new';
        const createdAt = new Date(lead.created_at);
        const hoursSince = (Date.now() - createdAt) / (1000 * 60 * 60);

        if (status === 'booked' || status === 'confirmed') {
            return { text: 'BOOKED', color: 'bg-green-100 text-green-700' };
        }
        if (status === 'warranty_activated') {
            return { text: '🛡️ WARRANTY ACTIVE', color: 'bg-blue-100 text-blue-700' };
        }
        if (hoursSince < 1) {
            return { text: `New Lead (${timeAgo(lead.created_at)})`, color: 'bg-green-100 text-green-700' };
        }
        if (hoursSince < 24) {
            return { text: 'WAITING FOR REPLY', color: 'bg-yellow-100 text-yellow-700', isWaiting: true };
        }
        return { text: 'FOLLOW UP NEEDED', color: 'bg-red-100 text-red-700' };
    };

    // Open WhatsApp - using native app scheme to bypass ISP blocks
    const openWhatsApp = (phone, name) => {
        const cleanPhone = phone?.replace(/\D/g, '');
        if (cleanPhone) {
            const message = encodeURIComponent(`Hi ${name || 'there'}! Following up on your quote request...`);

            // Try native WhatsApp scheme first (bypasses ISP blocks on mobile)
            // On mobile this opens the app directly, on desktop it falls back
            const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

            if (isMobile) {
                // Native app URL scheme - bypasses all ISP DNS blocks
                window.location.href = `whatsapp://send?phone=${cleanPhone}&text=${message}`;
            } else {
                // Desktop - use web URL
                window.open(`https://api.whatsapp.com/send?phone=${cleanPhone}&text=${message}`, '_blank');
            }
        }
    };

    // Mark as booked
    const markAsBooked = async (leadId) => {
        const { error } = await supabase
            .from('customers')
            .update({ status: 'booked' })
            .eq('id', leadId);

        if (!error) {
            setLeads(prev => prev.map(l => l.id === leadId ? { ...l, status: 'booked' } : l));
            setStats(prev => ({
                ...prev,
                activeQuotes: Math.max(0, prev.activeQuotes - 1),
                booked: prev.booked + 1
            }));
        }
    };

    // Complete a booking and create service record (for Smart Nag reminders)
    const completeBooking = async (booking) => {
        if (!confirm('Mark this job as completed?')) return;

        try {
            // 1. Update booking status
            await supabase.from('bookings').update({ status: 'completed' }).eq('id', booking.id);

            // 2. Get customer ID (try to find by phone)
            let customerId = booking.customer_id;
            if (!customerId && booking.customer_phone) {
                const { data: customer } = await supabase
                    .from('customers')
                    .select('id')
                    .eq('business_id', business.id)
                    .eq('phone', booking.customer_phone)
                    .single();
                customerId = customer?.id;
            }

            // 3. Create service record for Smart Nag reminders (6-month cycle)
            if (customerId) {
                const now = new Date();
                const warrantyDays = 30;
                const serviceIntervalDays = 180; // 6 months
                const warrantyExpiresAt = new Date(now);
                warrantyExpiresAt.setDate(warrantyExpiresAt.getDate() + warrantyDays);
                const nextServiceDueAt = new Date(now);
                nextServiceDueAt.setDate(nextServiceDueAt.getDate() + serviceIntervalDays);

                // Parse service type from booking
                let serviceType = 'cleaning';
                const serviceNote = (booking.service_type || booking.notes || '').toLowerCase();
                if (serviceNote.includes('repair') || serviceNote.includes('fix') || serviceNote.includes('leak')) {
                    serviceType = 'repair';
                } else if (serviceNote.includes('install')) {
                    serviceType = 'installation';
                }

                const { error: srError } = await supabase.from('service_records').insert({
                    business_id: business.id,
                    customer_id: customerId,
                    service_type: serviceType,
                    service_name: booking.service_type || `${niche} Service`,
                    units_serviced: 1,
                    address: booking.customer_address,
                    warranty_days: warrantyDays,
                    warranty_expires_at: warrantyExpiresAt.toISOString(),
                    service_interval_days: serviceIntervalDays,
                    next_service_due_at: serviceType === 'repair' ? null : nextServiceDueAt.toISOString(),
                    registered_via: 'booking_complete',
                    registered_by: 'technician',
                    service_date: now.toISOString(),
                });

                if (srError) {
                    console.error('Failed to create service record:', srError);
                } else {
                    console.log('✅ Service record created - customer will get reminder in 6 months');
                }

                // 4. Update customer record
                await supabase.from('customers').update({
                    last_service_date: now.toISOString(),
                    next_reminder_due: serviceType === 'repair' ? null : nextServiceDueAt.toISOString(),
                    is_repeat_customer: true,
                    status: 'completed',
                }).eq('id', customerId);
            }

            // 5. Update UI
            setBookings(prev => prev.filter(b => b.id !== booking.id));
            setStats(prev => ({ ...prev, booked: Math.max(0, prev.booked - 1) }));

        } catch (err) {
            console.error('Error completing booking:', err);
            alert('Failed to complete booking');
        }
    };

    // Archive job (remove from feed)
    const archiveJob = async (leadId) => {
        if (!confirm('Remove this job from the live feed? (It will be archived)')) return;

        const { error } = await supabase
            .from('customers')
            .update({ status: 'archived' })
            .eq('id', leadId);

        if (!error) {
            setLeads(prev => prev.filter(l => l.id !== leadId));
            setStats(prev => ({ ...prev, booked: Math.max(0, prev.booked - 1) }));
        }
    };

    // Open schedule modal for a lead
    const openScheduleModal = (lead) => {
        setSelectedLead(lead);
        setScheduleDate('tomorrow');
        setScheduleTime('morning');
        setShowScheduleModal(true);
    };

    // Format date for display
    const formatScheduleDate = () => {
        const today = new Date();
        if (scheduleDate === 'today') {
            return 'Today';
        } else if (scheduleDate === 'tomorrow') {
            const tomorrow = new Date(today);
            tomorrow.setDate(today.getDate() + 1);
            return 'Tomorrow';
        } else {
            // Custom date
            return new Date(scheduleDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        }
    };

    // Format time for display
    const formatScheduleTime = () => {
        if (scheduleTime === 'morning') return '9:00 AM';
        if (scheduleTime === 'afternoon') return '2:00 PM';
        if (scheduleTime === 'evening') return '5:00 PM';
        return scheduleTime;
    };

    // Handle schedule confirmation - "Pick, Click & Send"
    const handleScheduleConfirm = async () => {
        if (!selectedLead) return;

        const dateStr = formatScheduleDate();
        const timeStr = formatScheduleTime();
        const customerName = selectedLead.name || 'there';
        const phone = selectedLead.phone?.replace(/\D/g, '');

        // 1. Format the confirmation message
        const message = `Hi ${customerName}! ✅ I've confirmed your schedule for *${dateStr} at ${timeStr}*.\n\nI'll see you then! Please reply YES to confirm.\n\n- ${businessName}`;

        // 2. Mark as booked in database
        const { error } = await supabase
            .from('customers')
            .update({
                status: 'booked',
                notes: `${selectedLead.notes || ''}\n[SCHEDULED ${new Date().toISOString()}]: ${dateStr} at ${timeStr}`
            })
            .eq('id', selectedLead.id);

        if (!error) {
            // 3. Update local state
            setLeads(prev => prev.map(l => l.id === selectedLead.id ? { ...l, status: 'booked' } : l));
            setStats(prev => ({
                ...prev,
                activeQuotes: Math.max(0, prev.activeQuotes - 1),
                booked: prev.booked + 1
            }));
        }

        // 4. Close modal
        setShowScheduleModal(false);
        setSelectedLead(null);

        // 5. Open WhatsApp with pre-filled message
        if (phone) {
            const encodedMsg = encodeURIComponent(message);
            window.open(`https://wa.me/${phone}?text=${encodedMsg}`, '_blank');
        }
    };

    // Send blast
    const sendBlast = async () => {
        setSendingBlast(true);
        try {
            const response = await fetch('/api/whatsapp/blast', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    businessId: business.id,
                    segment: selectedSegment,
                    templateId: selectedTemplate,
                    message: customMessage || null
                })
            });

            const data = await response.json();

            if (response.ok) {
                // Update credits after successful blast
                if (data.remainingCredits !== undefined) {
                    setBlastCredits(data.remainingCredits);
                }
                alert(`✅ Blast sent to ${data.sent} ${data.segmentName || 'leads'}! Cost: ${currency}${data.cost}`);
                setShowBlastModal(false);
                setCustomMessage('');
            } else if (response.status === 402) {
                // Insufficient credits
                alert(`❌ Insufficient credits. Need ${currency}${data.required}, have ${currency}${data.available}`);
                setShowBlastModal(false);
                setShowTopUpModal(true);
            } else {
                alert('❌ Failed to send blast: ' + (data.error || 'Unknown error'));
            }
        } catch (err) {
            console.error('Blast error:', err);
            alert('❌ Error sending blast');
        } finally {
            setSendingBlast(false);
        }
    };

    // Fetch blast segments when modal opens
    const fetchBlastSegments = async () => {
        if (!business?.id) return;
        setLoadingSegments(true);
        try {
            const res = await fetch(`/api/whatsapp/blast?businessId=${business.id}`);
            const data = await res.json();
            if (data.segments) {
                setBlastSegments(data.segments);
                setBlastTemplates(data.templates || []);
            }
        } catch (err) {
            console.error('Failed to fetch segments:', err);
        } finally {
            setLoadingSegments(false);
        }
    };

    // Import contacts for Database Reactivation
    const importContacts = async () => {
        if (!importText.trim()) {
            alert('Paste phone numbers first (one per line)');
            return;
        }
        setImporting(true);
        setImportResult(null);
        try {
            const res = await fetch('/api/whatsapp/blast/import', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    businessId: business.id,
                    contacts: importText,
                    label: importLabel || undefined
                })
            });
            const data = await res.json();
            if (res.ok) {
                setImportResult(data);
                // Refresh segments to show new imported count
                fetchBlastSegments();
                // Clear input
                setImportText('');
                setImportLabel('');
            } else {
                alert('❌ ' + (data.error || 'Import failed'));
            }
        } catch (err) {
            console.error('Import error:', err);
            alert('❌ Error importing contacts');
        } finally {
            setImporting(false);
        }
    };

    // Download QR - Maintenance Record Sticker Design
    // CONCEPT: "The Silver Badge" (Premium & Trustworthy)
    const downloadQR = async () => {
        // Launchfly Bot WhatsApp number - the central AI receptionist
        const launchflyBotNumber = '13203627874';

        // Include business ref in trigger message so bot knows which business context to use
        // Use subdomain if available (shorter), otherwise fall back to UUID
        const businessRef = business?.subdomain || business?.id;
        const stickerTrigger = `Hi! I want to activate my 30-Day Warranty. 🛡️\n\n(Ref: ${businessRef || 'UNKNOWN'})`;

        // Primary: Launchfly bot with business context
        const qrUrl = `https://wa.me/${launchflyBotNumber}?text=${encodeURIComponent(stickerTrigger)}`;

        const canvas = document.createElement('canvas');

        // High-resolution rendering: 2x scale for crisp quality
        const scaleFactor = 2;

        // Logical dimensions (layout)
        const width = 1680;
        const height = 575;

        // Physical canvas size (2x for retina/high-DPI)
        canvas.width = width * scaleFactor;
        canvas.height = height * scaleFactor;

        const ctx = canvas.getContext('2d');

        // Scale context to match - all subsequent drawing operations use logical coordinates
        ctx.scale(scaleFactor, scaleFactor);

        // Enable high-quality rendering
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // --- COLORS ---
        const navyBlue = '#515151'; // Deep Corporate Navy
        const silverStart = '#E8E8E8'; // Matte Silver
        const silverEnd = '#F8F8F8';   // Lighter Highlight
        const textBlack = '#111111';
        const textDarkGrey = '#4A4A4A';
        const accentBlue = '#102A56'; // Same as Navy to match brand
        const brandWhite = '#FFFFFF';

        // 1. CLIP ROUNDED CORNERS
        const radius = 40;
        ctx.beginPath();
        ctx.roundRect(0, 0, width, height, radius);
        ctx.clip();

        // 2. BACKGROUNDS
        // "Ice Cold" Professional Background
        // Reduced splitX (660 -> 540) to shrink left side
        const splitX = 540;

        // Base: Cool Ice White
        const bgGrad = ctx.createLinearGradient(0, 0, width, height);
        bgGrad.addColorStop(0, '#E0F2FE'); // Top Left: Very Light Sky Blue (Ice)
        bgGrad.addColorStop(0.4, '#F0F9FF'); // Mid: Almost White
        bgGrad.addColorStop(0.8, '#F0F9FF');
        bgGrad.addColorStop(1, '#E0F2FE'); // Bottom Right: Very Light Sky Blue
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, width, height);

        // --- FROST / ICE CRYSTAL TEXTURE ---
        // Generates random geometric shards to mimic ice crystals on a window
        ctx.save();
        ctx.globalCompositeOperation = 'overlay'; // Blend mode for subtle texture

        const numShards = 180;
        for (let i = 0; i < numShards; i++) {
            ctx.beginPath();
            const x = Math.random() * width;
            const y = Math.random() * height;
            const size = Math.random() * 200 + 50;
            const angle = Math.random() * Math.PI * 2;

            // Draw diverse shard shapes (triangles/polygons)
            ctx.moveTo(x, y);
            ctx.lineTo(x + Math.cos(angle) * size, y + Math.sin(angle) * size);
            ctx.lineTo(x + Math.cos(angle + 0.5) * (size * 0.4), y + Math.sin(angle + 0.5) * (size * 0.4));
            ctx.closePath();

            // Randomly pick between slight white frost or slight blue shadow
            if (Math.random() > 0.5) {
                ctx.fillStyle = 'rgba(255, 255, 255, 0.25)'; // White frost highlight
            } else {
                ctx.fillStyle = 'rgba(186, 230, 253, 0.15)'; // Blue ice shadow
            }
            ctx.fill();

            // Add occasional "scratch" lines for details
            if (i % 5 === 0) {
                ctx.beginPath();
                ctx.moveTo(x, y);
                ctx.lineTo(x + Math.cos(angle) * (size * 1.5), y + Math.sin(angle) * (size * 1.5));
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
                ctx.lineWidth = 1;
                ctx.stroke();
            }
        }
        ctx.restore();

        // Vertical Divider
        ctx.strokeStyle = '#CBD5E1'; // Slate 300
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(splitX, 40);
        ctx.lineTo(splitX, height - 40);
        ctx.stroke();

        // Optional Outer Border
        ctx.strokeStyle = '#E2E8F0';
        ctx.lineWidth = 2;
        ctx.strokeRect(1, 1, width - 2, height - 2);

        // --- LEFT SIDE CONTENT (Branding) ---
        const leftCenterX = splitX / 2;

        // A. Header "MAINTAINED BY"
        ctx.fillStyle = '#64748B'; // Slate 500
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.font = '800 30px "Inter", "Arial", sans-serif';
        ctx.fillText('MAINTAINED BY', leftCenterX, 40);

        // D. Phone (Big & Bold) - Aligned with "FREE 30-day warranty"
        // CTA is at `height - 35` with baseline `bottom`.
        // Let's use the same baseline and Y for phone to align perfectly.
        const phoneY = height - 35;

        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        const safePhone = business?.whatsapp_number || business?.phone_number || businessData?.phone || '+13203627874';

        // Normalize: Remove non-digits, keep leading +
        let raw = safePhone.replace(/[^0-9+]/g, '');

        // Smart Local Format: Replace known country codes (+63, +61, +60, etc) with '0'
        // Matches + followed by 2 digits for stripped target countries
        let displayPhone = raw.replace(/^\+(\d{2})/, '0');

        // Formatting: Group digits for readability (e.g. 0917 123 4567)
        if (displayPhone.length > 8) {
            // 4-3-4 pattern common in these regions or just chunks
            displayPhone = displayPhone.replace(/(\d{4})(\d{3})?(\d{4})?/, '$1 $2 $3').trim();
        }

        ctx.fillStyle = textBlack;
        ctx.font = '600 45px "Inter", "Arial", sans-serif';
        const phoneTextWidth = ctx.measureText(displayPhone).width;
        const phoneIconSize = 34; // Slightly smaller than text height
        const phoneGap = 15;
        const totalPhoneWidth = phoneIconSize + phoneGap + phoneTextWidth;

        // Calculate starting X to center the group
        const groupStartX = leftCenterX - totalPhoneWidth / 2;

        // Draw Phone Icon
        ctx.save();
        const iconY = phoneY - 42; // Center vertically relative to text cap height
        ctx.translate(groupStartX, iconY);
        const iconScale = phoneIconSize / 24;
        ctx.scale(iconScale, iconScale);
        ctx.fillStyle = textBlack;
        // Simple filled phone handset
        const phoneIconPath = new Path2D("M6.62 10.79c1.44 2.83 3.76 5.15 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z");
        ctx.fill(phoneIconPath);
        ctx.restore();

        // Draw Phone Text
        ctx.textAlign = 'left'; // Switch to left align for precise placement
        ctx.fillText(displayPhone, groupStartX + phoneIconSize + phoneGap, phoneY);

        // B. Dynamic Logo Section & C. Business Name (Centered Group) (unchanged below)
        // Top limit: "MAINTAINED BY" (y=40) + approx 40px height -> y=80
        // Bottom limit: Phone Number (y=height-35) - approx 50px height -> y=height-85
        // Total available height ~ 360px (525 - 85 - 80)

        const topLimit = 100;
        const bottomLimit = height - 100;
        const availableH = bottomLimit - topLimit;
        // Shift up slightly (-40px) as requested
        const centerY = (topLimit + availableH / 2);

        // Overlap amount: User wants text overlapping bottom of logo
        const overlap = 30;

        // Define sizes
        const logoTargetSize = 250;
        const logoRadius = logoTargetSize / 2;

        // Render Business Name first to calculate its height for centering
        const bizName = (business?.name || 'COOLTECH SERVICES').toUpperCase();
        let nameFontSize = 52;
        if (bizName.length > 15) nameFontSize = 46;
        if (bizName.length > 25) nameFontSize = 38;

        // Split name logic
        const words = bizName.split(' ');
        let lines = [];
        // Force split if long
        if (words.length >= 2 && bizName.length > 12) {
            const mid = Math.ceil(words.length / 2);
            lines.push(words.slice(0, mid).join(' '));
            lines.push(words.slice(mid).join(' '));
        } else {
            lines.push(bizName);
        }

        const lineHeight = nameFontSize * 0.9; // Tight line height for impact
        const textBlockHeight = lines.length * lineHeight;

        // Calculate visual center of the group (Logo + Text - Overlap)
        const totalGroupHeight = logoTargetSize + textBlockHeight - overlap;
        const groupStartY = centerY - totalGroupHeight / 2;

        // Logo Position
        const logoY = groupStartY + logoTargetSize / 2;

        // Text Position
        const textStartY = groupStartY + logoTargetSize - overlap; // Overlapping

        // --- DRAW LOGO ---
        const imagesQR1 = businessData.images || businessData.prospectImages || [];
        const logoImgQR1 = imagesQR1.find(img => img.type === 'logo');
        const logoUrlQR1 = logoImgQR1?.url || null;

        if (logoUrlQR1) {
            try {
                const logoEl = new Image();
                logoEl.crossOrigin = 'anonymous';
                logoEl.src = logoUrlQR1;
                await new Promise((resolve, reject) => {
                    logoEl.onload = resolve;
                    logoEl.onerror = resolve; // Continue even if error
                    setTimeout(resolve, 1000);
                });

                if (logoEl.complete && logoEl.naturalWidth !== 0) {
                    const aspect = logoEl.width / logoEl.height;
                    let drawW, drawH;
                    if (aspect >= 1) {
                        drawW = logoTargetSize;
                        drawH = drawW / aspect;
                    } else {
                        drawH = logoTargetSize;
                        drawW = drawH * aspect;
                    }
                    const logoDrawX = leftCenterX - drawW / 2;
                    const logoDrawY = logoY - drawH / 2; // Center based on calculated Y

                    // Enhanced Logo Shadow
                    ctx.save();
                    ctx.shadowColor = "rgba(0, 0, 0, 0.15)";
                    ctx.shadowBlur = 25;
                    ctx.shadowOffsetX = 0;
                    ctx.shadowOffsetY = 10;
                    ctx.drawImage(logoEl, logoDrawX, logoDrawY, drawW, drawH);
                    ctx.restore();
                }
            } catch (e) {
                console.warn('Logo failed to load:', e);
            }
        } else {
            // Fallback Shield
            // ... existing fallback code logic if needed ...
        }

        // --- DRAW BUSINESS NAME ---
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.font = `900 ${nameFontSize}px "Inter", "Arial Black", sans-serif`;
        ctx.fillStyle = textBlack;

        // Add white outline to text to make it pop over the logo
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineJoin = 'round';

        let currentNameY = textStartY;

        lines.forEach((l) => {
            // Stroke first for overlap readability
            ctx.strokeText(l.trim(), leftCenterX, currentNameY);
            ctx.fillText(l.trim(), leftCenterX, currentNameY);
            currentNameY += lineHeight;
        });


        // --- RIGHT SIDE CONTENT (Action Widget) ---
        const rightPad = 65;
        const contentX = splitX + rightPad;
        const qrSize = 340; // Reduced for new height
        // Available width for text content before hitting QR
        const availableTextW = (width - qrSize - 60) - contentX - 20;

        // E. "OFFICIAL SERVICE PARTNER"
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillStyle = '#334155'; // Slate 700
        ctx.font = '800 32px "Inter", "Arial", sans-serif';
        ctx.fillText('OFFICIAL SERVICE PARTNER', contentX, 40); // Compact top

        // F. RED HEADER BLOCK: "NEXT SERVICE DUE"
        // Tighter vertical spacing
        const widgetY = 115;
        const widgetW = 580;
        const widgetH = 200; // Slightly shorter
        const headerH = 65;

        // 1. Draw Container Body (White with Red Border)
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        // Slightly less rounded, more boxy like screenshot
        ctx.roundRect(contentX, widgetY, widgetW, widgetH, 12);
        ctx.fill();

        // Thick Red Border
        ctx.strokeStyle = '#DC2626'; // Red 600
        ctx.lineWidth = 12; // Thicker border
        ctx.stroke();

        // 2. Header Fill (Red) - Overwrites top border to be solid
        ctx.fillStyle = '#DC2626';
        ctx.beginPath();
        ctx.roundRect(contentX, widgetY, widgetW, headerH, [8, 8, 0, 0]); // Top corners only
        ctx.fill();

        // Header Text "NEXT SERVICE DUE"
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '900 46px "Inter", "Arial Black", sans-serif'; // Slightly smaller font
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'center';
        // Add subtle shadow to text for "punched out" look
        ctx.shadowColor = "rgba(0,0,0,0.2)";
        ctx.shadowBlur = 4;
        ctx.fillText('NEXT SERVICE DUE', contentX + widgetW / 2, widgetY + headerH / 2 + 2);
        ctx.shadowColor = "transparent"; // Reset

        // 3. Calendar Icon (Inside the White Body on Left)
        const bodyCenterY = widgetY + headerH + (widgetH - headerH) / 2;

        ctx.save();
        const calSize = 70; // Adjusted size
        const calX = contentX + 50;
        const calY = bodyCenterY;

        ctx.translate(calX, calY);
        // Calendar Path (Red Color)
        ctx.fillStyle = '#DC2626'; // Match border color
        const calPath = new Path2D("M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20a2 2 0 0 0 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm0-12H5V6h14v2z");
        // Center the path (original is 24x24)
        const scale = calSize / 24;
        ctx.scale(scale, scale);
        ctx.translate(-12, -12);
        ctx.fill(calPath);

        // Draw grid inside calendar (white) to look like dates
        ctx.fillStyle = '#FFFFFF';
        // Small rectangles for dates
        ctx.fillRect(7, 12, 2, 2);
        ctx.fillRect(11, 12, 2, 2);
        ctx.fillRect(15, 12, 2, 2);
        ctx.fillRect(7, 16, 2, 2);
        ctx.fillRect(11, 16, 2, 2);
        ctx.fillRect(15, 16, 2, 2);
        ctx.restore();

        // 4. Writeable Area Placeholders
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#CBD5E1'; // Light grey
        ctx.font = '500 50px "Courier New", monospace';

        // Shift '/' to the right since calendar is on the left
        const dateAreaStart = contentX + 80;
        const dateAreaW = widgetW - 110;
        const dateCenter = dateAreaStart + dateAreaW / 2;

        ctx.fillStyle = '#94A3B8'; // Slate 400
        ctx.fillText('/     /', dateCenter, bodyCenterY);


        // G. "DATE CLEANED:" Link (Below Widget)
        const dateCleanedY = widgetY + widgetH + 80;
        ctx.fillStyle = textBlack;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.font = '700 34px "Inter", "Arial", sans-serif';
        ctx.fillText('DATE CLEANED:', contentX, dateCleanedY);
        // Underline
        ctx.strokeStyle = '#94A3B8';
        ctx.lineWidth = 2; // Thicker line
        ctx.beginPath();
        const lineStart = contentX + 300;
        ctx.moveTo(lineStart, dateCleanedY);
        ctx.lineTo(contentX + widgetW, dateCleanedY);
        ctx.stroke();

        // Add Slashes for Date Input
        const lineLength = (contentX + widgetW) - lineStart;
        const lineCenter = lineStart + lineLength / 2;
        ctx.textAlign = 'center';
        ctx.fillStyle = '#CBD5E1'; // Light grey like placeholder
        ctx.font = '500 34px "Courier New", monospace';
        ctx.fillText('/    /', lineCenter, dateCleanedY - 8);

        // H. CTA TEXT (Bottom Left) - Replaces Button Pill
        // "Scan to activate" (Navy Blue)
        // "FREE 30-day warranty >" (Red, Bold)

        const ctaY = height - 35; // Tighter bottom margin

        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';

        // Line 1: "Scan to activate"
        const ctaLine1Y = ctaY - 55;
        ctx.fillStyle = '#0f172a'; // Slate 900 / Navy
        ctx.font = '800 40px "Inter", "Arial", sans-serif';
        ctx.fillText('Scan to activate', contentX, ctaLine1Y);

        // Line 2: "FREE 30-day warranty"
        ctx.fillStyle = '#DC2626'; // Red 600
        ctx.font = '900 46px "Inter", "Arial Black", sans-serif';
        const ctaText = 'FREE 30-day warranty'; // Removed ►
        ctx.fillText(ctaText, contentX, ctaY);

        // --- QR CODE AREA ---
        // Adjusted for new compact height (Increased by ~5%, 340 -> 357)
        const qrSizeAdjusted = 357;
        const qrX = width - qrSizeAdjusted - 60;
        const qrY = (height - qrSizeAdjusted) / 2;

        // --- DASHED ARROW TO QR ---
        // More dramatic "Loop" curve

        const ctaTextW = ctx.measureText(ctaText).width;
        // Start right after the text "warranty"
        const arrowStartX = contentX + ctaTextW + 15;
        const arrowStartY = ctaY - 25; // Mid-height of text

        // Target: Left side of QR, slighty below middle
        const arrowEndX = qrX - 27;
        const arrowEndY = qrY + qrSizeAdjusted - 80; // Higher up than before

        ctx.save();
        ctx.beginPath();
        ctx.strokeStyle = '#DC2626';
        ctx.lineWidth = 5;
        ctx.lineCap = 'round';
        ctx.setLineDash([12, 8]);

        // Create a loop-the-loop curve (Cycloidish)
        // 1. Go UP and RIGHT from text
        // 2. Loop BACK (left) and UP
        // 3. Curve RIGHT and DOWN into QR

        // A simple cubic bezier can't do a full loop, so we'll use a strong S-curve 
        // that goes HIGH to mimic the "flight path" look in the attachment

        const cp1x = arrowStartX + 40;
        const cp1y = arrowStartY - 100; // Go WAY up first

        const cp2x = arrowEndX - 120;
        const cp2y = arrowEndY + 80;  // Come from below/right logic? No, let's just arc it.

        // Let's try a defined 3-point curve for better control or just strong bezier
        // Start -> Control High/Right -> Control Low/Left -> End? No.

        // Let's do a large upward arc that swoops down.
        // Start: (Text End)
        // CP1: (Midway X, High Y)
        // CP2: (Close to QR X, Low Y?)

        // Update: User wants "Curve pointing more straight to the qr forming like s"
        // and "Start there" (after text).

        // New Control Points for "S" Shape
        // 1. Start moving Right
        // 2. Curve Down
        // 3. Curve Up/Right into QR? 
        // Or "Loop" style: Up -> Right -> Down -> target

        // Trying a "Ski Jump" S-curve
        const jumpCP1X = arrowStartX + 120;
        const jumpCP1Y = arrowStartY - 80; // Up and Right

        const jumpCP2X = arrowEndX - 100;
        const jumpCP2Y = arrowEndY + 80;   // Down and Left (creates tension)

        // Calculate shortened endpoint to prevent dashed line from overlapping arrowhead
        // Get the direction vector from CP2 to End
        const dx = arrowEndX - jumpCP2X;
        const dy = arrowEndY - jumpCP2Y;
        const length = Math.sqrt(dx * dx + dy * dy);
        const unitX = dx / length;
        const unitY = dy / length;

        // Pull back by ~15 pixels to create clean separation
        const shortenedEndX = arrowEndX - (unitX * 15);
        const shortenedEndY = arrowEndY - (unitY * 15);

        ctx.moveTo(arrowStartX, arrowStartY);
        ctx.lineCap = 'butt';
        ctx.bezierCurveTo(jumpCP1X, jumpCP1Y, jumpCP2X, jumpCP2Y, shortenedEndX, shortenedEndY);
        ctx.stroke();

        // Arrow Head (drawn at full endpoint for sharp tip)
        ctx.setLineDash([]);
        ctx.translate(arrowEndX, arrowEndY);
        // Angle needs to match the incoming tangent from jumpCP2
        const angle = Math.atan2(arrowEndY - jumpCP2Y, arrowEndX - jumpCP2X);
        ctx.rotate(angle);

        ctx.fillStyle = '#DC2626';
        ctx.beginPath();
        ctx.moveTo(0, 0);       // Sharp tip at center
        ctx.lineTo(-24, -12);
        ctx.lineTo(-24, 12);
        ctx.closePath();
        ctx.fill();
        ctx.restore();


        try {
            // Draw White Background Card for QR
            ctx.fillStyle = '#FFFFFF';
            const qrBgPadding = 20;
            const qrBgSize = qrSizeAdjusted + (qrBgPadding * 2);
            const qrBgX = qrX - qrBgPadding;
            const qrBgY = qrY - qrBgPadding;

            ctx.beginPath();
            ctx.roundRect(qrBgX, qrBgY, qrBgSize, qrBgSize, 24);
            ctx.fill();

            // Subtle shadow for the card
            ctx.shadowColor = "rgba(0, 0, 0, 0.05)";
            ctx.shadowBlur = 15;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 4;
            ctx.fill();
            ctx.shadowColor = "transparent"; // Reset

            const qrDataUrl = await QRCodeLib.toDataURL(qrUrl, {
                width: qrSizeAdjusted,
                // Add margin in QR generation so modules don't hit the edge if we didn't have padding
                margin: 0,
                errorCorrectionLevel: 'M',
                color: { dark: '#111111', light: '#00000000' }
            });

            const qrImg = new Image();
            qrImg.src = qrDataUrl;
            await new Promise((resolve) => { qrImg.onload = resolve; });
            ctx.drawImage(qrImg, qrX, qrY, qrSizeAdjusted, qrSizeAdjusted);

            // WhatsApp Icon Overlay
            const iconSize = qrSizeAdjusted * 0.20;
            const iconX = qrX + qrSizeAdjusted / 2;
            const iconY = qrY + qrSizeAdjusted / 2;

            ctx.beginPath();
            ctx.arc(iconX, iconY, iconSize / 2 + 8, 0, Math.PI * 2);
            ctx.fillStyle = '#FFFFFF';
            ctx.fill();

            ctx.beginPath();
            ctx.arc(iconX, iconY, iconSize / 2, 0, Math.PI * 2);
            ctx.fillStyle = '#25D366';
            ctx.fill();

            const s = iconSize * 0.55;
            ctx.fillStyle = '#ffffff';
            ctx.save();
            ctx.translate(iconX, iconY);
            ctx.scale(s / 24, s / 24);
            ctx.translate(-12, -12);
            const phonePath = new Path2D("M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z");
            ctx.fill(phonePath);
            ctx.restore();

            // Bottom Label for QR - "SCAN TO BOOK"
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillStyle = textBlack;
            ctx.font = '800 28px "Inter", "Arial", sans-serif';
            ctx.fillText('SCAN TO BOOK', qrX + qrSizeAdjusted / 2, qrY + qrSizeAdjusted + 44);

            // Download
            const link = document.createElement('a');
            const safeName = (business?.name || 'Business').replace(/[^a-z0-9]/gi, '_');
            link.download = `${safeName}_Premium_Sticker.png`;
            link.href = canvas.toDataURL('image/png');
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (err) {
            console.error('Error creating maintenance sticker:', err);
            alert('Failed to generate sticker. Please try again.');
        }
    };

    // Download QR - Maintenance Record Sticker Design
    // CONCEPT: "The Silver Badge" (Premium & Trustworthy)
    const downloadQR_silver = async () => {
        // Launchfly Bot WhatsApp number - the central AI receptionist
        const launchflyBotNumber = '13203627874';

        // Include business ref in trigger message so bot knows which business context to use
        // Use subdomain if available (shorter), otherwise fall back to UUID
        const businessRef = business?.subdomain || business?.id;
        const stickerTrigger = `Hi! I want to activate my 30-Day Warranty. 🛡️\n\n(Ref: ${businessRef || 'UNKNOWN'})`;

        // Primary: Launchfly bot with business context
        const qrUrl = `https://wa.me/${launchflyBotNumber}?text=${encodeURIComponent(stickerTrigger)}`;

        const canvas = document.createElement('canvas');
        // Landscape orientation ~2.8:1 ratio (Sleek bumper sticker size)
        const width = 1800;
        const height = 640;
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        // --- COLORS ---
        const navyBlue = '#102A56'; // Deep Corporate Navy
        const silverStart = '#E8E8E8'; // Matte Silver
        const silverEnd = '#F8F8F8';   // Lighter Highlight
        const textBlack = '#111111';
        const textDarkGrey = '#4A4A4A';
        const accentBlue = '#102A56'; // Same as Navy to match brand
        const brandWhite = '#FFFFFF';

        // 1. CLIP ROUNDED CORNERS
        const radius = 40;
        ctx.beginPath();
        ctx.roundRect(0, 0, width, height, radius);
        ctx.clip();

        // 2. BACKGROUNDS
        // Split point: Left 30% Blue, Right 70% Silver
        const splitX = 540; // 30% of 1800

        // Right Loop: Silver Gradient 
        // [MODIFIED FOR PRINT] LEAVE TRANSPARENT so the Silver Foil material shines through
        // const grad = ctx.createLinearGradient(splitX, 0, width, height);
        // grad.addColorStop(0, silverStart);
        // grad.addColorStop(0.5, silverEnd); // diagonal sheen
        // grad.addColorStop(1, silverStart);
        // ctx.fillStyle = grad;
        // ctx.fillRect(splitX, 0, width - splitX, height);

        // Left Loop: Navy Blue
        ctx.fillStyle = navyBlue;
        ctx.fillRect(0, 0, splitX, height);

        // --- LEFT SIDE CONTENT (Navy Block) ---
        const leftCenterX = splitX / 2;

        // A. Business Name
        ctx.fillStyle = brandWhite;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        // Dynamic sizing for name
        const bizName = (business?.name || 'COOLTECH SERVICES').toUpperCase();
        let nameFontSize = 55;
        if (bizName.length > 15) nameFontSize = 45;
        if (bizName.length > 25) nameFontSize = 35;
        ctx.font = `700 ${nameFontSize}px "Inter", "Arial", sans-serif`;

        // Wrap text logic: Print max 2 lines
        const nameY = 135;
        const words = bizName.split(' ');
        let line = '';
        let lines = [];
        for (let n = 0; n < words.length; n++) {
            const testLine = line + words[n] + ' ';
            const metrics = ctx.measureText(testLine);
            if (metrics.width > splitX - 60 && n > 0) {
                lines.push(line);
                line = words[n] + ' ';
            } else {
                line = testLine;
            }
        }
        lines.push(line);
        // Draw lines centered
        let currentNameY = lines.length > 1 ? nameY - (lines.length * nameFontSize / 2) : nameY;
        lines.forEach((l) => {
            ctx.fillText(l.trim(), leftCenterX, currentNameY);
            currentNameY += (nameFontSize * 1.2);
        });

        // B. Shield Icon (Center) - Professional SVG Path
        const shieldSize = 240;
        const shieldY = height / 2;

        ctx.save();
        // Centering logic: The Shield path specifically goes from y=2 to y=25 (material icon style)
        // We translate to the absolute center of the left section first.
        ctx.translate(leftCenterX, shieldY);
        ctx.scale(shieldSize / 24, shieldSize / 24);
        // Then we offset to center the 24x24 box AND account for the y=2 top margin in the path
        const pathCenterY = 13.5; // (2 + 25) / 2
        ctx.translate(-12, -pathCenterY);

        // Shield Outline
        ctx.lineWidth = 2.0; // Slightly thicker for print clarity at smaller scale
        ctx.strokeStyle = brandWhite;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';

        // Custom Shield Path (professional badge shape)
        const shieldPath = new Path2D("M12 2L3 7v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5z");
        ctx.stroke(shieldPath);

        // Checkmark inside
        const checkPath = new Path2D("M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z");
        ctx.fillStyle = brandWhite;
        ctx.fill(checkPath);
        ctx.restore();

        // C. Phone Number
        const phoneY = height - 45;
        // Priority: whatsapp_number > phone_number > business_data.phone > fallback
        const safePhone = business?.whatsapp_number || business?.phone_number || businessData?.phone || '+13203627874';

        ctx.fillStyle = brandWhite;
        ctx.font = '500 36px "Inter", "Arial", sans-serif';

        // "WhatsApp:" label with Icon
        const labelText = 'WhatsApp:';
        const iconSizeSmall = 32;
        const gap = 12;
        const textWidth = ctx.measureText(labelText).width;
        const totalWidth = iconSizeSmall + gap + textWidth;

        // Calculate starting X to center the whole group
        const startX = leftCenterX - (totalWidth / 2);

        // Draw Icon
        ctx.save();
        // Align icon vertically with text. Text is baseline 'bottom' at (phoneY - 55).
        ctx.translate(startX, phoneY - 55 - iconSizeSmall - 5);
        ctx.scale(iconSizeSmall / 24, iconSizeSmall / 24);
        const phoneIconPath = new Path2D("M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z");
        ctx.fill(phoneIconPath);
        ctx.restore();

        // Draw Text
        ctx.textAlign = 'left';
        ctx.fillText(labelText, startX + iconSizeSmall + gap, phoneY - 55);
        ctx.textAlign = 'center'; // Restore

        ctx.font = '700 42px "Inter", "Arial", sans-serif';
        ctx.fillText(safePhone, leftCenterX, phoneY);

        // --- RIGHT SIDE CONTENT (Silver Area) ---
        const rightPad = 80;
        const contentX = splitX + rightPad;
        const qrSize = 400; // Adjusted for sleek height

        ctx.textAlign = 'left';

        // D. Top Label "SERVICE & WARRANTY RECORD"
        // [PRINT FIX] Use Navy instead of Grey for high contrast on Silver Foil
        ctx.fillStyle = navyBlue;
        ctx.textBaseline = 'top';
        ctx.font = '800 42px "Inter", "Arial", sans-serif';
        ctx.fillText('OFFICIAL 30-DAY WARRANTY', contentX, 65); // Moved up

        // E. Main Headline "SCAN TO ACTIVATE WARRANTY"
        // Stacked
        const mainY = 135; // Moved up
        ctx.fillStyle = textBlack;
        ctx.font = '900 95px "Inter", "Arial Black", sans-serif';
        const lineHeight = 100;

        ctx.fillText('SCAN TO', contentX, mainY);
        ctx.fillText('ACTIVATE', contentX, mainY + lineHeight);
        ctx.fillText('WARRANTY', contentX, mainY + (lineHeight * 2));

        // F. Subtext "& Get Next Service Reminder"
        const subY = mainY + (lineHeight * 3) + 27;
        ctx.fillStyle = accentBlue;
        ctx.font = '700 50px "Inter", "Arial", sans-serif';
        ctx.fillText('& Get Next', contentX, subY);
        ctx.fillText('Service Reminder', contentX, subY + 65);

        // --- QR CODE AREA ---
        const qrX = width - qrSize - 100; // Increased margin slightly
        const qrY = (height - qrSize) / 2;

        try {
            // Generate QR - Silver background needs transparent or white?
            // User asked for "High contrast black on silver".
            // If library puts transparent, it will be silver background.
            // If library puts white, it will be a white box.
            // Let's try transparent (light: #00000000) for the integrated look.

            const qrDataUrl = await QRCodeLib.toDataURL(qrUrl, {
                width: qrSize,
                margin: 0,
                errorCorrectionLevel: 'M', // Standard level for fewer, larger dots (better for print)
                color: { dark: '#000000', light: '#00000000' }
            });

            const qrImg = new Image();
            qrImg.src = qrDataUrl;
            await new Promise((resolve) => { qrImg.onload = resolve; });
            ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);

            // WhatsApp Icon Overlay in center of QR
            const iconSize = qrSize * 0.20;
            const iconX = qrX + qrSize / 2;
            const iconY = qrY + qrSize / 2;

            // White circle background for icon
            ctx.beginPath();
            ctx.arc(iconX, iconY, iconSize / 2 + 10, 0, Math.PI * 2);
            ctx.fillStyle = '#FFFFFF';
            ctx.fill();

            // Green WhatsApp circle
            const whatsappGreen = '#25D366';
            ctx.beginPath();
            ctx.arc(iconX, iconY, iconSize / 2, 0, Math.PI * 2);
            ctx.fillStyle = whatsappGreen;
            ctx.fill();

            // Phone Icon Path (white)
            const s = iconSize * 0.6;
            ctx.fillStyle = '#ffffff';
            ctx.save();
            ctx.translate(iconX, iconY);
            ctx.scale(s / 24, s / 24);
            ctx.translate(-12, -12);
            const phonePath = new Path2D("M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z");
            ctx.fill(phonePath);
            ctx.restore();

            // "No app needed" text below QR
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillStyle = textDarkGrey;
            ctx.font = '600 34px "Inter", "Arial", sans-serif';
            ctx.fillText('No App Needed', qrX + qrSize / 2, qrY + qrSize + 25);

            // Download
            const link = document.createElement('a');
            const safeName = (business?.name || 'Business').replace(/[^a-z0-9]/gi, '_');
            link.download = `${safeName}_Warranty_Sticker.png`;
            link.href = canvas.toDataURL('image/png');
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (err) {
            console.error('Error creating maintenance sticker:', err);
            alert('Failed to generate sticker. Please try again.');
        }
    };

    // Upload logo handler
    const handleLogoUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            alert('Please select an image file');
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            alert('Image must be under 5MB');
            return;
        }

        setUploadingLogo(true);
        try {
            // 1. Upload to Supabase storage via the existing API
            const formData = new FormData();
            formData.append('files', file);
            const uploadRes = await fetch('/api/sales/upload', {
                method: 'POST',
                body: formData,
            });
            const uploadData = await uploadRes.json();
            if (!uploadRes.ok) throw new Error(uploadData.error || 'Upload failed');

            const newLogoUrl = uploadData.images[0]?.url;
            if (!newLogoUrl) throw new Error('No URL returned');

            // 2. Update business_data: replace or add logo entry in images array
            const currentData = business?.business_data || {};
            const currentImages = currentData.images || currentData.prospectImages || [];
            // Remove old logo entries
            const filtered = currentImages.filter(img => img.type !== 'logo');
            // Add new logo
            filtered.push({ url: newLogoUrl, type: 'logo', name: file.name });

            // Save to correct field (images or prospectImages)
            const imageField = currentData.images ? 'images' : 'prospectImages';
            const updatedData = { ...currentData, [imageField]: filtered };

            const { error } = await supabase
                .from('businesses')
                .update({ business_data: updatedData })
                .eq('id', business.id);

            if (error) throw error;

            setCurrentLogoUrl(newLogoUrl);
            // Update the in-memory business object too
            if (business.business_data) {
                business.business_data[imageField] = filtered;
            }
            alert('✅ Logo uploaded successfully!');
        } catch (err) {
            console.error('Logo upload error:', err);
            alert('❌ Failed to upload logo: ' + err.message);
        } finally {
            setUploadingLogo(false);
            if (logoFileRef.current) logoFileRef.current.value = '';
        }
    };

    // Remove logo handler
    const handleRemoveLogo = async () => {
        if (!confirm('Remove business logo?')) return;
        try {
            const currentData = business?.business_data || {};
            const currentImages = currentData.images || currentData.prospectImages || [];
            const filtered = currentImages.filter(img => img.type !== 'logo');
            const imageField = currentData.images ? 'images' : 'prospectImages';
            const updatedData = { ...currentData, [imageField]: filtered };

            const { error } = await supabase
                .from('businesses')
                .update({ business_data: updatedData })
                .eq('id', business.id);

            if (error) throw error;
            setCurrentLogoUrl(null);
            if (business.business_data) {
                business.business_data[imageField] = filtered;
            }
        } catch (err) {
            console.error('Remove logo error:', err);
            alert('Failed to remove logo');
        }
    };

    // Count old leads for blast
    const oldLeadsCount = leads.filter(l => {
        const hoursSince = (Date.now() - new Date(l.created_at)) / (1000 * 60 * 60);
        return hoursSince > 72 && l.status !== 'booked';
    }).length;

    return (
        <div className="max-w-md mx-auto min-h-screen bg-gray-50 pb-20">
            {/* Header */}
            <div className="bg-slate-900 text-white p-5 rounded-b-3xl shadow-lg sticky top-0 z-50">
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <h1 className="text-lg font-bold">{businessName}</h1>
                        <div className="flex items-center gap-2 mt-1">
                            <div className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse"></div>
                            <span className="text-xs font-medium text-green-400">Digital Receptionist: ONLINE</span>
                        </div>
                    </div>
                    <button
                        onClick={() => setShowSettingsModal(true)}
                        className="bg-slate-800 p-2 rounded-lg hover:bg-slate-700 transition-colors"
                    >
                        <Settings className="w-5 h-5 text-slate-400" />
                    </button>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-3">
                    <div className="bg-slate-800 p-3 rounded-xl border border-slate-700">
                        <p className="text-[10px] text-slate-400 uppercase font-bold">Active Quotes</p>
                        <p className="text-2xl font-bold text-white">{stats.activeQuotes}</p>
                    </div>
                    <div className="bg-slate-800 p-3 rounded-xl border border-slate-700">
                        <p className="text-[10px] text-slate-400 uppercase font-bold">Pipeline</p>
                        <p className="text-2xl font-bold text-green-400">
                            {currency}{stats.pipeline >= 1000 ? `${(stats.pipeline / 1000).toFixed(0)}k` : stats.pipeline}
                        </p>
                    </div>
                    <div className="bg-slate-800 p-3 rounded-xl border border-slate-700">
                        <p className="text-[10px] text-slate-400 uppercase font-bold">Booked</p>
                        <p className="text-2xl font-bold text-blue-400">{stats.booked}</p>
                    </div>
                </div>
            </div>

            {/* Revenue Pulse — Money Left on the Table */}
            <div className="px-5 pt-5">
                <RevenuePulse business={business} />
            </div>

            {/* Live Job Feed - Shows both upcoming bookings and leads */}
            <div className="p-5">
                {/* Upcoming Bookings Section */}
                {bookings.filter(b => b.status === 'pending' || b.status === 'confirmed').length > 0 && (
                    <>
                        <h2 className="text-sm font-bold text-slate-500 mb-4 uppercase tracking-wider">📅 Upcoming Jobs</h2>
                        {bookings
                            .filter(b => b.status === 'pending' || b.status === 'confirmed')
                            .sort((a, b) => new Date(a.slot_date) - new Date(b.slot_date))
                            .slice(0, 5)
                            .map((booking) => {
                                const isToday = booking.slot_date === new Date().toISOString().split('T')[0];
                                const isTomorrow = booking.slot_date === new Date(Date.now() + 86400000).toISOString().split('T')[0];
                                const dateLabel = isToday ? '🔴 TODAY' : isTomorrow ? '🟡 TOMORROW' : booking.slot_label?.split(' ').slice(0, 3).join(' ');

                                return (
                                    <div
                                        key={booking.id}
                                        className={`bg-white p-4 rounded-xl shadow-sm border mb-4 relative overflow-hidden ${isToday ? 'border-red-300 bg-red-50' : isTomorrow ? 'border-yellow-300 bg-yellow-50' : 'border-slate-200'}`}
                                    >
                                        {/* Status Badge */}
                                        <div className={`absolute top-0 right-0 text-[10px] font-bold px-2 py-1 rounded-bl-lg ${booking.status === 'confirmed' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                                            {booking.status === 'confirmed' ? '✅ CONFIRMED' : '⏳ PENDING'}
                                        </div>

                                        <div className="flex items-start gap-4">
                                            <div className={`p-3 rounded-lg ${isToday ? 'bg-red-100 text-red-600' : isTomorrow ? 'bg-yellow-100 text-yellow-600' : 'bg-blue-100 text-blue-600'}`}>
                                                {getServiceIcon(booking.notes)}
                                            </div>
                                            <div className="flex-1">
                                                <h3 className="font-bold text-slate-900">{booking.notes?.replace('Service: ', '') || niche}</h3>
                                                <p className="text-xs text-slate-500 mt-1">
                                                    {booking.customer_name || 'Customer'} • {booking.customer_phone || 'No phone'}
                                                </p>

                                                {/* Booking Details */}
                                                <div className="mt-2 text-sm bg-white/70 p-2 rounded border border-slate-100">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <Clock className="w-3.5 h-3.5 text-blue-600" />
                                                        <span className={`font-bold ${isToday ? 'text-red-700' : 'text-blue-900'}`}>
                                                            {dateLabel} • {booking.slot_time === 'morning' ? '9am-12pm' : '1pm-5pm'}
                                                        </span>
                                                    </div>
                                                    {booking.customer_address && (
                                                        <div className="flex items-start gap-2">
                                                            <div className="mt-0.5"><div className="w-3.5 h-3.5 rounded-full bg-red-100 flex items-center justify-center"><div className="w-1.5 h-1.5 rounded-full bg-red-500"></div></div></div>
                                                            <span className="text-slate-600 leading-tight">{booking.customer_address}</span>
                                                        </div>
                                                    )}
                                                    {booking.estimate && (
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <TrendingUp className="w-3.5 h-3.5 text-green-600" />
                                                            <span className="font-bold text-green-700">{booking.estimate}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Actions */}
                                        <div className="grid grid-cols-3 gap-2 mt-4">
                                            <button
                                                onClick={() => openWhatsApp(booking.customer_phone, booking.customer_name)}
                                                className="flex items-center justify-center gap-1 py-2 bg-green-500 text-white rounded-lg font-bold text-xs hover:bg-green-600 transition-colors"
                                            >
                                                <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                                            </button>
                                            <button
                                                onClick={() => {
                                                    const addr = encodeURIComponent(booking.customer_address || '');
                                                    window.open(`https://www.google.com/maps/search/${addr}`, '_blank');
                                                }}
                                                className="flex items-center justify-center gap-1 py-2 bg-blue-500 text-white rounded-lg font-bold text-xs hover:bg-blue-600 transition-colors"
                                            >
                                                <ChevronRight className="w-3.5 h-3.5" /> Map
                                            </button>
                                            <button
                                                onClick={() => completeBooking(booking)}
                                                className="flex items-center justify-center gap-1 py-2 bg-slate-100 text-slate-700 rounded-lg font-bold text-xs hover:bg-slate-200 transition-colors"
                                            >
                                                <CheckCircle className="w-3.5 h-3.5" /> Done
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                    </>
                )}

                {/* Leads Section */}
                <h2 className="text-sm font-bold text-slate-500 mb-4 uppercase tracking-wider">👥 Leads & Customers</h2>

                {leads.length === 0 ? (
                    <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200 text-center">
                        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Users className="w-8 h-8 text-slate-400" />
                        </div>
                        <h3 className="font-bold text-slate-700 mb-2">No leads yet</h3>
                        <p className="text-sm text-slate-500">Share your quote page to start getting leads!</p>
                        <button
                            onClick={() => navigator.clipboard.writeText(`${window.location.origin}/q/${business.id}`)}
                            className="mt-4 px-4 py-2 bg-blue-600 text-white font-medium rounded-lg text-sm"
                        >
                            Copy Quote Link
                        </button>
                    </div>
                ) : (
                    leads.slice(0, 10).map((lead) => {
                        const { service, estimate } = parseLeadDetails(lead);
                        const status = getStatusBadge(lead);

                        // Check if this lead has an active booking
                        const hasActiveBooking = bookings.some(b =>
                            b.customer_phone === lead.phone &&
                            (b.status === 'pending' || b.status === 'confirmed')
                        );

                        return (
                            <div
                                key={lead.id}
                                className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-4 relative overflow-hidden"
                            >
                                {status.isWaiting && (
                                    <div className="absolute top-0 right-0 bg-yellow-100 text-yellow-700 text-[10px] font-bold px-2 py-1 rounded-bl-lg">
                                        {status.text}
                                    </div>
                                )}

                                {hasActiveBooking && (
                                    <div className="absolute top-0 right-0 bg-green-100 text-green-700 text-[10px] font-bold px-2 py-1 rounded-bl-lg">
                                        ✅ HAS BOOKING
                                    </div>
                                )}

                                <div className="flex items-start gap-4">
                                    <div className={`p-3 rounded-lg ${getServiceColor(lead.notes)}`}>
                                        {getServiceIcon(lead.notes)}
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="font-bold text-slate-900">{service}</h3>
                                        <p className="text-xs text-slate-500 mt-1">
                                            {lead.name || 'Customer'} • {lead.phone || 'No phone'}
                                        </p>

                                        {/* Display Booking Details if available */}
                                        {(lead.status === 'booked' || lead.status === 'confirmed') && lead.notes ? (
                                            <div className="mt-2 text-sm bg-slate-50 p-2 rounded border border-slate-100">
                                                {(() => {
                                                    // Get LAST valid slot from notes (in case of multiple changes)
                                                    const slotParts = lead.notes ? lead.notes.split('📅 SELECTED SLOT: ') : [];
                                                    const slot = (slotParts.length > 1) ? slotParts.pop().split('\n')[0] : null;

                                                    const addrMatch = lead.notes ? lead.notes.match(/📍 ADDRESS: ([^\n]+)/) : null;
                                                    const addr = addrMatch ? addrMatch[1] : null;

                                                    return (
                                                        <>
                                                            {slot && (
                                                                <div className="flex items-center gap-2 mb-1">
                                                                    <Clock className="w-3.5 h-3.5 text-blue-600" />
                                                                    <span className="font-bold text-blue-900">{slot}</span>
                                                                </div>
                                                            )}
                                                            {addr && (
                                                                <div className="flex items-start gap-2">
                                                                    <div className="mt-0.5"><div className="w-3.5 h-3.5 rounded-full bg-red-100 flex items-center justify-center"><div className="w-1.5 h-1.5 rounded-full bg-red-500"></div></div></div>
                                                                    <span className="text-slate-600 leading-tight">{addr}</span>
                                                                </div>
                                                            )}
                                                        </>
                                                    );
                                                })()}
                                            </div>
                                        ) : estimate && (
                                            <p className="text-lg font-black text-slate-900 mt-1">{estimate}</p>
                                        )}
                                    </div>
                                </div>

                                {/* Bot activity */}
                                {lead.email_sequence_day && lead.email_sequence_day > 1 && (
                                    <div className="mt-4 bg-slate-50 p-3 rounded-lg border border-slate-100 flex items-center gap-2">
                                        <Bot className="w-4 h-4 text-slate-400" />
                                        <p className="text-xs text-slate-600">
                                            <span className="font-bold">Bot:</span> Sent follow-up #{lead.email_sequence_day - 1}
                                        </p>
                                    </div>
                                )}

                                {/* Status badge for non-waiting */}
                                {!status.isWaiting && !hasActiveBooking && (
                                    <div className="mt-3 flex gap-2">
                                        <span className={`px-2 py-1 text-[10px] font-bold rounded ${status.color}`}>
                                            {status.text}
                                        </span>
                                    </div>
                                )}

                                {/* Actions */}
                                <div className="grid grid-cols-2 gap-3 mt-4">
                                    <button
                                        onClick={() => openWhatsApp(lead.phone, lead.name)}
                                        className="flex items-center justify-center gap-2 py-2 bg-green-500 text-white rounded-lg font-bold text-sm hover:bg-green-600 transition-colors"
                                    >
                                        <MessageCircle className="w-4 h-4" /> WhatsApp
                                    </button>
                                    {lead.status === 'booked' || lead.status === 'confirmed' || hasActiveBooking ? (
                                        <button
                                            onClick={() => archiveJob(lead.id)}
                                            className="flex items-center justify-center gap-2 py-2 bg-slate-100 text-slate-500 rounded-lg font-bold text-sm hover:bg-slate-200 transition-colors"
                                        >
                                            <CheckCircle className="w-4 h-4" /> Archive
                                        </button>
                                    ) : status.isWaiting ? (
                                        <button
                                            onClick={() => markAsBooked(lead.id)}
                                            className="flex items-center justify-center gap-2 py-2 bg-slate-100 text-slate-700 rounded-lg font-bold text-sm hover:bg-slate-200 transition-colors"
                                        >
                                            <CheckCircle className="w-4 h-4" /> Booked
                                        </button>
                                    ) : (
                                        <button
                                            onClick={() => openScheduleModal(lead)}
                                            className="flex items-center justify-center gap-2 py-2 bg-blue-600 text-white rounded-lg font-bold text-sm hover:bg-blue-700 transition-colors"
                                        >
                                            <Calendar className="w-4 h-4" /> Schedule
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Quick Actions */}
            <div className="px-5 pb-5">
                <h2 className="text-sm font-bold text-slate-500 mb-4 uppercase tracking-wider">Quick Actions</h2>

                {/* AI Sales Assistant Card */}
                <div className="bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-700 p-5 rounded-xl shadow-lg text-white mb-4 relative overflow-hidden">
                    <div className="absolute -right-6 -top-6 bg-white/10 w-28 h-28 rounded-full blur-2xl"></div>
                    <div className="absolute -left-4 -bottom-4 bg-white/5 w-20 h-20 rounded-full blur-xl"></div>

                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-white/20 rounded-lg backdrop-blur">
                            <Bot className="w-5 h-5 text-white" />
                        </div>
                        <h3 className="font-bold">AI Sales Assistant</h3>
                    </div>
                    <p className="text-sm text-emerald-100 mb-4">
                        Put your follow-ups on autopilot. Choose an audience, and let the AI follow up until they book.
                    </p>
                    <button
                        onClick={() => { setShowBlastModal(true); setDeployStep(1); setSelectedGoal(null); setSelectedPlaybook(null); fetchBlastSegments(); }}
                        className="w-full py-2.5 bg-white text-emerald-700 font-bold rounded-lg text-sm hover:bg-emerald-50 transition-colors flex items-center justify-center gap-2"
                    >
                        <Zap className="w-4 h-4" /> Deploy AI Assistant
                    </button>
                </div>

                {/* QR Download */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-slate-100 rounded-lg">
                            <QrCode className="w-5 h-5 text-slate-700" />
                        </div>
                        <div>
                            <h3 className="font-bold text-sm text-slate-900">Service Record Sticker</h3>
                            <p className="text-xs text-slate-500">Factory-style warranty label</p>
                        </div>
                    </div>
                    <button
                        onClick={downloadQR}
                        className="px-3 py-1.5 bg-slate-900 text-white text-xs font-bold rounded-lg hover:bg-slate-800 transition-colors"
                    >
                        Download
                    </button>
                </div>

                {/* Quote Page Link */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-100 rounded-lg">
                            <Zap className="w-5 h-5 text-green-600" />
                        </div>
                        <div>
                            <h3 className="font-bold text-sm text-slate-900">Quote Page</h3>
                            <p className="text-xs text-slate-500">Share with customers</p>
                        </div>
                    </div>
                    <button
                        onClick={() => {
                            navigator.clipboard.writeText(`${window.location.origin}/q/${business.id}`);
                            alert('Link copied!');
                        }}
                        className="px-3 py-1.5 bg-green-600 text-white text-xs font-bold rounded-lg hover:bg-green-700 transition-colors"
                    >
                        Copy Link
                    </button>
                </div>
            </div>

            {/* AI Sales Assistant Modal — 3-Step Wizard */}
            {showBlastModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl max-w-sm w-full p-5 max-h-[90vh] overflow-y-auto">
                        {/* Header */}
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <div className="p-1.5 bg-emerald-100 rounded-lg">
                                    <Bot className="w-4 h-4 text-emerald-600" />
                                </div>
                                <h3 className="font-bold text-lg">AI Sales Assistant</h3>
                            </div>
                            <button onClick={() => { setShowBlastModal(false); setBlastTab('blast'); setImportResult(null); setDeployStep(1); }}>
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Progress Dots */}
                        <div className="flex items-center justify-center gap-2 mb-5">
                            {[1, 2, 3].map(step => (
                                <div key={step} className="flex items-center gap-2">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${deployStep === step
                                        ? 'bg-emerald-600 text-white scale-110 shadow-lg shadow-emerald-200'
                                        : deployStep > step
                                            ? 'bg-emerald-100 text-emerald-600'
                                            : 'bg-slate-100 text-slate-400'
                                        }`}>
                                        {deployStep > step ? '✓' : step}
                                    </div>
                                    {step < 3 && (
                                        <div className={`w-8 h-0.5 rounded transition-colors duration-300 ${deployStep > step ? 'bg-emerald-400' : 'bg-slate-200'
                                            }`} />
                                    )}
                                </div>
                            ))}
                        </div>
                        <div className="text-center mb-4">
                            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                                {deployStep === 1 ? 'Step 1: Target Audience' : deployStep === 2 ? 'Step 2: AI Goal' : 'Step 3: Follow-Up Playbook'}
                            </p>
                        </div>

                        {/* ───── STEP 1: AUDIENCE ───── */}
                        {deployStep === 1 && (
                            <div>
                                {loadingSegments ? (
                                    <div className="text-center py-8">
                                        <div className="animate-spin w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full mx-auto mb-2"></div>
                                        <p className="text-sm text-slate-500">Loading audiences...</p>
                                    </div>
                                ) : blastSegments ? (
                                    <div className="space-y-2">
                                        {Object.entries(blastSegments).map(([key, seg]) => (
                                            <button
                                                key={key}
                                                onClick={() => setSelectedSegment(key)}
                                                className={`w-full p-3.5 rounded-xl border-2 text-left transition-all ${selectedSegment === key
                                                    ? 'border-emerald-500 bg-emerald-50 shadow-sm'
                                                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                                                    }`}
                                            >
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-xl">{seg.icon}</span>
                                                        <div>
                                                            <p className="font-semibold text-sm text-slate-900">{seg.name}</p>
                                                            <p className="text-xs text-slate-500">{seg.description}</p>
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <span className={`text-lg font-bold ${seg.count > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                                                            {seg.count}
                                                        </span>
                                                        {seg.recommended && (
                                                            <span className="block text-[10px] text-amber-600 font-medium">⭐ Best</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-sm text-slate-500 text-center py-8">Failed to load audiences. Try again.</p>
                                )}

                                {/* Import link */}
                                <button
                                    onClick={() => setBlastTab('import')}
                                    className="mt-3 w-full text-xs text-slate-400 hover:text-emerald-600 transition-colors"
                                >
                                    📥 Or import a contact list first
                                </button>

                                {/* Next Button */}
                                <button
                                    onClick={() => setDeployStep(2)}
                                    disabled={!blastSegments || !blastSegments[selectedSegment] || blastSegments[selectedSegment].count === 0}
                                    className="w-full mt-4 py-3 bg-emerald-600 text-white font-bold rounded-xl disabled:opacity-40 disabled:cursor-not-allowed hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2"
                                >
                                    Next: Choose AI Goal <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        )}

                        {/* ───── STEP 2: AI GOAL ───── */}
                        {deployStep === 2 && (
                            <div>
                                <div className="space-y-2">
                                    {[
                                        { id: 'book_call', icon: '📞', title: 'Book a Decision Call', desc: 'Best for: Quoted, Not Booked', color: 'blue' },
                                        { id: 'reactivate', icon: '💬', title: 'Reactivate & Get a Reply', desc: 'Best for: Ghosted Leads', color: 'amber' },
                                        { id: 'upsell', icon: '🔧', title: 'Upsell / Book Maintenance', desc: 'Best for: Past Customers', color: 'purple' },
                                    ].map(goal => (
                                        <button
                                            key={goal.id}
                                            onClick={() => setSelectedGoal(goal.id)}
                                            className={`w-full p-4 rounded-xl border-2 text-left transition-all ${selectedGoal === goal.id
                                                ? 'border-emerald-500 bg-emerald-50 shadow-sm'
                                                : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                                                }`}
                                        >
                                            <div className="flex items-start gap-3">
                                                <span className="text-2xl mt-0.5">{goal.icon}</span>
                                                <div>
                                                    <p className="font-semibold text-sm text-slate-900">{goal.title}</p>
                                                    <p className="text-xs text-slate-500 mt-0.5">{goal.desc}</p>
                                                </div>
                                            </div>
                                            {selectedGoal === goal.id && (
                                                <div className="mt-2 ml-9 text-xs text-emerald-600 font-medium">✓ Selected</div>
                                            )}
                                        </button>
                                    ))}
                                </div>

                                {/* Navigation */}
                                <div className="flex gap-2 mt-4">
                                    <button
                                        onClick={() => setDeployStep(1)}
                                        className="flex-1 py-3 border-2 border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition-colors"
                                    >
                                        ← Back
                                    </button>
                                    <button
                                        onClick={() => setDeployStep(3)}
                                        disabled={!selectedGoal}
                                        className="flex-1 py-3 bg-emerald-600 text-white font-bold rounded-xl disabled:opacity-40 disabled:cursor-not-allowed hover:bg-emerald-700 transition-colors flex items-center justify-center gap-1"
                                    >
                                        Next <ChevronRight className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* ───── STEP 3: PLAYBOOK ───── */}
                        {deployStep === 3 && (
                            <div>
                                <div className="space-y-2">
                                    {[
                                        {
                                            id: 'aggressive',
                                            icon: '🔥',
                                            title: 'Aggressive',
                                            desc: 'High-intent leads',
                                            steps: [
                                                { day: 'Day 1', channel: 'WhatsApp', icon: '💬' },
                                                { day: 'Day 3', channel: 'AI Voice Call', icon: '📞' },
                                                { day: 'Day 5', channel: 'SMS Breakup', icon: '📱' },
                                            ]
                                        },
                                        {
                                            id: 'soft_touch',
                                            icon: '🕊️',
                                            title: 'Soft Touch',
                                            desc: 'Warm but cautious leads',
                                            steps: [
                                                { day: 'Day 1', channel: 'Email', icon: '✉️' },
                                                { day: 'Day 3', channel: 'WhatsApp', icon: '💬' },
                                                { day: 'Day 7', channel: 'Email', icon: '✉️' },
                                            ]
                                        },
                                        {
                                            id: 'text_only',
                                            icon: '💬',
                                            title: 'Text Only',
                                            desc: 'Low-friction approach',
                                            steps: [
                                                { day: 'Day 1', channel: 'WhatsApp', icon: '💬' },
                                                { day: 'Day 2', channel: 'WhatsApp', icon: '💬' },
                                                { day: 'Day 4', channel: 'SMS', icon: '📱' },
                                            ]
                                        },
                                    ].map(playbook => (
                                        <button
                                            key={playbook.id}
                                            onClick={() => setSelectedPlaybook(playbook.id)}
                                            className={`w-full p-4 rounded-xl border-2 text-left transition-all ${selectedPlaybook === playbook.id
                                                ? 'border-emerald-500 bg-emerald-50 shadow-sm'
                                                : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                                                }`}
                                        >
                                            <div className="flex items-center gap-3 mb-2">
                                                <span className="text-xl">{playbook.icon}</span>
                                                <div>
                                                    <p className="font-semibold text-sm text-slate-900">{playbook.title}</p>
                                                    <p className="text-xs text-slate-500">{playbook.desc}</p>
                                                </div>
                                            </div>
                                            {/* Sequence Timeline */}
                                            <div className="flex items-center gap-1 ml-8">
                                                {playbook.steps.map((s, i) => (
                                                    <React.Fragment key={i}>
                                                        <div className="flex flex-col items-center">
                                                            <span className="text-sm">{s.icon}</span>
                                                            <span className="text-[10px] text-slate-400 mt-0.5">{s.day}</span>
                                                        </div>
                                                        {i < playbook.steps.length - 1 && (
                                                            <div className="w-6 h-px bg-slate-300 mt-[-6px]" />
                                                        )}
                                                    </React.Fragment>
                                                ))}
                                            </div>
                                        </button>
                                    ))}
                                </div>

                                {/* Wallet + Cost Summary */}
                                {blastSegments && blastSegments[selectedSegment] && (
                                    <div className="mt-4 bg-slate-50 p-3 rounded-xl text-sm">
                                        <div className="flex justify-between mb-1">
                                            <span className="text-slate-500">Audience</span>
                                            <span className="font-medium">{blastSegments[selectedSegment].name} ({blastSegments[selectedSegment].count})</span>
                                        </div>
                                        <div className="flex justify-between mb-1">
                                            <span className="text-slate-500">Cost (first touch)</span>
                                            <span className="font-medium">{currency}{blastSegments[selectedSegment].count * COST_PER_MESSAGE}</span>
                                        </div>
                                        <div className="border-t pt-2 flex justify-between">
                                            <span className="text-slate-500">Wallet</span>
                                            <span className={`font-bold ${blastCredits >= blastSegments[selectedSegment].count * COST_PER_MESSAGE
                                                ? 'text-green-600'
                                                : 'text-red-600'
                                                }`}>
                                                {currency}{blastCredits.toFixed(0)}
                                            </span>
                                        </div>
                                    </div>
                                )}

                                {/* Navigation + Deploy */}
                                <div className="flex gap-2 mt-4">
                                    <button
                                        onClick={() => setDeployStep(2)}
                                        className="flex-1 py-3 border-2 border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition-colors"
                                    >
                                        ← Back
                                    </button>
                                    {blastSegments && blastSegments[selectedSegment] && blastCredits >= blastSegments[selectedSegment].count * COST_PER_MESSAGE ? (
                                        <button
                                            onClick={sendBlast}
                                            disabled={sendingBlast || !selectedPlaybook}
                                            className="flex-1 py-3 bg-emerald-600 text-white font-bold rounded-xl disabled:opacity-40 disabled:cursor-not-allowed hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2"
                                        >
                                            {sendingBlast ? (
                                                <span className="flex items-center gap-2">
                                                    <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                                                    Deploying...
                                                </span>
                                            ) : (
                                                <><Zap className="w-4 h-4" /> Deploy</>
                                            )}
                                        </button>
                                    ) : (
                                        <button
                                            onClick={() => { setShowBlastModal(false); setShowTopUpModal(true); }}
                                            className="flex-1 py-3 bg-amber-500 text-white font-bold rounded-xl hover:bg-amber-600 transition-colors"
                                        >
                                            💳 Top Up
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* === IMPORT TAB (accessible from Step 1) === */}
                        {blastTab === 'import' && (
                            <div>
                                <div className="bg-green-50 border border-green-200 rounded-xl p-3 mb-4">
                                    <p className="text-sm font-medium text-green-800 mb-1">📥 Database Reactivation</p>
                                    <p className="text-xs text-green-600">
                                        Paste your client&apos;s old customer list. We&apos;ll import them and you can deploy the AI to win them back.
                                    </p>
                                </div>

                                {/* Import Label */}
                                <div className="mb-3">
                                    <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">List Label (optional)</label>
                                    <input
                                        type="text"
                                        value={importLabel}
                                        onChange={(e) => setImportLabel(e.target.value)}
                                        placeholder="e.g. Old customers from Excel"
                                        className="w-full p-2.5 border border-slate-200 rounded-lg text-sm"
                                    />
                                </div>

                                {/* Phone List Input */}
                                <div className="mb-4">
                                    <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Phone Numbers</label>
                                    <textarea
                                        value={importText}
                                        onChange={(e) => setImportText(e.target.value)}
                                        placeholder={`Paste phone numbers, one per line:\n09171234567\n09181234567, Juan\n+639191234567 - Maria`}
                                        className="w-full p-3 border border-slate-200 rounded-lg text-sm font-mono resize-none"
                                        rows={6}
                                    />
                                    <p className="text-xs text-slate-400 mt-1">
                                        {importText.trim() ? `${importText.trim().split('\n').filter(l => l.trim()).length} lines detected` : 'Supports: 09xx, +63xx, +60xx formats'}
                                    </p>
                                </div>

                                {/* Import Result */}
                                {importResult && (
                                    <div className={`p-3 rounded-lg mb-4 text-sm ${importResult.error
                                        ? 'bg-red-50 border border-red-200 text-red-700'
                                        : 'bg-green-50 border border-green-200 text-green-700'
                                        }`}>
                                        {importResult.error ? (
                                            <p>❌ {importResult.error}</p>
                                        ) : (
                                            <div>
                                                <p className="font-medium mb-1">✅ Import Complete!</p>
                                                <p>📥 {importResult.imported} new contacts added</p>
                                                {importResult.duplicates > 0 && (
                                                    <p>⏭️ {importResult.duplicates} already existed</p>
                                                )}
                                                {importResult.invalid > 0 && (
                                                    <p>⚠️ {importResult.invalid} invalid numbers skipped</p>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Import / Back Buttons */}
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setBlastTab('blast')}
                                        className="flex-1 py-3 border-2 border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition-colors"
                                    >
                                        ← Back
                                    </button>
                                    <button
                                        onClick={importContacts}
                                        disabled={importing || !importText.trim()}
                                        className="flex-1 py-3 bg-green-600 text-white font-bold rounded-xl disabled:opacity-50 transition-all"
                                    >
                                        {importing ? (
                                            <span className="flex items-center justify-center gap-2">
                                                <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                                                Importing...
                                            </span>
                                        ) : (
                                            '📥 Import'
                                        )}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Settings Modal */}
            {showSettingsModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl max-w-sm w-full p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-bold text-lg">Settings</h3>
                            <button onClick={() => setShowSettingsModal(false)}>
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="space-y-4">

                            <a
                                href={`/preview/${business.id}`}
                                target="_blank"
                                className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100"
                            >
                                <span className="font-medium">View Landing Page</span>
                                <ChevronRight className="w-5 h-5 text-slate-400" />
                            </a>
                            <a
                                href={`/q/${business.id}`}
                                target="_blank"
                                className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100"
                            >
                                <span className="font-medium">View Quote Page</span>
                                <ChevronRight className="w-5 h-5 text-slate-400" />
                            </a>
                            <button
                                onClick={() => { setShowSettingsModal(false); setShowSlotSettingsModal(true); }}
                                className="w-full flex items-center justify-between p-3 bg-blue-50 rounded-lg hover:bg-blue-100 text-left"
                            >
                                <div className="flex items-center gap-2">
                                    <Clock className="w-4 h-4 text-blue-600" />
                                    <span className="font-medium text-blue-700">Arrival Windows</span>
                                </div>
                                <ChevronRight className="w-5 h-5 text-blue-400" />
                            </button>

                            {/* Logo Upload Section */}
                            <div className="border-t pt-4 mt-2">
                                <p className="text-xs font-bold text-slate-500 uppercase mb-3">Business Logo</p>
                                {currentLogoUrl ? (
                                    <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                                        <img
                                            src={currentLogoUrl}
                                            alt="Business logo"
                                            className="w-14 h-14 object-contain rounded-lg border border-slate-200 bg-white"
                                        />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-slate-700 truncate">Logo uploaded</p>
                                            <p className="text-xs text-green-600">✓ Will appear on stickers</p>
                                        </div>
                                        <div className="flex gap-1">
                                            <button
                                                onClick={() => logoFileRef.current?.click()}
                                                className="p-2 bg-white rounded-lg border border-slate-200 hover:bg-slate-100 transition-colors"
                                                title="Replace logo"
                                            >
                                                <Upload className="w-4 h-4 text-slate-500" />
                                            </button>
                                            <button
                                                onClick={handleRemoveLogo}
                                                className="p-2 bg-white rounded-lg border border-red-200 hover:bg-red-50 transition-colors"
                                                title="Remove logo"
                                            >
                                                <Trash2 className="w-4 h-4 text-red-500" />
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => logoFileRef.current?.click()}
                                        disabled={uploadingLogo}
                                        className="w-full flex items-center justify-center gap-2 p-4 border-2 border-dashed border-slate-300 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-colors disabled:opacity-50"
                                    >
                                        {uploadingLogo ? (
                                            <>
                                                <div className="animate-spin w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                                                <span className="text-sm text-slate-500">Uploading...</span>
                                            </>
                                        ) : (
                                            <>
                                                <ImageIcon className="w-5 h-5 text-slate-400" />
                                                <span className="text-sm font-medium text-slate-600">Upload Logo</span>
                                            </>
                                        )}
                                    </button>
                                )}
                                <input
                                    ref={logoFileRef}
                                    type="file"
                                    accept="image/*"
                                    onChange={handleLogoUpload}
                                    className="hidden"
                                />
                                <p className="text-xs text-slate-400 mt-2">PNG or JPG, max 5MB. Appears on warranty stickers.</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Arrival Windows Settings Modal - "Blue Collar Scheduling" */}
            {showSlotSettingsModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl max-w-sm w-full p-6 max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-bold text-lg">🕐 Arrival Windows</h3>
                            <button onClick={() => setShowSlotSettingsModal(false)}>
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <p className="text-sm text-slate-500 mb-4">
                            Set wide arrival windows that work with traffic & job overruns
                        </p>

                        {/* Arrival Windows */}
                        <div className="space-y-3 mb-6">
                            {slotSettings.map((slot, idx) => (
                                <div key={slot.id} className="bg-slate-50 rounded-xl p-4">
                                    <div className="flex items-center justify-between mb-3">
                                        <span className="font-medium text-slate-700">
                                            {slot.id === 'morning' ? '🌅 Morning' : '☀️ Afternoon'}
                                        </span>
                                        <button
                                            onClick={() => {
                                                const newSlots = [...slotSettings];
                                                newSlots[idx].enabled = !newSlots[idx].enabled;
                                                setSlotSettings(newSlots);
                                            }}
                                            className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${slot.enabled !== false
                                                ? 'bg-green-100 text-green-700'
                                                : 'bg-slate-200 text-slate-500'
                                                }`}
                                        >
                                            {slot.enabled !== false ? '✓ Active' : 'Off'}
                                        </button>
                                    </div>
                                    <div className="text-sm text-slate-600 mb-2">
                                        {slot.label}
                                    </div>
                                    <div className="flex gap-2 items-center">
                                        <input
                                            type="time"
                                            value={slot.start}
                                            onChange={(e) => {
                                                const newSlots = [...slotSettings];
                                                newSlots[idx].start = e.target.value;
                                                setSlotSettings(newSlots);
                                            }}
                                            className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm"
                                        />
                                        <span className="text-slate-400">to</span>
                                        <input
                                            type="time"
                                            value={slot.end}
                                            onChange={(e) => {
                                                const newSlots = [...slotSettings];
                                                newSlots[idx].end = e.target.value;
                                                newSlots[idx].label = `${formatTime(e.target.value)} window`;
                                                setSlotSettings(newSlots);
                                            }}
                                            className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm"
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Max Bookings Per Window */}
                        <div className="bg-blue-50 rounded-xl p-4 mb-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <span className="font-medium text-slate-700">Max per window</span>
                                    <p className="text-xs text-slate-500">Limit bookings per arrival window</p>
                                </div>
                                <select
                                    value={maxPerWindow}
                                    onChange={(e) => setMaxPerWindow(parseInt(e.target.value))}
                                    className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold"
                                >
                                    <option value={1}>1 job</option>
                                    <option value={2}>2 jobs</option>
                                    <option value={3}>3 jobs</option>
                                    <option value={4}>4 jobs</option>
                                    <option value={5}>5 jobs</option>
                                </select>
                            </div>
                        </div>

                        {/* WhatsApp Commands Help */}
                        <div className="bg-green-50 rounded-xl p-4 mb-6">
                            <div className="font-medium text-green-800 mb-2">📱 WhatsApp Commands</div>
                            <p className="text-xs text-green-700 mb-2">
                                Send these to your Launchfly number:
                            </p>
                            <div className="text-xs text-green-600 space-y-1 font-mono">
                                <div>• &quot;Block Tomorrow&quot;</div>
                                <div>• &quot;Block Tuesday Morning&quot;</div>
                                <div>• &quot;Unblock Wednesday&quot;</div>
                                <div>• &quot;Status&quot; - see today&apos;s bookings</div>
                            </div>
                        </div>

                        <button
                            onClick={async () => {
                                setSavingSlots(true);
                                try {
                                    const { error } = await supabase
                                        .from('businesses')
                                        .update({
                                            slot_settings: {
                                                slots: slotSettings,
                                                days_ahead: 4,
                                                morning_buffer: 2,
                                                afternoon_buffer: 2,
                                                max_per_window: maxPerWindow
                                            }
                                        })
                                        .eq('id', business.id);

                                    if (error) throw error;
                                    alert('✅ Arrival windows saved!');
                                    setShowSlotSettingsModal(false);
                                } catch (e) {
                                    alert('Failed to save settings');
                                }
                                setSavingSlots(false);
                            }}
                            disabled={savingSlots}
                            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl disabled:opacity-50"
                        >
                            {savingSlots ? 'Saving...' : 'Save Settings'}
                        </button>
                    </div>
                </div>
            )}

            {/* Schedule Modal - "Pick, Click & Send" */}
            {showScheduleModal && selectedLead && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end justify-center">
                    <div className="bg-white rounded-t-3xl w-full max-w-md p-6 animate-slide-up">
                        <div className="w-12 h-1 bg-slate-300 rounded-full mx-auto mb-4"></div>

                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h3 className="font-bold text-lg">Schedule Job</h3>
                                <p className="text-sm text-slate-500">{selectedLead.name || 'Customer'}</p>
                            </div>
                            <button
                                onClick={() => { setShowScheduleModal(false); setSelectedLead(null); }}
                                className="p-2 hover:bg-slate-100 rounded-lg"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Date Selection */}
                        <div className="mb-6">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">
                                When is the job?
                            </label>
                            <div className="grid grid-cols-3 gap-2">
                                <button
                                    onClick={() => setScheduleDate('today')}
                                    className={`py-3 rounded-xl font-semibold text-sm transition-colors ${scheduleDate === 'today'
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                        }`}
                                >
                                    Today
                                </button>
                                <button
                                    onClick={() => setScheduleDate('tomorrow')}
                                    className={`py-3 rounded-xl font-semibold text-sm transition-colors ${scheduleDate === 'tomorrow'
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                        }`}
                                >
                                    Tomorrow
                                </button>
                                <input
                                    type="date"
                                    onChange={(e) => setScheduleDate(e.target.value)}
                                    className={`py-3 px-2 rounded-xl font-semibold text-sm text-center transition-colors ${scheduleDate !== 'today' && scheduleDate !== 'tomorrow'
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                        }`}
                                    min={new Date().toISOString().split('T')[0]}
                                />
                            </div>
                        </div>

                        {/* Time Selection */}
                        <div className="mb-6">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">
                                What time?
                            </label>
                            <div className="grid grid-cols-3 gap-2">
                                <button
                                    onClick={() => setScheduleTime('morning')}
                                    className={`py-3 rounded-xl font-semibold text-sm transition-colors ${scheduleTime === 'morning'
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                        }`}
                                >
                                    🌅 Morning
                                </button>
                                <button
                                    onClick={() => setScheduleTime('afternoon')}
                                    className={`py-3 rounded-xl font-semibold text-sm transition-colors ${scheduleTime === 'afternoon'
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                        }`}
                                >
                                    ☀️ Afternoon
                                </button>
                                <button
                                    onClick={() => setScheduleTime('evening')}
                                    className={`py-3 rounded-xl font-semibold text-sm transition-colors ${scheduleTime === 'evening'
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                        }`}
                                >
                                    🌙 Evening
                                </button>
                            </div>
                        </div>

                        {/* Preview */}
                        <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6">
                            <p className="text-xs text-green-600 font-bold mb-1">Message Preview:</p>
                            <p className="text-sm text-green-800">
                                &quot;Hi {selectedLead.name || 'there'}! ✅ I&apos;ve confirmed your schedule for <strong>{formatScheduleDate()} at {formatScheduleTime()}</strong>. I&apos;ll see you then! Please reply YES to confirm.&quot;
                            </p>
                        </div>

                        {/* Confirm Button */}
                        <button
                            onClick={handleScheduleConfirm}
                            className="w-full py-4 bg-green-500 hover:bg-green-600 text-white font-bold rounded-xl text-base flex items-center justify-center gap-2 transition-colors"
                        >
                            <MessageCircle className="w-5 h-5" />
                            Confirm & Send WhatsApp
                        </button>
                    </div>
                </div>
            )}

            {/* Top-Up Modal */}
            {showTopUpModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl max-w-sm w-full p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-bold text-lg">💳 Top Up Wallet</h3>
                            <button onClick={() => setShowTopUpModal(false)}>
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Current Balance */}
                        <div className="bg-slate-100 p-3 rounded-lg mb-4 text-center">
                            <p className="text-xs text-slate-500">Current Balance</p>
                            <p className="text-2xl font-bold text-slate-800">{currency}{blastCredits.toFixed(0)}</p>
                        </div>

                        {/* Top-Up Options */}
                        <p className="text-sm font-medium text-slate-700 mb-3">Select amount:</p>
                        <div className="grid grid-cols-3 gap-2 mb-4">
                            <button
                                onClick={() => window.open(`https://wa.me/639627459049?text=Hi! I want to top up ₱500 for blast credits. Business: ${businessName}`, '_blank')}
                                className="py-3 px-2 bg-slate-50 hover:bg-blue-50 border-2 border-slate-200 hover:border-blue-400 rounded-xl text-center transition-colors"
                            >
                                <p className="font-bold text-lg">₱500</p>
                                <p className="text-xs text-slate-500">100 blasts</p>
                            </button>
                            <button
                                onClick={() => window.open(`https://wa.me/639627459049?text=Hi! I want to top up ₱1,000 for blast credits. Business: ${businessName}`, '_blank')}
                                className="py-3 px-2 bg-blue-50 border-2 border-blue-400 rounded-xl text-center relative"
                            >
                                <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full">Popular</span>
                                <p className="font-bold text-lg text-blue-600">₱1,000</p>
                                <p className="text-xs text-slate-500">200 blasts</p>
                            </button>
                            <button
                                onClick={() => window.open(`https://wa.me/639627459049?text=Hi! I want to top up ₱2,500 for blast credits. Business: ${businessName}`, '_blank')}
                                className="py-3 px-2 bg-slate-50 hover:bg-blue-50 border-2 border-slate-200 hover:border-blue-400 rounded-xl text-center transition-colors"
                            >
                                <p className="font-bold text-lg">₱2,500</p>
                                <p className="text-xs text-slate-500">500 blasts</p>
                            </button>
                        </div>

                        {/* Instructions */}
                        <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-lg text-sm">
                            <p className="font-medium text-yellow-800 mb-1">📱 How to Top Up:</p>
                            <ol className="text-yellow-700 text-xs space-y-1 list-decimal list-inside">
                                <li>Click amount above to message us</li>
                                <li>GCash payment details will be sent</li>
                                <li>Credits added within 5 minutes</li>
                            </ol>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
