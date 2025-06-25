import Anthropic from '@anthropic-ai/sdk';
import { NextResponse } from 'next/server';
import { getUserProfile, getUserMonthlyUsage } from '../../lib/database';
import { checkUsageLimits, estimateApiCost, USAGE_LIMITS } from '../../lib/usage-limits';

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
      globalAIInstructions = '',
      useEmojis = false,
      useNumbering = true,
      useHashtags = false,
      suggestPages = false,
      pageTexts = [],
      suggestPostImages = false,
      threadPosts = [],
      userId, // Pass from frontend
    } = await req.json();

    console.log('API Request received:', {
      hasText: !!text,
      suggestPages,
      suggestPostImages,
      pageTextsLength: pageTexts.length,
      threadPostsLength: threadPosts.length
    });

    if (!text && !suggestPages && !suggestPostImages) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    if (suggestPages && (!pageTexts || pageTexts.length === 0)) {
      return NextResponse.json({ error: 'Page texts are required for suggestions' }, { status: 400 });
    }

    if (suggestPostImages && (!pageTexts || pageTexts.length === 0 || !threadPosts || threadPosts.length === 0)) {
      return NextResponse.json({ error: 'Page texts and thread posts are required for post image suggestions' }, { status: 400 });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'Anthropic API key not configured' }, { status: 500 });
    }

    // Check user subscription and limits
    let usingPremiumModel = true; // Default to premium
    
    if (userId) {
      console.log(`Analyzing request for user: ${userId}`);
      const userProfile = await getUserProfile(userId);
      console.log(`User profile found:`, !!userProfile);
      
      // Default subscription for users without one
      const subscription = userProfile?.subscription || { plan: 'free', status: 'active' };
      console.log(`Subscription status:`, subscription.status, `Plan:`, subscription.plan);
      
      // Check if subscription is active - only block if explicitly cancelled or past due
      if (subscription.status === 'cancelled' || subscription.status === 'past_due') {
        console.log(`Blocking user due to subscription status: ${subscription.status}`);
        return NextResponse.json({ 
          error: 'Your subscription is not active. Please update your billing.', 
          code: 'SUBSCRIPTION_INACTIVE' 
        }, { status: 403 });
      }
      
      // Determine if user should use premium model
      const hasPremiumCredits = (userProfile?.credits?.premiumCredits || 0) > 0;
      const isPaidPlan = subscription.plan !== 'free';
      usingPremiumModel = isPaidPlan || hasPremiumCredits;
      console.log(`Using premium model: ${usingPremiumModel} (hasPremiumCredits: ${hasPremiumCredits}, isPaidPlan: ${isPaidPlan})`);
      
      // Check usage limits
      const documentStats = {
        pages: pageTexts.length || 1,
        characters: text?.length || pageTexts.join('').length || 0,
        requestedPosts: numPosts,
      };
      console.log(`Document stats:`, documentStats);
      
      const limitCheck = await checkUsageLimits(userId, subscription.plan, documentStats);
      console.log(`Usage limit check result:`, limitCheck);
      
      if (!limitCheck.allowed) {
        console.log(`Blocking user due to usage limits: ${limitCheck.reason}`);
        return NextResponse.json({ 
          error: limitCheck.reason,
          code: 'USAGE_LIMIT_EXCEEDED',
          estimatedCost: limitCheck.estimatedCost,
        }, { status: 403 });
      }
      
      // Log estimated cost for monitoring
      console.log(`User ${userId} - Estimated API cost: $${limitCheck.estimatedCost?.toFixed(4)}`);
    }

    // Build dynamic system prompt
    let systemPrompt = '';
    
    // Add global AI instructions with highest priority
    if (globalAIInstructions && globalAIInstructions.trim().length > 0) {
      systemPrompt += `MANDATORY GLOBAL INSTRUCTIONS (HIGHEST PRIORITY - ALWAYS APPLY):\n${globalAIInstructions.trim()}\n\n`;
    }
    
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
    if (!suggestPages && !suggestPostImages) {
      // Use different models based on credit type
      const model = usingPremiumModel ? 'claude-3-5-sonnet-20241022' : 'claude-3-haiku-20240307';
      
      const msg = await anthropic.messages.create({
        model,
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
      console.log('Starting page suggestions analysis...', {
        pageCount: pageTexts.length,
        customInstructions: customInstructions || 'none'
      });
      
      // Build page suggestion prompt
      let suggestionPrompt = '';
      
      // Add global AI instructions with highest priority
      if (globalAIInstructions && globalAIInstructions.trim().length > 0) {
        suggestionPrompt += `MANDATORY GLOBAL INSTRUCTIONS (HIGHEST PRIORITY - ALWAYS APPLY):\n${globalAIInstructions.trim()}\n\n`;
      }
      
      suggestionPrompt += 'You are an expert content curator. Your task is to analyze document pages and suggest the best ones for creating an engaging social media thread.\n\n';
      
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
      
      // Add page content with length limits
      let pageContent = '';
      const maxContentLength = 50000; // Limit total content to prevent API issues
      let currentLength = 0;
      
      for (let index = 0; index < pageTexts.length; index++) {
        const pageText = pageTexts[index];
        const pageSection = `=== PAGE ${index + 1} ===\n${pageText}\n\n`;
        
        if (currentLength + pageSection.length > maxContentLength) {
          pageContent += `\n[Content truncated - analyzed ${index + 1} of ${pageTexts.length} pages]\n`;
          break;
        }
        
        pageContent += pageSection;
        currentLength += pageSection.length;
      }
      
      console.log('Sending page analysis request to Anthropic...', {
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 3000,
        contentLength: pageContent.length
      });

      const suggestionMsg = await anthropic.messages.create({
        model: usingPremiumModel ? 'claude-3-5-sonnet-20241022' : 'claude-3-haiku-20240307',
        max_tokens: 3000,
        system: suggestionPrompt,
        messages: [
          {
            role: 'user',
            content: `Please analyze these pages and suggest the best ones for creating a social media thread:\n\n${pageContent}`,
          },
        ],
      });

      console.log('Received response from Anthropic for page suggestions');

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

    // Handle post-specific image suggestions
    let postImageSuggestions = null;
    if (suggestPostImages && threadPosts.length > 0 && pageTexts.length > 0) {
      console.log('Starting post-specific image suggestions...', {
        postCount: threadPosts.length,
        pageCount: pageTexts.length
      });
      
      // Build post-specific image suggestion prompt
      let postImagePrompt = '';
      
      // Add global AI instructions with highest priority
      if (globalAIInstructions && globalAIInstructions.trim().length > 0) {
        postImagePrompt += `MANDATORY GLOBAL INSTRUCTIONS (HIGHEST PRIORITY - ALWAYS APPLY):\\n${globalAIInstructions.trim()}\\n\\n`;
      }
      
      postImagePrompt += 'You are an expert at matching social media post content with relevant document pages. Your task is to strategically match every thread post with the best possible page images, considering document structure and page types.\\n\\n';
      
      if (customInstructions && customInstructions.trim().length > 0) {
        postImagePrompt += `Focus Area: ${customInstructions.trim()}\\n\\n`;
      }
      
      postImagePrompt += `CRITICAL REQUIREMENTS:\\n`;
      postImagePrompt += `- EVERY post must have at least 2-3 image suggestions (even if lower relevance)\\n`;
      postImagePrompt += `- Ensure good distribution - don\\'t recommend the same page for multiple posts unless highly relevant\\n\\n`;
      
      postImagePrompt += `SMART PAGE TYPE DETECTION:\\n`;
      postImagePrompt += `- TITLE/COVER PAGES: Perfect for first/intro posts (high score for post 0-1)\\n`;
      postImagePrompt += `- SIGNATURE PAGES: Avoid unless specifically about signatures/authentication\\n`;
      postImagePrompt += `- COPYRIGHT/LEGAL NOTICES: Avoid unless discussing legal disclaimers\\n`;
      postImagePrompt += `- ADDRESS/CONTACT PAGES: Avoid unless discussing location/contact info\\n`;
      postImagePrompt += `- TABLE OF CONTENTS: Good for overview posts about document structure\\n`;
      postImagePrompt += `- SUBSTANTIVE CONTENT: Prioritize for main argument/evidence posts\\n`;
      postImagePrompt += `- CHARTS/GRAPHS/IMAGES: Excellent for data/visual posts\\n`;
      postImagePrompt += `- QUOTES/TESTIMONIALS: Perfect when post discusses testimony/statements\\n\\n`;
      
      postImagePrompt += `SCORING GUIDELINES:\\n`;
      postImagePrompt += `1. Analyze each post and identify 2-4 pages that could support it\\n`;
      postImagePrompt += `2. Score pages 20-100 based on relevance:\\n`;
      postImagePrompt += `   - 90-100: Perfect content match + ideal page type\\n`;
      postImagePrompt += `   - 70-89: Strong content match or good page type\\n`;
      postImagePrompt += `   - 50-69: Moderate relevance or general support\\n`;
      postImagePrompt += `   - 20-49: Weak relevance but still usable option\\n`;
      postImagePrompt += `3. For posts with no strong matches, find the best available option (even if 30-50%)\\n`;
      postImagePrompt += `4. Prioritize page distribution - spread suggestions across different pages\\n`;
      postImagePrompt += `5. Consider post sequence: intro posts → main content → conclusion\\n\\n`;
      
      postImagePrompt += `OUTPUT FORMAT - Return JSON with exactly this structure:\\n`;
      postImagePrompt += `{\\n`;
      postImagePrompt += `  "postSuggestions": [\\n`;
      postImagePrompt += `    {\\n`;
      postImagePrompt += `      "postIndex": 0,\\n`;
      postImagePrompt += `      "postText": "The actual post text",\\n`;
      postImagePrompt += `      "recommendedPages": [\\n`;
      postImagePrompt += `        {\\n`;
      postImagePrompt += `          "pageNumber": 1,\\n`;
      postImagePrompt += `          "relevanceScore": 85,\\n`;
      postImagePrompt += `          "reasoning": "Why this page supports this specific post",\\n`;
      postImagePrompt += `          "keyQuotes": ["Relevant quote from page"],\\n`;
      postImagePrompt += `          "confidence": "high"\\n`;
      postImagePrompt += `        }\\n`;
      postImagePrompt += `      ]\\n`;
      postImagePrompt += `    }\\n`;
      postImagePrompt += `  ]\\n`;
      postImagePrompt += `}\\n\\n`;
      
      // Add thread posts
      let postContent = 'THREAD POSTS:\\n';
      threadPosts.forEach((post: string, index: number) => {
        postContent += `Post ${index + 1}: ${post}\\n\\n`;
      });
      
      // Add page content with length limits
      let pageContent = '\\nDOCUMENT PAGES:\\n';
      const maxContentLength = 40000; // Smaller limit since we have posts too
      let currentLength = postContent.length;
      
      for (let index = 0; index < pageTexts.length; index++) {
        const pageText = pageTexts[index];
        const pageSection = `=== PAGE ${index + 1} ===\\n${pageText}\\n\\n`;
        
        if (currentLength + pageSection.length > maxContentLength) {
          pageContent += `\\n[Content truncated - analyzed ${index + 1} of ${pageTexts.length} pages]\\n`;
          break;
        }
        
        pageContent += pageSection;
        currentLength += pageSection.length;
      }
      
      const fullContent = postContent + pageContent;
      
      console.log('Sending post-image matching request to Anthropic...', {
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4000,
        contentLength: fullContent.length
      });

      const postImageMsg = await anthropic.messages.create({
        model: usingPremiumModel ? 'claude-3-5-sonnet-20241022' : 'claude-3-haiku-20240307',
        max_tokens: 4000,
        system: postImagePrompt,
        messages: [
          {
            role: 'user',
            content: `Please analyze these thread posts and find the best matching pages for each post:\\n\\n${fullContent}`,
          },
        ],
      });

      console.log('Received response from Anthropic for post-image suggestions');

      if (postImageMsg.content && postImageMsg.content.length > 0 && postImageMsg.content[0].type === 'text') {
        const rawPostImageResponse = postImageMsg.content[0].text;
        console.log('Raw Anthropic response for post-images:', rawPostImageResponse);
        
        const postImageJsonMatch = rawPostImageResponse.match(/\{[\s\S]*\}/);
        
        if (postImageJsonMatch) {
          console.log('Found JSON match:', postImageJsonMatch[0]);
          try {
            const postImageData = JSON.parse(postImageJsonMatch[0]);
            console.log('Parsed post-image data:', postImageData);
            postImageSuggestions = postImageData.postSuggestions || [];
            console.log('Final postImageSuggestions:', postImageSuggestions);
          } catch (error) {
            console.error('Error parsing post-image suggestions:', error);
          }
        } else {
          console.log('No JSON match found in response');
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
    if (postImageSuggestions) {
      response.postImageSuggestions = postImageSuggestions;
    }

    return NextResponse.json(response);

  } catch (error) {
    // Log the actual error for better debugging
    if (error instanceof Error) {
      console.error('Error analyzing document:', error.message);
      console.error('Error stack:', error.stack);
    } else {
      console.error('An unknown error occurred:', error);
    }
    
    // Log additional context for debugging
    console.error('Error occurred during API call');
    
    return NextResponse.json({ error: 'Failed to analyze document' }, { status: 500 });
  }
} 