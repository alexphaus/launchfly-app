// Test the enhanced hero background generation
// This is a standalone test - the function would be imported in the actual implementation

console.log('Testing enhanced hero background generation...\n');

// Mock function for testing (copy of getBusinessVisuals)
function getBusinessVisuals(niche, businessType) {
  const visualMap = {
    fitness: {
      background: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&q=80",
      overlay: "linear-gradient(135deg, rgba(245, 87, 108, 0.8) 0%, rgba(240, 147, 251, 0.6) 100%)"
    },
    health: {
      background: "https://images.unsplash.com/photo-1559757148-5c350d0d3c56?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&q=80",
      overlay: "linear-gradient(135deg, rgba(67, 233, 123, 0.8) 0%, rgba(56, 249, 215, 0.6) 100%)"
    },
    business: {
      background: "https://images.unsplash.com/photo-1497366216548-37526070297c?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&q=80",
      overlay: "linear-gradient(135deg, rgba(79, 172, 254, 0.8) 0%, rgba(0, 242, 254, 0.6) 100%)"
    },
    technology: {
      background: "https://images.unsplash.com/photo-1518709268805-4e9042af2176?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&q=80",
      overlay: "linear-gradient(135deg, rgba(102, 126, 234, 0.8) 0%, rgba(118, 75, 162, 0.6) 100%)"
    },
    creative: {
      background: "https://images.unsplash.com/photo-1561736778-92e52a7769ef?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&q=80",
      overlay: "linear-gradient(135deg, rgba(250, 112, 154, 0.8) 0%, rgba(254, 225, 64, 0.6) 100%)"
    },
    education: {
      background: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&q=80",
      overlay: "linear-gradient(135deg, rgba(168, 237, 234, 0.8) 0%, rgba(254, 214, 227, 0.6) 100%)"
    },
    food: {
      background: "https://images.unsplash.com/photo-1514933651103-005eec06c04b?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&q=80",
      overlay: "linear-gradient(135deg, rgba(255, 236, 210, 0.8) 0%, rgba(252, 182, 159, 0.6) 100%)"
    },
    finance: {
      background: "https://images.unsplash.com/photo-1559526324-4b87b5e36e44?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&q=80",
      overlay: "linear-gradient(135deg, rgba(26, 43, 72, 0.8) 0%, rgba(59, 130, 246, 0.6) 100%)"
    },
    realestate: {
      background: "https://images.unsplash.com/photo-1560518883-ce09059eeffa?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&q=80",
      overlay: "linear-gradient(135deg, rgba(34, 197, 94, 0.8) 0%, rgba(59, 130, 246, 0.6) 100%)"
    },
    consulting: {
      background: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&q=80",
      overlay: "linear-gradient(135deg, rgba(59, 130, 246, 0.8) 0%, rgba(147, 51, 234, 0.6) 100%)"
    },
    default: {
      background: "https://images.unsplash.com/photo-1497366216548-37526070297c?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&q=80",
      overlay: "linear-gradient(135deg, rgba(79, 172, 254, 0.8) 0%, rgba(0, 242, 254, 0.6) 100%)"
    }
  };
  
  const lowerNiche = niche?.toLowerCase() || '';
  const lowerType = businessType?.toLowerCase() || '';
  
  // Check niche first, then business type
  for (const [key, visuals] of Object.entries(visualMap)) {
    if (lowerNiche.includes(key) || lowerType.includes(key)) {
      return visuals;
    }
  }
  
  return visualMap.default;
}

// Test different business types
const testCases = [
  { niche: 'fitness coaching', businessType: 'personal training' },
  { niche: 'business consulting', businessType: 'startup advisor' },
  { niche: 'web development', businessType: 'technology services' },
  { niche: 'graphic design', businessType: 'creative services' },
  { niche: 'online education', businessType: 'course creation' },
  { niche: 'restaurant', businessType: 'food delivery' },
  { niche: 'real estate', businessType: 'property sales' },
  { niche: 'financial planning', businessType: 'investment advice' }
];

testCases.forEach((testCase, index) => {
  console.log(`Test ${index + 1}: ${testCase.niche} (${testCase.businessType})`);
  
  try {
    const visuals = getBusinessVisuals(testCase.niche, testCase.businessType);
    console.log(`  Background: ${visuals.background}`);
    console.log(`  Overlay: ${visuals.overlay}`);
    console.log('  ✅ Success\n');
  } catch (error) {
    console.log(`  ❌ Error: ${error.message}\n`);
  }
});

console.log('Test completed!');
