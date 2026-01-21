/**
 * Forever Customer Engine - End-to-End Test Script
 * 
 * This script tests the complete lifecycle:
 * 1. Database schema verification
 * 2. Service record creation
 * 3. Reminder scheduling
 * 4. SMS/WhatsApp flow simulation
 * 
 * Run: node test-forever-customer.js
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

// Test config - UPDATE THESE FOR YOUR TEST
const TEST_CONFIG = {
    // Use an existing business ID from your DB
    businessId: null, // Will be auto-detected
    testCustomerPhone: '+60123456789', // Fake test number
    testCustomerName: 'Test Sarah',
    ownerPhone: process.env.TEST_OWNER_PHONE || '+60173527250', // Your phone for testing
};

// Colors for console output
const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    reset: '\x1b[0m',
    bold: '\x1b[1m',
};

const log = {
    success: (msg) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
    error: (msg) => console.log(`${colors.red}❌ ${msg}${colors.reset}`),
    warn: (msg) => console.log(`${colors.yellow}⚠️  ${msg}${colors.reset}`),
    info: (msg) => console.log(`${colors.blue}ℹ️  ${msg}${colors.reset}`),
    header: (msg) => console.log(`\n${colors.bold}${colors.blue}═══ ${msg} ═══${colors.reset}\n`),
};

async function runTests() {
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║       🔄 FOREVER CUSTOMER ENGINE - TEST SUITE 🔄          ║
╚═══════════════════════════════════════════════════════════╝
`);

    const results = {
        passed: 0,
        failed: 0,
        warnings: 0,
    };

    // ========== TEST 1: Database Schema ==========
    log.header('TEST 1: Database Schema Verification');

    // Check service_records table
    const { data: srTest, error: srError } = await supabase
        .from('service_records')
        .select('id')
        .limit(1);

    if (srError && srError.code === '42P01') {
        log.error('Table "service_records" does not exist!');
        log.warn('Run the migration: db/migrations/20260121_forever_customer.sql');
        results.failed++;
    } else if (srError) {
        log.error(`service_records error: ${srError.message}`);
        results.failed++;
    } else {
        log.success('Table "service_records" exists');
        results.passed++;
    }

    // Check service_reminders table
    const { error: remError } = await supabase
        .from('service_reminders')
        .select('id')
        .limit(1);

    if (remError && remError.code === '42P01') {
        log.error('Table "service_reminders" does not exist!');
        results.failed++;
    } else if (remError) {
        log.error(`service_reminders error: ${remError.message}`);
        results.failed++;
    } else {
        log.success('Table "service_reminders" exists');
        results.passed++;
    }

    // Check customers table has new columns
    const { data: custTest, error: custError } = await supabase
        .from('customers')
        .select('is_repeat_customer, service_count, last_service_date')
        .limit(1);

    if (custError && custError.message.includes('column')) {
        log.warn('Customers table missing new columns (is_repeat_customer, etc.)');
        log.warn('Run the ALTER TABLE statements from migration');
        results.warnings++;
    } else {
        log.success('Customers table has retention columns');
        results.passed++;
    }

    // ========== TEST 2: Find Test Business ==========
    log.header('TEST 2: Business Setup');

    const { data: businesses, error: bizError } = await supabase
        .from('businesses')
        .select('id, name, whatsapp_number, phone_number, business_data')
        .not('whatsapp_number', 'is', null)
        .limit(5);

    if (bizError || !businesses?.length) {
        log.error('No businesses found with whatsapp_number');
        results.failed++;
        return printSummary(results);
    }

    log.success(`Found ${businesses.length} business(es) with WhatsApp configured`);
    
    // Pick first business for testing
    const testBusiness = businesses[0];
    TEST_CONFIG.businessId = testBusiness.id;
    
    log.info(`Using business: "${testBusiness.name}" (${testBusiness.id.substring(0, 8)}...)`);
    log.info(`Owner phone: ${testBusiness.whatsapp_number || testBusiness.phone_number}`);
    results.passed++;

    // ========== TEST 3: Create Test Customer ==========
    log.header('TEST 3: Customer Creation');

    // Check if test customer exists
    let { data: existingCustomer } = await supabase
        .from('customers')
        .select('id, name, phone')
        .eq('phone', TEST_CONFIG.testCustomerPhone)
        .single();

    let testCustomerId;

    if (existingCustomer) {
        log.info(`Test customer already exists: ${existingCustomer.name}`);
        testCustomerId = existingCustomer.id;
    } else {
        const { data: newCustomer, error: custCreateError } = await supabase
            .from('customers')
            .insert({
                phone: TEST_CONFIG.testCustomerPhone,
                name: TEST_CONFIG.testCustomerName,
                email: 'test@launchfly.ai',
                business_id: TEST_CONFIG.businessId,
                status: 'lead',
                source: 'test_script',
            })
            .select()
            .single();

        if (custCreateError) {
            log.error(`Failed to create test customer: ${custCreateError.message}`);
            results.failed++;
        } else {
            log.success(`Created test customer: ${newCustomer.name}`);
            testCustomerId = newCustomer.id;
            results.passed++;
        }
    }

    // ========== TEST 4: Create Service Record ==========
    log.header('TEST 4: Service Record Creation');

    if (!testCustomerId) {
        log.error('Cannot test service records without customer');
        results.failed++;
    } else {
        // Calculate dates
        const serviceDate = new Date();
        serviceDate.setMonth(serviceDate.getMonth() - 5); // 5 months ago (due in 1 month)
        
        const warrantyExpires = new Date(serviceDate);
        warrantyExpires.setDate(warrantyExpires.getDate() + 30);
        
        const nextDue = new Date(serviceDate);
        nextDue.setDate(nextDue.getDate() + 180); // 6 months from service

        const { data: serviceRecord, error: srCreateError } = await supabase
            .from('service_records')
            .insert({
                business_id: TEST_CONFIG.businessId,
                customer_id: testCustomerId,
                service_type: 'cleaning',
                service_name: 'Aircon General Cleaning',
                appliance_type: 'aircon',
                units_serviced: 2,
                amount: 240,
                currency: 'RM',
                address: '123 Test Street, Subang Jaya',
                warranty_days: 30,
                warranty_expires_at: warrantyExpires.toISOString(),
                service_interval_days: 180,
                next_service_due_at: nextDue.toISOString(),
                registered_via: 'manual', // Use valid enum value
                registered_by: 'system',
                service_date: serviceDate.toISOString(),
            })
            .select()
            .single();

        if (srCreateError) {
            if (srCreateError.code === '42P01') {
                log.error('service_records table does not exist - run migration first!');
            } else {
                log.error(`Failed to create service record: ${srCreateError.message}`);
            }
            results.failed++;
        } else {
            log.success(`Created service record: ${serviceRecord.id.substring(0, 8)}...`);
            log.info(`  Service: ${serviceRecord.service_name}`);
            log.info(`  Service Date: ${new Date(serviceRecord.service_date).toLocaleDateString()}`);
            log.info(`  Next Due: ${new Date(serviceRecord.next_service_due_at).toLocaleDateString()}`);
            log.info(`  Warranty Expires: ${new Date(serviceRecord.warranty_expires_at).toLocaleDateString()}`);
            results.passed++;

            // Update customer with service info
            await supabase
                .from('customers')
                .update({
                    last_service_date: serviceDate.toISOString(),
                    is_repeat_customer: true,
                })
                .eq('id', testCustomerId);
        }
    }

    // ========== TEST 5: Test Reminder Query ==========
    log.header('TEST 5: Reminder Query (Smart Nag)');

    // Check if the helper function exists
    const { data: dueServices, error: dueError } = await supabase
        .rpc('get_services_due_for_reminder', { p_days_ahead: 60 }); // 60 days to catch our test

    if (dueError) {
        if (dueError.message.includes('function') || dueError.code === '42883') {
            log.warn('Helper function get_services_due_for_reminder() not found');
            log.warn('The cron job will use fallback query');
            results.warnings++;
            
            // Test fallback query
            const { data: fallbackDue, error: fallbackError } = await supabase
                .from('service_records')
                .select(`
                    id,
                    customer_id,
                    business_id,
                    service_name,
                    next_service_due_at,
                    reminder_sent,
                    reminder_count,
                    customers(name, phone)
                `)
                .eq('reminder_sent', false)
                .not('next_service_due_at', 'is', null)
                .lte('next_service_due_at', new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString())
                .limit(10);

            if (fallbackError) {
                log.error(`Fallback query failed: ${fallbackError.message}`);
                results.failed++;
            } else {
                log.success(`Fallback query works - found ${fallbackDue?.length || 0} services due`);
                if (fallbackDue?.length > 0) {
                    fallbackDue.forEach(s => {
                        log.info(`  → ${s.customers?.name || 'Unknown'}: ${s.service_name} (due ${new Date(s.next_service_due_at).toLocaleDateString()})`);
                    });
                }
                results.passed++;
            }
        } else {
            log.error(`Query error: ${dueError.message}`);
            results.failed++;
        }
    } else {
        log.success(`Found ${dueServices?.length || 0} services due for reminder`);
        if (dueServices?.length > 0) {
            dueServices.slice(0, 5).forEach(s => {
                log.info(`  → ${s.customer_name}: ${s.service_name} (${s.days_until_due} days)`);
            });
        }
        results.passed++;
    }

    // ========== TEST 6: Environment Variables ==========
    log.header('TEST 6: Environment Variables');

    const requiredEnvVars = [
        'NEXT_PUBLIC_SUPABASE_URL',
        'SUPABASE_SERVICE_KEY',
        'TWILIO_ACCOUNT_SID',
        'TWILIO_AUTH_TOKEN',
        'TWILIO_WHATSAPP_NUMBER',
    ];

    const optionalEnvVars = [
        'TWILIO_SMS_NUMBER', // For Smart Nag SMS
        'CRON_SECRET',       // For cron job auth
    ];

    requiredEnvVars.forEach(key => {
        if (process.env[key]) {
            log.success(`${key}: Set ✓`);
            results.passed++;
        } else {
            log.error(`${key}: MISSING!`);
            results.failed++;
        }
    });

    optionalEnvVars.forEach(key => {
        if (process.env[key]) {
            log.success(`${key}: Set ✓`);
        } else {
            log.warn(`${key}: Not set (optional but recommended)`);
            results.warnings++;
        }
    });

    // ========== TEST 7: Simulate Sticker Scan ==========
    log.header('TEST 7: Sticker Scan Flow Simulation');

    log.info('To test the full WhatsApp flow:');
    console.log(`
${colors.yellow}┌─────────────────────────────────────────────────────────────┐
│  MANUAL TEST: Scan as OWNER (Admin Mode)                    │
├─────────────────────────────────────────────────────────────┤
│  1. Open WhatsApp on the phone registered as business owner │
│  2. Send this message to +1 320 362 7874:                   │
│                                                             │
│     Hi, I scanned the Service Sticker [BIZ:${TEST_CONFIG.businessId?.substring(0, 8) || 'YOUR_BIZ'}]       │
│                                                             │
│  Expected: Bot asks "Enter customer's phone number"         │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  MANUAL TEST: Scan as CUSTOMER (Booking Mode)               │
├─────────────────────────────────────────────────────────────┤
│  1. Use a DIFFERENT phone (not the owner's)                 │
│  2. Send this message to +1 320 362 7874:                   │
│                                                             │
│     Hi, I scanned the Service Sticker [BIZ:${TEST_CONFIG.businessId?.substring(0, 8) || 'YOUR_BIZ'}]       │
│                                                             │
│  If NEW customer: See menu (1/2/3)                          │
│  If RETURNING: "Welcome back! Your last service was..."     │
└─────────────────────────────────────────────────────────────┘${colors.reset}
`);

    // ========== TEST 8: Test Cron Endpoint ==========
    log.header('TEST 8: Cron Job Endpoint');

    if (process.env.CRON_SECRET) {
        log.info('Testing cron endpoint locally...');
        
        try {
            const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
            const response = await fetch(`${baseUrl}/api/cron/service-reminders`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${process.env.CRON_SECRET}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                log.success(`Cron endpoint responded: ${JSON.stringify(data).substring(0, 100)}...`);
                results.passed++;
            } else {
                log.warn(`Cron endpoint returned ${response.status} - may need local server running`);
                results.warnings++;
            }
        } catch (e) {
            log.warn('Could not reach cron endpoint (is dev server running?)');
            log.info('Test manually: curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/service-reminders');
            results.warnings++;
        }
    } else {
        log.warn('CRON_SECRET not set - skipping cron test');
        results.warnings++;
    }

    // ========== SUMMARY ==========
    printSummary(results);

    // Cleanup option
    console.log(`
${colors.yellow}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🧹 To clean up test data, run:
   
   DELETE FROM service_records WHERE registered_via = 'test_script';
   DELETE FROM customers WHERE source = 'test_script';
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}
`);
}

function printSummary(results) {
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║                    📊 TEST SUMMARY                        ║
╠═══════════════════════════════════════════════════════════╣
║  ${colors.green}✅ Passed:   ${results.passed.toString().padStart(3)}${colors.reset}                                      ║
║  ${colors.red}❌ Failed:   ${results.failed.toString().padStart(3)}${colors.reset}                                      ║
║  ${colors.yellow}⚠️  Warnings: ${results.warnings.toString().padStart(3)}${colors.reset}                                      ║
╠═══════════════════════════════════════════════════════════╣
║  ${results.failed === 0 ? colors.green + '🎉 ALL CRITICAL TESTS PASSED!' : colors.red + '⚠️  FIX FAILURES BEFORE LAUNCH'}${colors.reset}                      ║
╚═══════════════════════════════════════════════════════════╝
`);
}

// Run tests
runTests().catch(err => {
    console.error('Test script error:', err);
    process.exit(1);
});
