import Anthropic from '@anthropic-ai/sdk';
import { NextResponse } from 'next/server';

// Initialize the Anthropic client with the API key from environment variables
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(req: Request) {
  try {
    const { text } = await req.json();

    if (!text) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'Anthropic API key not configured' }, { status: 500 });
    }

    const systemPrompt = `You are a legal analyst and social media expert. Your task is to analyze a legal document and break it down into a series of clear, concise, and engaging posts for X (formerly Twitter).

    Guidelines:
    1.  **Analyze the Text:** Read the provided legal document text carefully.
    2.  **Identify Key Points:** Extract the most critical information: the main issue, the court's holding, key arguments, and the overall significance.
    3.  **Simplify Language:** Translate complex legal jargon into plain English that a layperson can easily understand.
    4.  **Create a Thread:** Structure your output as a JSON object containing an array of strings, where each string is a single post in the thread.
    5.  **Character Limits:** Keep each post under 280 characters.
    6.  **Hook the Reader:** The first post should be a strong hook that grabs attention.
    7.  **Maintain Neutrality:** Present the information factually and without personal bias.
    8.  **Output Format:** Your final output MUST be a valid JSON object in the format: { "thread": ["Post 1 text...", "Post 2 text...", "Post 3 text..."] }
    9.  **CRITICAL:** Your entire response must ONLY be the raw JSON object. Do not include any introductory text, explanations, or markdown code fences like \`\`\`json.`;

    const msg = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: `Here is the legal document text. Please generate the X thread based on the guidelines:\n\n${text}`,
        },
      ],
    });

    if (!msg.content || msg.content.length === 0 || msg.content[0].type !== 'text') {
      return NextResponse.json({ error: 'Invalid response from AI' }, { status: 500 });
    }

    const rawResponse = msg.content[0].text;
    
    // Find the JSON object within the AI's response
    const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("AI response did not contain a valid JSON object:", rawResponse);
      return NextResponse.json({ error: 'AI did not return a parsable JSON object.' }, { status: 500 });
    }
    
    const jsonString = jsonMatch[0];
    const jsonResponse = JSON.parse(jsonString);

    return NextResponse.json(jsonResponse);

  } catch (error) {
    // Log the actual error for better debugging
    if (error instanceof Error) {
      console.error('Error analyzing document:', error.message);
    } else {
      console.error('An unknown error occurred:', error);
    }
    return NextResponse.json({ error: 'Failed to analyze document' }, { status: 500 });
  }
} 