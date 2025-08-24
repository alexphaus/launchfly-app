// src/app/api/central-brain/route.js
/**
 * Central AI Brain API Endpoints
 * 
 * Provides REST API access to the Central AI Brain system:
 * - Initialize and manage the brain
 * - Get system status and metrics
 * - Trigger manual optimizations
 * - Access revenue intelligence
 * - Manage business templates
 */

import { NextResponse } from 'next/server';
import { initializeCentralAIBrain, getCentralAIBrain, shutdownCentralAIBrain } from '@/lib/central-ai-brain/orchestrator';

// GET /api/central-brain - Get system status
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    switch (action) {
      case 'status':
        return await getSystemStatus();
      case 'metrics':
        return await getSystemMetrics();
      case 'intelligence':
        return await getRevenueIntelligence();
      case 'templates':
        return await getBusinessTemplates();
      default:
        return await getSystemStatus();
    }
  } catch (error) {
    console.error('Central Brain API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

// POST /api/central-brain - Control brain operations
export async function POST(request) {
  try {
    const { action, data } = await request.json();

    switch (action) {
      case 'initialize':
        return await initializeBrain();
      case 'shutdown':
        return await shutdownBrain();
      case 'optimize':
        return await triggerOptimization(data);
      case 'record_conversion':
        return await recordConversion(data);
      case 'clone_template':
        return await cloneBusinessTemplate(data);
      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Central Brain API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * Get system status
 */
async function getSystemStatus() {
  const brain = getCentralAIBrain();
  
  if (!brain) {
    return NextResponse.json({
      status: 'offline',
      message: 'Central AI Brain not initialized',
      timestamp: new Date().toISOString()
    });
  }

  const status = brain.getSystemStatus();
  
  return NextResponse.json({
    status: 'online',
    ...status,
    message: 'Central AI Brain operational'
  });
}

/**
 * Get detailed system metrics
 */
async function getSystemMetrics() {
  const brain = getCentralAIBrain();
  
  if (!brain) {
    return NextResponse.json(
      { error: 'Central AI Brain not initialized' },
      { status: 503 }
    );
  }

  // Get comprehensive metrics
  const metrics = {
    system: brain.getSystemStatus(),
    revenue: await brain.revenueAnalyzer.getRevenueIntelligence(),
    marketplace: await brain.marketplace.getMarketplaceAnalytics(),
    timestamp: new Date().toISOString()
  };

  return NextResponse.json(metrics);
}

/**
 * Get revenue intelligence data
 */
async function getRevenueIntelligence() {
  const brain = getCentralAIBrain();
  
  if (!brain) {
    return NextResponse.json(
      { error: 'Central AI Brain not initialized' },
      { status: 503 }
    );
  }

  const intelligence = await brain.revenueAnalyzer.getRevenueIntelligence();
  const topStrategies = await brain.revenueAnalyzer.getTopPerformingStrategies(10);

  return NextResponse.json({
    intelligence,
    topStrategies,
    timestamp: new Date().toISOString()
  });
}

/**
 * Get business templates
 */
async function getBusinessTemplates() {
  const brain = getCentralAIBrain();
  
  if (!brain) {
    return NextResponse.json(
      { error: 'Central AI Brain not initialized' },
      { status: 503 }
    );
  }

  const templates = await brain.marketplace.getAvailableTemplates();
  const analytics = await brain.marketplace.getMarketplaceAnalytics();

  return NextResponse.json({
    templates,
    analytics,
    timestamp: new Date().toISOString()
  });
}

/**
 * Initialize the Central AI Brain
 */
async function initializeBrain() {
  try {
    const brain = await initializeCentralAIBrain();
    const status = brain.getSystemStatus();

    return NextResponse.json({
      success: true,
      message: 'Central AI Brain initialized successfully',
      status,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to initialize Central AI Brain',
        details: error.message 
      },
      { status: 500 }
    );
  }
}

/**
 * Shutdown the Central AI Brain
 */
async function shutdownBrain() {
  try {
    await shutdownCentralAIBrain();

    return NextResponse.json({
      success: true,
      message: 'Central AI Brain shutdown successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to shutdown Central AI Brain',
        details: error.message 
      },
      { status: 500 }
    );
  }
}

/**
 * Trigger manual optimization
 */
async function triggerOptimization(data) {
  const brain = getCentralAIBrain();
  
  if (!brain) {
    return NextResponse.json(
      { error: 'Central AI Brain not initialized' },
      { status: 503 }
    );
  }

  const { businessId, optimizationType } = data;

  if (!businessId) {
    return NextResponse.json(
      { error: 'Business ID required' },
      { status: 400 }
    );
  }

  try {
    let result;
    
    switch (optimizationType) {
      case 'emergency':
        result = await brain.triggerEmergencyOptimization({ id: businessId });
        break;
      case 'conversion':
        result = await brain.triggerConversionOptimization({ id: businessId });
        break;
      case 'first_sale':
        result = await brain.triggerFirstSaleAcceleration({ id: businessId });
        break;
      default:
        // Trigger general optimization
        result = await brain.coordinateSystemOptimizations();
    }

    return NextResponse.json({
      success: true,
      message: `${optimizationType || 'general'} optimization triggered`,
      businessId,
      result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return NextResponse.json(
      { 
        success: false, 
        error: 'Optimization failed',
        details: error.message 
      },
      { status: 500 }
    );
  }
}

/**
 * Record conversion for Revenue Graph
 */
async function recordConversion(data) {
  const brain = getCentralAIBrain();
  
  if (!brain) {
    return NextResponse.json(
      { error: 'Central AI Brain not initialized' },
      { status: 503 }
    );
  }

  const {
    businessId,
    businessType,
    industry,
    offerType,
    channel,
    messageTemplate,
    timing,
    conversionValue,
    customerData,
    campaignData
  } = data;

  // Validate required fields
  if (!businessId || !businessType || !industry || !offerType || !channel) {
    return NextResponse.json(
      { error: 'Missing required conversion data' },
      { status: 400 }
    );
  }

  try {
    const result = await brain.revenueAnalyzer.recordConversion({
      businessId,
      businessType,
      industry,
      offerType,
      channel,
      messageTemplate,
      timing,
      conversionValue,
      customerData,
      campaignData
    });

    return NextResponse.json({
      success: true,
      message: 'Conversion recorded in Revenue Graph',
      conversionId: result?.id,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to record conversion',
        details: error.message 
      },
      { status: 500 }
    );
  }
}

/**
 * Clone business template
 */
async function cloneBusinessTemplate(data) {
  const brain = getCentralAIBrain();
  
  if (!brain) {
    return NextResponse.json(
      { error: 'Central AI Brain not initialized' },
      { status: 503 }
    );
  }

  const { templateId, userId, customizations } = data;

  if (!templateId || !userId) {
    return NextResponse.json(
      { error: 'Template ID and User ID required' },
      { status: 400 }
    );
  }

  try {
    const newBusiness = await brain.marketplace.cloneTemplate(
      templateId,
      userId,
      customizations
    );

    return NextResponse.json({
      success: true,
      message: 'Business template cloned successfully',
      business: newBusiness,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to clone template',
        details: error.message 
      },
      { status: 500 }
    );
  }
}
