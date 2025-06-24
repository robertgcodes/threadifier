import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { firestore } from '../../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-05-28.basil',
});

export async function POST(req: NextRequest) {
  try {
    const { subscriptionId } = await req.json();

    if (!subscriptionId) {
      return NextResponse.json(
        { error: 'Missing subscription ID' },
        { status: 400 }
      );
    }

    // Reactivate the subscription
    const subscription = await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: false,
    });

    // Update the user's profile in Firebase
    const customerId = subscription.customer as string;
    const customerData = await stripe.customers.retrieve(customerId);
    
    if (customerData && 'metadata' in customerData && customerData.metadata.userId) {
      const userRef = doc(firestore, 'users', customerData.metadata.userId);
      await updateDoc(userRef, {
        'subscription.cancelAtPeriodEnd': false,
        'updatedAt': new Date(),
      });
    }

    return NextResponse.json({
      success: true,
      subscription: {
        id: subscription.id,
        cancel_at_period_end: (subscription as any).cancel_at_period_end,
        current_period_end: (subscription as any).current_period_end,
      },
    });
  } catch (error) {
    console.error('Error reactivating subscription:', error);
    return NextResponse.json(
      { error: 'Failed to reactivate subscription' },
      { status: 500 }
    );
  }
}