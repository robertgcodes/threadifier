# X (Twitter) Integration Setup Guide

This guide will help you set up X (Twitter) integration to post threads directly from Threadifier.

## Prerequisites

- An X (Twitter) account
- Access to X Developer Portal

## Setup Steps

### 1. Create an X Developer Account

1. Go to [X Developer Portal](https://developer.twitter.com/en/portal/dashboard)
2. Sign in with your X account
3. Apply for a developer account if you haven't already
   - Choose "Personal use" for individual projects
   - Fill out the application form
   - Wait for approval (usually instant for basic access)

### 2. Create a New Project and App

1. Once approved, go to "Projects & Apps" → "Overview"
2. Click "New Project"
   - Name: "Threadifier" (or your preferred name)
   - Use case: Choose the most appropriate option
3. Create a new App within the project
   - App name: Must be unique across all X apps
4. **Important**: Save your API keys when shown!
   - You'll need the OAuth 2.0 Client ID and Client Secret

### 3. Configure OAuth 2.0 Settings

1. In your app settings, find "User authentication settings"
2. Click "Set up" or "Edit"
3. Configure as follows:

   **App permissions**: Read and write
   
   **Type of App**: Web App
   
   **App info**:
   - Callback URI / Redirect URL:
     ```
     http://localhost:3000/api/x-callback
     ```
     For production, add your production URL:
     ```
     https://your-domain.com/api/x-callback
     ```
   
   - Website URL: Your app URL (e.g., http://localhost:3000)
   
   **Required scopes**:
   - ✓ tweet.read
   - ✓ tweet.write
   - ✓ users.read
   - ✓ offline.access

4. Click "Save"

### 4. Add Credentials to Your App

1. Create a `.env.local` file in your project root (if it doesn't exist)
2. Add the following environment variables:

```env
# X (Twitter) API Configuration
X_CLIENT_ID=your_oauth2_client_id_here
X_CLIENT_SECRET=your_oauth2_client_secret_here

# App URL (for OAuth callbacks)
# For development:
NEXT_PUBLIC_APP_URL=http://localhost:3000
# For production:
# NEXT_PUBLIC_APP_URL=https://your-domain.com
```

3. Replace the placeholder values with your actual credentials
4. **Important**: Never commit `.env.local` to version control!

### 5. Restart Your Development Server

After adding the environment variables:

```bash
# Stop the server (Ctrl+C)
# Start it again
npm run dev
```

## Using X Integration

1. Go to your Profile settings in Threadifier
2. Find the "Social Media Connections" section
3. Click "Connect" next to X (Twitter)
4. Authorize the app when redirected to X
5. Once connected, you'll see "Post to X" button when editing threads

## Troubleshooting

### "X API credentials not configured" error
- Make sure you've added both `X_CLIENT_ID` and `X_CLIENT_SECRET` to `.env.local`
- Ensure you've restarted your development server after adding credentials

### OAuth callback error
- Verify the callback URL in your X app settings matches exactly
- For localhost, use `http://localhost:3000/api/x-callback`
- For production, update to your actual domain

### "Failed to post thread" error
- Check that your X app has read and write permissions
- Ensure all required scopes are enabled
- Verify your account isn't rate-limited (1,500 tweets/month on free tier)

### App not approved
- New X developer accounts may need manual approval
- Check your email for approval status
- Basic access is usually approved instantly

## Rate Limits

- Free tier: 1,500 tweets per month
- Rate limit: 50 requests per 15 minutes
- Each thread post counts as multiple tweets (one per post in thread)

## Security Notes

1. **Keep your Client Secret secure**
   - Never expose it in client-side code
   - Never commit it to version control
   - Use environment variables only

2. **Use HTTPS in production**
   - OAuth requires secure connections
   - Update callback URLs when deploying

3. **Token Storage**
   - Tokens are stored in secure HTTP-only cookies
   - They expire after 2 hours but refresh automatically

## Need Help?

If you encounter issues:
1. Check the browser console for detailed error messages
2. Verify all environment variables are set correctly
3. Ensure your X developer account is in good standing
4. Check X Developer Portal for any app restrictions or warnings