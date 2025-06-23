import { TwitterApi } from 'twitter-api-v2';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    const { posts, images } = await request.json();
    
    if (!posts || posts.length === 0) {
      return NextResponse.json(
        { error: 'No posts provided' },
        { status: 400 }
      );
    }

    // Get access token from cookies
    const cookieStore = cookies();
    const accessToken = cookieStore.get('x_access_token')?.value;

    if (!accessToken) {
      return NextResponse.json(
        { error: 'Not authenticated with X' },
        { status: 401 }
      );
    }

    // Create authenticated client
    const client = new TwitterApi(accessToken);

    // Post thread
    const tweetIds: string[] = [];
    let replyToId: string | undefined;

    for (let i = 0; i < posts.length; i++) {
      const postText = posts[i].text;
      const postImages = images?.[posts[i].id];
      
      try {
        // Prepare tweet data
        const tweetData: any = {
          text: postText,
        };

        // If this is a reply, add the reply parameter
        if (replyToId) {
          tweetData.reply = {
            in_reply_to_tweet_id: replyToId,
          };
        }

        // Upload images if provided
        if (postImages && postImages.length > 0) {
          const mediaIds: string[] = [];
          
          for (const imageUrl of postImages) {
            try {
              // Download image from URL
              const response = await fetch(imageUrl);
              const arrayBuffer = await response.arrayBuffer();
              const buffer = Buffer.from(arrayBuffer);
              
              // Upload to Twitter
              const mediaId = await client.v1.uploadMedia(buffer, {
                mimeType: 'image/png',
              });
              
              mediaIds.push(mediaId);
            } catch (imgError) {
              console.error('Error uploading image:', imgError);
              // Continue without this image
            }
          }

          if (mediaIds.length > 0) {
            tweetData.media = {
              media_ids: mediaIds,
            };
          }
        }

        // Post tweet
        const tweet = await client.v2.tweet(tweetData);
        tweetIds.push(tweet.data.id);
        
        // Set the reply ID for the next tweet in thread
        replyToId = tweet.data.id;

      } catch (tweetError: any) {
        console.error(`Error posting tweet ${i + 1}:`, tweetError);
        
        // If we've posted some tweets, return partial success
        if (tweetIds.length > 0) {
          return NextResponse.json({
            success: false,
            partial: true,
            postedCount: tweetIds.length,
            totalCount: posts.length,
            tweetIds,
            error: `Failed at tweet ${i + 1}: ${tweetError.message}`,
          });
        }
        
        throw tweetError;
      }
    }

    return NextResponse.json({
      success: true,
      tweetIds,
      threadUrl: `https://x.com/${cookieStore.get('x_user_info')?.value ? JSON.parse(cookieStore.get('x_user_info')!.value).username : 'i'}/status/${tweetIds[0]}`,
    });

  } catch (error: any) {
    console.error('Error posting to X:', error);
    return NextResponse.json(
      { 
        error: 'Failed to post thread to X',
        details: error.message,
      },
      { status: 500 }
    );
  }
}