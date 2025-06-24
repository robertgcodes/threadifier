import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-05-28.basil',
});

export async function POST(req: NextRequest) {
  try {
    const { customerId, subscriptionId } = await req.json();

    if (!customerId || !subscriptionId) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    // Fetch subscription details
    const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
      expand: ['default_payment_method', 'items.data.price.product']
    });

    // Fetch customer details
    const customer = await stripe.customers.retrieve(customerId, {
      expand: ['invoice_settings.default_payment_method']
    });

    // Fetch recent invoices
    const invoices = await stripe.invoices.list({
      customer: customerId,
      limit: 10,
      status: 'paid',
    });

    // Fetch upcoming invoice
    let upcomingInvoice = null;
    try {
      const upcoming = await stripe.invoices.upcoming({
        customer: customerId,
      });
      upcomingInvoice = {
        amount_due: upcoming.amount_due,
        currency: upcoming.currency,
        created: upcoming.created,
      };
    } catch (error) {
      // No upcoming invoice
    }

    return NextResponse.json({
      subscription,
      customer,
      invoices: invoices.data,
      upcomingInvoice,
    });
  } catch (error) {
    console.error('Error fetching billing details:', error);
    return NextResponse.json(
      { error: 'Failed to fetch billing details' },
      { status: 500 }
    );
  }
}