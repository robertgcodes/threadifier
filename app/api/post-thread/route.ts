import { TwitterApi } from 'twitter-api-v2';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const accessToken = cookieStore.get('x_access_token')?.value;
    
    if (!accessToken) {
      return NextResponse.json({ error: 'Not authenticated with X' }, { status: 401 });
    }

    const { posts } = await request.json();
    
    if (!posts || !Array.isArray(posts) || posts.length === 0) {
      return NextResponse.json({ error: 'Invalid posts data' }, { status: 400 });
    }
    
    // Initialize Twitter client with user's access token
    const client = new TwitterApi(accessToken);
    
    // Post the thread
    let previousTweetId: string | undefined;
    const tweetIds: string[] = [];
    const errors: any[] = [];
    
    for (let i = 0; i < posts.length; i++) {
      try {
        const post = posts[i];
        const tweetData: any = {
          text: post.text,
        };
        
        // Add reply reference for subsequent tweets in the thread
        if (previousTweetId) {
          tweetData.reply = {
            in_reply_to_tweet_id: previousTweetId
          };
        }
        
        const tweet = await client.v2.tweet(tweetData);
        
        previousTweetId = tweet.data.id;
        tweetIds.push(tweet.data.id);
        
        // Add a small delay between posts to avoid rate limiting
        if (i < posts.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (error: any) {
        console.error(`Error posting tweet ${i + 1}:`, error);
        errors.push({
          index: i,
          error: error.message || 'Unknown error'
        });
        
        // If we fail to post a tweet in the middle of the thread, stop
        break;
      }
    }
    
    if (tweetIds.length === 0) {
      return NextResponse.json({ 
        error: 'Failed to post any tweets', 
        details: errors 
      }, { status: 500 });
    }
    
    // Get the username to construct the URL
    const userInfo = cookieStore.get('x_user_info')?.value;
    let username = 'i';
    
    if (userInfo) {
      try {
        const parsed = JSON.parse(userInfo);
        username = parsed.username || 'i';
      } catch (e) {
        console.error('Error parsing user info:', e);
      }
    }
    
    return NextResponse.json({ 
      success: true, 
      tweetIds,
      postedCount: tweetIds.length,
      totalCount: posts.length,
      threadUrl: `https://twitter.com/${username}/status/${tweetIds[0]}`,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error: any) {
    console.error('Error posting thread:', error);
    
    // Check for specific error types
    if (error.code === 429) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        { status: 429 }
      );
    }
    
    if (error.code === 401) {
      return NextResponse.json(
        { error: 'X authentication expired. Please reconnect your account.' },
        { status: 401 }
      );
    }
    
    return NextResponse.json(
      { error: error.message || 'Failed to post thread' },
      { status: 500 }
    );
  }
}