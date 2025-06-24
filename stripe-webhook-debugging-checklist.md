# Stripe Webhook Debugging Checklist

## Issue: Credits Not Being Applied After Successful Payment

### 1. Environment Variable Verification

#### In Vercel Dashboard
- [ ] `STRIPE_WEBHOOK_SECRET` is set correctly
  - Must match the signing secret from Stripe webhook endpoint
  - Format: `whsec_...`
  - **DO NOT** use API key here
- [ ] `STRIPE_SECRET_KEY` is set correctly
  - Format: `sk_test_...` (test) or `sk_live_...` (production)
- [ ] `STRIPE_PRICE_PROFESSIONAL_MONTHLY` is set
- [ ] `STRIPE_PRICE_PROFESSIONAL_YEARLY` is set
- [ ] `STRIPE_PRICE_TEAM_MONTHLY` is set
- [ ] `STRIPE_PRICE_TEAM_YEARLY` is set
- [ ] `NEXT_PUBLIC_APP_URL` is set to your production URL

### 2. Stripe Dashboard Configuration

#### Webhook Endpoint Settings
- [ ] Go to Stripe Dashboard → Developers → Webhooks
- [ ] Verify endpoint URL is correct: `https://your-domain.vercel.app/api/stripe-webhook`
- [ ] Endpoint is listening for these events:
  - [ ] `checkout.session.completed`
  - [ ] `customer.subscription.updated`
  - [ ] `customer.subscription.deleted`
  - [ ] `invoice.payment_failed`
- [ ] Webhook endpoint is enabled (not disabled)
- [ ] Copy the signing secret and verify it matches `STRIPE_WEBHOOK_SECRET` in Vercel

### 3. Webhook Health Check

#### In Stripe Dashboard
- [ ] Click on your webhook endpoint
- [ ] Check "Webhook attempts" tab
- [ ] Look for failed attempts (status != 200)
- [ ] Check error messages for any 400 or 500 errors
- [ ] Verify recent successful deliveries

### 4. Common Issues Found in Code

#### Issue 1: Missing userId in Metadata
The webhook expects `userId` in the session metadata. Check:
- [ ] Checkout session creation includes metadata with userId
- [ ] Subscription data also includes metadata with userId

#### Issue 2: Price ID Mismatch
The code compares price IDs to determine the plan:
- [ ] Verify price IDs in environment variables match exactly with Stripe
- [ ] Check both test and live price IDs if applicable

### 5. Debug Steps

#### Step 1: Test Webhook Locally
```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Login to Stripe
stripe login

# Forward webhooks to local server
stripe listen --forward-to localhost:3000/api/stripe-webhook

# In another terminal, trigger a test event
stripe trigger checkout.session.completed
```

#### Step 2: Check Vercel Function Logs
```bash
# View real-time logs
vercel logs --follow

# Or check in Vercel Dashboard
# Project → Functions → stripe-webhook → View Logs
```

#### Step 3: Manual Database Verification
1. Go to Firebase Console → Firestore
2. Navigate to `users` → [user-id]
3. Check these fields:
   - `credits.available`
   - `subscription.plan`
   - `subscription.status`
   - `subscription.stripeSubscriptionId`

### 6. Temporary Workarounds

#### Manual Credit Addition
1. Login to your app
2. Go to your profile → Admin Panel
3. Enter user's email
4. Add credits manually
5. Add reason: "Manual addition - webhook debugging"

### 7. Code Issues Found

#### In webhook handler (`/app/api/stripe-webhook/route.ts`):
1. **Line 41-42**: The code retrieves subscription but TypeScript shows it as `any`
2. **Line 91-96**: For subscription updates, userId comes from metadata, but Stripe doesn't always include metadata in subscription objects
3. **Line 138-140**: Similar issue with getting userId from subscription metadata

### 8. Recommended Fixes

#### Fix 1: Store userId in Customer Metadata
When creating the Stripe customer, store the userId there:
```typescript
const customer = await stripe.customers.create({
  email: userEmail,
  metadata: {
    userId: userId,
  },
});
```

#### Fix 2: Update Webhook to Check Multiple Sources
```typescript
// Try to get userId from multiple sources
let userId = session.metadata?.userId;

if (!userId && session.customer) {
  // Get from customer metadata
  const customer = await stripe.customers.retrieve(session.customer as string);
  userId = customer.metadata?.userId;
}

if (!userId) {
  console.error('No userId found in session or customer metadata');
  break;
}
```

### 9. Testing Checklist

- [ ] Create a test subscription using Stripe test cards
- [ ] Check Stripe webhook attempts for success
- [ ] Verify credits were added in Firebase
- [ ] Check user's subscription status in Firebase
- [ ] Test with different plans (Professional/Team)

### 10. Production Deployment Checklist

- [ ] All environment variables are set in Vercel
- [ ] Webhook endpoint URL uses HTTPS
- [ ] Webhook secret is from the correct environment (test/live)
- [ ] Price IDs match the correct environment
- [ ] Test with a real card in production

## Quick Debug Commands

```bash
# Check if webhook is receiving events
curl -X POST https://your-domain.vercel.app/api/stripe-webhook \
  -H "Content-Type: application/json" \
  -d '{"test": true}'
# Should return 400 with "Invalid signature"

# Check Vercel environment variables
vercel env ls

# Pull logs for specific function
vercel logs api/stripe-webhook --since 1h
```

## Emergency Contact

If webhooks continue to fail:
1. Use Admin Panel for manual credit management
2. Contact Stripe support with webhook endpoint ID
3. Consider implementing a webhook retry mechanism