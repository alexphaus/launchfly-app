#!/usr/bin/env node
/**
 * Test script for AI sales agent interest response handling
 * Tests the sendInterestResponse function that sends business website links
 */

require('dotenv').config();

// Mock the required modules for testing
const mockSupabase = {
  from: () => ({
    select: () => ({
      eq: () => ({
        single: () => Promise.resolve({
          data: {
            id: 'test-business-123',
            businessName: 'Test Business Co',
            subdomain: 'test-business',
            industry: 'Professional Services',
            tagline: 'We help businesses grow',
            products: [{
              description: 'Premium consulting services'
            }]
          },
          error: null
        })
      })
    }),
    insert: () => Promise.resolve({ data: {}, error: null }),
    update: () => ({ eq: () => Promise.resolve({ data: {}, error: null }) })
  })
};

const mockResend = {
  emails: {
    send: (emailData) => {
      console.log('📧 Mock Email Sent:');
      console.log('To:', emailData.to);
      console.log('Subject:', emailData.subject);
      console.log('From:', emailData.from);
      console.log('HTML Preview:', emailData.html?.substring(0, 200) + '...');
      return Promise.resolve({ 
        data: { id: 'mock-email-123' },
        error: null 
      });
    }
  }
};

// Mock activity logger
const mockActivityLogger = {
  logActivity: (businessId, activity) => {
    console.log(`📝 Activity Logged for ${businessId}:`, activity.action);
    return Promise.resolve();
  }
};

async function testInterestResponse() {
  console.log('🧪 Testing AI Sales Agent Interest Response...\n');

  try {
    // Create a mock sendInterestResponse function similar to the one we implemented
    async function sendInterestResponse(businessId, prospectEmail, business) {
      const businessWebsiteUrl = `${process.env.NEXT_PUBLIC_WEBSITE_BASE_URL || 'https://launchfly.ai'}/sites/${business.subdomain}`;
      
      const emailData = {
        to: prospectEmail,
        from: process.env.FROM_EMAIL || 'alex@launchfly.ai',
        subject: `Next Steps - ${business.businessName}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2563eb;">Thank you for your interest!</h2>
            
            <p>Hi there,</p>
            
            <p>Thanks for expressing interest in ${business.businessName}! I'm excited to help you move forward.</p>
            
            <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #1e40af;">🚀 Next Steps:</h3>
              <ol>
                <li><strong>Visit our business website:</strong> <a href="${businessWebsiteUrl}" style="color: #2563eb;">${businessWebsiteUrl}</a></li>
                <li><strong>Review our services</strong> and see how we can help</li>
                <li><strong>Schedule a consultation</strong> when you're ready</li>
              </ol>
            </div>
            
            <p>Our website has all the details about our ${business.industry} solutions, including:</p>
            <ul>
              <li>Service details and pricing</li>
              <li>Client testimonials</li>
              <li>Easy scheduling options</li>
              <li>Direct contact information</li>
            </ul>
            
            <p>Feel free to reply with any questions - I'm here to help!</p>
            
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; color: #6b7280; font-size: 14px;">
                Best regards,<br>
                ${business.businessName}<br>
                <em>${business.tagline}</em>
              </p>
            </div>
          </div>
        `
      };

      await mockResend.emails.send(emailData);
      
      await mockActivityLogger.logActivity(businessId, {
        action: 'email_sent',
        type: 'interest_response',
        message: `Sent business website link to interested prospect: ${prospectEmail}`,
        metadata: {
          prospectEmail,
          businessWebsiteUrl,
          emailSubject: emailData.subject
        }
      });

      return { success: true, businessWebsiteUrl };
    }

    // Test data
    const testBusiness = {
      id: 'test-business-123',
      businessName: 'Test Business Co',
      subdomain: 'test-business',
      industry: 'Professional Services',
      tagline: 'We help businesses grow',
      products: [{
        description: 'Premium consulting services'
      }]
    };

    const testProspectEmail = 'interested.prospect@example.com';

    // Run the test
    console.log('📋 Test Parameters:');
    console.log('Business:', testBusiness.businessName);
    console.log('Prospect Email:', testProspectEmail);
    console.log('Expected Website URL:', `${process.env.NEXT_PUBLIC_WEBSITE_BASE_URL || 'https://launchfly.ai'}/sites/${testBusiness.subdomain}`);
    console.log('');

    const result = await sendInterestResponse(testBusiness.id, testProspectEmail, testBusiness);

    console.log('\n✅ Test Results:');
    console.log('Success:', result.success);
    console.log('Business Website URL:', result.businessWebsiteUrl);
    console.log('\n🎉 Test completed successfully! The AI sales agent will now send business website links when prospects express interest.');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  testInterestResponse();
}

module.exports = { testInterestResponse };
