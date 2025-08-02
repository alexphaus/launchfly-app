// Test script to check testimonials generation
import { createClient } from '@supabase/supabase-js';
import { generateBusinessWithAI } from './src/lib/business-generator.js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function testTestimonials() {
  console.log('🧪 Testing testimonials generation...\n');
  
  // Create test session and business records
  const sessionId = `test-testimonials-${Date.now()}`;
  const businessId = `business-${Date.now()}`;
  
  // Insert test session
  await supabase.from('sessions').insert({
    id: sessionId,
    stage: 'pending',
    form_data: {
      name: 'John Doe',
      skills: 'fitness coaching',
      businessType: 'online coaching',
      goal: 'help people get fit'
    }
  });
  
  // Insert test business
  await supabase.from('businesses').insert({
    id: businessId,
    user_id: '00000000-0000-0000-0000-000000000000', // dummy user id
    name: 'Test Business',
    subdomain: `test-${Date.now()}`,
    session_id: sessionId,
    form_data: {
      name: 'John Doe',
      skills: 'fitness coaching',
      businessType: 'online coaching',
      goal: 'help people get fit'
    }
  });
  
  try {
    // Generate business
    console.log('Generating business...');
    const businessData = await generateBusinessWithAI({
      name: 'John Doe',
      skills: 'fitness coaching, nutrition',
      businessType: 'online coaching',
      goal: 'help people transform their health'
    }, sessionId, businessId);
    
    console.log('\n✅ Business generated successfully!');
    console.log('Business Name:', businessData.businessName);
    
    // Check testimonials
    if (businessData.layout) {
      console.log('\n📋 Layout found, checking testimonials...');
      const testimonialComponent = businessData.layout.find(component => 
        component.component === 'TestimonialSlider'
      );
      
      if (testimonialComponent) {
        console.log('✅ TestimonialSlider component found');
        const testimonials = testimonialComponent.props?.testimonials || [];
        
        console.log(`📝 Found ${testimonials.length} testimonials:`);
        testimonials.forEach((testimonial, index) => {
          console.log(`\n${index + 1}. ${testimonial.name} (${testimonial.role})`);
          console.log(`   Content: "${testimonial.content}"`);
          console.log(`   Avatar: ${testimonial.avatar}`);
          console.log(`   Rating: ${testimonial.rating}`);
        });
        
        // Check for empty content
        const emptyContent = testimonials.filter(t => !t.content || t.content.trim() === '');
        if (emptyContent.length > 0) {
          console.log(`\n❌ Found ${emptyContent.length} testimonials with empty content!`);
        } else {
          console.log('\n✅ All testimonials have content!');
        }
      } else {
        console.log('❌ No TestimonialSlider component found in layout');
      }
    } else {
      console.log('❌ No layout found in business data');
    }
    
    // Check if testimonials are also in the main business data
    if (businessData.testimonials) {
      console.log(`\n📝 Found ${businessData.testimonials.length} testimonials in main business data too`);
    }
    
  } catch (error) {
    console.error('❌ Error generating business:', error);
  }
  
  // Clean up test records
  console.log('\n🧹 Cleaning up test records...');
  await supabase.from('sessions').delete().eq('id', sessionId);
  await supabase.from('businesses').delete().eq('id', businessId);
  console.log('✅ Cleanup complete');
}

testTestimonials().catch(console.error);
