import { analyzeOpportunity, launchBusiness } from '@/core';

export async function POST(request) {
  try {
    console.log('=== STARTING MINIMAL TEST ===');
    
    const testData = {
      name: 'Test User',
      skills: 'Web development and marketing',
      businessType: 'Digital Services',
      goal: 'Make $5000/month',
      preferences: 'Online business'
    };
    
    const testSessionId = `test-${Date.now()}`;
    const testBusinessId = `test-business-${Date.now()}`;
    
    console.log('=== TESTING ANALYZE OPPORTUNITY ===');
    const opportunity = await analyzeOpportunity(testData, testSessionId);
    console.log('Opportunity analysis completed:', {
      businessName: opportunity?.businessName,
      niche: opportunity?.niche,
      confidence: opportunity?.confidence
    });
    
    console.log('=== TESTING LAUNCH BUSINESS ===');
    const businessData = await launchBusiness(opportunity, testSessionId, testBusinessId);
    console.log('Business launch completed:', {
      businessName: businessData?.businessName,
      domain: businessData?.domain,
      productsCount: businessData?.products?.length
    });
    
    console.log('=== TEST COMPLETED SUCCESSFULLY ===');
    
    return Response.json({ 
      success: true,
      opportunity: {
        businessName: opportunity?.businessName,
        niche: opportunity?.niche,
        confidence: opportunity?.confidence
      },
      businessData: {
        businessName: businessData?.businessName,
        domain: businessData?.domain,
        productsCount: businessData?.products?.length,
        hasTheme: !!businessData?.theme,
        hasLayout: !!businessData?.layout,
        hasMarketing: !!businessData?.marketing
      }
    });
    
  } catch (error) {
    console.error('=== TEST FAILED ===');
    console.error('Error:', error.message);
    console.error('Type:', error.constructor.name);
    console.error('Code:', error.code);
    console.error('Stack:', error.stack);
    
    return Response.json({ 
      success: false, 
      error: error.message,
      type: error.constructor.name,
      code: error.code
    }, { status: 500 });
  }
}

export const runtime = 'nodejs';
export const maxDuration = 60;
