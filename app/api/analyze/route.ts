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
      useEmojis = false,
      useNumbering = true,
      useHashtags = false,
      suggestPages = false,
      pageTexts = [],
    } = await req.json();

    if (!text && !suggestPages) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    if (suggestPages && (!pageTexts || pageTexts.length === 0)) {
      return NextResponse.json({ error: 'Page texts are required for suggestions' }, { status: 400 });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'Anthropic API key not configured' }, { status: 500 });
    }

    // Build dynamic system prompt
    let systemPrompt = '';
    if (customInstructions && customInstructions.trim().length > 0) {
      systemPrompt += `Your top priority is to follow the user's instructions below, even if it means adopting a different tone, style, or political perspective than the original document.\nUser Instructions: ${customInstructions.trim()}\n`;
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
    if (useEmojis) {
      systemPrompt += `10. Emojis: Use relevant emojis to enhance the posts.\n`;
    } else {
      systemPrompt += `10. Emojis: Do NOT use emojis.\n`;
    }
    if (useNumbering) {
      systemPrompt += `11. Numbering: Add number sequencing to each post (e.g., 1/${numPosts}, 2/${numPosts}, ...).\n`;
    } else {
      systemPrompt += `11. Numbering: Do NOT add number sequencing to the posts.\n`;
    }
    if (useHashtags) {
      systemPrompt += `12. Hashtags: Add relevant hashtags to the end of each post.\n`;
    } else {
      systemPrompt += `12. Hashtags: Do NOT use hashtags.\n`;
    }
    systemPrompt += `13. CRITICAL: Your entire response must ONLY be the raw JSON object. Do not include any introductory text, explanations, or markdown code fences like \`\`\`json.`;

    // User message
    let userMessage = '';
    if (customInstructions && customInstructions.trim().length > 0) {
      userMessage += `Follow these user instructions: ${customInstructions.trim()}\n\n`;
    }
    userMessage += `Please generate the X thread following the guidelines.\n\n`;
    userMessage += text;

    // Handle thread generation
    let threadResponse = null;
    if (!suggestPages) {
      const msg = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 2048,
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
      threadResponse = JSON.parse(jsonString);
    }

    // Handle page suggestions
    let pageSuggestions = null;
    if (suggestPages && pageTexts.length > 0) {
      // Build page suggestion prompt
      let suggestionPrompt = 'You are an expert content curator. Your task is to analyze document pages and suggest the best ones for creating an engaging social media thread.\n\n';
      
      if (customInstructions && customInstructions.trim().length > 0) {
        suggestionPrompt += `Focus Area: ${customInstructions.trim()}\n\n`;
      }
      
      suggestionPrompt += `Guidelines:\n`;
      suggestionPrompt += `1. Analyze each page for content that would make compelling social media posts\n`;
      suggestionPrompt += `2. Consider visual appeal, key insights, quotable content, and relevance to the focus area\n`;
      suggestionPrompt += `3. Score each page from 1-100 for relevance and engagement potential\n`;
      suggestionPrompt += `4. Suggest what kind of post each page would make\n`;
      suggestionPrompt += `5. Only recommend the top ${Math.min(numPosts + 2, 10)} pages\n`;
      suggestionPrompt += `6. Output must be valid JSON in this exact format:\n`;
      suggestionPrompt += `{\n`;
      suggestionPrompt += `  "suggestions": [\n`;
      suggestionPrompt += `    {\n`;
      suggestionPrompt += `      "pageNumber": 1,\n`;
      suggestionPrompt += `      "relevanceScore": 85,\n`;
      suggestionPrompt += `      "suggestedPost": "Brief description of what this page would contribute to the thread",\n`;
      suggestionPrompt += `      "reasoning": "Why this page is valuable for the thread",\n`;
      suggestionPrompt += `      "keyQuotes": ["Important quote 1", "Important quote 2"],\n`;
      suggestionPrompt += `      "confidence": "high"\n`;
      suggestionPrompt += `    }\n`;
      suggestionPrompt += `  ]\n`;
      suggestionPrompt += `}\n\n`;
      
      // Add page content
      let pageContent = '';
      pageTexts.forEach((pageText: string, index: number) => {
        pageContent += `=== PAGE ${index + 1} ===\n${pageText}\n\n`;
      });
      
      const suggestionMsg = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 3000,
        system: suggestionPrompt,
        messages: [
          {
            role: 'user',
            content: `Please analyze these pages and suggest the best ones for creating a social media thread:\n\n${pageContent}`,
          },
        ],
      });

      if (suggestionMsg.content && suggestionMsg.content.length > 0 && suggestionMsg.content[0].type === 'text') {
        const rawSuggestionResponse = suggestionMsg.content[0].text;
        const suggestionJsonMatch = rawSuggestionResponse.match(/\{[\s\S]*\}/);
        
        if (suggestionJsonMatch) {
          try {
            const suggestionData = JSON.parse(suggestionJsonMatch[0]);
            pageSuggestions = suggestionData.suggestions || [];
          } catch (error) {
            console.error('Error parsing page suggestions:', error);
          }
        }
      }
    }

    // Return combined response
    const response: any = {};
    if (threadResponse) {
      response.thread = threadResponse.thread;
    }
    if (pageSuggestions) {
      response.pageSuggestions = pageSuggestions;
    }

    return NextResponse.json(response);

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