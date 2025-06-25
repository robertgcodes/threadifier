# Complete Stripe Setup Guide for Threadifier

This guide covers every step needed to properly configure Stripe for Threadifier, including environment variables, product creation, and billing portal setup.

## Prerequisites

1. A Stripe account (sign up at https://stripe.com)
2. Access to your Stripe Dashboard
3. Your local development environment or production server

## Step 1: Get Your API Keys

1. Log in to your [Stripe Dashboard](https://dashboard.stripe.com)
2. Navigate to **Developers** → **API keys**
3. You'll see two sets of keys:
   - **Test mode** (for development)
   - **Live mode** (for production)

4. Copy the following keys:
   - **Publishable key** (starts with `pk_test_` or `pk_live_`)
   - **Secret key** (starts with `sk_test_` or `sk_live_`)

## Step 2: Create Products and Prices in Stripe

### Professional Plan
1. Go to [Products](https://dashboard.stripe.com/test/products) in your Stripe Dashboard
2. Click **+ Add product**
3. Fill in:
   - **Name**: Professional Plan
   - **Description**: 500 premium credits per month, Claude Sonnet AI, no referral message
   - **Pricing**:
     - Monthly: $29.00 USD (recurring)
     - Yearly: $290.00 USD (recurring)
4. Click **Save product**
5. Copy the Price IDs (they start with `price_`)

### Team Plan
1. Click **+ Add product** again
2. Fill in:
   - **Name**: Team Plan
   - **Description**: 2000 premium credits per month, team features, priority support
   - **Pricing**:
     - Monthly: $79.00 USD (recurring)
     - Yearly: $790.00 USD (recurring)
3. Click **Save product**
4. Copy the Price IDs

## Step 3: Configure Webhook Endpoint

1. Go to **Developers** → **Webhooks**
2. Click **+ Add endpoint**
3. Set the endpoint URL:
   - Development: `http://localhost:3000/api/stripe-webhook`
   - Production: `https://your-domain.com/api/stripe-webhook`
4. Select events to listen to:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.paid`
   - `invoice.payment_failed`
5. Click **Add endpoint**
6. Copy the **Signing secret** (starts with `whsec_`)

## Step 4: Configure Customer Portal (CRITICAL!)

This is the most important step that's often missed!

1. Go to [Customer Portal Settings](https://dashboard.stripe.com/test/settings/billing/portal)
2. If you haven't set it up before, you'll see a setup wizard
3. Configure these sections:

### Features
- ✅ **Subscriptions**
  - ✅ Customers can cancel subscriptions
  - ✅ Customers can switch plans (optional)
  - ✅ Customers can update quantities (if applicable)
- ✅ **Payment methods**
  - ✅ Customers can update payment methods
  - ✅ Customers can add payment methods
- ✅ **Invoices**
  - ✅ Customers can view invoices
  - ✅ Customers can download invoices

### Business information
- **Business name**: Threadifier (or your company name)
- **Privacy policy**: Add your privacy policy URL
- **Terms of service**: Add your terms URL
- **Customer support**:
  - Email: support@threadifier.com
  - Phone: (optional)
  - Website: https://threadifier.com

### Branding
- **Logo**: Upload your logo (recommended: 200x200px PNG)
- **Icon**: Upload a favicon (32x32px)
- **Brand color**: #3B82F6 (or your brand color)
- **Accent color**: #2563EB

4. **IMPORTANT**: Click the **Save** button at the bottom!

## Step 5: Set Environment Variables

Create or update your `.env.local` file:

```bash
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_YOUR_SECRET_KEY_HERE
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_YOUR_PUBLISHABLE_KEY_HERE
STRIPE_WEBHOOK_SECRET=whsec_YOUR_WEBHOOK_SECRET_HERE

# Stripe Price IDs (from Step 2)
NEXT_PUBLIC_STRIPE_PRICE_PROFESSIONAL_MONTHLY=price_YOUR_PROF_MONTHLY_ID
NEXT_PUBLIC_STRIPE_PRICE_PROFESSIONAL_YEARLY=price_YOUR_PROF_YEARLY_ID
NEXT_PUBLIC_STRIPE_PRICE_TEAM_MONTHLY=price_YOUR_TEAM_MONTHLY_ID
NEXT_PUBLIC_STRIPE_PRICE_TEAM_YEARLY=price_YOUR_TEAM_YEARLY_ID

# App URL (needed for redirects)
NEXT_PUBLIC_APP_URL=http://localhost:3000  # or https://your-domain.com
```

## Step 6: Verify Your Setup

1. **Test the Customer Portal**:
   ```bash
   # In your browser console on your app:
   await fetch('/api/create-portal-session', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({ 
       customerId: 'cus_test123',
       returnUrl: window.location.href 
     })
   })
   ```
   
   If you get "No configuration provided" error, the portal isn't saved properly.

2. **Test Webhook Connection**:
   - Use Stripe CLI for local testing:
     ```bash
     stripe listen --forward-to localhost:3000/api/stripe-webhook
     ```

3. **Test Checkout**:
   - Try subscribing to a plan
   - Should redirect to Stripe Checkout
   - After payment, should redirect back to your app

## Common Issues and Solutions

### "No configuration provided" Error
- **Cause**: Customer Portal not configured
- **Fix**: Go back to Step 4 and make sure to click Save

### React Error #130
- **Cause**: Missing Stripe environment variables
- **Fix**: Ensure all NEXT_PUBLIC_STRIPE_* variables are set
- **Also check**: Price IDs are correctly set for all tiers

### Checkout Session Fails
- **Cause**: Invalid price IDs or missing products
- **Fix**: Verify price IDs match exactly from Stripe Dashboard

### Webhook Not Receiving Events
- **Cause**: Wrong endpoint URL or signing secret
- **Fix**: Verify webhook URL and update signing secret

## Testing Checklist

- [ ] Environment variables are set correctly
- [ ] Products and prices created in Stripe
- [ ] Customer Portal is configured and saved
- [ ] Webhook endpoint is configured
- [ ] Test mode keys are being used for development
- [ ] Can create checkout sessions
- [ ] Can access customer portal
- [ ] Webhook receives events

## Going Live

When ready for production:

1. Switch to Live mode in Stripe Dashboard
2. Create products/prices in Live mode
3. Update environment variables with live keys:
   ```bash
   STRIPE_SECRET_KEY=sk_live_...
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
   ```
4. Configure Customer Portal in Live mode
5. Set up webhook for production URL
6. Update price IDs to live versions

## Support

If you encounter issues:
1. Check Stripe Dashboard logs
2. Verify all environment variables
3. Ensure Customer Portal is saved
4. Contact support@threadifier.com

Remember: The Customer Portal configuration is the most commonly missed step!