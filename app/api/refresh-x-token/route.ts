import { TwitterApi } from 'twitter-api-v2';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST() {
  try {
    const cookieStore = cookies();
    const refreshToken = cookieStore.get('x_refresh_token')?.value;
    
    if (!refreshToken) {
      return NextResponse.json({ error: 'No refresh token available' }, { status: 401 });
    }

    const client = new TwitterApi({
      clientId: process.env.X_CLIENT_ID!,
      clientSecret: process.env.X_CLIENT_SECRET!,
    });
    
    const { 
      client: refreshedClient, 
      accessToken, 
      refreshToken: newRefreshToken 
    } = await client.refreshOAuth2Token(refreshToken);
    
    // Update access token
    cookieStore.set('x_access_token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });
    
    // Update refresh token if provided
    if (newRefreshToken) {
      cookieStore.set('x_refresh_token', newRefreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 365, // 1 year
      });
    }
    
    // Get updated user info
    try {
      const { data: userInfo } = await refreshedClient.v2.me();
      
      cookieStore.set('x_user_info', JSON.stringify({
        id: userInfo.id,
        name: userInfo.name,
        username: userInfo.username,
      }), {
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30,
      });
    } catch (error) {
      console.error('Error fetching user info after refresh:', error);
    }
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Token refresh error:', error);
    
    // Clear invalid tokens
    const cookieStore = cookies();
    cookieStore.delete('x_access_token');
    cookieStore.delete('x_refresh_token');
    cookieStore.delete('x_user_info');
    
    return NextResponse.json({ 
      error: 'Failed to refresh token. Please reconnect your X account.',
      code: error.code || 'REFRESH_FAILED'
    }, { status: 401 });
  }
}