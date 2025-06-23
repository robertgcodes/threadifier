import { TwitterApi } from 'twitter-api-v2';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Check if credentials are configured
    if (!process.env.X_CLIENT_ID || !process.env.X_CLIENT_SECRET) {
      return NextResponse.json({ 
        error: 'X API credentials not configured',
        setupRequired: true,
        message: 'Please set up your X API credentials in the environment variables.'
      }, { status: 400 });
    }

    // Twitter OAuth 2.0 configuration
    const client = new TwitterApi({
      clientId: process.env.X_CLIENT_ID,
      clientSecret: process.env.X_CLIENT_SECRET,
    });

    // Dynamically determine callback URL
    const getCallbackUrl = () => {
      if (process.env.NEXT_PUBLIC_APP_URL) {
        return `${process.env.NEXT_PUBLIC_APP_URL}/api/x-callback`;
      }
      
      // Fallback to request headers for dynamic environments
      const host = request.headers.get('host');
      const protocol = request.headers.get('x-forwarded-proto') || 'http';
      return `${protocol}://${host}/api/x-callback`;
    };

    const callbackURL = getCallbackUrl();
    const { url, codeVerifier, state } = client.generateOAuth2AuthLink(
      callbackURL,
      { 
        scope: ['tweet.read', 'tweet.write', 'users.read', 'offline.access'],
      }
    );

    // Store codeVerifier in a secure way (e.g., encrypted cookie or session)
    // For now, we'll return it to the client to store temporarily
    return NextResponse.json({ 
      authUrl: url,
      codeVerifier,
      state,
    });
  } catch (error) {
    console.error('Error generating auth link:', error);
    return NextResponse.json(
      { error: 'Failed to generate authentication link' },
      { status: 500 }
    );
  }
}