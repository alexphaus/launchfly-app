// Check recent Stripe checkout sessions to debug the real issue
// This will help us see what's actually happening with your purchases

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

async function checkRecentSessions() {
  try {
    console.log('🔍 Checking Recent Stripe Checkout Sessions...\n');

    // Get recent checkout sessions
    const sessions = await stripe.checkout.sessions.list({
      limit: 10,
      created: {
        gte: Math.floor(Date.now() / 1000) - (24 * 60 * 60) // Last 24 hours
      }
    });

    console.log(`Found ${sessions.data.length} sessions in the last 24 hours:\n`);

    sessions.data.forEach((session, index) => {
      console.log(`Session ${index + 1}:`);
      console.log(`  ID: ${session.id}`);
      console.log(`  Status: ${session.payment_status}`);
      console.log(`  Amount: $${(session.amount_total / 100).toFixed(2)}`);
      console.log(`  Created: ${new Date(session.created * 1000).toLocaleString()}`);
      console.log(`  Customer: ${session.customer_details?.email || 'N/A'}`);
      
      if (session.metadata) {
        console.log(`  Metadata:`);
        console.log(`    business_id: ${session.metadata.business_id || 'MISSING'}`);
        console.log(`    product_id: ${session.metadata.product_id || 'MISSING'}`);
        console.log(`    items_count: ${session.metadata.items_count || 'MISSING'}`);
        console.log(`    item_names: ${session.metadata.item_names || 'MISSING'}`);
        
        // Check if this is a multi-item purchase
        const isMultiItem = session.metadata.items_count && parseInt(session.metadata.items_count) > 1;
        console.log(`    Multi-item: ${isMultiItem ? 'YES' : 'NO'}`);
        
        if (isMultiItem && !session.metadata.product_id) {
          console.log(`    ⚠️  This would trigger our multi-item fix!`);
        }
      } else {
        console.log(`  ❌ No metadata found - this could be the issue!`);
      }
      
      console.log('');
    });

    // Check if there are any completed sessions that should have triggered webhooks
    const completedSessions = sessions.data.filter(s => s.payment_status === 'paid');
    
    if (completedSessions.length > 0) {
      console.log(`\n📊 ${completedSessions.length} completed sessions found:`);
      
      completedSessions.forEach(session => {
        const isMultiItem = session.metadata?.items_count && parseInt(session.metadata.items_count) > 1;
        const hasProductId = !!session.metadata?.product_id;
        
        console.log(`  ${session.id}:`);
        console.log(`    Amount: $${(session.amount_total / 100).toFixed(2)}`);
        console.log(`    Multi-item: ${isMultiItem}`);
        console.log(`    Has product_id: ${hasProductId}`);
        console.log(`    Business ID: ${session.metadata?.business_id || 'MISSING'}`);
        
        if (isMultiItem && !hasProductId) {
          console.log(`    🎯 This session should be handled by our multi-item fix!`);
        }
      });
    } else {
      console.log('\n❌ No completed sessions found in the last 24 hours.');
      console.log('Either no purchases were made, or they\'re older than 24 hours.');
    }

  } catch (error) {
    console.error('❌ Error checking Stripe sessions:', error.message);
    
    if (error.message.includes('No such')) {
      console.log('💡 Check your STRIPE_SECRET_KEY environment variable');
    }
  }
}

checkRecentSessions();
