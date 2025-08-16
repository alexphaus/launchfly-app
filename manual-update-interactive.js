// Manual revenue update for multi-item purchases
// Run this after completing a multi-item purchase to update revenue

const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('Manual Revenue Update for Multi-Item Purchases');
console.log('============================================');

function askForInput() {
  rl.question('Enter the total amount from your purchase (e.g., 135.96): $', (amount) => {
    const purchaseAmount = parseFloat(amount);
    
    if (isNaN(purchaseAmount) || purchaseAmount <= 0) {
      console.log('Please enter a valid amount.');
      askForInput();
      return;
    }

    rl.question('Enter session ID (or press Enter to use a generated one): ', (sessionId) => {
      const finalSessionId = sessionId.trim() || `cs_manual_${Date.now()}`;
      
      updateRevenue(purchaseAmount, finalSessionId);
    });
  });
}

async function updateRevenue(amount, sessionId) {
  console.log(`\nUpdating revenue: +$${amount}`);
  
  const transactionData = {
    businessId: '402430fd-cd98-4fe7-a5e7-700c85bd2786', // moderngrind
    amount: amount,
    stripeSessionId: sessionId,
    customerEmail: 'manual-update@test.com',
    customerName: 'Manual Update'
  };

  try {
    const response = await fetch('http://localhost:3000/api/business/update-revenue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(transactionData)
    });
    
    const result = await response.json();
    
    if (result.success) {
      console.log(`✅ Revenue updated successfully!`);
      console.log(`   Previous revenue: $${result.previousRevenue}`);
      console.log(`   New revenue: $${result.newRevenue}`);
      console.log(`   Purchase amount: $${result.saleAmount}`);
    } else {
      console.log('❌ Error updating revenue:', result.error);
    }
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
  
  rl.close();
}

askForInput();
