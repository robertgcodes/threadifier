import Anthropic from '@anthropic-ai/sdk';
import { NextResponse } from 'next/server';

// Initialize the Anthropic client with the API key from environment variables
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(req: Request) {
  try {
    const {
      text,
      charLimit = 280,
      numPosts = 5,
      customInstructions = '',
      tone = 'Neutral',
      useEmojis = false,
      useNumbering = true,
      audience = 'General',
    } = await req.json();

    if (!text) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'Anthropic API key not configured' }, { status: 500 });
    }

    // Build dynamic system prompt
    let systemPrompt = '';
    if (audience && audience !== 'General') {
      systemPrompt += `Your top priority is to write for a ${audience} audience. Use language, tone, and examples that resonate with this group.\n`;
    }
    systemPrompt += `You are a legal analyst and social media expert. Your task is to analyze a legal document and break it down into a series of clear, concise, and engaging posts for X (formerly Twitter).\n\n`;
    systemPrompt += `Guidelines:\n`;
    systemPrompt += `1. Analyze the Text: Read the provided legal document text carefully.\n`;
    systemPrompt += `2. Identify Key Points: Extract the most critical information: the main issue, the court's holding, key arguments, and the overall significance.\n`;
    systemPrompt += `3. Simplify Language: Translate complex legal jargon into plain English that a layperson can easily understand.\n`;
    systemPrompt += `4. Create a Thread: Structure your output as a JSON object containing an array of strings, where each string is a single post in the thread.\n`;
    systemPrompt += `5. Character Limits: Keep each post under ${charLimit} characters.\n`;
    systemPrompt += `6. Number of Posts: Generate exactly ${numPosts} posts in the thread.\n`;
    systemPrompt += `7. Hook the Reader: The first post should be a strong hook that grabs attention.\n`;
    systemPrompt += `8. Maintain Neutrality: Present the information factually and without personal bias, unless otherwise specified.\n`;
    systemPrompt += `9. Output Format: Your final output MUST be a valid JSON object in the format: { "thread": ["Post 1 text...", "Post 2 text...", "Post 3 text..."] }\n`;
    if (tone && tone !== 'Neutral') {
      systemPrompt += `10. Tone/Style: Write in a "${tone}" style.\n`;
    }
    if (useEmojis) {
      systemPrompt += `11. Emojis: Use relevant emojis to enhance the posts.\n`;
    } else {
      systemPrompt += `11. Emojis: Do NOT use emojis.\n`;
    }
    if (useNumbering) {
      systemPrompt += `12. Numbering: Add number sequencing to each post (e.g., 1/${numPosts}, 2/${numPosts}, ...).\n`;
    } else {
      systemPrompt += `12. Numbering: Do NOT add number sequencing to the posts.\n`;
    }
    if (customInstructions && customInstructions.trim().length > 0) {
      systemPrompt += `13. Custom Instructions: ${customInstructions.trim()}\n`;
    }
    systemPrompt += `14. CRITICAL: Your entire response must ONLY be the raw JSON object. Do not include any introductory text, explanations, or markdown code fences like \`\`\`json.`;

    // User message with audience emphasis
    let userMessage = '';
    if (audience && audience !== 'General') {
      userMessage += `Please generate the X thread for a ${audience} audience, following the guidelines.\n\n`;
    } else {
      userMessage += `Please generate the X thread following the guidelines.\n\n`;
    }
    userMessage += text;

    const msg = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: userMessage,
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