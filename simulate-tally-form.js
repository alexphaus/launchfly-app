#!/usr/bin/env node

/**
 * Simulate Tally Form Submission for Local Testing
 * 
 * This script simulates a user submitting the Tally form and automatically
 * opens the dashboard in your browser.
 * 
 * Usage: node simulate-tally-form.js [email] [name]
 */

import { nanoid } from 'nanoid';
import { exec } from 'child_process';

// Configuration
const LOCAL_URL = 'http://localhost:3000';
const WEBHOOK_ENDPOINT = `${LOCAL_URL}/api/webhook/tally`;

// Get user inputs or use defaults
const email = process.argv[2] || 'axpg31@gmail.com';
const name = process.argv[3] || 'Alex';
const sessionId = nanoid();

// Mock Tally form submission data
const mockTallyData = {
  eventId: `evt_${nanoid()}`,
  eventType: "FORM_RESPONSE",
  createdAt: new Date().toISOString(),
  data: {
    responseId: `res_${nanoid()}`,
    submissionId: `sub_${nanoid()}`,
    respondentId: `resp_${nanoid()}`,
    formId: "mock_tally_form_id",
    formName: "Launchfly Business Generation Form",
    createdAt: new Date().toISOString(),
    fields: [
      {
        key: "question_name",
        label: "Name",
        type: "INPUT_TEXT",
        value: name
      },
      {
        key: "question_email", 
        label: "Email",
        type: "INPUT_EMAIL",
        value: email
      },
      {
        key: "question_skills",
        label: "What are your main skills or interests?",
        type: "TEXTAREA",
        value: "Web development, design, marketing, and content creation"
      },
      {
        key: "question_business_type",
        label: "What type of business are you most interested in?",
        type: "MULTIPLE_CHOICE",
        value: "Digital products and services"
      },
      {
        key: "question_goal",
        label: "What's your business goal?", 
        type: "MULTIPLE_CHOICE",
        value: "Build a sustainable income stream"
      },
      {
        key: "question_preferences",
        label: "Any special preferences or ideas you have?",
        type: "TEXTAREA", 
        value: "I want to focus on helping other entrepreneurs with productivity tools"
      },
      {
        key: "question_plan",
        label: "plan",
        type: "HIDDEN",
        value: "Starter"
      },
      {
        key: "question_session_id",
        label: "sessionID", 
        type: "HIDDEN",
        value: sessionId
      }
    ]
  }
};

async function simulateTallySubmission() {
  console.log('🚀 Simulating Tally form submission...');
  console.log(`📧 Email: ${email}`);
  console.log(`👤 Name: ${name}`);
  console.log(`🆔 Session ID: ${sessionId}`);
  console.log('');

  try {
    // Make the webhook request
    const response = await fetch(WEBHOOK_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(mockTallyData)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    console.log('✅ Form submission successful!');
    console.log('📊 Response:', result);
    
    // Construct dashboard URL with onboarding parameter
    const dashboardUrl = `${LOCAL_URL}/dashboard/${sessionId}?onboarding=true`;
    console.log('');
    console.log(`🎯 Dashboard URL: ${dashboardUrl}`);
    
    // Open browser automatically
    console.log('🌐 Opening dashboard in browser...');
    const command = process.platform === 'darwin' ? 'open' : 
                   process.platform === 'win32' ? 'start' : 'xdg-open';
    
    exec(`${command} "${dashboardUrl}"`, (error) => {
      if (error) {
        console.error('❌ Failed to open browser:', error.message);
        console.log('👆 Please manually copy and paste the URL above into your browser');
      } else {
        console.log('✅ Browser opened successfully!');
      }
    });

  } catch (error) {
    console.error('❌ Simulation failed:', error.message);
    console.log('');
    console.log('🔧 Troubleshooting:');
    console.log('1. Make sure your Next.js dev server is running (npm run dev)');
    console.log('2. Check that your environment variables are set correctly');
    console.log('3. Verify your database connection is working');
    console.log('4. Check the console logs in your Next.js app for errors');
    
    process.exit(1);
  }
}

// Run the simulation
simulateTallySubmission();