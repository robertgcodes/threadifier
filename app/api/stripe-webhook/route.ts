import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { doc, updateDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { firestore } from '../../lib/firebase';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-05-28.basil',
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const signature = req.headers.get('stripe-signature')!;

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err: any) {
      console.error('Webhook signature verification failed:', err.message);
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 400 }
      );
    }

    // Handle the event
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;
        
        if (!userId) {
          console.error('No userId in session metadata');
          break;
        }

        // Get the subscription
        const subscriptionId = session.subscription as string;
        const subscription = await stripe.subscriptions.retrieve(subscriptionId) as any;

        // Determine the plan based on the price
        let plan: 'professional' | 'team' = 'professional';
        const priceId = subscription.items.data[0].price.id;
        
        if (priceId === process.env.STRIPE_PRICE_TEAM_MONTHLY || 
            priceId === process.env.STRIPE_PRICE_TEAM_YEARLY) {
          plan = 'team';
        }
        
        // Determine initial credits based on plan
        let initialCredits = 0;
        switch (plan) {
          case 'professional':
            initialCredits = 500;
            break;
          case 'team':
            initialCredits = 2000;
            break;
        }

        // Update user profile with subscription info and add credits
        const userRef = doc(firestore, 'users', userId);
        const userDoc = await getDoc(userRef);
        const currentCredits = userDoc.data()?.credits?.available || 0;
        
        await updateDoc(userRef, {
          subscription: {
            plan: plan,
            status: 'active',
            stripeCustomerId: session.customer as string,
            stripeSubscriptionId: subscription.id,
            currentPeriodEnd: new Date(subscription.current_period_end * 1000),
            cancelAtPeriodEnd: subscription.cancel_at_period_end,
          },
          'credits.available': currentCredits + initialCredits,
          'credits.lifetime': ((userDoc.data() as any)?.credits?.lifetime || 0) + initialCredits,
          'credits.lastRefreshDate': serverTimestamp(),
          'settings.autoAppendReferral': false, // Disable auto-append for paid users
          updatedAt: serverTimestamp(),
        });

        console.log(`Subscription activated for user ${userId}`);
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as any;
        const userId = subscription.metadata?.userId;
        
        if (!userId) {
          console.error('No userId in subscription metadata');
          break;
        }

        // Update subscription status
        const userRef = doc(firestore, 'users', userId);
        await updateDoc(userRef, {
          'subscription.status': subscription.status,
          'subscription.currentPeriodEnd': new Date(subscription.current_period_end * 1000),
          'subscription.cancelAtPeriodEnd': subscription.cancel_at_period_end,
          updatedAt: serverTimestamp(),
        });

        console.log(`Subscription updated for user ${userId}`);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as any;
        const userId = subscription.metadata?.userId;
        
        if (!userId) {
          console.error('No userId in subscription metadata');
          break;
        }

        // Downgrade to free plan
        const userRef = doc(firestore, 'users', userId);
        await updateDoc(userRef, {
          'subscription.plan': 'free',
          'subscription.status': 'cancelled',
          'subscription.cancelAtPeriodEnd': false,
          updatedAt: serverTimestamp(),
        });

        console.log(`Subscription cancelled for user ${userId}`);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as any;
        const subscriptionId = invoice.subscription as string;
        
        // Get subscription to find userId
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const userId = subscription.metadata?.userId;
        
        if (!userId) {
          console.error('No userId in subscription metadata');
          break;
        }

        // Update subscription status
        const userRef = doc(firestore, 'users', userId);
        await updateDoc(userRef, {
          'subscription.status': 'past_due',
          updatedAt: serverTimestamp(),
        });

        console.log(`Payment failed for user ${userId}`);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error('Webhook handler error:', error);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }
}