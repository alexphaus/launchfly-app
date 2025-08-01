import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function GET() {
  try {
    console.log('Testing OpenAI API connection...');
    console.log('API Key exists:', !!process.env.OPENAI_API_KEY);
    console.log('API Key length:', process.env.OPENAI_API_KEY?.length);
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "user", content: "Say 'Hello, the API is working!'" }
      ],
      max_tokens: 50
    });
    
    console.log('OpenAI response:', response.choices[0].message.content);
    
    return Response.json({ 
      success: true, 
      message: response.choices[0].message.content,
      model: response.model,
      usage: response.usage
    });
  } catch (error) {
    console.error('OpenAI API error:', error);
    return Response.json({ 
      success: false, 
      error: error.message,
      code: error.code,
      type: error.type
    }, { status: 500 });
  }
}
