ci# Stripe Integration Setup Guide

This guide will walk you through setting up Stripe for Threadifier's subscription billing.

## Prerequisites

- A Stripe account (create one at https://stripe.com)
- Access to your Stripe Dashboard
- Your deployed app URL (e.g., https://threadifier.com)

## Step 1: Get Your API Keys

1. Log into your [Stripe Dashboard](https://dashboard.stripe.com)
2. Navigate to **Developers** → **API keys**
3. Copy your **Publishable key** (starts with `pk_`)
4. Copy your **Secret key** (starts with `sk_`) - keep this secure!

## Step 2: Create Products and Prices

### Professional Plan ($29/month, $290/year)

1. Go to **Products** → **Add product**
2. Create product:
   - Name: `Professional Plan`
   - Description: `500 credits per month, custom AI instructions, direct X posting`
3. Add pricing:
   - Monthly: $29.00 USD, recurring monthly
   - Yearly: $290.00 USD, recurring yearly
4. Copy both Price IDs (starts with `price_`)

### Team Plan ($79/month, $790/year)

1. Create another product:
   - Name: `Team Plan`
   - Description: `2000 credits per month, 3 team members, analytics, priority support`
2. Add pricing:
   - Monthly: $79.00 USD, recurring monthly
   - Yearly: $790.00 USD, recurring yearly
3. Copy both Price IDs

## Step 3: Set Up Webhook

1. Go to **Developers** → **Webhooks**
2. Click **Add endpoint**
3. Set endpoint URL: `https://threadifier.com/api/stripe-webhook`
4. Select events to listen for:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`
5. Copy the **Webhook signing secret** (starts with `whsec_`)

## Step 4: Configure Environment Variables

Add these to your `.env.local` file:

```bash
# Stripe Configuration
STRIPE_SECRET_KEY=sk_live_your_secret_key_here
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_your_publishable_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here

# Stripe Price IDs
NEXT_PUBLIC_STRIPE_PRICE_PROFESSIONAL_MONTHLY=price_professional_monthly_id
NEXT_PUBLIC_STRIPE_PRICE_PROFESSIONAL_YEARLY=price_professional_yearly_id
NEXT_PUBLIC_STRIPE_PRICE_TEAM_MONTHLY=price_team_monthly_id
NEXT_PUBLIC_STRIPE_PRICE_TEAM_YEARLY=price_team_yearly_id
```

## Step 5: Set Up Firebase Admin (for webhook)

The Stripe webhook needs Firebase Admin to update user subscriptions. Add these to `.env.local`:

```bash
# Firebase Admin (for server-side operations)
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=your-service-account-email@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour-Private-Key-Here\n-----END PRIVATE KEY-----\n"
```

To get these values:
1. Go to Firebase Console → Project Settings → Service Accounts
2. Click "Generate new private key"
3. Open the downloaded JSON file
4. Copy the values for `project_id`, `client_email`, and `private_key`

## Step 6: Test Your Integration

### Test Mode
1. Use test API keys (starts with `pk_test_` and `sk_test_`)
2. Use test card numbers: `4242 4242 4242 4242`
3. Test the full flow:
   - User clicks subscribe
   - Completes Stripe checkout
   - Webhook updates user subscription
   - User gets credits added

### Going Live
1. Replace test keys with live keys
2. Update webhook endpoint if needed
3. Test with a real card (you can refund yourself)

## Step 7: Monitor and Manage

### Customer Portal
Enable the Customer Portal so users can manage their subscriptions:
1. Go to **Settings** → **Billing** → **Customer portal**
2. Activate the portal
3. Configure what customers can do (cancel, update payment, etc.)

### Usage Tracking
The app automatically tracks:
- Credit usage per user
- Monthly credit refresh for paid plans
- Subscription status updates

## Troubleshooting

### Webhook not working?
- Check webhook logs in Stripe Dashboard
- Verify endpoint URL is correct
- Ensure webhook secret is properly set
- Check server logs for errors

### Subscription not updating?
- Verify Firebase Admin credentials
- Check if webhook events are being received
- Look for errors in webhook response

### Credits not adding?
- Check the webhook handler logic
- Verify user ID is being passed correctly
- Check Firebase permissions

## Security Notes

1. **Never expose your secret key** - it should only be in server-side code
2. **Always verify webhook signatures** - the app does this automatically
3. **Use HTTPS** - required for production webhooks
4. **Restrict API key permissions** in Stripe Dashboard if needed

## Support

For Stripe-specific issues:
- Stripe Support: https://support.stripe.com
- Stripe Discord: https://discord.gg/stripe

For Threadifier integration issues:
- Check the webhook logs
- Review server logs
- Contact support@threadifier.com