# Deployment Guide for Threadifier

This guide covers deploying Threadifier to Vercel with your custom domain (threadifier.com).

## Prerequisites

- Vercel account
- GitHub repository with your Threadifier code
- Domain (threadifier.com) purchased
- All API keys ready (Anthropic, Firebase, X)

## Step 1: Connect GitHub to Vercel

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click "Add New Project"
3. Import your GitHub repository
4. Vercel will auto-detect Next.js

## Step 2: Configure Environment Variables in Vercel

1. In your Vercel project settings, go to "Environment Variables"
2. Add each of these variables:

```env
# Core APIs
ANTHROPIC_API_KEY=your_anthropic_key
X_CLIENT_ID=your_x_client_id
X_CLIENT_SECRET=your_x_client_secret

# Firebase (all NEXT_PUBLIC_ variables)
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_firebase_auth_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_firebase_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_firebase_storage_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_firebase_messaging_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_firebase_app_id
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=your_firebase_measurement_id

# App URL (production)
NEXT_PUBLIC_APP_URL=https://threadifier.com
```

3. Make sure to select "Production" environment for each variable

## Step 3: Add Custom Domain

1. In Vercel project settings, go to "Domains"
2. Add `threadifier.com`
3. Follow Vercel's instructions to update your DNS:
   - Add an A record pointing to `76.76.21.21`
   - Or add a CNAME record pointing to `cname.vercel-dns.com`
4. Wait for DNS propagation (usually 5-30 minutes)
5. Vercel will automatically provision SSL certificates

## Step 4: Update X (Twitter) App Settings

1. Go to [X Developer Portal](https://developer.twitter.com/en/portal/projects-and-apps)
2. Find your app and go to "User authentication settings"
3. Add the production callback URL:
   ```
   https://threadifier.com/api/x-callback
   ```
4. Update website URL to: `https://threadifier.com`
5. Save changes

## Step 5: Update Firebase Settings

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project
3. Go to Authentication → Settings → Authorized domains
4. Add `threadifier.com`
5. Go to Project Settings and ensure your domain is in allowed domains

## Step 6: Deploy

### Option A: Automatic Deployment (Recommended)
- Push to your main branch: `git push origin main`
- Vercel will automatically deploy

### Option B: Manual Deployment
```bash
# Install Vercel CLI if needed
npm i -g vercel

# Deploy
vercel --prod
```

## Step 7: Test Production

1. Visit https://threadifier.com
2. Test critical features:
   - User authentication
   - PDF upload and processing
   - Thread generation
   - X authentication and posting
   - Image editing

## Environment-Specific Configuration

The app automatically handles different environments:

- **Local Development**: Uses `http://localhost:3000`
- **Vercel Preview**: Uses the preview URL automatically
- **Production**: Uses `https://threadifier.com`

## Troubleshooting

### Domain not working
- Check DNS propagation: https://dnschecker.org
- Ensure nameservers are pointing correctly
- Wait up to 48 hours for global propagation

### X OAuth not working
- Verify callback URL is exactly `https://threadifier.com/api/x-callback`
- Check that X app is approved and active
- Ensure environment variables are set in Vercel

### Firebase auth issues
- Add threadifier.com to authorized domains
- Check that Firebase config is in production environment variables
- Verify API keys are correct

### Build failures
- Check Vercel build logs
- Ensure all dependencies are in package.json
- Verify Node.js version compatibility

## Monitoring

1. **Vercel Analytics**: Automatically included
2. **Error Tracking**: Consider adding Sentry
3. **Uptime Monitoring**: Use Vercel's built-in monitoring

## Security Checklist

- [ ] All sensitive keys are in environment variables
- [ ] No secrets in code repository
- [ ] HTTPS is enforced (automatic with Vercel)
- [ ] Firebase security rules are configured
- [ ] X API credentials are kept secure
- [ ] Rate limiting is considered for API routes

## Maintenance

- Regularly update dependencies: `npm update`
- Monitor Vercel dashboard for errors
- Keep API usage within limits
- Backup Firebase data regularly

## Support

For deployment issues:
- Check Vercel documentation
- Review build logs in Vercel dashboard
- Ensure all environment variables are set correctly