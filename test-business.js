const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://jahdnckxduwkxodyjbnq.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImphaGRuY2t4ZHV3a3hvZHlqYm5xIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MzI4MDE2OCwiZXhwIjoyMDY4ODU2MTY4fQ.9O3NmxvU8AhuaNrsTdE34FJfSrqrDT6whLmCjoUdiEE';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testAndCreateBusiness() {
  try {
    console.log('Testing database connection...');
    
    // Test connection
    const { data: tables, error: tablesError } = await supabase
      .from('businesses')
      .select('count', { count: 'exact', head: true });
    
    if (tablesError) {
      console.error('Database connection failed:', tablesError);
      return;
    }
    
    console.log('Database connected successfully');
    
    // Check if business exists
    const { data: existing, error: existingError } = await supabase
      .from('businesses')
      .select('*')
      .eq('subdomain', 'axceleratebusiness');
    
    if (existingError) {
      console.error('Error checking existing business:', existingError);
      return;
    }
    
    if (existing && existing.length > 0) {
      console.log('Business already exists:', existing[0]);
      return;
    }
    
    console.log('Creating new business...');
    
    // Create business data
    const businessData = {
      name: 'Axcelerate Business',
      description: 'AI-powered business acceleration platform',
      theme: {
        colors: {
          primary: '#3b82f6',
          secondary: '#1e40af',
          textDark: '#1f2937',
          textGray: '#6b7280',
          borderColor: '#e5e7eb'
        },
        font: 'Inter',
        gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
      },
      layout: [
        {
          component: 'NavBar',
          props: {
            logo: 'Axcelerate Business',
            links: [
              { href: '#home', label: 'Home' },
              { href: '#about', label: 'About' },
              { href: '#services', label: 'Services' },
              { href: '#contact', label: 'Contact' }
            ]
          }
        },
        {
          component: 'Hero',
          props: {
            title: 'Accelerate Your Business Growth',
            subtitle: 'AI-powered solutions to streamline operations and boost productivity',
            buttonText: 'Get Started',
            buttonLink: '#contact'
          }
        },
        {
          component: 'FeatureGrid',
          props: {
            title: 'Why Choose Us',
            features: [
              {
                title: 'AI Integration',
                description: 'Leverage cutting-edge AI to automate processes',
                icon: '🤖'
              },
              {
                title: 'Scalable Solutions',
                description: 'Grow with confidence using our flexible platform',
                icon: '📈'
              },
              {
                title: 'Expert Support',
                description: '24/7 dedicated support from our expert team',
                icon: '🎯'
              }
            ]
          }
        },
        {
          component: 'Footer',
          props: {
            companyName: 'Axcelerate Business',
            links: [
              { href: '#privacy', label: 'Privacy Policy' },
              { href: '#terms', label: 'Terms of Service' }
            ]
          }
        }
      ]
    };
    
    const { data, error } = await supabase
      .from('businesses')
      .insert({
        subdomain: 'axceleratebusiness',
        status: 'published',
        business_data: businessData
      })
      .select()
      .single();
      
    if (error) {
      console.error('Error creating business:', error);
    } else {
      console.log('✅ Business created successfully!');
      console.log('Subdomain:', data.subdomain);
      console.log('Status:', data.status);
      console.log('Business data keys:', Object.keys(data.business_data));
    }
    
  } catch (err) {
    console.error('Script error:', err);
  }
}

testAndCreateBusiness();
