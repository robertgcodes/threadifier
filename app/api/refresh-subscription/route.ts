import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { initAdmin } from '../../lib/firebase-admin';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-05-28.basil',
});

export async function POST(req: NextRequest) {
  try {
    // Verify authentication
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    initAdmin();
    const auth = getAuth();
    const db = getFirestore();

    // Verify the token
    const decodedToken = await auth.verifyIdToken(token);
    const userId = decodedToken.uid;

    // Get user data
    const userDoc = await db.collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userData = userDoc.data();
    
    if (!userData?.subscription?.stripeSubscriptionId) {
      return NextResponse.json({ 
        error: 'No subscription found',
        plan: 'free' 
      }, { status: 200 });
    }

    // Fetch current subscription from Stripe
    const subscription = await stripe.subscriptions.retrieve(userData.subscription.stripeSubscriptionId) as any;
    
    // Determine the correct plan based on price ID
    const priceId = subscription.items.data[0].price.id;
    let correctPlan: 'professional' | 'team' | 'free' = 'professional';
    
    const teamPriceIds = [
      process.env.NEXT_PUBLIC_STRIPE_PRICE_TEAM_MONTHLY,
      process.env.NEXT_PUBLIC_STRIPE_PRICE_TEAM_YEARLY
    ];
    
    if (teamPriceIds.includes(priceId)) {
      correctPlan = 'team';
    } else if (subscription.status !== 'active') {
      correctPlan = 'free';
    }

    // Check if update is needed
    const needsUpdate = userData.subscription.plan !== correctPlan || 
                       userData.subscription.status !== subscription.status;

    if (needsUpdate) {
      // Update the subscription data
      await db.collection('users').doc(userId).update({
        'subscription.plan': correctPlan,
        'subscription.status': subscription.status,
        'subscription.currentPeriodEnd': new Date(subscription.current_period_end * 1000),
        'subscription.cancelAtPeriodEnd': subscription.cancel_at_period_end,
        updatedAt: new Date(),
      });

      return NextResponse.json({ 
        success: true,
        message: 'Subscription updated',
        oldPlan: userData.subscription.plan,
        newPlan: correctPlan,
        status: subscription.status
      });
    }

    return NextResponse.json({ 
      success: true,
      message: 'Subscription is already up to date',
      plan: correctPlan,
      status: subscription.status
    });

  } catch (error: any) {
    console.error('Error refreshing subscription:', error);
    return NextResponse.json(
      { error: 'Failed to refresh subscription' },
      { status: 500 }
    );
  }
}