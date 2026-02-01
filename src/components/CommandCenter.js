// src/components/CommandCenter.js
// Mobile-first Command Center Dashboard - "The WhatsApp OS for Service Pros"
'use client';

import React, { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import {
    Settings, Snowflake, Wrench, MessageCircle, CheckCircle,
    Calendar, Megaphone, QrCode, Bot, Phone, Clock, X,
    Zap, TrendingUp, Users, ChevronRight, Download
} from 'lucide-react';
import QRCodeLib from 'qrcode';

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

    // Download QR - Maintenance Record Sticker Design
    // CONCEPT: "The Silver Badge" (Premium & Trustworthy)
    const downloadQR = async () => {
        // Launchfly Bot WhatsApp number - the central AI receptionist
        const launchflyBotNumber = '13203627874';
        
        // Include business ID in trigger message so bot knows which business context to use
        const businessId = business?.id;
        const stickerTrigger = businessId 
            ? `Hi, I scanned the Service Sticker [BIZ:${businessId}]`
            : "Hi, I scanned the Service Sticker";
        
        // Primary: Launchfly bot with business context
        const qrUrl = `https://wa.me/${launchflyBotNumber}?text=${encodeURIComponent(stickerTrigger)}`;

        const canvas = document.createElement('canvas');
        // Landscape orientation 2.5:1 ratio (Premium Sticker size)
        const width = 1800;
        const height = 700;
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
        const nameY = 130;
        const words = bizName.split(' ');
        let line = '';
        let lines = [];
        for(let n = 0; n < words.length; n++) {
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
        let currentNameY = lines.length > 1 ? nameY - (lines.length * nameFontSize/2) : nameY;
        lines.forEach((l) => {
           ctx.fillText(l.trim(), leftCenterX, currentNameY); 
           currentNameY += (nameFontSize * 1.2);
        });

        // B. Shield Icon (Center) - Professional SVG Path
        const shieldSize = 280;
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
        ctx.lineWidth = 1.8; // Slightly thicker for print clarity
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
        const phoneY = height - 50;
        const safePhone = business?.phone || '+1 555-0123';
        
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
        ctx.translate(startX, phoneY - 55 - iconSizeSmall + 4); 
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
        const qrSize = 420; // Reduced from 480 to give text more room
        
        ctx.textAlign = 'left';
        
        // D. Top Label "SERVICE & WARRANTY RECORD"
        // [PRINT FIX] Use Navy instead of Grey for high contrast on Silver Foil
        ctx.fillStyle = navyBlue; 
        ctx.textBaseline = 'top';
        ctx.font = '700 38px "Inter", "Arial", sans-serif'; // Slightly smaller to ensure fit
        ctx.fillText('SERVICE & WARRANTY RECORD', contentX, 95); // Shifted down for centering

        // E. Main Headline "SCAN TO ACTIVATE WARRANTY"
        // Stacked
        const mainY = 175; // Shifted down +40px
        ctx.fillStyle = textBlack;
        ctx.font = '900 95px "Inter", "Arial Black", sans-serif';
        const lineHeight = 100;
        
        ctx.fillText('SCAN TO', contentX, mainY);
        ctx.fillText('ACTIVATE', contentX, mainY + lineHeight);
        ctx.fillText('WARRANTY', contentX, mainY + (lineHeight * 2));

        // F. Subtext "& Get Next Service Reminder"
        const subY = mainY + (lineHeight * 3) + 25;
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
                errorCorrectionLevel: 'H',
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

                {/* Blast Promo Card - Smart Segments */}
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-5 rounded-xl shadow-lg text-white mb-4 relative overflow-hidden">
                    <div className="absolute -right-4 -top-4 bg-white/10 w-24 h-24 rounded-full blur-2xl"></div>

                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-white/20 rounded-lg backdrop-blur">
                            <Megaphone className="w-5 h-5 text-white" />
                        </div>
                        <h3 className="font-bold">Smart Blast</h3>
                    </div>
                    <p className="text-sm text-blue-100 mb-4">
                        Target specific leads with personalized messages
                    </p>
                    <button
                        onClick={() => { setShowBlastModal(true); fetchBlastSegments(); }}
                        className="w-full py-2 bg-white text-blue-700 font-bold rounded-lg text-sm hover:bg-blue-50 transition-colors"
                    >
                        Choose Audience & Message
                    </button>
                </div>

                {/* QR Download */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-slate-100 rounded-lg">
                            <QrCode className="w-5 h-5 text-slate-700" />
                        </div>
                        <div>
                            <h3 className="font-bold text-sm text-slate-900">Van Sticker QR</h3>
                            <p className="text-xs text-slate-500">Get more offline leads</p>
                        </div>
                    </div>
                    <button
                        onClick={downloadQR}
                        className="px-3 py-1.5 bg-slate-900 text-white text-xs font-bold rounded-lg hover:bg-slate-800 transition-colors"
                    >
                        Download
                    </button>
                </div>

                {/* Block Today - Emergency Brake */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-red-100 rounded-lg">
                            <Calendar className="w-5 h-5 text-red-600" />
                        </div>
                        <div>
                            <h3 className="font-bold text-sm text-slate-900">Block Today</h3>
                            <p className="text-xs text-slate-500">Mark as fully booked</p>
                        </div>
                    </div>
                    <button
                        onClick={async () => {
                            if (!confirm('Block all remaining slots for today?')) return;
                            try {
                                const res = await fetch('/api/slots/available', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                        businessId: business.id,
                                        action: 'block_day',
                                        notes: 'Blocked via Command Center'
                                    })
                                });
                                if (res.ok) {
                                    alert('✅ Today marked as fully booked!');
                                } else {
                                    alert('Failed to block day');
                                }
                            } catch (e) {
                                alert('Error blocking day');
                            }
                        }}
                        className="px-3 py-1.5 bg-red-500 text-white text-xs font-bold rounded-lg hover:bg-red-600 transition-colors"
                    >
                        Block
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

            {/* Blast Modal - Enhanced with Segments */}
            {showBlastModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl max-w-sm w-full p-5 max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-bold text-lg">📣 Smart Blast</h3>
                            <button onClick={() => setShowBlastModal(false)}>
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Wallet Balance */}
                        <div className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white p-3 rounded-xl mb-4">
                            <div className="flex justify-between items-center">
                                <div>
                                    <p className="text-xs text-blue-100">Wallet</p>
                                    <p className="text-xl font-bold">{currency}{blastCredits.toFixed(0)}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs text-blue-100">Per message</p>
                                    <p className="text-lg font-semibold">{currency}{COST_PER_MESSAGE}</p>
                                </div>
                            </div>
                        </div>

                        {loadingSegments ? (
                            <div className="text-center py-8">
                                <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-2"></div>
                                <p className="text-sm text-slate-500">Loading segments...</p>
                            </div>
                        ) : blastSegments ? (
                            <>
                                {/* Segment Selection */}
                                <div className="mb-4">
                                    <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Target Audience</label>
                                    <div className="space-y-2">
                                        {Object.entries(blastSegments).map(([key, seg]) => (
                                            <button
                                                key={key}
                                                onClick={() => setSelectedSegment(key)}
                                                className={`w-full p-3 rounded-lg border text-left transition-all ${
                                                    selectedSegment === key 
                                                        ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200' 
                                                        : 'border-slate-200 hover:border-slate-300'
                                                }`}
                                            >
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-lg">{seg.icon}</span>
                                                        <div>
                                                            <p className="font-medium text-sm">{seg.name}</p>
                                                            <p className="text-xs text-slate-500">{seg.description}</p>
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <span className={`text-lg font-bold ${seg.count > 0 ? 'text-blue-600' : 'text-slate-400'}`}>
                                                            {seg.count}
                                                        </span>
                                                        {seg.recommended && (
                                                            <span className="block text-[10px] text-green-600 font-medium">⭐ Best</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Message Template */}
                                <div className="mb-4">
                                    <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Message</label>
                                    <div className="flex flex-wrap gap-2 mb-2">
                                        {blastTemplates.map(t => (
                                            <button
                                                key={t.id}
                                                onClick={() => {
                                                    setSelectedTemplate(t.id);
                                                    setCustomMessage('');
                                                }}
                                                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                                                    selectedTemplate === t.id && !customMessage
                                                        ? 'bg-blue-600 text-white'
                                                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                                }`}
                                            >
                                                {t.icon} {t.name}
                                            </button>
                                        ))}
                                    </div>
                                    <textarea
                                        value={customMessage}
                                        onChange={(e) => setCustomMessage(e.target.value)}
                                        placeholder="Or write custom message..."
                                        className="w-full p-3 border border-slate-200 rounded-lg text-sm resize-none"
                                        rows={2}
                                    />
                                </div>

                                {/* Cost Summary */}
                                {blastSegments[selectedSegment] && (
                                    <div className="bg-slate-50 p-3 rounded-lg text-sm mb-4">
                                        <div className="flex justify-between mb-1">
                                            <span className="text-slate-500">Recipients</span>
                                            <span className="font-medium">{blastSegments[selectedSegment].count} leads</span>
                                        </div>
                                        <div className="flex justify-between mb-1">
                                            <span className="text-slate-500">Cost</span>
                                            <span className="font-medium">{currency}{blastSegments[selectedSegment].count * COST_PER_MESSAGE}</span>
                                        </div>
                                        <div className="border-t pt-2 flex justify-between">
                                            <span className="text-slate-500">Remaining</span>
                                            <span className={`font-bold ${
                                                blastCredits >= blastSegments[selectedSegment].count * COST_PER_MESSAGE 
                                                    ? 'text-green-600' 
                                                    : 'text-red-600'
                                            }`}>
                                                {currency}{(blastCredits - blastSegments[selectedSegment].count * COST_PER_MESSAGE).toFixed(0)}
                                            </span>
                                        </div>
                                    </div>
                                )}

                                {/* Send Button */}
                                {blastSegments[selectedSegment]?.count > 0 ? (
                                    blastCredits >= blastSegments[selectedSegment].count * COST_PER_MESSAGE ? (
                                        <button
                                            onClick={sendBlast}
                                            disabled={sendingBlast}
                                            className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl disabled:opacity-50"
                                        >
                                            {sendingBlast ? 'Sending...' : `Send to ${blastSegments[selectedSegment].count} Leads`}
                                        </button>
                                    ) : (
                                        <div className="space-y-2">
                                            <button disabled className="w-full py-3 bg-gray-300 text-gray-500 font-bold rounded-xl cursor-not-allowed">
                                                Insufficient Credits
                                            </button>
                                            <button
                                                onClick={() => { setShowBlastModal(false); setShowTopUpModal(true); }}
                                                className="w-full py-3 bg-green-600 text-white font-bold rounded-xl"
                                            >
                                                💳 Top Up Wallet
                                            </button>
                                        </div>
                                    )
                                ) : (
                                    <div className="text-center py-3 text-slate-500 text-sm">
                                        No leads in this segment
                                    </div>
                                )}
                            </>
                        ) : (
                            /* Fallback to old UI if segments fail to load */
                            <>
                                <p className="text-sm text-slate-600 mb-3">
                                    Send WhatsApp promo to <strong>{oldLeadsCount} leads</strong> who haven&apos;t booked in 3+ days.
                                </p>
                                <div className="bg-green-50 border border-green-100 p-3 rounded-lg text-sm mb-4">
                                    <p className="text-xs text-green-600 font-medium mb-1">📱 Message Preview</p>
                                    🔥 {niche} Promo! 10% OFF this week only. Reply &quot;BOOK&quot; to claim your slot! - {businessName}
                                </div>
                                <button
                                    onClick={sendBlast}
                                    disabled={sendingBlast || oldLeadsCount === 0}
                                    className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl disabled:opacity-50"
                                >
                                    {sendingBlast ? 'Sending...' : `Send Blast (${currency}${oldLeadsCount * COST_PER_MESSAGE} cost)`}
                                </button>
                            </>
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
