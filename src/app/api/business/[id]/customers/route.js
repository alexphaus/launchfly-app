// src/app/api/business/[id]/customers/route.js
import { NextResponse } from 'next/server';

export async function GET(request, { params }) {
  const { id: businessId } = params;

  if (!businessId) {
    return NextResponse.json({ success: false, error: 'Business ID is required' }, { status: 400 });
  }

  // In a real application, you would fetch this data from your database
  // For now, we'll use mock data to demonstrate the feature
  const mockCustomers = [
    { id: 1, name: 'Alice Johnson', email: 'alice.j@example.com', status: 'Converted', business_id: businessId },
    { id: 2, name: 'Bob Williams', email: 'bob.w@example.com', status: 'Contacted', business_id: businessId },
    { id: 3, name: 'Charlie Brown', email: 'charlie.b@example.com', status: 'Lead', business_id: businessId },
    { id: 4, name: 'Diana Miller', email: 'diana.m@example.com', status: 'Lead', business_id: businessId },
    { id: 5, name: 'Ethan Davis', email: 'ethan.d@example.com', status: 'Contacted', business_id: businessId },
  ];

  // Simulate a network delay
  await new Promise(resolve => setTimeout(resolve, 500));

  return NextResponse.json({ success: true, customers: mockCustomers });
}
