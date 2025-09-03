/**
 * Revenue Analytics API
 * Provides comprehensive revenue metrics and insights
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/**
 * GET - Retrieve revenue analytics for a business
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get('businessId');
    const period = searchParams.get('period') || '30'; // days
    const metric = searchParams.get('metric'); // specific metric if requested
    
    if (!businessId) {
      return NextResponse.json(
        { error: 'Business ID is required' },
        { status: 400 }
      );
    }
    
    // Calculate date range
    const endDate = new Date();
    const startDate = new Date(Date.now() - parseInt(period) * 24 * 60 * 60 * 1000);
    
    // If specific metric requested
    if (metric) {
      const data = await getSpecificMetric(businessId, metric, startDate, endDate);
      return NextResponse.json({
        success: true,
        metric: metric,
        data: data
      });
    }
    
    // Get comprehensive analytics
    const analytics = await getComprehensiveAnalytics(businessId, startDate, endDate);
    
    return NextResponse.json({
      success: true,
      businessId: businessId,
      period: `${period} days`,
      analytics: analytics
    });
    
  } catch (error) {
    console.error('Failed to get analytics:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve analytics', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * Get comprehensive analytics
 */
async function getComprehensiveAnalytics(businessId, startDate, endDate) {
  // Get revenue data
  const revenue = await getRevenueMetrics(businessId, startDate, endDate);
  
  // Get order data
  const orders = await getOrderMetrics(businessId, startDate, endDate);
  
  // Get customer data
  const customers = await getCustomerMetrics(businessId, startDate, endDate);
  
  // Get conversion data
  const conversions = await getConversionMetrics(businessId, startDate, endDate);
  
  // Get product performance
  const products = await getProductPerformance(businessId, startDate, endDate);
  
  // Get channel performance
  const channels = await getChannelPerformance(businessId, startDate, endDate);
  
  // Get projections
  const projections = await getProjections(businessId, revenue.current);
  
  // Calculate growth rates
  const growth = calculateGrowthRates(revenue, orders, customers);
  
  return {
    summary: {
      totalRevenue: revenue.total,
      totalOrders: orders.total,
      totalCustomers: customers.total,
      averageOrderValue: orders.averageValue,
      conversionRate: conversions.overallRate,
      period: {
        start: startDate.toISOString(),
        end: endDate.toISOString()
      }
    },
    revenue: revenue,
    orders: orders,
    customers: customers,
    conversions: conversions,
    products: products,
    channels: channels,
    growth: growth,
    projections: projections
  };
}

/**
 * Get revenue metrics
 */
async function getRevenueMetrics(businessId, startDate, endDate) {
  // Get revenue transactions
  const { data: transactions } = await supabase
    .from('revenue_transactions')
    .select('*')
    .eq('business_id', businessId)
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString())
    .order('created_at', { ascending: true });
  
  // Calculate metrics
  const total = transactions?.reduce((sum, t) => sum + parseFloat(t.amount), 0) || 0;
  const fees = transactions?.reduce((sum, t) => sum + parseFloat(t.fee || 0), 0) || 0;
  const net = total - fees;
  
  // Group by day
  const dailyRevenue = {};
  transactions?.forEach(t => {
    const date = new Date(t.created_at).toISOString().split('T')[0];
    if (!dailyRevenue[date]) {
      dailyRevenue[date] = 0;
    }
    dailyRevenue[date] += parseFloat(t.amount);
  });
  
  // Calculate recurring vs one-time
  const { data: subscriptions } = await supabase
    .from('subscriptions')
    .select('plan_id, subscription_plans(monthly_price)')
    .eq('business_id', businessId)
    .eq('status', 'active');
  
  const recurringMonthly = subscriptions?.reduce((sum, s) => {
    return sum + (s.subscription_plans?.monthly_price || 0);
  }, 0) || 0;
  
  // Get revenue by stream
  const { data: streams } = await supabase
    .from('revenue_streams')
    .select('type, actual_revenue')
    .eq('business_id', businessId);
  
  const byStream = {};
  streams?.forEach(s => {
    byStream[s.type] = s.actual_revenue || 0;
  });
  
  return {
    total: total,
    net: net,
    fees: fees,
    recurring: recurringMonthly * (parseInt((endDate - startDate) / (1000 * 60 * 60 * 24)) / 30),
    oneTime: total - (recurringMonthly * (parseInt((endDate - startDate) / (1000 * 60 * 60 * 24)) / 30)),
    daily: dailyRevenue,
    byStream: byStream,
    current: total,
    averageDaily: total / Math.max(1, Object.keys(dailyRevenue).length)
  };
}

/**
 * Get order metrics
 */
async function getOrderMetrics(businessId, startDate, endDate) {
  const { data: orders } = await supabase
    .from('orders')
    .select('*')
    .eq('business_id', businessId)
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString());
  
  const total = orders?.length || 0;
  const completed = orders?.filter(o => o.payment_status === 'completed').length || 0;
  const totalValue = orders?.reduce((sum, o) => sum + parseFloat(o.total), 0) || 0;
  const averageValue = total > 0 ? totalValue / total : 0;
  
  // Group by status
  const byStatus = {};
  orders?.forEach(o => {
    if (!byStatus[o.payment_status]) {
      byStatus[o.payment_status] = 0;
    }
    byStatus[o.payment_status]++;
  });
  
  // Group by product type
  const byType = {};
  orders?.forEach(o => {
    if (!byType[o.product_type]) {
      byType[o.product_type] = 0;
    }
    byType[o.product_type]++;
  });
  
  // Calculate fulfillment metrics
  const fulfilled = orders?.filter(o => o.fulfillment_status === 'completed').length || 0;
  const avgFulfillmentTime = orders
    ?.filter(o => o.fulfilled_at)
    .reduce((sum, o) => {
      const time = new Date(o.fulfilled_at) - new Date(o.created_at);
      return sum + time;
    }, 0) || 0;
  
  return {
    total: total,
    completed: completed,
    totalValue: totalValue,
    averageValue: averageValue,
    byStatus: byStatus,
    byType: byType,
    fulfillmentRate: total > 0 ? fulfilled / total : 0,
    averageFulfillmentTime: avgFulfillmentTime > 0 ? avgFulfillmentTime / fulfilled / (1000 * 60 * 60) : 0 // hours
  };
}

/**
 * Get customer metrics
 */
async function getCustomerMetrics(businessId, startDate, endDate) {
  // Get unique customers from orders
  const { data: orders } = await supabase
    .from('orders')
    .select('customer_email, total')
    .eq('business_id', businessId)
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString());
  
  const customerMap = {};
  orders?.forEach(o => {
    if (!customerMap[o.customer_email]) {
      customerMap[o.customer_email] = {
        orders: 0,
        totalSpent: 0
      };
    }
    customerMap[o.customer_email].orders++;
    customerMap[o.customer_email].totalSpent += parseFloat(o.total);
  });
  
  const customers = Object.values(customerMap);
  const total = customers.length;
  const repeatCustomers = customers.filter(c => c.orders > 1).length;
  const averageLifetimeValue = customers.reduce((sum, c) => sum + c.totalSpent, 0) / Math.max(1, total);
  
  // Get new vs returning
  const { data: allTimeOrders } = await supabase
    .from('orders')
    .select('customer_email')
    .eq('business_id', businessId)
    .lt('created_at', startDate.toISOString());
  
  const previousCustomers = new Set(allTimeOrders?.map(o => o.customer_email) || []);
  const newCustomers = customers.filter(c => !previousCustomers.has(c.email)).length;
  const returningCustomers = total - newCustomers;
  
  return {
    total: total,
    new: newCustomers,
    returning: returningCustomers,
    repeatRate: total > 0 ? repeatCustomers / total : 0,
    averageLifetimeValue: averageLifetimeValue,
    averageOrdersPerCustomer: orders?.length / Math.max(1, total),
    topCustomers: Object.entries(customerMap)
      .sort((a, b) => b[1].totalSpent - a[1].totalSpent)
      .slice(0, 5)
      .map(([email, data]) => ({
        email: email,
        orders: data.orders,
        totalSpent: data.totalSpent
      }))
  };
}

/**
 * Get conversion metrics
 */
async function getConversionMetrics(businessId, startDate, endDate) {
  const { data: metrics } = await supabase
    .from('conversion_metrics')
    .select('*')
    .eq('business_id', businessId)
    .gte('date', startDate.toISOString().split('T')[0])
    .lte('date', endDate.toISOString().split('T')[0]);
  
  if (!metrics || metrics.length === 0) {
    return {
      overallRate: 0,
      cartAbandonmentRate: 0,
      checkoutCompletionRate: 0,
      averageTimeToConvert: 0
    };
  }
  
  const totalVisitors = metrics.reduce((sum, m) => sum + m.visitors, 0);
  const totalPurchases = metrics.reduce((sum, m) => sum + m.purchases, 0);
  const totalCarts = metrics.reduce((sum, m) => sum + m.add_to_carts, 0);
  const totalCheckouts = metrics.reduce((sum, m) => sum + m.checkouts_initiated, 0);
  
  return {
    overallRate: totalVisitors > 0 ? totalPurchases / totalVisitors : 0,
    cartAbandonmentRate: totalCarts > 0 ? 1 - (totalPurchases / totalCarts) : 0,
    checkoutCompletionRate: totalCheckouts > 0 ? totalPurchases / totalCheckouts : 0,
    funnel: {
      visitors: totalVisitors,
      addedToCart: totalCarts,
      initiatedCheckout: totalCheckouts,
      purchased: totalPurchases
    },
    daily: metrics.map(m => ({
      date: m.date,
      conversionRate: m.conversion_rate,
      aov: m.average_order_value
    }))
  };
}

/**
 * Get product performance
 */
async function getProductPerformance(businessId, startDate, endDate) {
  const { data: orders } = await supabase
    .from('orders')
    .select('product_id, product_name, total')
    .eq('business_id', businessId)
    .eq('payment_status', 'completed')
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString());
  
  const productMap = {};
  orders?.forEach(o => {
    if (!o.product_id) return;
    
    if (!productMap[o.product_id]) {
      productMap[o.product_id] = {
        name: o.product_name,
        orders: 0,
        revenue: 0
      };
    }
    productMap[o.product_id].orders++;
    productMap[o.product_id].revenue += parseFloat(o.total);
  });
  
  const products = Object.entries(productMap)
    .map(([id, data]) => ({
      id: id,
      name: data.name,
      orders: data.orders,
      revenue: data.revenue
    }))
    .sort((a, b) => b.revenue - a.revenue);
  
  return {
    topProducts: products.slice(0, 10),
    totalProducts: products.length,
    bestSeller: products[0] || null,
    worstPerformer: products[products.length - 1] || null
  };
}

/**
 * Get channel performance
 */
async function getChannelPerformance(businessId, startDate, endDate) {
  // Get revenue by source/channel
  const { data: transactions } = await supabase
    .from('revenue_transactions')
    .select('source, amount')
    .eq('business_id', businessId)
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString());
  
  const channelMap = {};
  transactions?.forEach(t => {
    if (!channelMap[t.source]) {
      channelMap[t.source] = {
        transactions: 0,
        revenue: 0
      };
    }
    channelMap[t.source].transactions++;
    channelMap[t.source].revenue += parseFloat(t.amount);
  });
  
  // Get marketing channel data
  const { data: marketplaces } = await supabase
    .from('marketplace_listings')
    .select('marketplace, metrics')
    .eq('business_id', businessId)
    .eq('status', 'posted');
  
  return {
    bySource: channelMap,
    marketplaces: marketplaces?.map(m => ({
      marketplace: m.marketplace,
      performance: m.metrics || {}
    })) || [],
    topChannel: Object.entries(channelMap)
      .sort((a, b) => b[1].revenue - a[1].revenue)[0] || null
  };
}

/**
 * Get projections
 */
async function getProjections(businessId, currentRevenue) {
  // Simple linear projection - would use ML in production
  const dailyRate = currentRevenue / 30;
  
  const projections = {
    nextWeek: dailyRate * 7,
    nextMonth: dailyRate * 30,
    nextQuarter: dailyRate * 90,
    nextYear: dailyRate * 365,
    growthScenarios: {
      conservative: {
        monthly: dailyRate * 30,
        growth: 0.1
      },
      moderate: {
        monthly: dailyRate * 30 * 1.25,
        growth: 0.25
      },
      aggressive: {
        monthly: dailyRate * 30 * 1.5,
        growth: 0.5
      }
    }
  };
  
  // Get AI predictions if available
  const { data: predictions } = await supabase
    .from('business_success_predictions')
    .select('*')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  
  if (predictions) {
    projections.aiPrediction = {
      revenue: predictions.projected_revenue,
      timeframe: predictions.projected_timeframe_days,
      confidence: predictions.confidence_level,
      probability: predictions.success_probability
    };
  }
  
  return projections;
}

/**
 * Calculate growth rates
 */
function calculateGrowthRates(revenue, orders, customers) {
  // Would compare with previous period in production
  const growth = {
    revenue: {
      value: 0,
      trend: 'stable'
    },
    orders: {
      value: 0,
      trend: 'stable'
    },
    customers: {
      value: 0,
      trend: 'stable'
    },
    momentum: 'building'
  };
  
  // Simple trend analysis based on daily data
  if (revenue.daily && Object.keys(revenue.daily).length > 7) {
    const dates = Object.keys(revenue.daily).sort();
    const firstWeek = dates.slice(0, 7).reduce((sum, d) => sum + revenue.daily[d], 0);
    const lastWeek = dates.slice(-7).reduce((sum, d) => sum + revenue.daily[d], 0);
    
    if (firstWeek > 0) {
      growth.revenue.value = ((lastWeek - firstWeek) / firstWeek) * 100;
      growth.revenue.trend = growth.revenue.value > 10 ? 'growing' : 
                              growth.revenue.value < -10 ? 'declining' : 'stable';
    }
  }
  
  return growth;
}

/**
 * Get specific metric
 */
async function getSpecificMetric(businessId, metric, startDate, endDate) {
  switch(metric) {
    case 'revenue':
      return await getRevenueMetrics(businessId, startDate, endDate);
    case 'orders':
      return await getOrderMetrics(businessId, startDate, endDate);
    case 'customers':
      return await getCustomerMetrics(businessId, startDate, endDate);
    case 'conversions':
      return await getConversionMetrics(businessId, startDate, endDate);
    case 'products':
      return await getProductPerformance(businessId, startDate, endDate);
    case 'channels':
      return await getChannelPerformance(businessId, startDate, endDate);
    default:
      throw new Error(`Unknown metric: ${metric}`);
  }
}

/**
 * POST - Track analytics event
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { businessId, event, data } = body;
    
    if (!businessId || !event) {
      return NextResponse.json(
        { error: 'Business ID and event are required' },
        { status: 400 }
      );
    }
    
    // Track the event
    await trackAnalyticsEvent(businessId, event, data);
    
    return NextResponse.json({
      success: true,
      message: 'Event tracked successfully'
    });
    
  } catch (error) {
    console.error('Failed to track event:', error);
    return NextResponse.json(
      { error: 'Failed to track event' },
      { status: 500 }
    );
  }
}

/**
 * Track analytics event
 */
async function trackAnalyticsEvent(businessId, event, data) {
  const today = new Date().toISOString().split('T')[0];
  
  // Update conversion metrics based on event
  switch(event) {
    case 'page_view':
      await supabase.rpc('increment_metric', {
        p_business_id: businessId,
        p_date: today,
        p_metric: 'page_views',
        p_value: 1
      });
      break;
      
    case 'visitor':
      await supabase.rpc('increment_metric', {
        p_business_id: businessId,
        p_date: today,
        p_metric: 'visitors',
        p_value: 1
      });
      break;
      
    case 'add_to_cart':
      await supabase.rpc('increment_metric', {
        p_business_id: businessId,
        p_date: today,
        p_metric: 'add_to_carts',
        p_value: 1
      });
      break;
      
    case 'checkout_initiated':
      await supabase.rpc('increment_metric', {
        p_business_id: businessId,
        p_date: today,
        p_metric: 'checkouts_initiated',
        p_value: 1
      });
      break;
      
    case 'purchase':
      await supabase.rpc('increment_metric', {
        p_business_id: businessId,
        p_date: today,
        p_metric: 'purchases',
        p_value: 1
      });
      
      if (data?.amount) {
        await supabase.rpc('increment_metric', {
          p_business_id: businessId,
          p_date: today,
          p_metric: 'revenue',
          p_value: data.amount
        });
      }
      break;
  }
  
  // Log the event
  await supabase
    .from('events')
    .insert({
      business_id: businessId,
      type: `analytics_${event}`,
      data: data,
      created_at: new Date().toISOString()
    });
}
