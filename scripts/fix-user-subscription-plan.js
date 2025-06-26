#!/usr/bin/env node

/**
 * Script to fix user subscription plans that weren't updated correctly
 * This script checks the user's current Stripe subscription and updates their Firebase plan accordingly
 */

require('dotenv').config({ path: '.env.local' });
const Stripe = require('stripe');
const admin = require('firebase-admin');

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-05-28.basil',
});

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const db = admin.firestore();

async function fixUserSubscriptionPlan(userEmail) {
  try {
    console.log(`Checking subscription for user: ${userEmail}`);
    
    // Find user by email
    const usersSnapshot = await db.collection('users').where('email', '==', userEmail).get();
    
    if (usersSnapshot.empty) {
      console.error(`No user found with email: ${userEmail}`);
      return;
    }
    
    const userDoc = usersSnapshot.docs[0];
    const userData = userDoc.data();
    const userId = userDoc.id;
    
    console.log(`Found user: ${userId}`);
    console.log(`Current plan in database: ${userData.subscription?.plan || 'free'}`);
    
    if (!userData.subscription?.stripeSubscriptionId) {
      console.log('User has no Stripe subscription ID');
      return;
    }
    
    // Fetch subscription from Stripe
    const subscription = await stripe.subscriptions.retrieve(userData.subscription.stripeSubscriptionId);
    console.log(`Stripe subscription status: ${subscription.status}`);
    
    if (subscription.status !== 'active') {
      console.log('Subscription is not active');
      return;
    }
    
    // Get the price ID
    const priceId = subscription.items.data[0].price.id;
    console.log(`Current price ID: ${priceId}`);
    
    // Determine the correct plan
    let correctPlan = 'professional';
    let monthlyCredits = 500;
    
    const teamPriceIds = [
      process.env.NEXT_PUBLIC_STRIPE_PRICE_TEAM_MONTHLY,
      process.env.NEXT_PUBLIC_STRIPE_PRICE_TEAM_YEARLY
    ];
    
    const professionalPriceIds = [
      process.env.NEXT_PUBLIC_STRIPE_PRICE_PROFESSIONAL_MONTHLY,
      process.env.NEXT_PUBLIC_STRIPE_PRICE_PROFESSIONAL_YEARLY
    ];
    
    if (teamPriceIds.includes(priceId)) {
      correctPlan = 'team';
      monthlyCredits = 2000;
      console.log('✓ User should be on TEAM plan');
    } else if (professionalPriceIds.includes(priceId)) {
      correctPlan = 'professional';
      monthlyCredits = 500;
      console.log('✓ User should be on PROFESSIONAL plan');
    } else {
      console.log(`⚠️ Unknown price ID: ${priceId}`);
      return;
    }
    
    // Check if update is needed
    if (userData.subscription.plan === correctPlan) {
      console.log('✓ User plan is already correct');
      return;
    }
    
    console.log(`Updating user plan from ${userData.subscription.plan} to ${correctPlan}`);
    
    // Update the user's subscription in Firebase
    await db.collection('users').doc(userId).update({
      'subscription.plan': correctPlan,
      'subscription.status': subscription.status,
      'subscription.currentPeriodEnd': new Date(subscription.current_period_end * 1000),
      'subscription.cancelAtPeriodEnd': subscription.cancel_at_period_end,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    
    console.log('✓ Successfully updated user subscription plan');
    
    // Check if credits need to be adjusted
    const currentCredits = userData.credits?.premiumCredits || 0;
    console.log(`Current premium credits: ${currentCredits}`);
    
    // If upgrading from professional to team, add the difference in credits
    if (userData.subscription.plan === 'professional' && correctPlan === 'team') {
      const creditDifference = 2000 - 500; // 1500 additional credits
      console.log(`Adding ${creditDifference} additional credits for team upgrade`);
      
      // Note: You may want to use the addCreditsWithExpiration function from your API
      // For now, we'll just log this requirement
      console.log('⚠️ Manual credit adjustment may be needed. Team plan should have 2000 credits.');
    }
    
  } catch (error) {
    console.error('Error fixing subscription:', error);
  }
}

// Check if email was provided as command line argument
const userEmail = process.argv[2];

if (!userEmail) {
  console.log('Usage: node fix-user-subscription-plan.js <user-email>');
  console.log('Example: node fix-user-subscription-plan.js user@example.com');
  process.exit(1);
}

// Run the fix
fixUserSubscriptionPlan(userEmail).then(() => {
  console.log('Done');
  process.exit(0);
}).catch(error => {
  console.error('Script failed:', error);
  process.exit(1);
});