import { TwitterApi } from 'twitter-api-v2';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import CryptoJS from 'crypto-js';

const client = new TwitterApi({
  clientId: process.env.X_CLIENT_ID!,
  clientSecret: process.env.X_CLIENT_SECRET!,
});

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');

  if (!code || !state) {
    return NextResponse.redirect(new URL('/?error=x_auth_failed', request.url));
  }

  // Get stored values from cookies
  const cookieStore = cookies();
  const encryptedCodeVerifier = cookieStore.get('x_code_verifier')?.value;
  const storedState = cookieStore.get('x_oauth_state')?.value;

  if (!encryptedCodeVerifier || !storedState) {
    console.error('Missing code verifier or state from cookies');
    return NextResponse.redirect(new URL('/?error=x_auth_failed', request.url));
  }

  // Verify state to prevent CSRF attacks
  if (state !== storedState) {
    console.error('State mismatch, possible CSRF attack');
    return NextResponse.redirect(new URL('/?error=x_auth_failed', request.url));
  }

  // Decrypt the code verifier
  const encryptionKey = process.env.ENCRYPTION_KEY || 'default-key-change-in-production';
  let codeVerifier: string;
  
  try {
    const decrypted = CryptoJS.AES.decrypt(encryptedCodeVerifier, encryptionKey);
    codeVerifier = decrypted.toString(CryptoJS.enc.Utf8);
  } catch (error) {
    console.error('Failed to decrypt code verifier:', error);
    return NextResponse.redirect(new URL('/?error=x_auth_failed', request.url));
  }

  // Dynamically determine callback URL based on request headers for better flexibility
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

  try {
    // Exchange code for access token
    const { client: loggedClient, accessToken, refreshToken } = await client.loginWithOAuth2({
      code,
      codeVerifier,
      redirectUri: callbackURL,
    });

    // Clear the temporary OAuth cookies
    cookieStore.delete('x_code_verifier');
    cookieStore.delete('x_oauth_state');

    // Store tokens securely (in production, use encrypted cookies or database)
    cookieStore.set('x_access_token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });

    if (refreshToken) {
      cookieStore.set('x_refresh_token', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 365, // 1 year
      });
    }

    // Get user info
    const { data: userInfo } = await loggedClient.v2.me();
    
    // Store user info
    cookieStore.set('x_user_info', JSON.stringify({
      id: userInfo.id,
      name: userInfo.name,
      username: userInfo.username,
    }), {
      httpOnly: false, // Allow client to read user info
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });

    // Redirect back to app with success
    return NextResponse.redirect(new URL('/?x_auth=success', request.url));
  } catch (error) {
    console.error('X OAuth callback error:', error);
    
    // Clear the temporary OAuth cookies on error
    cookieStore.delete('x_code_verifier');
    cookieStore.delete('x_oauth_state');
    
    return NextResponse.redirect(new URL('/?error=x_auth_failed', request.url));
  }
}