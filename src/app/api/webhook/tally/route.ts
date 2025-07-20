// app/api/webhook/route.ts
import OpenAI from 'openai';
import { Resend } from 'resend';
import { NextRequest } from 'next/server';

// Type definitions
interface TallyField {
  label: string;
  value: string;
}

interface TallyWebhookData {
  data: {
    fields: TallyField[];
  };
}

interface UserData {
  name: string;
  email: string;
  skills: string;
  businessType: string;
  goal: string;
  preferences: string;
}

interface BusinessIdea {
  businessName: string;
  tagline: string;
  product: string;
  price: string;
  targetCustomer: string;
  steps: string[];
  monthlyRevenue: string;
}

// Initialize services
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const resend = new Resend(process.env.RESEND_API_KEY);

// Main webhook handler
export async function POST(request: NextRequest): Promise<Response> {
  try {
    // 1. Get Tally data
    const formData: TallyWebhookData = await request.json();
    console.log('Received from Tally:', formData);
    
    // 2. Extract the fields
    const userData: UserData = {
      name: formData.data.fields.find(f => f.label === "Name")?.value || '',
      email: formData.data.fields.find(f => f.label === "Email")?.value || '',
      skills: formData.data.fields.find(f => f.label === "What are your main skills or interests?")?.value || '',
      businessType: formData.data.fields.find(f => f.label === "What type of business are you most interested in?")?.value || '',
      goal: formData.data.fields.find(f => f.label === "What's your business goal?")?.value || '',
      preferences: formData.data.fields.find(f => f.label === "Any special preferences or ideas you have?")?.value || ''
    };
    
    // 3. Generate business with OpenAI
    const business = await generateBusiness(userData);
    
    // 4. Send email
    await sendBusinessEmail(userData.email, userData.name, business);
    
    return new Response('Success', { status: 200 });
  } catch (error) {
    console.error('Error:', error);
    return new Response('Error', { status: 500 });
  }
}

// OpenAI function
async function generateBusiness(userData: UserData): Promise<BusinessIdea> {
  const prompt = `You are a brilliant business strategist. Create a specific, actionable online business idea based on this person's profile:

Name: ${userData.name}
Skills/Interests: ${userData.skills}
Business Type Preference: ${userData.businessType}
Goal: ${userData.goal}
Special Preferences: ${userData.preferences || 'None'}

Generate a business idea with:
1. businessName: Creative and memorable name
2. tagline: One compelling sentence
3. product: What they're selling (specific product/service)
4. price: Price point (e.g., "$99/month")
5. targetCustomer: Be specific about who will buy
6. steps: Array of 3 specific actions to take this week
7. monthlyRevenue: Realistic potential (e.g., "$2,000-$5,000/month")

Return as JSON.`;

  const completion = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" }
  });

  const content = completion.choices[0].message.content;
  if (!content) {
    throw new Error('No content received from OpenAI');
  }

  return JSON.parse(content) as BusinessIdea;
}

// Email sending function
async function sendBusinessEmail(email: string, name: string, business: BusinessIdea): Promise<void> {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #5D5FEF;">🚀 ${name}, Your AI-Generated Business Is Ready!</h1>
      
      <div style="background: #F3F4F6; padding: 20px; border-radius: 10px; margin: 20px 0;">
        <h2 style="color: #1F2937; margin-top: 0;">${business.businessName}</h2>
        <p style="font-size: 18px; color: #4B5563; font-style: italic;">"${business.tagline}"</p>
      </div>
      
      <h3 style="color: #374151;">📦 What You're Selling:</h3>
      <p style="line-height: 1.6;">${business.product}</p>
      <p style="font-size: 24px; color: #5D5FEF; font-weight: bold;">Price: ${business.price}</p>
      
      <h3 style="color: #374151;">🎯 Your Target Customer:</h3>
      <p style="line-height: 1.6;">${business.targetCustomer}</p>
      
      <h3 style="color: #374151;">💰 Revenue Potential:</h3>
      <p style="font-size: 20px; color: #059669; font-weight: bold;">${business.monthlyRevenue}</p>
      
      <h3 style="color: #374151;">🚀 Your First 3 Steps (Do These This Week!):</h3>
      <ol style="line-height: 1.8;">
        <li>${business.steps[0]}</li>
        <li>${business.steps[1]}</li>
        <li>${business.steps[2]}</li>
      </ol>
      
      <div style="background: #DBEAFE; padding: 15px; border-radius: 10px; margin: 30px 0;">
        <p style="margin: 0; color: #1E40AF;">
          <strong>🎉 Next Step:</strong> Reply to this email with "I'm ready!" and I'll send you resources to launch this week.
        </p>
      </div>
      
      <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 30px 0;">
      
      <p style="color: #6B7280; font-size: 14px;">
        Generated by Launchfly AI in 12 seconds<br>
        <a href="https://launchfly.ai" style="color: #5D5FEF;">launchfly.ai</a>
      </p>
    </div>
  `;

  await resend.emails.send({
    from: 'Launchfly <hello@launchfly.ai>',
    to: email,
    subject: `${name}, your ${business.businessName} business plan is ready! 🚀`,
    html: html
  });
}