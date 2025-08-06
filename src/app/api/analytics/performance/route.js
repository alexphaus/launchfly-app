/**
 * @fileoverview Analytics performance API
 * Provides performance metrics and optimization insights
 */

import { NextRequest, NextResponse } from 'next/server';
import { PostHog } from 'posthog-node';
import { checkRateLimit } from '../../../../lib/ai-sales/rate-limiter';
import { generateAnalyticsReport, calculateConversionRate, calculateAOV } from '../../../../lib/analytics/ai-events';

// Initialize PostHog for server-side analytics
const posthog = process.env.POSTHOG_PROJECT_API_KEY 
  ? new PostHog(process.env.POSTHOG_PROJECT_API_KEY, {
      host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://app.posthog.com'
    })
  : null;

export const runtime = 'nodejs';

/**
 * GET /api/analytics/performance
 * Get performance metrics for AI sales agent
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get('businessId');
    const timeRange = searchParams.get('timeRange') || '7d';
    const metrics = searchParams.get('metrics')?.split(',') || ['all'];
    
    if (!businessId) {
      return NextResponse.json(
        { error: 'Missing businessId parameter' },
        { status: 400 }
      );
    }
    
    // Get performance data
    const performanceData = await getPerformanceMetrics(businessId, timeRange, metrics);
    
    return NextResponse.json(performanceData);
    
  } catch (error) {
    console.error('Performance API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch performance data' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/analytics/performance
 * Update performance metrics
 */
export async function POST(request) {
  try {
    const rateLimitResult = await checkRateLimit(request);
    if (rateLimitResult) {
      return NextResponse.json(rateLimitResult, { status: 429 });
    }
    
    const { businessId, metrics, timeRange } = await request.json();
    
    if (!businessId || !metrics) {
      return NextResponse.json(
        { error: 'Missing required fields: businessId, metrics' },
        { status: 400 }
      );
    }
    
    // Store metrics
    const result = await storePerformanceMetrics(businessId, metrics, timeRange);
    
    return NextResponse.json({
      success: true,
      stored: result,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Performance POST error:', error);
    return NextResponse.json(
      { error: 'Failed to store performance metrics' },
      { status: 500 }
    );
  }
}

/**
 * Get performance metrics for business
 * @param {string} businessId - Business ID
 * @param {string} timeRange - Time range (1d, 7d, 30d)
 * @param {Array} requestedMetrics - Requested metrics
 * @returns {Object} Performance data
 */
async function getPerformanceMetrics(businessId, timeRange, requestedMetrics) {
  const endDate = new Date();
  const startDate = new Date();
  
  // Calculate start date based on time range
  switch (timeRange) {
    case '1d':
      startDate.setDate(endDate.getDate() - 1);
      break;
    case '7d':
      startDate.setDate(endDate.getDate() - 7);
      break;
    case '30d':
      startDate.setDate(endDate.getDate() - 30);
      break;
    default:
      startDate.setDate(endDate.getDate() - 7);
  }
  
  // In production, this would query PostHog or your analytics database
  // For demo, return mock data with realistic patterns
  const mockData = generateMockPerformanceData(businessId, timeRange);
  
  // Filter requested metrics
  if (!requestedMetrics.includes('all')) {
    const filteredData = { ...mockData };
    filteredData.metrics = {};
    requestedMetrics.forEach(metric => {
      if (mockData.metrics[metric]) {
        filteredData.metrics[metric] = mockData.metrics[metric];
      }
    });
    return filteredData;
  }
  
  return mockData;
}

/**
 * Store performance metrics
 * @param {string} businessId - Business ID
 * @param {Object} metrics - Metrics to store
 * @param {string} timeRange - Time range
 * @returns {Object} Storage result
 */
async function storePerformanceMetrics(businessId, metrics, timeRange) {
  // In production, store in database or send to PostHog
  console.log('Storing performance metrics:', { businessId, metrics, timeRange });
  
  // Example PostHog integration:
  // if (posthog) {
  //   posthog.capture({
  //     distinctId: businessId,
  //     event: 'ai_performance_update',
  //     properties: {
  //       businessId,
  //       metrics,
  //       timeRange,
  //       timestamp: Date.now()
  //     }
  //   });
  // }
  
  return {
    businessId,
    metricsStored: Object.keys(metrics).length,
    timestamp: Date.now()
  };
}

/**
 * Generate mock performance data for demo
 * @param {string} businessId - Business ID
 * @param {string} timeRange - Time range
 * @returns {Object} Mock performance data
 */
function generateMockPerformanceData(businessId, timeRange) {
  const baseMetrics = {
    // Engagement metrics
    totalVisitors: Math.floor(Math.random() * 1000) + 500,
    chatOpenRate: Math.round((Math.random() * 0.3 + 0.15) * 100) / 100, // 15-45%
    responseRate: Math.round((Math.random() * 0.4 + 0.6) * 100) / 100, // 60-100%
    avgSessionDuration: Math.floor(Math.random() * 300) + 120, // 2-7 minutes
    messagesPerSession: Math.round((Math.random() * 8 + 3) * 10) / 10, // 3-11 messages
    
    // Conversion metrics
    chatToLeadRate: Math.round((Math.random() * 0.4 + 0.1) * 100) / 100, // 10-50%
    chatToSaleRate: Math.round((Math.random() * 0.1 + 0.02) * 100) / 100, // 2-12%
    averageOrderValue: Math.round((Math.random() * 500 + 150) * 100) / 100, // $150-650
    revenuePerVisitor: Math.round((Math.random() * 50 + 10) * 100) / 100, // $10-60
    
    // AI performance metrics
    aiResponseTime: Math.round((Math.random() * 2000 + 500) * 10) / 10, // 0.5-2.5s
    aiAccuracyRate: Math.round((Math.random() * 0.2 + 0.8) * 100) / 100, // 80-100%
    functionCallSuccessRate: Math.round((Math.random() * 0.1 + 0.9) * 100) / 100, // 90-100%
    errorRate: Math.round((Math.random() * 0.05) * 100) / 100, // 0-5%
    
    // User experience metrics
    userSatisfaction: Math.round((Math.random() * 1.5 + 3.5) * 10) / 10, // 3.5-5.0
    chatCompletionRate: Math.round((Math.random() * 0.3 + 0.6) * 100) / 100, // 60-90%
    bounceRate: Math.round((Math.random() * 0.4 + 0.2) * 100) / 100, // 20-60%
    timeToConversion: Math.floor(Math.random() * 1800) + 300 // 5-35 minutes
  };
  
  // Calculate derived metrics
  const totalConversions = Math.floor(baseMetrics.totalVisitors * baseMetrics.chatToSaleRate);
  const totalRevenue = totalConversions * baseMetrics.averageOrderValue;
  
  // Generate time series data
  const timeSeriesData = generateTimeSeriesData(timeRange, baseMetrics);
  
  // Generate experiment results
  const experimentResults = generateExperimentResults();
  
  return {
    businessId,
    timeRange,
    period: {
      start: new Date(Date.now() - getTimeRangeMs(timeRange)).toISOString(),
      end: new Date().toISOString()
    },
    summary: {
      totalVisitors: baseMetrics.totalVisitors,
      totalConversions,
      totalRevenue,
      conversionRate: baseMetrics.chatToSaleRate,
      averageOrderValue: baseMetrics.averageOrderValue
    },
    metrics: baseMetrics,
    timeSeries: timeSeriesData,
    experiments: experimentResults,
    insights: generateInsights(baseMetrics),
    recommendations: generateRecommendations(baseMetrics),
    lastUpdated: new Date().toISOString()
  };
}

/**
 * Generate time series data
 * @param {string} timeRange - Time range
 * @param {Object} baseMetrics - Base metrics
 * @returns {Array} Time series data
 */
function generateTimeSeriesData(timeRange, baseMetrics) {
  const points = timeRange === '1d' ? 24 : timeRange === '7d' ? 7 : 30;
  const data = [];
  
  for (let i = 0; i < points; i++) {
    const variance = 0.8 + Math.random() * 0.4; // ±20% variance
    data.push({
      timestamp: new Date(Date.now() - getTimeRangeMs(timeRange) + (i * getTimeRangeMs(timeRange) / points)).toISOString(),
      visitors: Math.floor(baseMetrics.totalVisitors / points * variance),
      conversions: Math.floor(baseMetrics.totalVisitors * baseMetrics.chatToSaleRate / points * variance),
      revenue: Math.floor(baseMetrics.totalVisitors * baseMetrics.chatToSaleRate * baseMetrics.averageOrderValue / points * variance),
      chatOpens: Math.floor(baseMetrics.totalVisitors * baseMetrics.chatOpenRate / points * variance),
      intentScore: Math.round((Math.random() * 40 + 30) * 10) / 10 // 30-70
    });
  }
  
  return data;
}

/**
 * Generate experiment results
 * @returns {Object} Experiment results
 */
function generateExperimentResults() {
  return {
    chatOpener: {
      status: 'running',
      variants: [
        { id: 'control', participants: 234, conversions: 12, conversionRate: 5.1 },
        { id: 'personalized', participants: 198, conversions: 15, conversionRate: 7.6 },
        { id: 'urgent', participants: 187, conversions: 8, conversionRate: 4.3 }
      ],
      winner: 'personalized',
      confidence: 95,
      lift: 49
    },
    discountStrategy: {
      status: 'completed',
      variants: [
        { id: 'immediate', participants: 312, conversions: 18, conversionRate: 5.8 },
        { id: 'earned', participants: 298, conversions: 24, conversionRate: 8.1 },
        { id: 'exit_intent', participants: 301, conversions: 21, conversionRate: 7.0 }
      ],
      winner: 'earned',
      confidence: 98,
      lift: 40
    }
  };
}

/**
 * Generate insights based on metrics
 * @param {Object} metrics - Performance metrics
 * @returns {Array} Insights
 */
function generateInsights(metrics) {
  const insights = [];
  
  if (metrics.chatOpenRate < 0.2) {
    insights.push({
      type: 'warning',
      title: 'Low Chat Open Rate',
      message: 'Consider lowering your intent threshold or adjusting trigger timing.',
      impact: 'medium',
      action: 'Reduce intent threshold from current setting'
    });
  }
  
  if (metrics.chatToSaleRate > 0.08) {
    insights.push({
      type: 'success',
      title: 'High Conversion Rate',
      message: 'Your AI agent is performing excellently! Chat-to-sale rate is above average.',
      impact: 'high',
      action: 'Consider increasing traffic or scaling successful strategies'
    });
  }
  
  if (metrics.aiResponseTime > 2000) {
    insights.push({
      type: 'warning',
      title: 'Slow AI Response Time',
      message: 'Response times above 2 seconds may impact user experience.',
      impact: 'medium',
      action: 'Optimize AI prompts or upgrade infrastructure'
    });
  }
  
  if (metrics.userSatisfaction >= 4.5) {
    insights.push({
      type: 'success',
      title: 'Excellent User Satisfaction',
      message: 'Users are very satisfied with their AI chat experience.',
      impact: 'high',
      action: 'Maintain current approach and consider case studies'
    });
  }
  
  return insights;
}

/**
 * Generate recommendations
 * @param {Object} metrics - Performance metrics
 * @returns {Array} Recommendations
 */
function generateRecommendations(metrics) {
  const recommendations = [];
  
  recommendations.push({
    priority: 'high',
    category: 'conversion',
    title: 'Optimize Intent Threshold',
    description: `Your current chat open rate suggests adjusting the intent threshold could improve performance.`,
    expectedImpact: '+15% more chat opens',
    effort: 'low',
    implementation: 'Reduce intent threshold by 10-15 points in configuration'
  });
  
  recommendations.push({
    priority: 'medium',
    category: 'ai_performance',
    title: 'A/B Test Message Templates',
    description: 'Test different greeting messages and objection handlers to improve engagement.',
    expectedImpact: '+8% conversion rate',
    effort: 'medium',
    implementation: 'Create variants in the configuration panel'
  });
  
  recommendations.push({
    priority: 'medium',
    category: 'user_experience',
    title: 'Implement Fallback Flows',
    description: 'Add human handoff for complex queries to maintain satisfaction.',
    expectedImpact: '+0.3 satisfaction score',
    effort: 'high',
    implementation: 'Configure human handoff rules in advanced settings'
  });
  
  return recommendations;
}

/**
 * Get time range in milliseconds
 * @param {string} timeRange - Time range string
 * @returns {number} Milliseconds
 */
function getTimeRangeMs(timeRange) {
  switch (timeRange) {
    case '1d': return 24 * 60 * 60 * 1000;
    case '7d': return 7 * 24 * 60 * 60 * 1000;
    case '30d': return 30 * 24 * 60 * 60 * 1000;
    default: return 7 * 24 * 60 * 60 * 1000;
  }
}