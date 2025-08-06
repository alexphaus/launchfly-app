/**
 * @fileoverview OpenAI client configuration for AI Sales Agent
 * Handles GPT-4o initialization and streaming setup
 */

import OpenAI from 'openai';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Model configuration
export const AI_CONFIG = {
  model: 'gpt-4o',
  temperature: 0.7,
  max_tokens: 500,
  stream: true,
  presence_penalty: 0.1,
  frequency_penalty: 0.1,
};

// Export configured client
export default openai;