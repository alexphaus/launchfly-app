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
        // Landscape orientation
        // Reduced left side width (1800 -> 1680) to shrink the branding area
        const width = 1680;
        // Increased height by 5% (525 -> ~550)
        const height = 600;
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

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

        // Base White
        ctx.fillStyle = brandWhite;
        ctx.fillRect(0, 0, width, height);
        
        // Subtle "Tech/Ice" Gradient for premium feel (Very light blue-grey to white)
        const bgGrad = ctx.createLinearGradient(0, 0, width, height);
        bgGrad.addColorStop(0, '#F1F5F9'); // Slate 100
        bgGrad.addColorStop(0.5, '#FFFFFF');
        bgGrad.addColorStop(1, '#F8FAFC'); // Slate 50
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, width, height);
        
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

        // B. Dynamic Logo Section
        const logoAreaSize = 260; // Slightly larger
        const logoAreaY = height / 2 - 50;
        
        const imagesQR1 = businessData.images || businessData.prospectImages || [];
        const logoImgQR1 = imagesQR1.find(img => img.type === 'logo');
        const logoUrlQR1 = logoImgQR1?.url || null;

        let brandingBottomY = logoAreaY + logoAreaSize/2;

        if (logoUrlQR1) {
            try {
                const logoEl = new Image();
                logoEl.crossOrigin = 'anonymous';
                logoEl.src = logoUrlQR1;
                await new Promise((resolve, reject) => {
                    logoEl.onload = resolve;
                    logoEl.onerror = reject;
                    setTimeout(reject, 3000);
                });

                const aspect = logoEl.width / logoEl.height;
                let drawW, drawH;
                if (aspect >= 1) {
                    drawW = logoAreaSize;
                    drawH = drawW / aspect;
                } else {
                    drawH = logoAreaSize;
                    drawW = drawH * aspect;
                }
                const logoDrawX = leftCenterX - drawW / 2;
                const logoDrawY = logoAreaY - drawH / 2;
                
                // Enhanced Logo Shadow
                ctx.save();
                ctx.shadowColor = "rgba(0, 0, 0, 0.12)";
                ctx.shadowBlur = 20;
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 8;
                ctx.drawImage(logoEl, logoDrawX, logoDrawY, drawW, drawH);
                ctx.restore();

            } catch (e) {
                console.warn('Logo failed to load:', e);
            }
        } else {
             // Fallback Shield
            const shieldSize = 200;
            const shieldY = logoAreaY;
            ctx.save();
            ctx.translate(leftCenterX, shieldY); 
            ctx.scale(shieldSize / 24, shieldSize / 24);
            ctx.translate(-12, -13.5); 
            ctx.lineWidth = 2.0;
            ctx.strokeStyle = navyBlue;
            const shieldPath = new Path2D("M12 2L3 7v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5z");
            ctx.stroke(shieldPath);
            ctx.restore();
        }

        // C. Business Name
        const bizName = (business?.name || 'COOLTECH SERVICES').toUpperCase();
        let nameFontSize = 52;
        if (bizName.length > 15) nameFontSize = 44;
        if (bizName.length > 25) nameFontSize = 34;
        ctx.font = `900 ${nameFontSize}px "Inter", "Arial Black", sans-serif`;
        ctx.fillStyle = textBlack;
        
        // Positioning below logo
        const textY = brandingBottomY + 50; 
        
        const words = bizName.split(' ');
        let lines = [];
        if (words.length > 2 && bizName.length > 15) {
             const mid = Math.ceil(words.length / 2);
             lines.push(words.slice(0, mid).join(' '));
             lines.push(words.slice(mid).join(' '));
        } else {
            lines.push(bizName);
        }

        let currentNameY = lines.length > 1 ? textY : textY;
        
        // Check bounds to ensure name doesn't overlap phone
        if (currentNameY + (lines.length * nameFontSize) > height - 100) {
            nameFontSize = nameFontSize * 0.85;
            ctx.font = `900 ${nameFontSize}px "Inter", "Arial Black", sans-serif`;
        }
        
        lines.forEach((l) => {
           ctx.fillText(l.trim(), leftCenterX, currentNameY); 
           currentNameY += (nameFontSize * 1.15);
        });

        // D. Phone (Big & Bold)
        // Adjusted Y for new height
        const phoneY = height - 40;
        const safePhone = business?.whatsapp_number || business?.phone_number || businessData?.phone || '+13203627874';
        const displayPhone = safePhone.startsWith('+') ? safePhone : `+${safePhone}`;
        
        ctx.fillStyle = textBlack;
        ctx.font = '800 46px "Inter", "Arial", sans-serif';
        ctx.fillText(displayPhone, leftCenterX, phoneY);


        // --- RIGHT SIDE CONTENT (Action Widget) ---
        const rightPad = 70; 
        const contentX = splitX + rightPad;
        const qrSize = 340; // Reduced for new height
        // Available width for text content before hitting QR
        const availableTextW = (width - qrSize - 60) - contentX - 20;

        // E. "OFFICIAL SERVICE PARTNER"
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillStyle = '#334155'; // Slate 700
        ctx.font = '800 32px "Inter", "Arial", sans-serif'; 
        ctx.fillText('OFFICIAL SERVICE PARTNER', contentX, 30); // Compact top

        // F. RED HEADER BLOCK: "NEXT SERVICE DUE"
        // Tighter vertical spacing
        const widgetY = 75; 
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
        ctx.fillText('NEXT SERVICE DUE', contentX + widgetW/2, widgetY + headerH/2 + 2);
        ctx.shadowColor = "transparent"; // Reset

        // 3. Calendar Icon (Inside the White Body on Left)
        const bodyCenterY = widgetY + headerH + (widgetH - headerH)/2;
        
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
        const dateAreaStart = contentX + 110;
        const dateAreaW = widgetW - 110;
        const dateCenter = dateAreaStart + dateAreaW/2;
        
        ctx.fillStyle = '#94A3B8'; // Slate 400
        ctx.fillText('/         /', dateCenter, bodyCenterY);


        // G. "DATE CLEANED:" Link (Below Widget)
        const dateCleanedY = widgetY + widgetH + 32;
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

        // H. CTA TEXT (Bottom Left) - Replaces Button Pill
        // "Scan to activate" (Navy Blue)
        // "FREE 30-day warranty >" (Red, Bold)
        
        const ctaY = height - 35; // Tighter bottom margin
        
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        
        // Line 1: "Scan to activate"
        const ctaLine1Y = ctaY - 45;
        ctx.fillStyle = '#0f172a'; // Slate 900 / Navy
        ctx.font = '800 38px "Inter", "Arial", sans-serif';
        ctx.fillText('Scan to activate', contentX, ctaLine1Y);
        
        // Line 2: "FREE 30-day warranty >"
        ctx.fillStyle = '#DC2626'; // Red 600
        ctx.font = '900 46px "Inter", "Arial Black", sans-serif';
        // Add arrow symbol instead of just text >
        ctx.fillText('FREE 30-day warranty ►', contentX, ctaY + 8);


        // --- QR CODE AREA ---
        // Adjusted for new compact height
        const qrSizeAdjusted = 340; 
        const qrX = width - qrSizeAdjusted - 60; 
        const qrY = (height - qrSizeAdjusted) / 2 - 10; 

        try {
            const qrDataUrl = await QRCodeLib.toDataURL(qrUrl, {
                width: qrSizeAdjusted,
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
            ctx.fillText('SCAN TO BOOK', qrX + qrSizeAdjusted/2, qrY + qrSizeAdjusted + 20);

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

    // Download QR - "Factory Service Record" Sticker Design
    // CONCEPT: "The Silver Edition" — Looks like an OEM factory sticker (Samsung/Daikin style)
    // Psychology: Customers never peel off "official" stickers. Technicians look like authorized service centers.
    const downloadQR2 = async () => {
        // Launchfly Bot WhatsApp number - the central AI receptionist
        const launchflyBotNumber = '13203627874';
        
        // Include business ref in trigger message so bot knows which business context to use
        const businessRef = business?.subdomain || business?.id;
        const stickerTrigger = `Hi! I want to activate my Service Warranty. 🛡️\n\n(Ref: ${businessRef || 'UNKNOWN'})`;
        
        const qrUrl = `https://wa.me/${launchflyBotNumber}?text=${encodeURIComponent(stickerTrigger)}`;

        const canvas = document.createElement('canvas');
        // Landscape orientation — sized like a premium service label
        const width = 1800;
        const height = 700;
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        // --- COLORS (Industrial / OEM Factory Palette) ---
        const navyDark = '#0D1B2A';     // Deep authoritative navy
        const navyMid = '#1B2A4A';      // Mid navy for accents
        const silverLight = '#F0F0F0';  // Clean matte silver
        const silverMid = '#D8D8D8';    // Silver border tones
        const silverDark = '#B0B0B0';   // Darker silver for subtle elements
        const textBlack = '#111111';
        const textDarkGrey = '#3A3A3A';
        const warningRed = '#CC2222';   // Authority red for "DO NOT REMOVE"
        const successGreen = '#1A8A3F'; // Checkmark green (muted, professional)
        const brandWhite = '#FFFFFF';

        // ============================================
        // 1. CLIP ROUNDED CORNERS (Subtle, like OEM labels)
        // ============================================
        const radius = 24;
        ctx.beginPath();
        ctx.roundRect(0, 0, width, height, radius);
        ctx.clip();

        // ============================================
        // 2. FULL SILVER/WHITE BACKGROUND (Industrial look)
        // ============================================
        // Subtle diagonal metallic gradient — mimics brushed aluminum
        const bgGrad = ctx.createLinearGradient(0, 0, width, height);
        bgGrad.addColorStop(0, '#E8E8E8');
        bgGrad.addColorStop(0.3, '#F4F4F4');
        bgGrad.addColorStop(0.5, '#FAFAFA');  // Highlight band
        bgGrad.addColorStop(0.7, '#F2F2F2');
        bgGrad.addColorStop(1, '#E6E6E6');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, width, height);

        // Subtle border (like factory sticker edge)
        ctx.strokeStyle = silverDark;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.roundRect(2, 2, width - 4, height - 4, radius - 1);
        ctx.stroke();

        // ============================================
        // 3. TOP BAR — "OFFICIAL SERVICE RECORD" (Authority strip)
        // ============================================
        const topBarH = 62;
        ctx.fillStyle = navyDark;
        ctx.fillRect(0, 0, width, topBarH);

        // Left: "OFFICIAL SERVICE RECORD"
        ctx.fillStyle = brandWhite;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.font = '700 28px "Inter", "Helvetica Neue", "Arial", sans-serif';
        ctx.letterSpacing = '3px';
        ctx.fillText('OFFICIAL SERVICE RECORD', 40, topBarH / 2);

        // Right: Serial/Reference badge
        ctx.textAlign = 'right';
        ctx.font = '500 22px "Inter", "Courier New", monospace';
        ctx.fillStyle = '#8899BB';
        const refCode = (businessRef || 'REF').toString().substring(0, 12).toUpperCase();
        ctx.fillText(`REF: ${refCode}`, width - 40, topBarH / 2);

        // ============================================
        // 4. BOTTOM BAR — "WARRANTY SEAL · DO NOT REMOVE"
        // ============================================
        const bottomBarH = 52;
        const bottomBarY = height - bottomBarH;
        ctx.fillStyle = navyDark;
        ctx.fillRect(0, bottomBarY, width, bottomBarH);

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '700 24px "Inter", "Arial", sans-serif';
        ctx.fillStyle = warningRed;
        ctx.fillText('⚠  WARRANTY SEAL — DO NOT REMOVE  ⚠', width / 2, bottomBarY + bottomBarH / 2);

        // ============================================
        // 5. LEFT SECTION — Business Identity (Authorized Partner)
        // ============================================
        const contentTop = topBarH + 30;
        const contentBottom = bottomBarY - 20;
        const leftWidth = 520;
        const leftCenterX = leftWidth / 2;

        // "AUTHORIZED SERVICE PARTNER" label
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillStyle = navyMid;
        ctx.font = '800 24px "Inter", "Arial", sans-serif';
        ctx.fillText('AUTHORIZED SERVICE PARTNER', leftCenterX, contentTop);

        // Thin rule line
        ctx.strokeStyle = silverDark;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(40, contentTop + 38);
        ctx.lineTo(leftWidth - 40, contentTop + 38);
        ctx.stroke();

        // Business Name (dynamic sizing)
        const bizName = (business?.name || 'COOLTECH SERVICES').toUpperCase();
        let nameFontSize = 48;
        if (bizName.length > 14) nameFontSize = 40;
        if (bizName.length > 22) nameFontSize = 32;
        if (bizName.length > 30) nameFontSize = 26;
        ctx.fillStyle = textBlack;
        ctx.font = `900 ${nameFontSize}px "Inter", "Arial Black", sans-serif`;

        // Wrap text: max 2 lines
        const nameStartY = contentTop + 55;
        const words = bizName.split(' ');
        let line = '';
        let nameLines = [];
        for (let n = 0; n < words.length; n++) {
            const testLine = line + words[n] + ' ';
            if (ctx.measureText(testLine).width > leftWidth - 60 && n > 0) {
                nameLines.push(line.trim());
                line = words[n] + ' ';
            } else {
                line = testLine;
            }
        }
        nameLines.push(line.trim());

        let nameDrawY = nameStartY;
        nameLines.slice(0, 2).forEach((l) => {
            ctx.fillText(l, leftCenterX, nameDrawY);
            nameDrawY += nameFontSize * 1.25;
        });

        // ── Shield + "WARRANTY ACTIVE" Badge ──
        const badgeY = nameDrawY + 20;
        const badgeCenterY = badgeY + 55;

        // Shield icon (smaller, inline with text)
        const shieldScale = 4.5;
        ctx.save();
        ctx.translate(leftCenterX - 130, badgeCenterY);
        ctx.scale(shieldScale, shieldScale);
        ctx.translate(-12, -12);
        // Filled shield
        ctx.fillStyle = successGreen;
        const shieldPath = new Path2D("M12 2L3 7v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5z");
        ctx.fill(shieldPath);
        // White checkmark inside
        ctx.fillStyle = brandWhite;
        const checkPath = new Path2D("M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z");
        ctx.fill(checkPath);
        ctx.restore();

        // "WARRANTY ACTIVE" text next to shield
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = successGreen;
        ctx.font = '900 44px "Inter", "Arial Black", sans-serif';
        ctx.fillText('WARRANTY', leftCenterX - 70, badgeCenterY - 14);
        ctx.fillText('ACTIVE', leftCenterX - 70, badgeCenterY + 32);

        // ── 24H Service Hotline ──
        const phoneY = contentBottom - 30;
        const safePhone = business?.whatsapp_number || business?.phone_number || businessData?.phone || '+13203627874';

        // Hotline label
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillStyle = textDarkGrey;
        ctx.font = '600 22px "Inter", "Arial", sans-serif';
        ctx.fillText('24H SERVICE HOTLINE', leftCenterX, phoneY - 42);

        // Phone number (bold, prominent)
        ctx.fillStyle = navyDark;
        ctx.font = '800 36px "Inter", "Arial", sans-serif';
        ctx.fillText(safePhone, leftCenterX, phoneY);

        // ============================================
        // 6. CENTER DIVIDER LINE (Factory sticker style)
        // ============================================
        const dividerX = leftWidth + 15;
        ctx.strokeStyle = silverDark;
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 6]); // Dashed = "cut here" industrial feel
        ctx.beginPath();
        ctx.moveTo(dividerX, topBarH + 15);
        ctx.lineTo(dividerX, bottomBarY - 15);
        ctx.stroke();
        ctx.setLineDash([]); // Reset

        // ============================================
        // 7. CENTER SECTION — Main CTA Text
        // ============================================
        const centerX = dividerX + 40;
        const centerWidth = 680;
        const centerMidX = centerX + centerWidth / 2;

        // "SERVICE WARRANTY & LOG" header
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillStyle = navyMid;
        ctx.font = '800 30px "Inter", "Arial", sans-serif';
        ctx.fillText('SERVICE WARRANTY & LOG', centerMidX, contentTop + 5);

        // Main CTA: "SCAN TO ACTIVATE & LOG SERVICE"
        const ctaY = contentTop + 60;
        ctx.fillStyle = textBlack;
        ctx.font = '900 72px "Inter", "Arial Black", sans-serif';
        ctx.fillText('SCAN TO', centerMidX, ctaY);
        ctx.fillText('ACTIVATE', centerMidX, ctaY + 78);

        ctx.font = '900 52px "Inter", "Arial Black", sans-serif';
        ctx.fillStyle = navyMid;
        ctx.fillText('& LOG SERVICE', centerMidX, ctaY + 165);

        // Sub-instruction
        const instrY = ctaY + 245;
        ctx.fillStyle = textDarkGrey;
        ctx.font = '600 28px "Inter", "Arial", sans-serif';
        ctx.fillText('Verify Warranty · Book Next Service', centerMidX, instrY);

        // "24/7 SUPPORT" pill badge
        const pillY = instrY + 48;
        const pillText = '24/7 SUPPORT';
        ctx.font = '800 26px "Inter", "Arial", sans-serif';
        const pillW = ctx.measureText(pillText).width + 50;
        const pillH = 42;
        const pillX = centerMidX - pillW / 2;

        // Pill background
        ctx.fillStyle = navyDark;
        ctx.beginPath();
        ctx.roundRect(pillX, pillY, pillW, pillH, pillH / 2);
        ctx.fill();

        // Pill text
        ctx.fillStyle = brandWhite;
        ctx.textBaseline = 'middle';
        ctx.fillText(pillText, centerMidX, pillY + pillH / 2);

        // ============================================
        // 8. RIGHT SECTION — QR Code
        // ============================================
        const qrSize = 370;
        const qrAreaX = width - qrSize - 80;
        const qrY = topBarH + (contentBottom - topBarH - qrSize) / 2 - 15;

        try {
            const qrDataUrl = await QRCodeLib.toDataURL(qrUrl, {
                width: qrSize,
                margin: 1,
                errorCorrectionLevel: 'H', // High correction for logo overlay
                color: { dark: '#0D1B2A', light: '#00000000' } // Navy dots on transparent (silver shows through)
            });

            const qrImg = new Image();
            qrImg.src = qrDataUrl;
            await new Promise((resolve) => { qrImg.onload = resolve; });

            // Subtle QR background box (slightly lighter than sticker bg)
            ctx.fillStyle = 'rgba(255,255,255,0.6)';
            ctx.beginPath();
            ctx.roundRect(qrAreaX - 15, qrY - 15, qrSize + 30, qrSize + 30, 16);
            ctx.fill();
            ctx.strokeStyle = silverDark;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.roundRect(qrAreaX - 15, qrY - 15, qrSize + 30, qrSize + 30, 16);
            ctx.stroke();

            ctx.drawImage(qrImg, qrAreaX, qrY, qrSize, qrSize);

            // WhatsApp Icon Overlay in center of QR
            const iconSize = qrSize * 0.18;
            const iconX = qrAreaX + qrSize / 2;
            const iconY = qrY + qrSize / 2;

            // White circle background
            ctx.beginPath();
            ctx.arc(iconX, iconY, iconSize / 2 + 10, 0, Math.PI * 2);
            ctx.fillStyle = brandWhite;
            ctx.fill();

            // Green WhatsApp circle
            ctx.beginPath();
            ctx.arc(iconX, iconY, iconSize / 2, 0, Math.PI * 2);
            ctx.fillStyle = '#25D366';
            ctx.fill();

            // Phone icon (white)
            const s = iconSize * 0.55;
            ctx.fillStyle = brandWhite;
            ctx.save();
            ctx.translate(iconX, iconY);
            ctx.scale(s / 24, s / 24);
            ctx.translate(-12, -12);
            const phonePath = new Path2D("M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z");
            ctx.fill(phonePath);
            ctx.restore();

            // "BOOK NEXT SERVICE" below QR
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillStyle = navyDark;
            ctx.font = '700 26px "Inter", "Arial", sans-serif';
            ctx.fillText('BOOK NEXT SERVICE ▸', qrAreaX + qrSize / 2, qrY + qrSize + 22);

            // Download
            const link = document.createElement('a');
            const safeName = (business?.name || 'Business').replace(/[^a-z0-9]/gi, '_');
            link.download = `${safeName}_Service_Record_Sticker.png`;
            link.href = canvas.toDataURL('image/png');
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (err) {
            console.error('Error creating service record sticker:', err);
            alert('Failed to generate sticker. Please try again.');
        }
    };

    // Download QR - "Simple Warranty" Sticker Design
    // CONCEPT: Clean, bold, 2-column layout. High contrast for readability.
    const downloadQR3 = async () => {
        // Launchfly Bot WhatsApp number
        const launchflyBotNumber = '13203627874';
        
        // Include business ref in trigger message
        const businessRef = business?.subdomain || business?.id;
        const stickerTrigger = `Hi! I want to activate my Warranty. 🛡️\n\n(Ref: ${businessRef || 'UNKNOWN'})`;
        
        const qrUrl = `https://wa.me/${launchflyBotNumber}?text=${encodeURIComponent(stickerTrigger)}`;

        const canvas = document.createElement('canvas');
        // Landscape orientation
        const width = 1800;
        // Reduced height by ~10% (640 -> 580)
        const height = 580;
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        // --- COLORS ---
        const navyBlue = '#0F172A';     // Deep Slate/Navy (Text)
        const activeGreen = '#22C55E';  // Bright Green (Checkmark, Phone)
        const textBlack = '#111111';
        const textGray = '#64748B';     // Slate-500
        const brandWhite = '#FFFFFF';

        // 1. ROUNDED CORNERS CLIP
        const radius = 30;
        ctx.beginPath();
        ctx.roundRect(0, 0, width, height, radius);
        ctx.clip();

        // 2. BACKGROUND (White)
        ctx.fillStyle = brandWhite;
        ctx.fillRect(0, 0, width, height);
        
        // Optional: Very light grey border
        ctx.strokeStyle = '#E2E8F0';
        ctx.lineWidth = 2;
        ctx.strokeRect(1, 1, width-2, height-2);

        // --- LEFT SECTION ---
        const leftMargin = 80;
        const topMargin = 70;

        // Pre-load logo so we know if we need to shift text
        const images = businessData.images || businessData.prospectImages || [];
        const logoImage = images.find(img => img.type === 'logo');
        const logoUrl = logoImage?.url || null;
        let logoLoadedImg = null;

        if (logoUrl) {
            try {
                const tmpImg = new Image();
                tmpImg.crossOrigin = 'anonymous';
                tmpImg.src = logoUrl;
                await new Promise((resolve, reject) => {
                    tmpImg.onload = resolve;
                    tmpImg.onerror = reject;
                    setTimeout(reject, 3000);
                });
                logoLoadedImg = tmpImg;
            } catch (e) {
                console.warn('Logo failed to load for sticker:', e);
            }
        }

        // Calculate logo size (match HEIGHT of WARRANTY ACTIVE title block)
        const titleBlockH = 245; // WARRANTY (130) + gap (115) = ACTIVE bottom
        let logoDrawW = 0;
        let logoPadding = 0;

        if (logoLoadedImg) {
            const aspect = logoLoadedImg.width / logoLoadedImg.height;
            const drawH = titleBlockH;
            const drawW = drawH * aspect;
            logoDrawW = Math.min(drawW, 260); // Cap max width
            logoPadding = logoDrawW + 30; // Space between logo and text
        }

        const textLeft = leftMargin + logoPadding; // Shift text right if logo present
        
        // A. "OFFICIAL SERVICE RECORD"
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillStyle = textGray;
        ctx.font = '700 36px "Inter", "Arial", sans-serif'; 
        ctx.fillText('OFFICIAL SERVICE RECORD', textLeft, topMargin);

        // B. "WARRANTY" (Huge, Black)
        const warrantyY = topMargin + 60;
        ctx.fillStyle = textBlack;
        ctx.font = '900 130px "Inter", "Arial Black", sans-serif';
        ctx.fillText('WARRANTY', textLeft, warrantyY);

        // C. "ACTIVE" + Checkmark
        const activeY = warrantyY + 115;
        ctx.fillStyle = textBlack;
        ctx.fillText('ACTIVE', textLeft, activeY);
        
        // Measure "ACTIVE" to place checkmark
        const activeWidth = ctx.measureText('ACTIVE').width;
        
        // Checkmark Icon (Green Circle with white check)
        const checkSize = 90;
        const checkX = textLeft + activeWidth + 45;
        const checkY = activeY + 60; 
        
        // Green Circle
        ctx.beginPath();
        ctx.arc(checkX, checkY, checkSize / 2, 0, Math.PI * 2);
        ctx.fillStyle = activeGreen;
        ctx.fill();
        
        // White Checkmark
        ctx.strokeStyle = brandWhite;
        ctx.lineWidth = 10;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(checkX - 18, checkY + 4);
        ctx.lineTo(checkX - 4, checkY + 18);
        ctx.lineTo(checkX + 22, checkY - 18);
        ctx.stroke();

        // Draw logo to the left of WARRANTY ACTIVE, sized to match title height
        if (logoLoadedImg) {
            const aspect = logoLoadedImg.width / logoLoadedImg.height;
            let drawH = titleBlockH;
            let drawW = drawH * aspect;
            if (drawW > 260) { drawW = 260; drawH = drawW / aspect; }
            const logoX = leftMargin;
            const logoY = warrantyY + (titleBlockH - drawH) / 2; // Vertically center with title
            ctx.drawImage(logoLoadedImg, logoX, logoY, drawW, drawH);
        }

        // D. "AUTHORIZED SERVICE PARTNER"
        // Slightly reordered per user request, but still below Active
        const partnerY = activeY + 140; 
        ctx.fillStyle = navyBlue;
        ctx.font = '800 38px "Inter", "Arial", sans-serif';
        ctx.fillText('AUTHORIZED SERVICE PARTNER', textLeft, partnerY);

        // E. Business Name (logo is now next to WARRANTY ACTIVE)
        const bizNameY = partnerY + 50;
        const bizName = (business?.name || 'YOUR BUSINESS NAME').toUpperCase();
        let nameSize = 58;
        if (bizName.length > 20) nameSize = 48;
        if (bizName.length > 30) nameSize = 38;

        ctx.fillStyle = '#334155';
        ctx.font = `900 ${nameSize}px "Inter", "Arial Black", sans-serif`;
        ctx.fillText(bizName, textLeft, bizNameY);

        // F. Hotline - Pushed to absolute bottom left
        const hotlineY = height - 70; // Adjusted for new height
        const formatPhone = (p) => {
             if (!p) return '';
             return p.startsWith('+') ? p : `+${p}`;
        };
        const displayPhone = formatPhone(business?.whatsapp_number || business?.phone_number || businessData?.phone || '639627459049');
        
        ctx.fillStyle = textBlack;
        ctx.font = '800 44px "Inter", "Arial", sans-serif';
        ctx.fillText(displayPhone, textLeft, hotlineY);

        // --- RIGHT SECTION ---
        // QR Code Area
        const qrSize = 380; // Scaled down for height
        const qrX = width - qrSize - 100; // Increased right margin
        // Center vertically relative to whole canvas
        const qrY = (height - qrSize) / 2 + 15; // Shifted down slightly

        // Top Right Label: "24/7 SUPPORT"
        // Positioned relative to QR top
        const trY = qrY - 50;
        const trX = qrX + (qrSize / 2); // Center over QR
        ctx.textAlign = 'center';
        ctx.fillStyle = navyBlue;
        ctx.font = '800 36px "Inter", "Arial", sans-serif';
        ctx.fillText('24/7 SUPPORT', trX, trY);

        try {
            // Generate QR
            const qrDataUrl = await QRCodeLib.toDataURL(qrUrl, {
                width: qrSize,
                margin: 1,
                errorCorrectionLevel: 'H',
                color: { dark: '#000000', light: '#00000000' }
            });

            const qrImg = new Image();
            qrImg.src = qrDataUrl;
            await new Promise((resolve) => { qrImg.onload = resolve; });
            ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);

            // Icon Overlay (Phone Green)
            const iconSize = qrSize * 0.22;
            const iconX = qrX + qrSize / 2;
            const iconY = qrY + qrSize / 2;

            // White border circle
            ctx.beginPath();
            ctx.arc(iconX, iconY, iconSize / 2 + 10, 0, Math.PI * 2);
            ctx.fillStyle = brandWhite;
            ctx.fill();

            // Green circle
            ctx.beginPath();
            ctx.arc(iconX, iconY, iconSize / 2, 0, Math.PI * 2);
            ctx.fillStyle = activeGreen;
            ctx.fill();

            // Phone Icon
            const s = iconSize * 0.55;
            ctx.fillStyle = brandWhite;
            ctx.save();
            ctx.translate(iconX, iconY);
            ctx.scale(s / 24, s / 24);
            ctx.translate(-12, -12);
            // Simple Phone Path
            const phonePath = new Path2D("M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z");
            ctx.fill(phonePath);
            ctx.restore();

            // Bottom Text: "Scan to Verify Warranty & Book Service"
            const bottomTextY = qrY + qrSize + 20;
            ctx.fillStyle = textBlack;
            ctx.font = '600 24px "Inter", "Arial", sans-serif';
            ctx.fillText('SCAN TO ACTIVATE WARRANTY', trX, bottomTextY);
            //ctx.fillText('& Book Service', trX, bottomTextY + 32);

            // Download
            const link = document.createElement('a');
            const safeName = (business?.name || 'Business').replace(/[^a-z0-9]/gi, '_');
            link.download = `${safeName}_Warranty_Active.png`;
            link.href = canvas.toDataURL('image/png');
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

        } catch (err) {
            console.error('Error creating warranty active sticker:', err);
            alert('Failed to generate sticker.');
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

                {/* QR Download - Warranty Active */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-100 rounded-lg">
                            <QrCode className="w-5 h-5 text-green-700" />
                        </div>
                        <div>
                            <h3 className="font-bold text-sm text-slate-900">Warranty Active Sticker</h3>
                            <p className="text-xs text-slate-500">Official Warranty Label</p>
                        </div>
                    </div>
                    <button
                        onClick={downloadQR3}
                        className="px-3 py-1.5 bg-green-600 text-white text-xs font-bold rounded-lg hover:bg-green-700 transition-colors"
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
                            <button onClick={() => { setShowBlastModal(false); setBlastTab('blast'); setImportResult(null); }}>
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Tab Switcher: Blast vs Import */}
                        <div className="flex gap-1 bg-slate-100 rounded-lg p-1 mb-4">
                            <button
                                onClick={() => setBlastTab('blast')}
                                className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${
                                    blastTab === 'blast'
                                        ? 'bg-white shadow text-blue-600'
                                        : 'text-slate-500 hover:text-slate-700'
                                }`}
                            >
                                📣 Send Blast
                            </button>
                            <button
                                onClick={() => setBlastTab('import')}
                                className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${
                                    blastTab === 'import'
                                        ? 'bg-white shadow text-green-600'
                                        : 'text-slate-500 hover:text-slate-700'
                                }`}
                            >
                                📥 Import List
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

                        {/* === BLAST TAB === */}
                        {blastTab === 'blast' && (
                        <>
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

                                {/* Message Template Selection */}
                                <div className="mb-4">
                                    <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">
                                        Message {(selectedSegment === 'imported' || selectedSegment === 'cold_leads') && '(Template)'}
                                    </label>
                                    
                                    {/* Template Selection Pills */}
                                    <div className="flex flex-wrap gap-2 mb-3">
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

                                    {/* Preview Box: Smart switching between Custom/Freeform and Twilio Template */}
                                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm">
                                        {/* Header */}
                                        <div className="flex justify-between items-center mb-2 pb-2 border-b border-slate-200">
                                            <span className="text-xs font-bold text-slate-500 uppercase">Preview</span>
                                            {(selectedSegment === 'imported' || selectedSegment === 'cold_leads') ? (
                                                <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                                                    WhatsApp Template
                                                </span>
                                            ) : (
                                                <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                                                    Freeform Message
                                                </span>
                                            )}
                                        </div>

                                        {/* Content Preview */}
                                        <div className="text-slate-700 whitespace-pre-wrap font-sans">
                                            {(selectedSegment === 'imported' || selectedSegment === 'cold_leads') ? (
                                                /* COLD LEADS: Show Twilio Template Preview */
                                                <div className="space-y-2">
                                                    <p>Hi {'{Name}'}!</p>
                                                    <p>🎉 Special offer from *{businessName}*:</p>
                                                    <p>Book your {niche ? niche.toLowerCase() : 'service'} service this week and get *10% OFF*!</p>
                                                    <p>Limited slots available. Reply *YES* to claim your discount.</p>
                                                    <p className="text-[10px] text-slate-400 italic mt-2 border-t pt-1">
                                                        * Sent as pre-approved WhatsApp template because contact is outside 24h window
                                                    </p>
                                                </div>
                                            ) : (
                                                /* WARM LEADS: Show Selected Pill / Custom Text */
                                                customMessage || (blastTemplates.find(t => t.id === selectedTemplate)?.name === '10% Off Promo' 
                                                    ? `🔥 ${niche} Promo! 10% OFF this week only. Reply "BOOK" to claim your slot! - ${businessName}`
                                                    : blastTemplates.find(t => t.id === selectedTemplate)?.name === 'We Miss You'
                                                    ? `Hi {Name}! 👋 It's been a while since your last ${niche?.toLowerCase()} service. Ready to book again? Reply "YES" - ${businessName}`
                                                    : blastTemplates.find(t => t.id === selectedTemplate)?.name === 'Service Reminder'
                                                    ? `Hi {Name}! 🔧 Your ${niche?.toLowerCase()} is due for service. Book now to keep it running smoothly! Reply "BOOK" - ${businessName}`
                                                    : `(Select a template above)`
                                                )
                                            )}
                                        </div>
                                    </div>
                                    
                                    {/* Textarea only visible for Warm leads where custom text is possible */}
                                    {!(selectedSegment === 'imported' || selectedSegment === 'cold_leads') && (
                                        <textarea
                                            value={customMessage}
                                            onChange={(e) => setCustomMessage(e.target.value)}
                                            placeholder="Or write custom message..."
                                            className="w-full p-3 border border-slate-200 rounded-lg text-sm resize-none mt-3"
                                            rows={2}
                                        />
                                    )}
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
                        </>
                        )}

                        {/* === IMPORT TAB === */}
                        {blastTab === 'import' && (
                            <div>
                                <div className="bg-green-50 border border-green-200 rounded-xl p-3 mb-4">
                                    <p className="text-sm font-medium text-green-800 mb-1">📥 Database Reactivation</p>
                                    <p className="text-xs text-green-600">
                                        Paste your client&apos;s old customer list. We&apos;ll import them and you can blast a promo to win them back.
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
                                    <div className={`p-3 rounded-lg mb-4 text-sm ${
                                        importResult.error 
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
                                                <p className="mt-2 text-xs text-green-600">
                                                    Switch to &quot;Send Blast&quot; tab → select &quot;Imported Contacts&quot; segment to blast them!
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Import Button */}
                                <button
                                    onClick={importContacts}
                                    disabled={importing || !importText.trim()}
                                    className="w-full py-3 bg-green-600 text-white font-bold rounded-xl disabled:opacity-50 transition-all"
                                >
                                    {importing ? (
                                        <span className="flex items-center justify-center gap-2">
                                            <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                                            Importing...
                                        </span>
                                    ) : (
                                        `📥 Import Contacts`
                                    )}
                                </button>
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
