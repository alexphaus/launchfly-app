
import { sendJobCard, sendLeadNotification } from '../lib/whatsapp-push';

// Mock data to simulate the flow
const mockJob = {
    id: 'TEST1234',
    serviceName: 'Aircon Service',
    serviceEmoji: '❄️',
    customerName: 'Siti Nurhaliza',
    customerPhone: '+60123456789',
    estimate: { min: 140, max: 168, currency: 'RM' },
    answers: {
        units: 2,
        type: 'General Service'
    },
    businessName: 'Cool Breeze Aircon'
};

const ownerPhone = '+60173527250'; // Alex's number for testing

async function verifyPivot() {
    console.log('🚀 Starting Verification: WhatsApp OS Pivot');

    // 1. Verify Job Card Generation
    console.log('\n--- 1. Testing Job Card Send ---');
    const result1 = await sendJobCard(ownerPhone, mockJob);

    if (result1) {
        console.log('✅ Job Card Function: SUCCESS');
    } else {
        console.error('❌ Job Card Function: FAILED');
    }

    // 2. Verify Legacy fallback
    console.log('\n--- 2. Testing Legacy Lead Notification ---');
    const result2 = await sendLeadNotification(ownerPhone, {
        businessName: 'Old School Biz',
        name: 'John Doe',
        phone: '+60111111111',
        message: 'I need help.'
    });

    if (result2) {
        console.log('✅ Legacy Notification: SUCCESS');
    } else {
        console.error('❌ Legacy Notification: FAILED');
    }

    console.log('\n--- Verification Complete ---');
}

// Execute
verifyPivot().catch(console.error);
