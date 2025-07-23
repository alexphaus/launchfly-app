// app/api/webhook/route.js
import OpenAI from 'openai';
import { Resend } from 'resend';

// Initialize services
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const resend = new Resend(process.env.RESEND_API_KEY);

// Main webhook handler
export async function POST(request) {
  try {
    // 1. Get Tally data
    const formData = await request.json();
    console.log('Received from Tally:', formData);
    
    // 2. Extract the fields
    const userData = {
      name: formData.data.fields.find(f => f.label === "Name")?.value,
      email: formData.data.fields.find(f => f.label === "Email")?.value,
      skills: formData.data.fields.find(f => f.label === "What are your main skills or interests?")?.value,
      businessType: formData.data.fields.find(f => f.label === "What type of business are you most interested in?")?.value,
      goal: formData.data.fields.find(f => f.label === "What's your business goal?")?.value,
      preferences: formData.data.fields.find(f => f.label === "Any special preferences or ideas you have?")?.value
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
async function generateBusiness(userData) {
  const prompt = `You are an expert business strategist and web designer who has helped launch 1000+ successful online businesses. Analyze this person's profile and create a SPECIFIC, VALIDATED business idea:

PROFILE:
- Name: ${userData.name}
- Skills/Interests: ${userData.skills}
- Business Type: ${userData.businessType}
- Goal: ${userData.goal}
- Preferences: ${userData.preferences || 'None'}

REQUIREMENTS:
Create a business that:
1. Leverages their existing skills
2. Has proven market demand
3. Can start with $0-500 budget
4. Can generate income within 30 days
5. Scales to $10K+/month potential

OUTPUT (JSON format):
{
  "businessName": "Creative, brandable name (not generic)",
  "tagline": "Clear value proposition in 10 words or less",
  "product": "Specific product/service with unique angle",
  "price": "Strategic pricing with rationale (e.g., '$97/month - premium but accessible')",
  "targetCustomer": "Specific niche with demographics, pain points, and buying power",
  "marketValidation": "Why this business will succeed (market size, trends, competition gaps)",
  "steps": [
    "Week 1: Specific action with tools/platforms",
    "Week 2: Specific action with metrics to track", 
    "Week 3: Specific action with expected outcome"
  ],
  "monthlyRevenue": "Realistic projection with math (e.g., '50 customers × $97 = $4,850/month')",
  "landingPage": "Professional HTML with modern CSS, compelling headlines, social proof placeholders, clear CTAs, mobile-responsive design, and conversion-optimized layout. Include hero section, benefits, testimonials placeholder, pricing, FAQ, and footer. Use modern design trends, proper spacing, and psychological triggers.",
  "launchStrategy": "Step-by-step 30-day launch plan",
  "competitiveAdvantage": "What makes this different from competitors"
}

Make the landing page HTML production-ready with:
- Modern CSS styling (gradients, shadows, animations)
- Mobile-first responsive design
- Conversion psychology (urgency, social proof, benefit-focused)
- Clear value hierarchy
- Professional typography and spacing
- Call-to-action buttons that convert
- Trust signals and credibility elements`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" }
  });

  return JSON.parse(completion.choices[0].message.content);
}

// Email sending function
async function sendBusinessEmail(email, name, business) {
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
    <div>
        ${business.landingPage}
    </div>
  `;

  await resend.emails.send({
    from: 'Launchfly <hello@launchfly.ai>',
    to: email,
    subject: `${name}, your ${business.businessName} business plan is ready! 🚀`,
    html: html
  });
}