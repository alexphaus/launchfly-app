// src/app/api/analytics/performance/route.js
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export async function POST(request) {
  try {
    const data = await request.json();
    
    // Validate required fields
    if (!data.metric || typeof data.value === 'undefined') {
      return NextResponse.json(
        { error: 'Missing required fields: metric, value' },
        { status: 400 }
      );
    }

    // Prepare performance data for storage
    const performanceData = {
      business_id: data.businessId || null,
      metric_name: data.metric,
      metric_value: parseFloat(data.value),
      url: data.url || null,
      user_agent: data.userAgent || null,
      viewport_width: data.viewport?.width || null,
      viewport_height: data.viewport?.height || null,
      connection_type: data.connection?.effectiveType || null,
      connection_speed: data.connection?.downlink || null,
      metadata: data.metadata ? JSON.stringify(data.metadata) : null,
      timestamp: new Date(data.timestamp || Date.now()).toISOString(),
      created_at: new Date().toISOString()
    };

    // Store in database (create table if needed)
    const { error } = await supabase
      .from('performance_metrics')
      .insert(performanceData);

    if (error) {
      // If table doesn't exist, create it
      if (error.code === '42P01') {
        await createPerformanceTable();
        // Retry insert
        const { error: retryError } = await supabase
          .from('performance_metrics')
          .insert(performanceData);
        
        if (retryError) {
          console.error('Performance metrics insert error:', retryError);
          return NextResponse.json(
            { error: 'Failed to store performance data' },
            { status: 500 }
          );
        }
      } else {
        console.error('Performance metrics error:', error);
        return NextResponse.json(
          { error: 'Failed to store performance data' },
          { status: 500 }
        );
      }
    }

    // Log performance issues for monitoring
    if (shouldLogPerformanceIssue(data)) {
      console.warn('Performance issue detected:', {
        metric: data.metric,
        value: data.value,
        url: data.url,
        businessId: data.businessId
      });
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Performance tracking error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Create performance metrics table
async function createPerformanceTable() {
  const { error } = await supabase.rpc('create_performance_table');
  
  if (error) {
    console.error('Failed to create performance table:', error);
    // Fallback: create table with raw SQL
    await supabase.from('_sql').select(`
      CREATE TABLE IF NOT EXISTS performance_metrics (
        id SERIAL PRIMARY KEY,
        business_id UUID REFERENCES businesses(id),
        metric_name VARCHAR(100) NOT NULL,
        metric_value DECIMAL(10,2) NOT NULL,
        url TEXT,
        user_agent TEXT,
        viewport_width INTEGER,
        viewport_height INTEGER,
        connection_type VARCHAR(50),
        connection_speed DECIMAL(5,2),
        metadata JSONB,
        timestamp TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      
      CREATE INDEX IF NOT EXISTS idx_performance_business_metric 
      ON performance_metrics(business_id, metric_name);
      
      CREATE INDEX IF NOT EXISTS idx_performance_timestamp 
      ON performance_metrics(timestamp);
    `);
  }
}

// Determine if performance issue should be logged
function shouldLogPerformanceIssue(data) {
  const thresholds = {
    'LCP': 2500, // Largest Contentful Paint > 2.5s
    'FID': 100,  // First Input Delay > 100ms
    'CLS': 0.1,  // Cumulative Layout Shift > 0.1
    'domContentLoaded': 3000, // DOM ready > 3s
    'loadComplete': 5000,     // Full load > 5s
    'slowResources': 3        // More than 3 slow resources
  };

  const threshold = thresholds[data.metric];
  return threshold && data.value > threshold;
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get('businessId');
    const metric = searchParams.get('metric');
    const hours = parseInt(searchParams.get('hours') || '24');

    if (!businessId) {
      return NextResponse.json(
        { error: 'businessId parameter required' },
        { status: 400 }
      );
    }

    const since = new Date();
    since.setHours(since.getHours() - hours);

    let query = supabase
      .from('performance_metrics')
      .select('metric_name, metric_value, timestamp, url')
      .eq('business_id', businessId)
      .gte('timestamp', since.toISOString())
      .order('timestamp', { ascending: false });

    if (metric) {
      query = query.eq('metric_name', metric);
    }

    const { data, error } = await query.limit(1000);

    if (error) {
      console.error('Performance query error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch performance data' },
        { status: 500 }
      );
    }

    // Aggregate metrics for summary
    const summary = {};
    data.forEach(row => {
      if (!summary[row.metric_name]) {
        summary[row.metric_name] = {
          count: 0,
          sum: 0,
          min: Infinity,
          max: -Infinity,
          values: []
        };
      }
      
      const stat = summary[row.metric_name];
      stat.count++;
      stat.sum += row.metric_value;
      stat.min = Math.min(stat.min, row.metric_value);
      stat.max = Math.max(stat.max, row.metric_value);
      stat.values.push(row.metric_value);
    });

    // Calculate averages and percentiles
    Object.keys(summary).forEach(metricName => {
      const stat = summary[metricName];
      stat.average = stat.sum / stat.count;
      
      // Calculate 95th percentile
      stat.values.sort((a, b) => a - b);
      const p95Index = Math.floor(stat.values.length * 0.95);
      stat.p95 = stat.values[p95Index] || 0;
      
      delete stat.values; // Remove raw values to reduce response size
    });

    return NextResponse.json({
      summary,
      rawData: data.slice(0, 100), // Return latest 100 entries
      timeRange: { since: since.toISOString(), hours }
    });

  } catch (error) {
    console.error('Performance fetch error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
