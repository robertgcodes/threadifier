# Stripe Setup Guide for Threadifier

This guide will help you set up Stripe for payment processing in your Threadifier application.

## Prerequisites

1. A Stripe account (sign up at https://stripe.com)
2. Access to your Stripe Dashboard

## Step 1: Get Your API Keys

1. Log in to your [Stripe Dashboard](https://dashboard.stripe.com)
2. Navigate to **Developers** → **API keys**
3. Copy your keys:
   - **Publishable key** (starts with `pk_test_` or `pk_live_`)
   - **Secret key** (starts with `sk_test_` or `sk_live_`)

## Step 2: Configure the Customer Portal (IMPORTANT\!)

The customer portal allows users to manage their subscriptions. This MUST be configured or you'll get errors.

1. Go to [Customer Portal Settings](https://dashboard.stripe.com/test/settings/billing/portal)
2. Configure the following:
   - **Features**:
     - ✅ Allow customers to update payment methods
     - ✅ Allow customers to cancel subscriptions
     - ✅ Allow customers to view billing history
   - **Business information**: Add your business name and support email
   - **Branding**: Upload your logo and set brand colors
3. **Click "Save" at the bottom of the page** (This is crucial\!)

## Troubleshooting

### "No configuration provided" Error
- This means the Customer Portal hasn't been configured in Stripe
- Go to the link above and save your portal settings
- Make sure you're configuring the right mode (test vs live)
EOF < /dev/null