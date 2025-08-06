/**
 * @fileoverview Intent detection API endpoint
 * Tracks visitor behavior and calculates intent scores
 */

import { NextRequest, NextResponse } from 'next/server';
import { calculateIntentScore, determineStage } from '../../../../lib/ai-sales/chat-engine';

export const runtime = 'edge';

/**
 * POST /api/ai-sales/intent
 * Update visitor intent based on behavior signals
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { 
      visitorId, 
      sessionId, 
      signals, 
      businessId 
    } = body;

    // Validate required fields
    if (!visitorId || !sessionId || !signals) {
      return NextResponse.json(
        { error: 'Missing required fields: visitorId, sessionId, signals' },
        { status: 400 }
      );
    }

    // Calculate intent score
    const intentScore = calculateIntentScore(signals);
    
    // Determine conversation stage
    const stage = determineStage(intentScore, signals);
    
    // Determine if chat should trigger
    const shouldTriggerChat = shouldShowChat(intentScore, signals);
    
    // Store intent data (in production, save to database)
    const intentData = {
      visitorId,
      sessionId,
      businessId,
      signals,
      intentScore,
      stage,
      shouldTriggerChat,
      timestamp: Date.now()
    };

    // Return intent analysis
    return NextResponse.json({
      intentScore,
      stage,
      shouldTriggerChat,
      recommendations: generateRecommendations(intentScore, signals),
      metadata: {
        timestamp: Date.now(),
        version: '1.0'
      }
    });

  } catch (error) {
    console.error('Intent API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/ai-sales/intent
 * Get current intent score for a visitor
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const visitorId = searchParams.get('visitorId');
  const sessionId = searchParams.get('sessionId');
  
  if (!visitorId || !sessionId) {
    return NextResponse.json(
      { error: 'Missing visitorId or sessionId parameter' },
      { status: 400 }
    );
  }

  // In production, fetch from database
  // For demo, return default data
  return NextResponse.json({
    visitorId,
    sessionId,
    intentScore: 45,
    stage: 'awareness',
    shouldTriggerChat: false,
    lastUpdate: Date.now()
  });
}

/**
 * Determine if chat should be shown based on intent
 * @param {number} intentScore - Current intent score
 * @param {Object} signals - Visitor behavior signals
 * @returns {boolean} Whether to show chat
 */
function shouldShowChat(intentScore, signals) {
  // Trigger conditions
  if (signals.exitIntent) return true;
  if (intentScore > 70) return true;
  if (signals.pricingViews > 2) return true;
  if (signals.ctaHovers > 3) return true;
  if (signals.timeOnPage > 120 && intentScore > 40) return true;
  
  return false;
}

/**
 * Generate recommendations based on intent analysis
 * @param {number} intentScore - Intent score
 * @param {Object} signals - Visitor signals
 * @returns {Object[]} Recommendations
 */
function generateRecommendations(intentScore, signals) {
  const recommendations = [];
  
  if (signals.exitIntent) {
    recommendations.push({
      type: 'urgent',
      action: 'exit_intent_popup',
      message: 'Show exit intent offer',
      priority: 'high'
    });
  }
  
  if (signals.pricingViews > 1 && intentScore > 60) {
    recommendations.push({
      type: 'sales',
      action: 'price_assistance',
      message: 'Offer pricing help via chat',
      priority: 'high'
    });
  }
  
  if (signals.timeOnPage > 60 && signals.scrollDepth > 50) {
    recommendations.push({
      type: 'engagement',
      action: 'proactive_chat',
      message: 'Start proactive conversation',
      priority: 'medium'
    });
  }
  
  if (signals.ctaHovers > 2 && intentScore < 50) {
    recommendations.push({
      type: 'optimization',
      action: 'cta_optimization',
      message: 'Consider CTA placement or messaging',
      priority: 'low'
    });
  }
  
  return recommendations;
}