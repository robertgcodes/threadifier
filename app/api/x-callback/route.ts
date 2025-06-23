import { TwitterApi } from 'twitter-api-v2';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const client = new TwitterApi({
  clientId: process.env.X_CLIENT_ID!,
  clientSecret: process.env.X_CLIENT_SECRET!,
});

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const codeVerifier = searchParams.get('codeVerifier'); // This should come from secure storage

  if (!code || !state) {
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
      codeVerifier: codeVerifier || '', // This should be retrieved from secure storage
      redirectUri: callbackURL,
    });

    // Store tokens securely (in production, use encrypted cookies or database)
    const cookieStore = cookies();
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
    return NextResponse.redirect(new URL('/?error=x_auth_failed', request.url));
  }
}