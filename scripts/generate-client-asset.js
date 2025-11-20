#!/usr/bin/env node
/**
 * Client Asset Factory Script
 * 
 * Use this to manually generate lead magnets, guides, and other content
 * for your $297 "24-Hour Lead Magnet Funnel" service.
 * 
 * Usage:
 *   node scripts/generate-client-asset.js --type expert-guide --topic "Weight Loss for Dads" --niche fitness
 *   node scripts/generate-client-asset.js --type action-plan --topic "Starting a Coaching Business" --niche business
 *   node scripts/generate-client-asset.js --type business-audit --topic "Marketing Audit" --niche marketing
 * 
 * Output: Saves to scripts/output/[type]-[timestamp].md
 */

import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env.local
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Ensure output directory exists
const outputDir = path.join(__dirname, 'output');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

/**
 * Generate Expert Guide (Perfect for Lead Magnets)
 */
async function generateExpertGuide(topic, niche, clientName = 'Your Client') {
  const prompt = `
    Create a comprehensive, high-value expert guide for ${clientName} about "${topic}" in the ${niche} niche.
    
    This is a LEAD MAGNET - a free resource that coaches give away to grow their email list.
    It needs to be valuable enough that people will give their email address for it.
    
    Create a detailed guide (15-25 pages when formatted) that includes:
    
    1. **Introduction** (Hook them immediately)
       - Why this guide matters
       - What they'll learn
       - Who this is for
    
    2. **Core Content** (The meat)
       - Step-by-step methodologies
       - Industry insider secrets
       - Specific tactics and strategies
       - Tools and resources
       - Real examples and case studies
    
    3. **Implementation Guide**
       - How to get started TODAY
       - Week-by-week action plan
       - Common pitfalls and how to avoid them
       - Troubleshooting guide
    
    4. **Advanced Strategies**
       - Next-level tactics
       - Scaling strategies
       - Long-term success factors
    
    5. **Resources & Next Steps**
       - Recommended tools
       - Further reading
       - How to get more help
    
    Make it feel like insider knowledge worth $500+.
    Include specific, actionable content - not generic advice.
    Write in a conversational, engaging tone that builds trust.
    Use examples, stories, and specific numbers where possible.
    
    Format as markdown with clear headings and sections.
    Make it professional but approachable.
  `;
  
  console.log(`📝 Generating Expert Guide: "${topic}" for ${niche} niche...`);
  
  const response = await openai.chat.completions.create({
    model: "gpt-4o", // Using premium model for client-ready quality
    messages: [
      { 
        role: "system", 
        content: `You are a top expert in ${niche} with 15+ years of industry experience. You create high-value lead magnets that coaches use to grow their email lists. Your guides are detailed, actionable, and worth 10x what they cost to create.` 
      },
      { role: "user", content: prompt }
    ],
    temperature: 0.7,
    max_tokens: 4000, // Generous token limit for comprehensive guide
  });
  
  return {
    type: 'expert-guide',
    title: `The Complete Guide to ${topic}`,
    content: response.choices[0].message.content,
    topic,
    niche,
    clientName,
    estimatedValue: '$500+',
    pageCount: '15-25 pages',
    tokensUsed: response.usage?.total_tokens || 0
  };
}

/**
 * Generate Action Plan (Perfect for Roadmaps)
 */
async function generateActionPlan(topic, niche, clientName = 'Your Client') {
  const prompt = `
    Create a strategic action plan for ${clientName} about "${topic}" in the ${niche} niche.
    
    This is a ROADMAP that coaches give to their clients to help them achieve specific goals.
    
    Create a detailed, step-by-step action plan that includes:
    
    1. **Goal Setting**
       - Clear, specific objectives
       - Success metrics and KPIs
       - Timeline expectations
    
    2. **Week-by-Week Plan** (12 weeks)
       - Week 1-4: Foundation
       - Week 5-8: Implementation
       - Week 9-12: Optimization
    
    3. **Daily Actions**
       - Specific tasks for each day
       - Priorities and focus areas
       - Quick wins to build momentum
    
    4. **Resource Requirements**
       - Tools needed
       - Skills to develop
       - Support systems
    
    5. **Milestones & Checkpoints**
       - What success looks like at each stage
       - How to measure progress
       - When to adjust the plan
    
    6. **Risk Mitigation**
       - Common obstacles
       - How to overcome them
       - Backup strategies
    
    Make it actionable and specific - not generic advice.
    Include timelines, priorities, and success criteria.
    Format as a professional strategic plan document.
  `;
  
  console.log(`📋 Generating Action Plan: "${topic}" for ${niche} niche...`);
  
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { 
        role: "system", 
        content: `You are a strategic planning expert who creates actionable business plans. Your plans are detailed, specific, and help people achieve real results.` 
      },
      { role: "user", content: prompt }
    ],
    temperature: 0.7,
    max_tokens: 4000,
  });
  
  return {
    type: 'action-plan',
    title: `${topic} - Strategic Action Plan`,
    content: response.choices[0].message.content,
    topic,
    niche,
    clientName,
    estimatedValue: '$300+',
    timeline: '12 weeks',
    tokensUsed: response.usage?.total_tokens || 0
  };
}

/**
 * Generate Business Audit (Perfect for Consultants)
 */
async function generateBusinessAudit(topic, niche, clientName = 'Your Client') {
  const prompt = `
    Create a comprehensive business audit for ${clientName} about "${topic}" in the ${niche} niche.
    
    This is a DIAGNOSTIC TOOL that consultants use to identify opportunities and problems.
    
    Create a detailed audit that includes:
    
    1. **Current State Analysis**
       - Where they are now
       - Strengths and weaknesses
       - Key metrics and performance indicators
    
    2. **Gap Analysis**
       - Where they want to be
       - What's missing
       - Opportunities for improvement
    
    3. **Detailed Assessment** (by area)
       - Marketing & Sales
       - Operations & Systems
       - Financial Health
       - Team & Culture
       - Customer Experience
    
    4. **Priority Recommendations**
       - Quick wins (do this week)
       - High-impact changes (do this month)
       - Strategic initiatives (do this quarter)
    
    5. **Implementation Roadmap**
       - What to do first
       - Dependencies and sequencing
       - Resource requirements
    
    6. **Success Metrics**
       - How to measure improvement
       - Key performance indicators
       - Expected outcomes
    
    Make it feel like a premium consulting deliverable worth $1000+.
    Include specific insights and data-driven recommendations.
    Format as a professional audit report.
  `;
  
  console.log(`🔍 Generating Business Audit: "${topic}" for ${niche} niche...`);
  
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { 
        role: "system", 
        content: `You are a senior business consultant from a top-tier consulting firm. Your audits are thorough, insightful, and help businesses identify real opportunities for growth.` 
      },
      { role: "user", content: prompt }
    ],
    temperature: 0.7,
    max_tokens: 4000,
  });
  
  return {
    type: 'business-audit',
    title: `${topic} - Business Audit Report`,
    content: response.choices[0].message.content,
    topic,
    niche,
    clientName,
    estimatedValue: '$1000+',
    validityPeriod: '6 months',
    tokensUsed: response.usage?.total_tokens || 0
  };
}

/**
 * Generate Personalized Routine (Perfect for Wellness/Fitness)
 */
async function generatePersonalizedRoutine(topic, niche, clientName = 'Your Client') {
  const prompt = `
    Create a personalized routine for ${clientName} about "${topic}" in the ${niche} niche.
    
    This is a CUSTOMIZED PLAN that coaches give to their clients based on their specific needs.
    
    Create a detailed routine that includes:
    
    1. **Assessment & Goals**
       - Current situation
       - Specific goals
       - Timeline expectations
    
    2. **Daily Routine**
       - Morning routine (detailed steps)
       - Afternoon routine
       - Evening routine
       - Weekly schedule
    
    3. **Progressive Plan**
       - Week 1-2: Foundation
       - Week 3-4: Building
       - Week 5-8: Optimization
       - Week 9-12: Mastery
    
    4. **Specific Instructions**
       - Exact steps to follow
       - Dos and don'ts
       - Modifications for different situations
    
    5. **Support Materials**
       - Tracking tools
       - Progress checkpoints
       - Troubleshooting guide
    
    6. **Expected Results**
       - What to expect and when
       - How to measure progress
       - Success indicators
    
    Make it feel premium and personalized, worth more than what they paid.
    Include specific actions, not just generic advice.
    Format as a detailed routine with clear sections.
  `;
  
  console.log(`💪 Generating Personalized Routine: "${topic}" for ${niche} niche...`);
  
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { 
        role: "system", 
        content: `You are a top expert in ${niche} with 20+ years of experience. You create personalized routines that help people achieve real results.` 
      },
      { role: "user", content: prompt }
    ],
    temperature: 0.7,
    max_tokens: 4000,
  });
  
  return {
    type: 'personalized-routine',
    title: `Personalized ${topic} Routine`,
    content: response.choices[0].message.content,
    topic,
    niche,
    clientName,
    estimatedValue: '$200+',
    timeToResults: '2-4 weeks',
    tokensUsed: response.usage?.total_tokens || 0
  };
}

/**
 * Save content to file
 */
function saveContent(result) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const filename = `${result.type}-${timestamp}.md`;
  const filepath = path.join(outputDir, filename);
  
  const content = `# ${result.title}

**Generated:** ${new Date().toLocaleString()}
**Topic:** ${result.topic}
**Niche:** ${result.niche}
**Client:** ${result.clientName}
**Estimated Value:** ${result.estimatedValue}
${result.pageCount ? `**Page Count:** ${result.pageCount}` : ''}
${result.timeline ? `**Timeline:** ${result.timeline}` : ''}
${result.timeToResults ? `**Time to Results:** ${result.timeToResults}` : ''}
${result.validityPeriod ? `**Validity Period:** ${result.validityPeriod}` : ''}
**Tokens Used:** ${result.tokensUsed}

---

${result.content}
`;
  
  fs.writeFileSync(filepath, content, 'utf8');
  
  console.log(`✅ Content saved to: ${filepath}`);
  console.log(`📊 Stats:`);
  console.log(`   - Type: ${result.type}`);
  console.log(`   - Title: ${result.title}`);
  console.log(`   - Estimated Value: ${result.estimatedValue}`);
  console.log(`   - Tokens Used: ${result.tokensUsed}`);
  console.log(`   - File: ${filename}`);
  
  return filepath;
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);
  
  // Parse arguments
  let type = null;
  let topic = null;
  let niche = 'business';
  let clientName = 'Your Client';
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--type' && args[i + 1]) {
      type = args[i + 1];
      i++;
    } else if (args[i] === '--topic' && args[i + 1]) {
      topic = args[i + 1];
      i++;
    } else if (args[i] === '--niche' && args[i + 1]) {
      niche = args[i + 1];
      i++;
    } else if (args[i] === '--client' && args[i + 1]) {
      clientName = args[i + 1];
      i++;
    }
  }
  
  // Validate required arguments
  if (!type) {
    console.error('❌ Error: --type is required');
    console.log('\nUsage:');
    console.log('  node scripts/generate-client-asset.js --type <type> --topic "<topic>" [--niche <niche>] [--client "<name>"]');
    console.log('\nTypes:');
    console.log('  - expert-guide    (Perfect for Lead Magnets)');
    console.log('  - action-plan     (Perfect for Roadmaps)');
    console.log('  - business-audit  (Perfect for Consultants)');
    console.log('  - personalized-routine (Perfect for Wellness/Fitness)');
    console.log('\nExamples:');
    console.log('  node scripts/generate-client-asset.js --type expert-guide --topic "Weight Loss for Dads" --niche fitness');
    console.log('  node scripts/generate-client-asset.js --type action-plan --topic "Starting a Coaching Business" --niche business');
    console.log('  node scripts/generate-client-asset.js --type business-audit --topic "Marketing Audit" --niche marketing --client "Sarah\'s Coaching"');
    process.exit(1);
  }
  
  if (!topic) {
    console.error('❌ Error: --topic is required');
    console.log('Example: --topic "Weight Loss for Dads"');
    process.exit(1);
  }
  
  // Check for OpenAI API key
  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ Error: OPENAI_API_KEY environment variable not set');
    console.log('Set it with: export OPENAI_API_KEY=your-key-here');
    process.exit(1);
  }
  
  // Generate content based on type
  let result;
  
  try {
    switch (type) {
      case 'expert-guide':
        result = await generateExpertGuide(topic, niche, clientName);
        break;
      case 'action-plan':
        result = await generateActionPlan(topic, niche, clientName);
        break;
      case 'business-audit':
        result = await generateBusinessAudit(topic, niche, clientName);
        break;
      case 'personalized-routine':
        result = await generatePersonalizedRoutine(topic, niche, clientName);
        break;
      default:
        console.error(`❌ Error: Unknown type "${type}"`);
        console.log('Valid types: expert-guide, action-plan, business-audit, personalized-routine');
        process.exit(1);
    }
    
    // Save to file
    const filepath = saveContent(result);
    
    console.log('\n🎉 Success! Your content is ready.');
    console.log(`\n📝 Next steps:`);
    console.log(`   1. Review the content: ${filepath}`);
    console.log(`   2. Copy to Google Docs or Canva for formatting`);
    console.log(`   3. Create PDF for client delivery`);
    console.log(`   4. Use Launchfly to generate landing page`);
    
  } catch (error) {
    console.error('❌ Error generating content:', error.message);
    if (error.response) {
      console.error('OpenAI API Error:', error.response.data);
    }
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export {
  generateExpertGuide,
  generateActionPlan,
  generateBusinessAudit,
  generatePersonalizedRoutine
};

