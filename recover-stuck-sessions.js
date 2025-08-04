// recover-stuck-sessions.js
// Recovery tool for sessions stuck at "Creating products..."
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function recoverStuckSessions() {
  console.log('🚑 STUCK SESSION RECOVERY TOOL');
  console.log('===============================\n');
  
  // Find sessions that should be complete but aren't
  const { data: sessions, error } = await supabase
    .from('sessions')
    .select(`
      id, stage, progress, created_at,
      businesses (
        id, status, business_data
      )
    `)
    .in('stage', ['building', 'generating', 'analyzing', 'researching', 'finalizing'])
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching sessions:', error);
    return;
  }

  console.log(`Found ${sessions.length} sessions in intermediate stages\n`);
  
  let recoveredCount = 0;
  
  for (const session of sessions) {
    const business = session.businesses?.[0];
    
    if (!business) {
      console.log(`❌ Session ${session.id}: No business record found`);
      continue;
    }
    
    const businessData = business.business_data;
    const hasProducts = businessData?.products?.length > 0;
    const hasTheme = businessData?.theme ? true : false;
    const hasBusinessName = businessData?.businessName ? true : false;
    const hasCompleteData = hasProducts && hasTheme && hasBusinessName;
    
    console.log(`\n📋 Session: ${session.id}`);
    console.log(`   Current Stage: ${session.stage} (${session.progress}%)`);
    console.log(`   Business Status: ${business.status}`);
    console.log(`   Has Complete Data: ${hasCompleteData}`);
    console.log(`   - Business Name: ${hasBusinessName}`);
    console.log(`   - Theme: ${hasTheme}`);
    console.log(`   - Products: ${hasProducts} ${hasProducts ? `(${businessData.products.length})` : ''}`);
    
    // Recovery logic
    if (hasCompleteData && session.stage !== 'complete') {
      console.log(`   🔧 RECOVERING: Session has complete data but wrong stage`);
      
      try {
        // Update session to complete
        const { error: sessionError } = await supabase
          .from('sessions')
          .update({
            stage: 'complete',
            progress: 100,
            updated_at: new Date().toISOString()
          })
          .eq('id', session.id);
          
        if (sessionError) {
          console.log(`   ❌ Failed to update session: ${sessionError.message}`);
          continue;
        }
        
        // Update business status
        const { error: businessError } = await supabase
          .from('businesses')
          .update({
            status: 'ready',
            updated_at: new Date().toISOString()
          })
          .eq('id', business.id);
          
        if (businessError) {
          console.log(`   ⚠️ Session updated but business update failed: ${businessError.message}`);
        }
        
        console.log(`   ✅ RECOVERED: Session marked as complete`);
        recoveredCount++;
        
      } catch (error) {
        console.log(`   ❌ Recovery failed: ${error.message}`);
      }
      
    } else if (hasTheme && !hasProducts && session.stage === 'building') {
      console.log(`   🔍 NEEDS PRODUCTS: Has theme but missing products`);
      
      // Generate fallback products for this session
      const fallbackProducts = [
        { 
          name: "Starter Package", 
          price: "$97", 
          description: `Essential services to get you started with ${businessData.businessName || 'your business'}` 
        },
        { 
          name: "Professional Package", 
          price: "$297", 
          description: "Comprehensive solutions for established businesses" 
        },
        { 
          name: "Premium Package", 
          price: "$597", 
          description: "All-inclusive enterprise-grade services with premium support" 
        }
      ];
      
      try {
        // Add products to business data
        const updatedBusinessData = {
          ...businessData,
          products: fallbackProducts,
          recoveredAt: new Date().toISOString(),
          recoveryReason: 'stuck-at-product-creation'
        };
        
        const { error: dataError } = await supabase
          .from('businesses')
          .update({
            business_data: updatedBusinessData,
            updated_at: new Date().toISOString()
          })
          .eq('id', business.id);
          
        if (dataError) {
          console.log(`   ❌ Failed to add products: ${dataError.message}`);
          continue;
        }
        
        // Now update session to complete
        const { error: sessionError } = await supabase
          .from('sessions')
          .update({
            stage: 'complete',
            progress: 100,
            updated_at: new Date().toISOString()
          })
          .eq('id', session.id);
          
        if (sessionError) {
          console.log(`   ❌ Failed to complete session: ${sessionError.message}`);
          continue;
        }
        
        console.log(`   ✅ RECOVERED: Added fallback products and completed session`);
        recoveredCount++;
        
      } catch (error) {
        console.log(`   ❌ Product recovery failed: ${error.message}`);
      }
      
    } else {
      console.log(`   ℹ️  Session appears to be in normal processing state`);
    }
  }
  
  console.log(`\n📊 RECOVERY SUMMARY`);
  console.log(`==================`);
  console.log(`Sessions processed: ${sessions.length}`);
  console.log(`Sessions recovered: ${recoveredCount}`);
  console.log(`Recovery rate: ${sessions.length > 0 ? Math.round((recoveredCount / sessions.length) * 100) : 0}%`);
  
  if (recoveredCount > 0) {
    console.log('\n✅ Recovery completed! Users should now see their dashboards as complete.');
  } else {
    console.log('\n✨ No sessions needed recovery - all sessions are in proper states.');
  }
}

// Run recovery
recoverStuckSessions().catch(console.error);