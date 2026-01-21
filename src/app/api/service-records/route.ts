/**
 * Service Records API
 * 
 * CRUD operations for the service_records table
 * Core of the "Forever Customer Engine" - tracks completed services
 * for warranty management and automatic reminder scheduling.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { 
    calculateNextServiceDue, 
    calculateWarrantyExpiry,
    getDefaultServiceInterval,
    getDefaultWarrantyDays,
} from '@/lib/warranty-flow';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
);

// ============================================================================
// GET - Retrieve service records
// ============================================================================
// GET /api/service-records?customerId=xxx
// GET /api/service-records?businessId=xxx
// GET /api/service-records/[id]

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const customerId = searchParams.get('customerId');
        const businessId = searchParams.get('businessId');
        const recordId = searchParams.get('id');

        if (recordId) {
            // Get single record
            const { data, error } = await supabase
                .from('service_records')
                .select(`
                    *,
                    customers(id, name, phone, email),
                    businesses(id, name, business_data)
                `)
                .eq('id', recordId)
                .single();

            if (error) throw error;
            return NextResponse.json(data);
        }

        if (customerId) {
            // Get all records for a customer
            const { data, error } = await supabase
                .from('service_records')
                .select(`
                    *,
                    businesses(id, name)
                `)
                .eq('customer_id', customerId)
                .order('service_date', { ascending: false });

            if (error) throw error;
            return NextResponse.json({ records: data, count: data?.length || 0 });
        }

        if (businessId) {
            // Get all records for a business
            const { data, error } = await supabase
                .from('service_records')
                .select(`
                    *,
                    customers(id, name, phone)
                `)
                .eq('business_id', businessId)
                .order('service_date', { ascending: false })
                .limit(100);

            if (error) throw error;
            return NextResponse.json({ records: data, count: data?.length || 0 });
        }

        return NextResponse.json(
            { error: 'Please provide customerId, businessId, or id' },
            { status: 400 }
        );

    } catch (error) {
        console.error('Error fetching service records:', error);
        return NextResponse.json(
            { error: 'Failed to fetch service records' },
            { status: 500 }
        );
    }
}

// ============================================================================
// POST - Create new service record
// ============================================================================
// Called after tech registers a completed service

interface CreateServiceRecordBody {
    businessId: string;
    customerId: string;
    serviceType: 'cleaning' | 'repair' | 'installation' | 'maintenance' | 'inspection';
    serviceName?: string;
    applianceType?: string;
    unitsServiced?: number;
    amount?: number;
    currency?: string;
    address?: string;
    buildingName?: string;
    warrantyDays?: number;
    serviceIntervalDays?: number;
    registeredVia?: 'sticker_scan' | 'tech_register' | 'manual' | 'import' | 'booking_complete';
    registeredBy?: 'customer' | 'technician' | 'system';
    serviceDate?: string; // ISO string
}

export async function POST(request: NextRequest) {
    try {
        const body: CreateServiceRecordBody = await request.json();

        // Validate required fields
        if (!body.businessId || !body.customerId || !body.serviceType) {
            return NextResponse.json(
                { error: 'businessId, customerId, and serviceType are required' },
                { status: 400 }
            );
        }

        // Calculate warranty and reminder dates
        const serviceDate = body.serviceDate ? new Date(body.serviceDate) : new Date();
        const warrantyDays = body.warrantyDays ?? getDefaultWarrantyDays(body.serviceType);
        const intervalDays = body.serviceIntervalDays ?? getDefaultServiceInterval(body.serviceType);
        
        const warrantyExpiresAt = calculateWarrantyExpiry(serviceDate, warrantyDays);
        const nextServiceDueAt = body.serviceType === 'repair' 
            ? null // Don't auto-schedule for repairs
            : calculateNextServiceDue(serviceDate, intervalDays);

        // Create the service record
        const { data: record, error } = await supabase
            .from('service_records')
            .insert({
                business_id: body.businessId,
                customer_id: body.customerId,
                service_type: body.serviceType,
                service_name: body.serviceName,
                appliance_type: body.applianceType,
                units_serviced: body.unitsServiced || 1,
                amount: body.amount,
                currency: body.currency || 'RM',
                address: body.address,
                building_name: body.buildingName,
                warranty_days: warrantyDays,
                warranty_expires_at: warrantyExpiresAt,
                service_interval_days: intervalDays,
                next_service_due_at: nextServiceDueAt,
                registered_via: body.registeredVia || 'manual',
                registered_by: body.registeredBy || 'system',
                service_date: serviceDate,
            })
            .select()
            .single();

        if (error) throw error;

        // Update customer record with latest service info
        await supabase
            .from('customers')
            .update({
                last_service_date: serviceDate,
                next_reminder_due: nextServiceDueAt,
                service_count: supabase.rpc('increment_service_count'), // Will need to create this function
                is_repeat_customer: true,
                building_name: body.buildingName,
            })
            .eq('id', body.customerId);

        // Log activity
        await supabase.from('ai_activities').insert({
            business_id: body.businessId,
            type: 'service_registered',
            icon: '✅',
            message: `Service registered: ${body.serviceName || body.serviceType}`,
            details: `Customer will receive automatic reminder on ${nextServiceDueAt?.toLocaleDateString() || 'N/A'}`,
            metadata: {
                service_record_id: record.id,
                customer_id: body.customerId,
                warranty_expires: warrantyExpiresAt,
                next_due: nextServiceDueAt,
            },
        });

        console.log(`✅ Created service record: ${record.id}`);
        console.log(`   Warranty expires: ${warrantyExpiresAt}`);
        console.log(`   Next reminder: ${nextServiceDueAt}`);

        return NextResponse.json({
            success: true,
            record,
            warrantyExpiresAt,
            nextServiceDueAt,
        });

    } catch (error) {
        console.error('Error creating service record:', error);
        return NextResponse.json(
            { error: 'Failed to create service record' },
            { status: 500 }
        );
    }
}

// ============================================================================
// PUT - Update service record
// ============================================================================

export async function PUT(request: NextRequest) {
    try {
        const body = await request.json();
        const { id, ...updates } = body;

        if (!id) {
            return NextResponse.json(
                { error: 'id is required' },
                { status: 400 }
            );
        }

        const { data, error } = await supabase
            .from('service_records')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({ success: true, record: data });

    } catch (error) {
        console.error('Error updating service record:', error);
        return NextResponse.json(
            { error: 'Failed to update service record' },
            { status: 500 }
        );
    }
}

// ============================================================================
// DELETE - Delete service record
// ============================================================================

export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json(
                { error: 'id is required' },
                { status: 400 }
            );
        }

        const { error } = await supabase
            .from('service_records')
            .delete()
            .eq('id', id);

        if (error) throw error;

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('Error deleting service record:', error);
        return NextResponse.json(
            { error: 'Failed to delete service record' },
            { status: 500 }
        );
    }
}
