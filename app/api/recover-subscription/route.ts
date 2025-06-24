import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { doc, updateDoc, serverTimestamp, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { firestore } from '../../lib/firebase';
import { getUserProfile } from '../../lib/database';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-05-28.basil',
});

// Admin emails allowed to use this endpoint
const ADMIN_EMAILS = ['robert@spotlightlawyer.com'];

export async function POST(req: NextRequest) {
  try {
    const { userEmail, stripeCustomerId } = await req.json();

    // Get the requesting user's email from the Authorization header or request
    const authEmail = req.headers.get('x-user-email');
    
    if (!ADMIN_EMAILS.includes(authEmail || '')) {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access only' },
        { status: 403 }
      );
    }

    // Find user by email
    let userId: string | null = null;
    
    if (userEmail) {
      const usersRef = collection(firestore, 'users');
      const q = query(usersRef, where('email', '==', userEmail));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        userId = querySnapshot.docs[0].id;
      }
    }

    if (!userId) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Get user's current profile
    const userProfile = await getUserProfile(userId);
    if (!userProfile) {
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 404 }
      );
    }

    // Check if user already has an active subscription
    if (userProfile.subscription?.status === 'active' && userProfile.subscription?.plan !== 'free') {
      return NextResponse.json({
        message: 'User already has an active subscription',
        subscription: userProfile.subscription,
        credits: userProfile.credits
      });
    }

    // Get subscription from Stripe using customer ID
    let subscription = null;
    let plan: 'professional' | 'team' = 'professional';
    
    if (stripeCustomerId || userProfile.subscription?.stripeCustomerId) {
      const customerId = stripeCustomerId || userProfile.subscription?.stripeCustomerId;
      const subscriptions = await stripe.subscriptions.list({
        customer: customerId as string,
        status: 'active',
        limit: 1
      });

      if (subscriptions.data.length > 0) {
        subscription = subscriptions.data[0];
        
        // Determine plan from price ID
        const priceId = subscription.items.data[0].price.id;
        if (priceId === process.env.STRIPE_PRICE_TEAM_MONTHLY || 
            priceId === process.env.STRIPE_PRICE_TEAM_YEARLY) {
          plan = 'team';
        }
      }
    }

    if (!subscription) {
      return NextResponse.json(
        { error: 'No active subscription found for this user' },
        { status: 404 }
      );
    }

    // Determine credits based on plan
    let creditsToAdd = 0;
    switch (plan) {
      case 'professional':
        creditsToAdd = 500;
        break;
      case 'team':
        creditsToAdd = 2000;
        break;
    }

    // Update user profile with subscription info and credits
    const userRef = doc(firestore, 'users', userId);
    const currentCredits = userProfile.credits?.available || 0;
    
    await updateDoc(userRef, {
      subscription: {
        plan: plan,
        status: 'active',
        stripeCustomerId: subscription.customer as string,
        stripeSubscriptionId: subscription.id,
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
      },
      'credits.available': currentCredits + creditsToAdd,
      'credits.lifetime': (userProfile.credits?.lifetime || 0) + creditsToAdd,
      'credits.lastRefreshDate': serverTimestamp(),
      'settings.autoAppendReferral': false, // Disable auto-append for paid users
      updatedAt: serverTimestamp(),
    });

    return NextResponse.json({
      success: true,
      message: `Successfully recovered subscription for ${userEmail}`,
      subscription: {
        plan,
        creditsAdded: creditsToAdd,
        totalCredits: currentCredits + creditsToAdd,
        stripeSubscriptionId: subscription.id
      }
    });

  } catch (error: any) {
    console.error('Error recovering subscription:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}