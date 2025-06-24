import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = process.env.STRIPE_SECRET_KEY 
  ? new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2025-05-28.basil',
    })
  : null;

export async function POST(req: NextRequest) {
  try {
    const { customerId, returnUrl } = await req.json();

    if (!customerId) {
      return NextResponse.json(
        { error: 'Missing customer ID' },
        { status: 400 }
      );
    }

    // Check if Stripe is configured
    if (!stripe) {
      return NextResponse.json(
        { 
          error: 'Stripe is not configured',
          message: 'Please configure your Stripe secret key in environment variables'
        },
        { status: 500 }
      );
    }

    // Create a billing portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl || `${process.env.NEXT_PUBLIC_APP_URL}/?view=billing`,
    });

    return NextResponse.json({
      url: session.url,
    });
  } catch (error: any) {
    console.error('Error creating portal session:', error);
    
    // Handle specific Stripe errors
    if (error.type === 'StripeInvalidRequestError') {
      if (error.message.includes('No configuration provided')) {
        return NextResponse.json(
          { 
            error: 'Billing portal not configured',
            message: 'The billing portal needs to be configured in your Stripe dashboard. Visit https://dashboard.stripe.com/test/settings/billing/portal to set it up.',
            setupRequired: true
          },
          { status: 400 }
        );
      }
    }
    
    return NextResponse.json(
      { 
        error: error.message || 'Failed to create billing portal session',
        code: error.code || 'unknown_error'
      },
      { status: 500 }
    );
  }
}