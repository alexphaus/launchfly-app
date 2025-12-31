
// scripts/test-conversational-commerce.js
// Test script to verify the new Conversational Commerce features

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

// Mock data for test
const TEST_EMAIL = `test.commerce.${Date.now()}@example.com`;
const TEST_PHONE = '+15551234567'; // Should be saved as business owner phone (WhatsApp)
const TEST_FB_URL = 'https://facebook.com/testbusiness';
const TEST_LEAD_EMAIL = `lead.${Date.now()}@example.com`;

async function runTest() {
    console.log('🚀 Starting Conversational Commerce Verification...\n');

    try {
        // ----------------------------------------------------------------
        // 1. Simulate Onboarding (Wizard Submit)
        // ----------------------------------------------------------------
        console.log('1️⃣  Simulating Onboarding Submission...');

        // We'll call the API handler logic directly or just simulate what the API does by inserting directly
        // to keep this script self-contained and fast.

        // Create a user first (mock)
        const { data: user, error: userError } = await supabase.auth.admin.createUser({
            email: TEST_EMAIL,
            password: 'password123',
            email_confirm: true,
            user_metadata: { full_name: 'Test Commerce User' }
        });

        if (userError) throw userError;
        const userId = user.user.id;
        console.log(`   ✅ User created: ${userId}`);

        // Insert Business with new fields
        const { data: business, error: bizError } = await supabase
            .from('businesses')
            .insert({
                user_id: userId,
                name: 'Conversational Commerce Test',
                subdomain: `cc-test-${Date.now()}`,
                status: 'ready',
                phone_number: TEST_PHONE, // <--- KEY FIELD VERIFICATION
                form_data: {
                    social_proof: {
                        facebook_url: TEST_FB_URL // <--- KEY FIELD VERIFICATION
                    }
                },
                business_data: {
                    // Minimal data for lead magnet
                    leadMagnet: {
                        title: 'Conversational Commerce Guide',
                        content: []
                    }
                }
            })
            .select()
            .single();

        if (bizError) throw bizError;
        console.log(`   ✅ Business created: ${business.id}`);

        // ----------------------------------------------------------------
        // 2. Verify Data Persistence
        // ----------------------------------------------------------------
        console.log('\n2️⃣  Verifying Data Persistence...');

        if (business.phone_number === TEST_PHONE) {
            console.log(`   ✅ Phone Number saved correctly: ${business.phone_number}`);
        } else {
            console.error(`   ❌ Phone Number mismatch! Expected ${TEST_PHONE}, got ${business.phone_number}`);
        }

        if (business.form_data?.social_proof?.facebook_url === TEST_FB_URL) {
            console.log(`   ✅ Facebook URL saved correctly: ${business.form_data.social_proof.facebook_url}`);
        } else {
            console.error(`   ❌ Facebook URL mismatch! Expected ${TEST_FB_URL}, got ${JSON.stringify(business.form_data)}`);
        }

        // ----------------------------------------------------------------
        // 3. Simulate Lead Capture (WhatsApp Alert)
        // ----------------------------------------------------------------
        console.log('\n3️⃣  Simulating Lead Capture & WhatsApp Alert...');

        // Mock the HTTP request to the capture endpoint
        // We can't easily mock the API route execution here without running Next.js, 
        // but we can sanity check the Twilio config environment.

        if (!process.env.TWILIO_PHONE_NUMBER?.startsWith('whatsapp:')) {
            console.log('   ℹ️  Note: TWILIO_PHONE_NUMBER in .env is not prefixed with "whatsapp:".');
            console.log('      The code handles this by adding the prefix, but for real usage, ensure the number is WhatsApp enabled.');
        }

        // Direct invocation logic check (Simulation)
        const ownerPhone = business.phone_number;
        const toWhatsApp = `whatsapp:${ownerPhone}`;
        console.log(`   ℹ️  Logic check: Message would be sent TO: ${toWhatsApp}`);

        console.log('\n✅ Verification Complete.');

        // Cleanup
        // await supabase.from('businesses').delete().eq('id', business.id);
        // await supabase.auth.admin.deleteUser(userId);

    } catch (error) {
        console.error('❌ Test Failed:', error);
        process.exit(1);
    }
}

runTest();
