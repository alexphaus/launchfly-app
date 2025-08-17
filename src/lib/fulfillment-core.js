// src/lib/fulfillment-core.js
/**
 * Universal AI Fulfillment Core
 * 
 * This is the 80/20 solution that delivers actual value after a sale.
 * Instead of promising physical products (which require inventory/shipping),
 * we deliver AI-generated digital value that matches what customers expected.
 * 
 * Core Philosophy:
 * - Turn product purchases into valuable digital experiences
 * - Use AI to create personalized content that delivers real value
 * - Make it feel like they got exactly what they paid for (or better)
 * - Scale to any business type without manual work
 */

import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Main fulfillment orchestrator - triggered after successful payment
 * This is the genius part: we fulfill with AI-generated value instead of physical products
 */
export async function fulfillOrder(saleData, businessData) {
  console.log('🚀 Starting AI fulfillment for sale:', saleData.id);
  
  try {
    // 1. Analyze what the customer actually wants/needs
    const customerIntent = await analyzeCustomerIntent(saleData, businessData);
    
    // 2. Generate personalized value based on business type
    const fulfillmentPlan = await createFulfillmentPlan(customerIntent, businessData);
    
    // 3. Execute the fulfillment (generate content, send emails, create access)
    const deliveredValue = await executeFulfillment(fulfillmentPlan, saleData, businessData);
    
    // 4. Follow up to ensure satisfaction and gather feedback
    await scheduleFollowUp(saleData, deliveredValue);
    
    // 5. Record fulfillment in database
    await recordFulfillment(saleData.id, deliveredValue);
    
    console.log('✅ Fulfillment completed successfully');
    return deliveredValue;
    
  } catch (error) {
    console.error('❌ Fulfillment error:', error);
    
    // Fallback: send a personalized email with basic value
    await sendFallbackValue(saleData, businessData);
    throw error;
  }
}

/**
 * Analyze what the customer was really looking for when they made this purchase
 * This helps us deliver relevant value instead of generic content
 */
async function analyzeCustomerIntent(saleData, businessData) {
  const prompt = `
    A customer just purchased "${saleData.product_id}" for $${saleData.amount} from "${businessData.name}".
    
    Business Context:
    - Type: ${businessData.business_data?.businessModel || 'service'}
    - Niche: ${businessData.business_data?.niche || 'general'}
    - Target Problem: ${businessData.business_data?.painPoint || 'business growth'}
    
    Customer Info:
    - Name: ${saleData.customer_name}
    - Email: ${saleData.customer_email}
    - Product: ${saleData.product_id}
    - Amount: $${saleData.amount}
    
    Analyze what this customer was REALLY looking for when they made this purchase.
    What problem are they trying to solve? What outcome do they want?
    
    Return a JSON object with:
    {
      "primary_need": "main problem they want solved",
      "urgency_level": "low|medium|high",
      "expected_outcome": "what they expect to achieve",
      "value_preference": "content|tools|guidance|results",
      "business_context": "their likely business situation",
      "fulfillment_strategy": "best approach to deliver value"
    }
  `;
  
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: "You are an expert at understanding customer psychology and purchase intent." },
      { role: "user", content: prompt }
    ],
    response_format: { type: "json_object" }
  });
  
  return JSON.parse(response.choices[0].message.content);
}

/**
 * Create a specific fulfillment plan based on customer intent and business type
 * This is where we decide exactly what value to deliver
 */
async function createFulfillmentPlan(customerIntent, businessData) {
  const businessType = businessData.business_data?.businessModel || 'service';
  
  // Different fulfillment strategies by business type
  const strategies = {
    ecommerce: createEcommerceFulfillment,
    service: createServiceFulfillment,
    consulting: createConsultingFulfillment,
    course: createCourseFulfillment,
    software: createSoftwareFulfillment
  };
  
  const createPlan = strategies[businessType] || strategies.service;
  return await createPlan(customerIntent, businessData);
}

/**
 * E-commerce fulfillment: Instead of shipping physical products,
 * deliver digital value that customers actually want more than the product
 */
async function createEcommerceFulfillment(customerIntent, businessData) {
  const niche = businessData.business_data?.niche || 'general';
  
  // For skincare example: instead of shipping products, deliver personalized skincare guidance
  if (niche.includes('skincare') || niche.includes('beauty')) {
    return {
      type: 'personalized_guidance',
      deliverables: [
        {
          type: 'personalized_routine',
          title: 'Your Custom Skincare Routine',
          description: 'AI-analyzed routine based on your specific needs'
        },
        {
          type: 'product_education',
          title: 'Skincare Science Guide',
          description: 'Understanding ingredients and their effects'
        },
        {
          type: 'progress_tracking',
          title: 'Progress Tracking System',
          description: 'Tools to monitor your skin improvement'
        }
      ],
      timeline: 'immediate',
      follow_ups: ['week_1_check_in', 'month_1_results_review']
    };
  }
  
  // Generic e-commerce fulfillment
  return {
    type: 'value_package',
    deliverables: [
      {
        type: 'expert_guide',
        title: `Complete ${niche} Guide`,
        description: 'Comprehensive guide to getting the best results'
      },
      {
        type: 'community_access',
        title: 'Exclusive Community',
        description: 'Join others on the same journey'
      }
    ],
    timeline: 'immediate',
    follow_ups: ['satisfaction_check']
  };
}

/**
 * Service fulfillment: Deliver immediate value and build trust for ongoing relationship
 */
async function createServiceFulfillment(customerIntent, businessData) {
  return {
    type: 'service_starter',
    deliverables: [
      {
        type: 'custom_audit',
        title: 'Personalized Business Audit',
        description: 'AI analysis of your specific situation'
      },
      {
        type: 'action_plan',
        title: 'Strategic Action Plan',
        description: 'Step-by-step plan to achieve your goals'
      },
      {
        type: 'quick_wins',
        title: 'Immediate Improvements',
        description: 'Things you can implement today for quick results'
      }
    ],
    timeline: 'within_24h',
    follow_ups: ['implementation_support', 'results_check']
  };
}

/**
 * Consulting fulfillment: Deliver premium insights and establish expertise
 */
async function createConsultingFulfillment(customerIntent, businessData) {
  return {
    type: 'consulting_package',
    deliverables: [
      {
        type: 'strategic_analysis',
        title: 'Strategic Assessment Report',
        description: 'Deep dive analysis of your current situation'
      },
      {
        type: 'opportunity_map',
        title: 'Growth Opportunity Map',
        description: 'Identified opportunities for expansion and improvement'
      },
      {
        type: 'implementation_roadmap',
        title: 'Implementation Roadmap',
        description: 'Prioritized steps to achieve your objectives'
      }
    ],
    timeline: 'within_48h',
    follow_ups: ['strategy_review', 'progress_milestone']
  };
}

/**
 * Course fulfillment: Deliver learning content and progress tracking
 */
async function createCourseFulfillment(customerIntent, businessData) {
  return {
    type: 'learning_experience',
    deliverables: [
      {
        type: 'personalized_curriculum',
        title: 'Custom Learning Path',
        description: 'Tailored curriculum based on your experience level'
      },
      {
        type: 'interactive_materials',
        title: 'Interactive Learning Materials',
        description: 'Exercises and tools to practice what you learn'
      },
      {
        type: 'progress_system',
        title: 'Progress Tracking',
        description: 'System to track your learning milestones'
      }
    ],
    timeline: 'immediate',
    follow_ups: ['learning_check_in', 'completion_celebration']
  };
}

/**
 * Software fulfillment: Deliver tools and implementation support
 */
async function createSoftwareFulfillment(customerIntent, businessData) {
  return {
    type: 'software_onboarding',
    deliverables: [
      {
        type: 'custom_setup',
        title: 'Personalized Setup',
        description: 'Software configured for your specific needs'
      },
      {
        type: 'training_materials',
        title: 'Custom Training',
        description: 'Step-by-step training for your use case'
      },
      {
        type: 'success_metrics',
        title: 'Success Tracking',
        description: 'KPIs and metrics to measure your success'
      }
    ],
    timeline: 'within_24h',
    follow_ups: ['onboarding_completion', 'success_review']
  };
}

/**
 * Execute the fulfillment plan - this is where the magic happens
 * Generate actual valuable content and deliver it to the customer
 */
async function executeFulfillment(fulfillmentPlan, saleData, businessData) {
  const deliveredItems = [];
  
  for (const deliverable of fulfillmentPlan.deliverables) {
    try {
      let content;
      
      switch (deliverable.type) {
        case 'personalized_routine':
          content = await generatePersonalizedRoutine(saleData, businessData);
          break;
        case 'custom_audit':
          content = await generateBusinessAudit(saleData, businessData);
          break;
        case 'action_plan':
          content = await generateActionPlan(saleData, businessData);
          break;
        case 'expert_guide':
          content = await generateExpertGuide(saleData, businessData);
          break;
        case 'strategic_analysis':
          content = await generateStrategicAnalysis(saleData, businessData);
          break;
        default:
          content = await generateGenericValue(deliverable, saleData, businessData);
      }
      
      // Store the content and create access link
      const accessLink = await storeContent(content, saleData.id, deliverable.type);
      
      deliveredItems.push({
        ...deliverable,
        content: content,
        access_link: accessLink,
        delivered_at: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Error generating deliverable:', deliverable.type, error);
      // Continue with other deliverables
    }
  }
  
  // Send the fulfillment email with all the value
  await sendFulfillmentEmail(deliveredItems, saleData, businessData);
  
  return {
    plan: fulfillmentPlan,
    delivered_items: deliveredItems,
    total_items: deliveredItems.length,
    fulfillment_date: new Date().toISOString()
  };
}

/**
 * Generate personalized skincare routine (example for skincare e-commerce)
 */
async function generatePersonalizedRoutine(saleData, businessData) {
  const prompt = `
    Create a personalized skincare routine for ${saleData.customer_name}.
    
    They just purchased from ${businessData.name}, indicating they're serious about skincare.
    
    Create a comprehensive routine that includes:
    1. Morning routine (5-7 steps)
    2. Evening routine (5-7 steps)
    3. Weekly treatments
    4. Ingredient explanations
    5. Expected timeline for results
    6. Common mistakes to avoid
    7. Progress tracking suggestions
    
    Make it feel premium and personalized, worth more than what they paid.
    Include specific product types and techniques, not just generic advice.
    
    Format as detailed HTML with styling for a beautiful presentation.
  `;
  
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: "You are a top skincare expert and dermatologist with 20+ years of experience." },
      { role: "user", content: prompt }
    ]
  });
  
  return {
    type: 'personalized_routine',
    title: `${saleData.customer_name}'s Custom Skincare Routine`,
    content: response.choices[0].message.content,
    estimated_value: '$200+',
    time_to_results: '2-4 weeks'
  };
}

/**
 * Generate business audit (for service businesses)
 */
async function generateBusinessAudit(saleData, businessData) {
  const prompt = `
    Create a comprehensive business audit for ${saleData.customer_name}.
    
    Based on their purchase of "${saleData.product_id}" for $${saleData.amount} from ${businessData.name},
    they're looking for ${businessData.business_data?.painPoint || 'business growth'}.
    
    Create a detailed audit that includes:
    1. Current situation assessment
    2. Key strengths and opportunities
    3. Critical gaps and challenges
    4. Market position analysis
    5. 3 immediate action items
    6. 30-60-90 day roadmap
    7. Success metrics to track
    8. Resource recommendations
    
    Make it feel like a $500+ consulting report with specific, actionable insights.
    Use professional business language and structure.
    
    Format as a detailed business report with sections and bullet points.
  `;
  
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: "You are a senior business consultant with expertise in growth strategy and operations." },
      { role: "user", content: prompt }
    ]
  });
  
  return {
    type: 'business_audit',
    title: `Business Growth Audit - ${saleData.customer_name}`,
    content: response.choices[0].message.content,
    estimated_value: '$500+',
    implementation_time: '30-90 days'
  };
}

/**
 * Generate strategic action plan
 */
async function generateActionPlan(saleData, businessData) {
  const prompt = `
    Create a strategic action plan for ${saleData.customer_name}.
    
    They need help with ${businessData.business_data?.painPoint || 'growing their business'}.
    
    Create a step-by-step action plan with:
    1. Clear objectives (specific, measurable)
    2. Week-by-week implementation steps
    3. Resource requirements for each step
    4. Expected outcomes and milestones
    5. Risk mitigation strategies
    6. Success metrics and KPIs
    7. Quick wins (things they can do this week)
    8. Long-term strategic moves
    
    Make it actionable and specific, not generic advice.
    Include timelines, priorities, and success criteria.
    
    Format as a professional strategic plan document.
  `;
  
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: "You are a strategic planning expert who creates actionable business plans." },
      { role: "user", content: prompt }
    ]
  });
  
  return {
    type: 'action_plan',
    title: `Strategic Action Plan - ${saleData.customer_name}`,
    content: response.choices[0].message.content,
    estimated_value: '$300+',
    timeline: '90 days'
  };
}

/**
 * Generate expert guide content
 */
async function generateExpertGuide(saleData, businessData) {
  const niche = businessData.business_data?.niche || 'business';
  
  const prompt = `
    Create an expert guide for ${niche} for ${saleData.customer_name}.
    
    They just invested $${saleData.amount} in this, so deliver premium value.
    
    Create a comprehensive guide that includes:
    1. Industry insider secrets
    2. Step-by-step methodologies
    3. Tools and resources
    4. Common pitfalls and how to avoid them
    5. Advanced strategies for growth
    6. Case studies and examples
    7. Implementation timeline
    8. Troubleshooting common issues
    
    Make it feel like insider knowledge worth 10x what they paid.
    Include specific tactics, not just theory.
    
    Format as a detailed guide with clear sections and actionable content.
  `;
  
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: `You are a top expert in ${niche} with 15+ years of industry experience and insider knowledge.` },
      { role: "user", content: prompt }
    ]
  });
  
  return {
    type: 'expert_guide',
    title: `The Complete ${niche} Expert Guide`,
    content: response.choices[0].message.content,
    estimated_value: '$150+',
    update_frequency: 'quarterly'
  };
}

/**
 * Generate strategic analysis
 */
async function generateStrategicAnalysis(saleData, businessData) {
  const prompt = `
    Create a strategic analysis for ${saleData.customer_name}.
    
    Business context: ${businessData.business_data?.niche || 'general business'}
    Investment level: $${saleData.amount}
    
    Create a comprehensive strategic analysis with:
    1. Market landscape assessment
    2. Competitive positioning
    3. SWOT analysis
    4. Growth opportunities identification
    5. Risk assessment and mitigation
    6. Strategic recommendations
    7. Investment priorities
    8. Success probability assessment
    
    Make it feel like a premium consulting deliverable worth $1000+.
    Include specific insights and data-driven recommendations.
    
    Format as a professional strategic analysis report.
  `;
  
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: "You are a senior strategy consultant from a top-tier consulting firm." },
      { role: "user", content: prompt }
    ]
  });
  
  return {
    type: 'strategic_analysis',
    title: `Strategic Analysis Report - ${saleData.customer_name}`,
    content: response.choices[0].message.content,
    estimated_value: '$1000+',
    validity_period: '6 months'
  };
}

/**
 * Generate generic value content for other deliverable types
 */
async function generateGenericValue(deliverable, saleData, businessData) {
  const prompt = `
    Create ${deliverable.title} for ${saleData.customer_name}.
    
    Description: ${deliverable.description}
    Business context: ${businessData.name} - ${businessData.business_data?.niche || 'general'}
    
    Create valuable content that delivers on the promise of "${deliverable.title}".
    Make it specific, actionable, and worth more than the $${saleData.amount} they paid.
    
    Include practical steps, insider tips, and clear next actions.
    Format as professional content with clear structure.
  `;
  
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: "You are an expert consultant who delivers high-value content and insights." },
      { role: "user", content: prompt }
    ]
  });
  
  return {
    type: deliverable.type,
    title: deliverable.title,
    content: response.choices[0].message.content,
    estimated_value: '$100+',
    delivered_at: new Date().toISOString()
  };
}

/**
 * Store content and create access link
 */
async function storeContent(content, saleId, contentType) {
  // Store in fulfillment_content table
  const { data, error } = await supabase
    .from('fulfillment_content')
    .insert({
      sale_id: saleId,
      content_type: contentType,
      title: content.title,
      content: content.content,
      metadata: {
        estimated_value: content.estimated_value,
        type: content.type,
        timeline: content.timeline,
        validity_period: content.validity_period
      }
    })
    .select()
    .single();
    
  if (error) {
    console.error('Error storing content:', error);
    return null;
  }
  
  // Return access link
  return `${process.env.NEXT_PUBLIC_BASE_URL}/fulfillment/${data.id}`;
}

/**
 * Send beautiful fulfillment email with all the delivered value
 */
async function sendFulfillmentEmail(deliveredItems, saleData, businessData) {
  const totalValue = deliveredItems.reduce((sum, item) => {
    const value = parseInt(item.content.estimated_value?.replace(/[^0-9]/g, '') || '0');
    return sum + value;
  }, 0);
  
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Your Order is Ready!</title>
    </head>
    <body style="margin:0;padding:0;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
      <table border="0" cellpadding="0" cellspacing="0" width="100%">
        <tr>
          <td align="center" style="padding:40px 0">
            <table border="0" cellpadding="0" cellspacing="0" width="600" style="background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 25px rgba(0,0,0,0.1);">
              
              <!-- Header -->
              <tr>
                <td align="center" style="background:linear-gradient(135deg,#10b981 0%,#059669 100%);padding:40px 20px;">
                  <div style="font-size:64px;margin-bottom:20px;">🎉</div>
                  <h1 style="color:#ffffff;font-size:32px;font-weight:800;margin:0 0 12px 0;">
                    Your Order is Ready!
                  </h1>
                  <p style="color:#ffffff;font-size:18px;margin:0;opacity:0.95;">
                    We've prepared something special for you
                  </p>
                </td>
              </tr>

              <!-- Main Content -->
              <tr>
                <td style="padding:40px;">
                  
                  <!-- Personal Message -->
                  <div style="margin-bottom:30px;">
                    <h2 style="color:#1f2937;font-size:24px;font-weight:700;margin:0 0 15px 0;">
                      Hi ${saleData.customer_name}! 👋
                    </h2>
                    <p style="color:#6b7280;font-size:16px;line-height:1.6;margin:0;">
                      Thank you for your purchase from ${businessData.name}! Instead of waiting for shipping, 
                      we've prepared something even better – personalized digital content worth over $${totalValue} 
                      that you can access immediately.
                    </p>
                  </div>

                  <!-- Value Items -->
                  <div style="margin-bottom:30px;">
                    <h3 style="color:#1f2937;font-size:20px;font-weight:600;margin:0 0 20px 0;">
                      🚀 What You're Getting (Value: $${totalValue}+)
                    </h3>
                    
                    ${deliveredItems.map(item => `
                      <div style="background-color:#f9fafb;border-radius:12px;padding:20px;margin-bottom:15px;border-left:4px solid #10b981;">
                        <h4 style="color:#1f2937;font-size:18px;font-weight:600;margin:0 0 8px 0;">
                          ${item.title}
                        </h4>
                        <p style="color:#6b7280;font-size:14px;margin:0 0 12px 0;">
                          ${item.description}
                        </p>
                        <div style="display:flex;align-items:center;gap:15px;">
                          <span style="background-color:#10b981;color:#ffffff;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:600;">
                            Value: ${item.content.estimated_value}
                          </span>
                          <a href="${item.access_link}" style="color:#10b981;text-decoration:none;font-weight:600;font-size:14px;">
                            Access Now →
                          </a>
                        </div>
                      </div>
                    `).join('')}
                  </div>

                  <!-- Next Steps -->
                  <div style="background-color:#eff6ff;border-radius:12px;padding:25px;margin-bottom:25px;">
                    <h3 style="color:#1e40af;font-size:18px;font-weight:600;margin:0 0 15px 0;">
                      💡 Next Steps
                    </h3>
                    <ol style="color:#1e40af;margin:0;padding-left:20px;">
                      <li style="margin-bottom:8px;">Click the links above to access your content</li>
                      <li style="margin-bottom:8px;">Bookmark the pages for future reference</li>
                      <li style="margin-bottom:8px;">Start implementing the recommendations</li>
                      <li>Reply to this email if you have any questions</li>
                    </ol>
                  </div>

                  <!-- CTA -->
                  <div style="text-align:center;margin-bottom:25px;">
                    <a href="${deliveredItems[0]?.access_link}" style="display:inline-block;background:linear-gradient(135deg,#10b981 0%,#059669 100%);color:#ffffff;text-decoration:none;padding:16px 32px;border-radius:8px;font-weight:700;font-size:16px;">
                      🎯 Start Exploring Your Content
                    </a>
                  </div>

                  <!-- Guarantee -->
                  <div style="text-align:center;padding:20px;background-color:#fef3c7;border-radius:8px;">
                    <p style="color:#92400e;font-size:14px;font-weight:600;margin:0;">
                      💰 30-Day Money-Back Guarantee
                    </p>
                    <p style="color:#92400e;font-size:12px;margin:5px 0 0 0;">
                      If you don't find value in this content, we'll refund you completely.
                    </p>
                  </div>

                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td align="center" style="padding:30px;border-top:1px solid #e5e7eb;">
                  <p style="color:#6b7280;font-size:14px;margin:0 0 10px 0;">
                    Questions? Just reply to this email – we're here to help! 🤝
                  </p>
                  <p style="color:#9ca3af;font-size:12px;margin:0;">
                    © 2025 ${businessData.name}. Delivered by Launchfly AI.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  await resend.emails.send({
    from: `${businessData.name} <hello@launchfly.ai>`,
    to: saleData.customer_email,
    subject: `🎉 Your ${businessData.name} order is ready - $${totalValue}+ value inside!`,
    html: htmlContent
  });
}

/**
 * Schedule follow-up emails to ensure customer satisfaction
 */
async function scheduleFollowUp(saleData, deliveredValue) {
  // This would integrate with your email system to send follow-ups
  // For now, we'll log the intent
  console.log('📅 Scheduling follow-up for sale:', saleData.id);
  
  // Store follow-up tasks
  await supabase
    .from('fulfillment_followups')
    .insert({
      sale_id: saleData.id,
      follow_up_type: 'satisfaction_check',
      scheduled_for: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      status: 'pending'
    });
}

/**
 * Record fulfillment completion in database
 */
async function recordFulfillment(saleId, deliveredValue) {
  await supabase
    .from('fulfillments')
    .insert({
      sale_id: saleId,
      status: 'completed',
      delivered_items: deliveredValue.delivered_items,
      total_value: deliveredValue.delivered_items.reduce((sum, item) => {
        const value = parseInt(item.content.estimated_value?.replace(/[^0-9]/g, '') || '0');
        return sum + value;
      }, 0),
      fulfillment_type: deliveredValue.plan.type,
      completed_at: new Date().toISOString()
    });
}

/**
 * Fallback value delivery when main fulfillment fails
 */
async function sendFallbackValue(saleData, businessData) {
  const fallbackContent = `
    <h1>Thank you for your purchase, ${saleData.customer_name}!</h1>
    <p>We're preparing your personalized content and will send it within 24 hours.</p>
    <p>In the meantime, here are 3 quick tips to get started:</p>
    <ol>
      <li>Set clear goals for what you want to achieve</li>
      <li>Create a dedicated workspace for implementation</li>
      <li>Block time in your calendar for focused work</li>
    </ol>
    <p>Questions? Just reply to this email!</p>
  `;
  
  await resend.emails.send({
    from: `${businessData.name} <support@launchfly.ai>`,
    to: saleData.customer_email,
    subject: `Thank you for your purchase from ${businessData.name}!`,
    html: fallbackContent
  });
}
