// src/app/api/money/init/route.js
// POST: Initialize core monetization for a business (offers + Stripe Connect link)

import { NextResponse } from 'next/server';
import { initializeMonetizationForBusiness } from '@/lib/money/initializer';

export async function POST(request) {
  try {
    const body = await request.json();
    const { businessId, eagerConnectLink = true } = body || {};

    if (!businessId) {
      return NextResponse.json({ error: 'businessId is required' }, { status: 400 });
    }

    const result = await initializeMonetizationForBusiness({ businessId, eagerConnectLink });
    return NextResponse.json(result);
  } catch (error) {
    console.error('Money init error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}


