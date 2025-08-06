/**
 * @fileoverview Health check API endpoint
 * Simple endpoint for network connectivity testing
 */

import { NextResponse } from 'next/server';

export const runtime = 'edge';

/**
 * GET /api/health
 * Simple health check endpoint
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    timestamp: Date.now(),
    uptime: process.uptime?.() || 0
  });
}

/**
 * HEAD /api/health
 * Lightweight health check for network monitoring
 */
export async function HEAD() {
  return new Response(null, {
    status: 200,
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    }
  });
}