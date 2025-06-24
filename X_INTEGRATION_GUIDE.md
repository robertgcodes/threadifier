# X (Twitter) Integration Setup Guide

This guide will help you complete the X integration for Threadifier.

## Prerequisites

1. **X Developer Account**: You need an approved X Developer account
2. **Project & App Created**: Create a project and app in the X Developer Portal
3. **OAuth 2.0 Enabled**: Make sure OAuth 2.0 is enabled for your app

## Step 1: Configure Your X App

### In the X Developer Portal:

1. Go to your app's settings
2. Under "User authentication settings", click "Set up"
3. Configure the following:

#### App Permissions
- **Read and write**: Enable this to allow posting threads
- **Request email from users**: Optional, but recommended

#### Type of App
- Select **Web App, Automated App or Bot**

#### App Info
- **Callback URI / Redirect URL**: 
  ```
  https://your-domain.com/api/x-callback
  http://localhost:3000/api/x-callback (for development)
  ```
  
- **Website URL**: `https://your-domain.com`

#### Client ID & Client Secret
After saving, you'll receive:
- Client ID (starts with something like `M1M5R3...`)
- Client Secret (keep this secure!)

## Step 2: Update Environment Variables

Add these to your `.env.local` file:

```bash
# X (Twitter) API Configuration
X_CLIENT_ID=your_client_id_here
X_CLIENT_SECRET=your_client_secret_here

# App URL (needed for OAuth callbacks)
NEXT_PUBLIC_APP_URL=http://localhost:3000  # or https://your-domain.com in production
```

## Step 3: Test the Integration

1. **Start your development server**:
   ```bash
   npm run dev
   ```

2. **Navigate to the X connection page** in your app

3. **Click "Connect to X"** - this should:
   - Redirect you to X's authorization page
   - After authorization, redirect back to your app
   - Store the access tokens securely

## Step 4: Implement Thread Posting

Create a new API route for posting threads:

```typescript
// app/api/post-thread/route.ts
import { TwitterApi } from 'twitter-api-v2';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const accessToken = cookieStore.get('x_access_token')?.value;
    
    if (!accessToken) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { posts } = await request.json();
    
    // Initialize Twitter client with user's access token
    const client = new TwitterApi(accessToken);
    
    // Post the thread
    let previousTweetId: string | undefined;
    const tweetIds: string[] = [];
    
    for (const post of posts) {
      const tweet = await client.v2.tweet({
        text: post.text,
        reply: previousTweetId ? {
          in_reply_to_tweet_id: previousTweetId
        } : undefined
      });
      
      previousTweetId = tweet.data.id;
      tweetIds.push(tweet.data.id);
    }
    
    return NextResponse.json({ 
      success: true, 
      tweetIds,
      threadUrl: `https://twitter.com/i/status/${tweetIds[0]}`
    });
  } catch (error) {
    console.error('Error posting thread:', error);
    return NextResponse.json(
      { error: 'Failed to post thread' },
      { status: 500 }
    );
  }
}
```

## Step 5: Add UI for Posting

Update your thread editor to include a "Post to X" button:

```typescript
// In your ThreadEditor component
const postToX = async () => {
  try {
    const response = await fetch('/api/post-thread', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ posts: thread }),
    });
    
    const data = await response.json();
    
    if (data.success) {
      toast.success('Thread posted to X!');
      window.open(data.threadUrl, '_blank');
    } else {
      toast.error('Failed to post thread');
    }
  } catch (error) {
    toast.error('Error posting to X');
  }
};
```

## Step 6: Handle Token Refresh

X access tokens expire. Implement token refresh:

```typescript
// app/api/refresh-x-token/route.ts
import { TwitterApi } from 'twitter-api-v2';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST() {
  try {
    const cookieStore = cookies();
    const refreshToken = cookieStore.get('x_refresh_token')?.value;
    
    if (!refreshToken) {
      return NextResponse.json({ error: 'No refresh token' }, { status: 401 });
    }

    const client = new TwitterApi({
      clientId: process.env.X_CLIENT_ID!,
      clientSecret: process.env.X_CLIENT_SECRET!,
    });
    
    const { accessToken, refreshToken: newRefreshToken } = await client.refreshOAuth2Token(refreshToken);
    
    // Update tokens
    cookieStore.set('x_access_token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
    });
    
    if (newRefreshToken) {
      cookieStore.set('x_refresh_token', newRefreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 365,
      });
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Token refresh error:', error);
    return NextResponse.json({ error: 'Failed to refresh token' }, { status: 500 });
  }
}
```

## Step 7: Production Deployment

Before deploying to production:

1. **Update callback URLs** in X Developer Portal to include your production domain
2. **Set environment variables** in your hosting platform (Vercel, etc.)
3. **Enable HTTPS** - X requires secure connections for OAuth
4. **Test the full flow** in production

## Troubleshooting

### Common Issues:

1. **"Callback URL mismatch"**
   - Ensure the callback URL in your app matches exactly what's in X Developer Portal
   - Include both http://localhost:3000/api/x-callback and your production URL

2. **"Invalid client"**
   - Double-check your Client ID and Client Secret
   - Make sure there are no extra spaces or characters

3. **"Unauthorized"**
   - Access tokens may have expired - implement token refresh
   - Check that your app has the correct permissions

4. **Rate Limits**
   - X has rate limits for posting
   - Free tier: 1,500 posts per month
   - Consider implementing rate limit handling

## Security Best Practices

1. **Never expose your Client Secret** - keep it server-side only
2. **Use HTTPS in production** for all OAuth flows
3. **Store tokens securely** - the current implementation uses httpOnly cookies
4. **Implement CSRF protection** for your API routes
5. **Validate all input** before posting to X

## Next Steps

1. Test the integration thoroughly
2. Add error handling and retry logic
3. Implement a queue system for posting threads (to handle rate limits)
4. Add analytics to track successful posts
5. Consider adding scheduling functionality

## Additional Resources

- [X API Documentation](https://developer.twitter.com/en/docs/twitter-api)
- [OAuth 2.0 Guide](https://developer.twitter.com/en/docs/authentication/oauth-2-0)
- [twitter-api-v2 Library](https://github.com/PLhery/node-twitter-api-v2)