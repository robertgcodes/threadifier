# Debugging Stripe Webhook Credits Issue

## Quick Diagnosis Steps

### 1. Check Stripe Webhook Configuration
Go to your Stripe Dashboard → Developers → Webhooks and verify:
- Webhook endpoint URL is: `https://your-domain.vercel.app/api/stripe-webhook`
- Webhook is listening for these events:
  - `checkout.session.completed`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.payment_failed`

### 2. Verify Environment Variables in Vercel
Ensure these are set in your Vercel project settings:
- `STRIPE_WEBHOOK_SECRET` (from Stripe webhook endpoint)
- `STRIPE_SECRET_KEY` (your Stripe secret key)
- `STRIPE_PRICE_PROFESSIONAL_MONTHLY`
- `STRIPE_PRICE_PROFESSIONAL_YEARLY`
- `STRIPE_PRICE_TEAM_MONTHLY`
- `STRIPE_PRICE_TEAM_YEARLY`

### 3. Check Webhook Logs in Stripe
In Stripe Dashboard → Developers → Webhooks → Click on your endpoint → View attempts
- Look for any failed webhook attempts
- Check the response codes and error messages

### 4. Manual Credit Addition (Temporary Fix)
While debugging, you can manually add credits through your Admin Panel:
1. Go to your app and click on your profile
2. Look for the Admin Panel (only visible to your email)
3. Enter your email and add credits

## Common Issues and Solutions

### Issue: "No userId in session metadata"
**Solution**: The userId might not be passed correctly during checkout. Check that the checkout session creation includes the metadata.

### Issue: Webhook signature verification failed
**Solution**: 
1. Make sure you're using the correct webhook secret (not the API key)
2. Ensure the webhook secret in Vercel matches the one in Stripe
3. For Stripe TEST mode, use the test webhook secret

### Issue: Credits added but not showing
**Solution**: This might be a caching issue. Try:
1. Refresh the page
2. Log out and log back in
3. Check Firebase directly to see if credits were added

## Quick Test

To test if webhooks are working:
1. Create a test subscription in Stripe
2. Watch the Vercel function logs: `vercel logs --follow`
3. Check Stripe webhook attempts dashboard

## Manual Database Check

You can check your credits directly in Firebase:
1. Go to Firebase Console → Firestore
2. Navigate to `users` → [your-user-id]
3. Check the `credits.available` field

## Emergency Credit Addition Code

If needed, you can run this in your browser console while logged in:
```javascript
// This won't work due to security, but shows the structure
// Use the Admin Panel instead
```