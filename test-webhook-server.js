require('dotenv').config({ path: '.env.local' });

async function testWebhookWithServer() {
  console.log('🎯 Testing Tally Webhook Against Running Server\n');
  
  const testData = {
    eventId: "test_event_" + Date.now(),
    eventType: "FORM_RESPONSE",
    createdAt: new Date().toISOString(),
    data: {
      responseId: "test_response_" + Date.now(),
      submissionId: "test_submission_" + Date.now(),
      respondentId: "test_respondent_" + Date.now(),
      formId: "test_form",
      formName: "Launchfly Skills Assessment",
      createdAt: new Date().toISOString(),
      fields: [
        {
          key: "question_mzkl6Y",  
          label: "Name",
          type: "INPUT_TEXT",
          value: "Alex Test User"
        },
        {
          key: "question_3Q2yvN",
          label: "Email", 
          type: "INPUT_EMAIL",
          value: "test-" + Date.now() + "@example.com"
        },
        {
          key: "question_mq6pQl",
          label: "What are your main skills or interests?",
          type: "TEXTAREA", 
          value: "Web development and design"
        }
      ]
    }
  };
  
  console.log('📋 Test form data:');
  console.log('   Name:', testData.data.fields[0].value);
  console.log('   Email:', testData.data.fields[1].value);
  console.log('   Skills:', testData.data.fields[2].value);
  console.log('');
  
  try {
    console.log('🚀 Calling Tally webhook on localhost:3003...');
    
    const response = await fetch('http://localhost:3003/api/webhook/tally', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData)
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    console.log('✅ Webhook successful!');
    console.log('Response:', result);
    
  } catch (error) {
    console.error('❌ Webhook failed:', error.message);
    return;
  }
}

testWebhookWithServer().then(() => {
  console.log('\n✅ Test complete');
}).catch(error => {
  console.error('\n❌ Test error:', error);
});
