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

    // Post thread sequentially
    const tweetIds: string[] = [];
    let replyToId: string | undefined;

    for (let i = 0; i < posts.length; i++) {
      const post = posts[i];
      const postText = post.text;
      const postImages = images?.[post.id] || [];
      
      try {
        console.log(`Posting tweet ${i + 1}/${posts.length}: "${postText.substring(0, 50)}..."`);
        
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
          console.log(`Uploading ${postImages.length} image(s) for tweet ${i + 1}`);
          const mediaIds: string[] = [];
          
          for (const imageUrl of postImages) {
            try {
              console.log(`Downloading image from: ${imageUrl}`);
              
              // Download image from URL with timeout
              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
              
              const response = await fetch(imageUrl, {
                signal: controller.signal,
                headers: {
                  'User-Agent': 'Threadifier/1.0',
                }
              });
              
              clearTimeout(timeoutId);
              
              if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
              }
              
              const arrayBuffer = await response.arrayBuffer();
              const buffer = Buffer.from(arrayBuffer);
              
              // Validate image size (Twitter has limits)
              if (buffer.length > 5 * 1024 * 1024) { // 5MB limit
                throw new Error('Image too large (max 5MB)');
              }
              
              console.log(`Uploading image to Twitter (${buffer.length} bytes)`);
              
              // Upload to Twitter with retry logic
              let mediaId: string | undefined;
              let retryCount = 0;
              const maxRetries = 3;
              
              while (retryCount < maxRetries) {
                try {
                  mediaId = await client.v1.uploadMedia(buffer, {
                    mimeType: 'image/png',
                  });
                  break;
                } catch (uploadError: any) {
                  retryCount++;
                  console.error(`Upload attempt ${retryCount} failed:`, uploadError.message);
                  
                  if (retryCount >= maxRetries) {
                    throw uploadError;
                  }
                  
                  // Wait before retry
                  await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
                }
              }
              
              if (mediaId) {
                mediaIds.push(mediaId);
                console.log(`Successfully uploaded image, media ID: ${mediaId}`);
              }
              
            } catch (imgError: any) {
              console.error(`Error uploading image for tweet ${i + 1}:`, imgError);
              // Continue without this image rather than failing the entire tweet
            }
          }

          if (mediaIds.length > 0) {
            tweetData.media = {
              media_ids: mediaIds,
            };
            console.log(`Added ${mediaIds.length} media IDs to tweet ${i + 1}`);
          }
        }

        // Post tweet with retry logic
        let tweet: any;
        let retryCount = 0;
        const maxRetries = 3;
        
        while (retryCount < maxRetries) {
          try {
            console.log(`Posting tweet ${i + 1} to Twitter...`);
            tweet = await client.v2.tweet(tweetData);
            break;
          } catch (tweetError: any) {
            retryCount++;
            console.error(`Tweet posting attempt ${retryCount} failed:`, tweetError.message);
            
            if (retryCount >= maxRetries) {
              throw tweetError;
            }
            
            // Wait before retry
            await new Promise(resolve => setTimeout(resolve, 2000 * retryCount));
          }
        }
        
        tweetIds.push(tweet.data.id);
        console.log(`Successfully posted tweet ${i + 1}, ID: ${tweet.data.id}`);
        
        // Set the reply ID for the next tweet in thread
        replyToId = tweet.data.id;
        
        // Add delay between tweets to avoid rate limiting
        if (i < posts.length - 1) {
          console.log('Waiting 2 seconds before next tweet...');
          await new Promise(resolve => setTimeout(resolve, 2000));
        }

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

    console.log(`Successfully posted entire thread with ${tweetIds.length} tweets`);
    
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