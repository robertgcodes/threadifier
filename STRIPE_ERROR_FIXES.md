# Stripe Error Fixes for Threadifier

This document outlines the fixes implemented to resolve React error #130 and Stripe configuration issues.

## Problem Summary

The application was experiencing React error #130 ("Objects are not valid as a React child") specifically when clicking "View All Plans" in the billing tab. The root cause was missing Stripe configuration, particularly:

1. Missing Stripe environment variables
2. Unconfigured Customer Portal in Stripe Dashboard
3. Undefined values being rendered in React components

## Fixes Implemented

### 1. Environment Variable Handling

**File**: `/app/components/PricingTable.tsx`

Added conditional Stripe initialization:
```typescript
const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY 
  ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
  : null;
```

Added conditional price ID inclusion:
```typescript
// Only include stripePriceId if environment variable exists
...(process.env.NEXT_PUBLIC_STRIPE_PRICE_PROFESSIONAL_MONTHLY && {
  stripePriceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_PROFESSIONAL_MONTHLY,
}),
```

### 2. Price Display Fix

**File**: `/app/components/PricingTable.tsx`

Fixed free tier displaying "$0" instead of "Free":
```typescript
// Before: {tier.price === 0 ? '$0' : `$${tier.price}`}
// After:
{tier.price === 0 ? 'Free' : `$${isYearly ? Math.floor(tier.priceYearly / 12) : tier.price}`}
```

### 3. Customer Portal Error Handling

**File**: `/app/api/create-portal-session/route.ts`

Added specific handling for missing portal configuration:
```typescript
if (error.type === 'StripeInvalidRequestError') {
  if (error.message.includes('No configuration provided')) {
    return NextResponse.json({
      error: 'Billing portal not configured',
      message: 'The billing portal needs to be configured in your Stripe dashboard. Visit https://dashboard.stripe.com/test/settings/billing/portal to set it up.',
      setupRequired: true
    }, { status: 400 });
  }
}
```

### 4. Billing Management UI Updates

**File**: `/app/components/BillingManagement.tsx`

Added helpful error handling for portal configuration:
```typescript
if (data.setupRequired) {
  toast.error('Billing portal needs to be configured in Stripe dashboard');
  // Optionally open the setup link
  window.open('https://dashboard.stripe.com/test/settings/billing/portal', '_blank');
}
```

### 5. Conditional Rendering Fixes

Throughout the codebase, fixed conditional rendering patterns:
```typescript
// Before: {someValue && <Component />}
// After: {someValue ? <Component /> : null}

// Before: {premium && premiumCredits}
// After: {userProfile?.credits?.premiumCredits || 0}
```

## Environment Variables Required

Add these to your `.env.local` file:

```bash
# Stripe API Keys
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Stripe Price IDs
NEXT_PUBLIC_STRIPE_PRICE_PROFESSIONAL_MONTHLY=price_...
NEXT_PUBLIC_STRIPE_PRICE_PROFESSIONAL_YEARLY=price_...
NEXT_PUBLIC_STRIPE_PRICE_TEAM_MONTHLY=price_...
NEXT_PUBLIC_STRIPE_PRICE_TEAM_YEARLY=price_...
```

## Verification Steps

1. **Check Environment Variables**:
   ```bash
   # Should output your publishable key
   echo $NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
   ```

2. **Verify Customer Portal**:
   - Go to https://dashboard.stripe.com/test/settings/billing/portal
   - Ensure configuration is saved (look for green checkmark)

3. **Test Pricing Page**:
   - Click "View All Plans" - should not throw React error
   - Free tier should show "Free" not "$0"
   - Paid tiers should show prices only if configured

4. **Test Billing Management**:
   - Click "Update Payment Method"
   - Should either open portal or show setup instructions

## Debugging Tips

If errors persist:

1. **Check Browser Console**:
   ```javascript
   // Check if Stripe is loaded
   console.log(window.Stripe)
   
   // Check environment variables
   console.log(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
   ```

2. **Verify Stripe Initialization**:
   - Look for "Stripe loaded successfully" in console
   - If missing, check publishable key

3. **Check Network Tab**:
   - Look for failed requests to `/api/create-portal-session`
   - Check response for specific error messages

## Prevention

To prevent similar issues:

1. Always use optional chaining for nested properties
2. Provide default values for potentially undefined data
3. Use ternary operators instead of && for conditional rendering
4. Validate environment variables on startup
5. Add proper error boundaries for payment components

## Related Files

- `/app/components/PricingTable.tsx` - Pricing display
- `/app/components/BillingManagement.tsx` - Subscription management
- `/app/api/create-portal-session/route.ts` - Portal session creation
- `/app/api/create-checkout-session/route.ts` - Checkout handling
- `/.env.example` - Environment variable template