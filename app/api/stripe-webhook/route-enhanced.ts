import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { doc, updateDoc, serverTimestamp, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { firestore } from '../../lib/firebase';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-05-28.basil',
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

// Helper function to find userId from multiple sources
async function findUserId(session?: Stripe.Checkout.Session, subscription?: Stripe.Subscription, customerId?: string): Promise<string | null> {
  // 1. Try session metadata
  if (session?.metadata?.userId) {
    console.log('Found userId in session metadata:', session.metadata.userId);
    return session.metadata.userId;
  }

  // 2. Try subscription metadata
  if (subscription?.metadata?.userId) {
    console.log('Found userId in subscription metadata:', subscription.metadata.userId);
    return subscription.metadata.userId;
  }

  // 3. Try to get from customer
  if (customerId || session?.customer || subscription?.customer) {
    const customerIdToUse = customerId || session?.customer || subscription?.customer;
    try {
      const customer = await stripe.customers.retrieve(customerIdToUse as string);
      if ('metadata' in customer && customer.metadata?.userId) {
        console.log('Found userId in customer metadata:', customer.metadata.userId);
        return customer.metadata.userId;
      }
    } catch (error) {
      console.error('Error retrieving customer:', error);
    }
  }

  // 4. Last resort - search Firestore by customer ID
  if (customerId || session?.customer || subscription?.customer) {
    const customerIdToUse = customerId || session?.customer || subscription?.customer;
    try {
      const usersRef = collection(firestore, 'users');
      const q = query(usersRef, where('subscription.stripeCustomerId', '==', customerIdToUse));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        const userId = querySnapshot.docs[0].id;
        console.log('Found userId in Firestore by customer ID:', userId);
        return userId;
      }
    } catch (error) {
      console.error('Error searching Firestore:', error);
    }
  }

  console.error('Could not find userId from any source');
  return null;
}

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  console.log('=== STRIPE WEBHOOK START ===');
  
  try {
    const body = await req.text();
    const signature = req.headers.get('stripe-signature')!;

    console.log('Webhook signature present:', !!signature);

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
      console.log('Webhook signature verified successfully');
    } catch (err: any) {
      console.error('Webhook signature verification failed:', err.message);
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 400 }
      );
    }

    console.log('Event type:', event.type);
    console.log('Event ID:', event.id);

    // Handle the event
    switch (event.type) {
      case 'checkout.session.completed': {
        console.log('Processing checkout.session.completed');
        const session = event.data.object as Stripe.Checkout.Session;
        
        console.log('Session ID:', session.id);
        console.log('Customer ID:', session.customer);
        console.log('Subscription ID:', session.subscription);
        console.log('Session metadata:', JSON.stringify(session.metadata));
        
        const userId = await findUserId(session);
        
        if (!userId) {
          console.error('CRITICAL: No userId found for session:', session.id);
          // Log details for manual recovery
          console.error('Session details for manual recovery:', {
            sessionId: session.id,
            customerId: session.customer,
            subscriptionId: session.subscription,
            customerEmail: session.customer_email,
          });
          break;
        }

        // Get the subscription
        const subscriptionId = session.subscription as string;
        console.log('Retrieving subscription:', subscriptionId);
        
        let subscription: Stripe.Subscription;
        try {
          subscription = await stripe.subscriptions.retrieve(subscriptionId);
          console.log('Subscription retrieved successfully');
        } catch (error) {
          console.error('Error retrieving subscription:', error);
          break;
        }

        // Determine the plan based on the price
        let plan: 'professional' | 'team' = 'professional';
        const priceId = subscription.items.data[0].price.id;
        console.log('Price ID:', priceId);
        
        if (priceId === process.env.STRIPE_PRICE_TEAM_MONTHLY || 
            priceId === process.env.STRIPE_PRICE_TEAM_YEARLY) {
          plan = 'team';
        }
        
        console.log('Determined plan:', plan);
        
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

        console.log('Initial credits to add:', initialCredits);

        // Update user profile with subscription info and add credits
        const userRef = doc(firestore, 'users', userId);
        
        console.log('Fetching current user data...');
        const userDoc = await getDoc(userRef);
        
        if (!userDoc.exists()) {
          console.error('User document does not exist:', userId);
          break;
        }
        
        const currentCredits = userDoc.data()?.credits?.available || 0;
        const newCredits = currentCredits + initialCredits;
        
        console.log('Current credits:', currentCredits);
        console.log('New credits total:', newCredits);
        
        const updateData = {
          subscription: {
            plan: plan,
            status: 'active',
            stripeCustomerId: session.customer as string,
            stripeSubscriptionId: subscription.id,
            currentPeriodEnd: new Date((subscription as any).current_period_end * 1000),
            cancelAtPeriodEnd: (subscription as any).cancel_at_period_end,
          },
          'credits.available': newCredits,
          'credits.lifetime': ((userDoc.data() as any)?.credits?.lifetime || 0) + initialCredits,
          'credits.lastRefreshDate': serverTimestamp(),
          'settings.autoAppendReferral': false, // Disable auto-append for paid users
          updatedAt: serverTimestamp(),
        };
        
        console.log('Updating user document...');
        await updateDoc(userRef, updateData);
        
        console.log(`SUCCESS: Subscription activated for user ${userId}. Credits: ${currentCredits} -> ${newCredits}`);
        break;
      }

      case 'customer.subscription.updated': {
        console.log('Processing customer.subscription.updated');
        const subscription = event.data.object as any;
        
        const userId = await findUserId(undefined, subscription);
        
        if (!userId) {
          console.error('No userId found for subscription:', subscription.id);
          break;
        }

        // Update subscription status
        const userRef = doc(firestore, 'users', userId);
        await updateDoc(userRef, {
          'subscription.status': subscription.status,
          'subscription.currentPeriodEnd': new Date((subscription as any).current_period_end * 1000),
          'subscription.cancelAtPeriodEnd': (subscription as any).cancel_at_period_end,
          updatedAt: serverTimestamp(),
        });

        console.log(`Subscription updated for user ${userId}. Status: ${subscription.status}`);
        break;
      }

      case 'customer.subscription.deleted': {
        console.log('Processing customer.subscription.deleted');
        const subscription = event.data.object as any;
        
        const userId = await findUserId(undefined, subscription);
        
        if (!userId) {
          console.error('No userId found for subscription:', subscription.id);
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
        console.log('Processing invoice.payment_failed');
        const invoice = event.data.object as any;
        const subscriptionId = invoice.subscription as string;
        
        // Get subscription to find userId
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const userId = await findUserId(undefined, subscription);
        
        if (!userId) {
          console.error('No userId found for subscription:', subscriptionId);
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

    const duration = Date.now() - startTime;
    console.log(`=== STRIPE WEBHOOK END (${duration}ms) ===`);
    
    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error('=== STRIPE WEBHOOK ERROR ===');
    console.error('Error details:', error);
    console.error('Stack trace:', error.stack);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }
}