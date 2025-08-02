// Test PricingTable component with various data scenarios
import React from 'react';
import PricingTable from '../src/components/launchfly-ui/PricingTable.js';

// Test 1: Plans with missing ctaText
const plansWithMissingCtaText = [
  {
    name: 'Basic',
    price: '$10',
    description: 'Basic plan',
    features: ['Feature 1', 'Feature 2']
    // ctaText is missing
  },
  {
    name: 'Pro',
    price: '$25',
    description: 'Pro plan',
    features: ['Feature 1', 'Feature 2'],
    ctaText: 'Start Now'
  }
];

// Test 2: Empty plans array
const emptyPlans = [];

// Test 3: Proper plans
const properPlans = [
  {
    name: 'Starter',
    price: '$99',
    period: 'month',
    description: 'Perfect for getting started',
    features: ['Feature 1', 'Feature 2'],
    ctaText: 'Get Started',
    popular: false
  }
];

console.log('Testing PricingTable component scenarios:');
console.log('1. Plans with missing ctaText - should show "Choose Plan"');
console.log('2. Empty plans - should show default plans with proper ctaText');
console.log('3. Proper plans - should show provided ctaText');

// Mock the useParams hook for testing
jest.mock('next/navigation', () => ({
  useParams: () => ({ subdomain: 'test' })
}));

export { plansWithMissingCtaText, emptyPlans, properPlans };
