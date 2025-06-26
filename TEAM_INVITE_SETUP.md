# Team Invite Email Setup Guide

Team invitations require an email service to send invitation links. Here's how to set it up:

## Option 1: Resend (Recommended - Easy Setup)

1. **Sign up for Resend**
   - Go to [resend.com](https://resend.com)
   - Create a free account (includes 100 emails/day)
   - Verify your email

2. **Get your API Key**
   - Go to API Keys section
   - Create a new API key
   - Copy the key (starts with `re_`)

3. **Add Domain (Optional but recommended)**
   - Go to Domains section
   - Add your domain (e.g., threadifier.com)
   - Follow their DNS setup instructions
   - This allows sending from your domain (e.g., team@threadifier.com)

4. **Add to Environment Variables**
   ```bash
   # In your .env.local file
   RESEND_API_KEY=re_your_api_key_here
   NEXT_PUBLIC_APP_URL=https://your-app-url.com
   ```

5. **Deploy**
   - Add the same environment variables to Vercel
   - Deploy your app

## Current Implementation

The team invite system now:
1. Creates an invitation record in Firebase
2. Sends an email with a unique invitation link (if Resend is configured)
3. The link includes a token and team ID
4. When clicked, the user can accept the invitation
5. The invitation expires after 7 days

## Email Template

The email includes:
- Inviter's name
- Role being offered
- Accept button linking to `/join-team?token=XXX&team=YYY`
- 7-day expiration notice

## Testing Without Email

If you don't want to set up email yet:
1. Invitations are still created in the database
2. You can manually share the invite link:
   ```
   https://your-app.com/join-team?token=INVITATION_ID&team=TEAM_OWNER_ID
   ```
3. The INVITATION_ID can be found in Firebase under:
   `users/{teamOwnerId}/team/{invitationId}`

## Alternative Email Services

If you prefer a different service, you can modify `/app/api/team/invite/route.ts`:

### SendGrid
```typescript
import sgMail from '@sendgrid/mail';
sgMail.setApiKey(process.env.SENDGRID_API_KEY);
```

### Nodemailer (SMTP)
```typescript
import nodemailer from 'nodemailer';
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});
```

## Troubleshooting

1. **Emails not sending but no errors**
   - Check if RESEND_API_KEY is set in environment
   - Check Resend dashboard for failed sends
   - Verify domain DNS if using custom domain

2. **"From" address rejected**
   - Use verified domain or Resend's default domain
   - Update the "from" address in the code

3. **Invitation link not working**
   - Ensure NEXT_PUBLIC_APP_URL is set correctly
   - Check if invitation hasn't expired
   - Verify user is logged in with correct email