// Direct revenue update for testing
// This simulates what the Stripe webhook should do

console.log('Updating revenue directly in database...');

// Mock transaction data from your successful payment
const transactionData = {
  businessId: '402430fd-cd98-4fe7-a5e7-700c85bd2786', // moderngrind
  amount: 135.96, // $135.96 from your transaction
  stripeSessionId: 'cs_test_b1geitCyEkVHGHIsAzEPm2gTk2AqKMkDg20k1OSVPZ2b3EA6IW1vRhpH4K',
  customerEmail: 'axpg31@gmail.com',
  customerName: 'Ax'
};

// Make API call to update revenue
fetch('http://localhost:3000/api/business/update-revenue', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(transactionData)
})
.then(response => response.json())
.then(data => {
  console.log('Revenue update result:', data);
})
.catch(error => {
  console.error('Error updating revenue:', error);
});
