import { TwitterApi } from 'twitter-api-v2';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import CryptoJS from 'crypto-js';

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

    // Store codeVerifier securely in an encrypted cookie
    const cookieStore = cookies();
    const encryptionKey = process.env.ENCRYPTION_KEY || 'default-key-change-in-production';
    const encryptedCodeVerifier = CryptoJS.AES.encrypt(codeVerifier, encryptionKey).toString();
    
    cookieStore.set('x_code_verifier', encryptedCodeVerifier, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 10, // 10 minutes (OAuth flow should complete quickly)
    });

    // Store state for verification
    cookieStore.set('x_oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 10, // 10 minutes
    });

    // Return only the auth URL to the client
    return NextResponse.json({ 
      authUrl: url,
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