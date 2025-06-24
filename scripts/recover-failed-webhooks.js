#!/usr/bin/env node

/**
 * Stripe Webhook Recovery Script
 * 
 * This script helps recover from failed webhook events by:
 * 1. Fetching failed events from Stripe
 * 2. Manually processing subscription data
 * 3. Updating user credits in Firebase
 * 
 * Usage: node scripts/recover-failed-webhooks.js
 */

const readline = require('readline');

// Initialize Stripe
const Stripe = require('stripe');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-05-28.basil',
});

// Initialize Firebase Admin
const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
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

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Helper to prompt user
function prompt(question) {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
}

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Find user by email or customer ID
async function findUser(identifier) {
  try {
    // First try to find by email
    const usersRef = db.collection('users');
    let query = usersRef.where('email', '==', identifier);
    let snapshot = await query.get();
    
    if (!snapshot.empty) {
      return {
        id: snapshot.docs[0].id,
        data: snapshot.docs[0].data(),
      };
    }
    
    // Try to find by Stripe customer ID
    query = usersRef.where('subscription.stripeCustomerId', '==', identifier);
    snapshot = await query.get();
    
    if (!snapshot.empty) {
      return {
        id: snapshot.docs[0].id,
        data: snapshot.docs[0].data(),
      };
    }
    
    return null;
  } catch (error) {
    console.error('Error finding user:', error);
    return null;
  }
}

// Process a subscription manually
async function processSubscription(subscriptionId, userId) {
  try {
    log(`\nProcessing subscription ${subscriptionId}...`, 'yellow');
    
    // Fetch subscription from Stripe
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    
    // Determine plan
    const priceId = subscription.items.data[0].price.id;
    let plan = 'professional';
    let credits = 500;
    
    if (priceId === process.env.STRIPE_PRICE_TEAM_MONTHLY || 
        priceId === process.env.STRIPE_PRICE_TEAM_YEARLY) {
      plan = 'team';
      credits = 2000;
    }
    
    log(`Plan: ${plan} (${credits} credits)`, 'blue');
    log(`Status: ${subscription.status}`, 'blue');
    
    // Update user in Firebase
    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();
    
    if (!userDoc.exists) {
      log('User not found in Firebase!', 'red');
      return false;
    }
    
    const currentData = userDoc.data();
    const currentCredits = currentData.credits?.available || 0;
    
    await userRef.update({
      subscription: {
        plan: plan,
        status: subscription.status,
        stripeCustomerId: subscription.customer,
        stripeSubscriptionId: subscription.id,
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
      },
      'credits.available': currentCredits + credits,
      'credits.lifetime': (currentData.credits?.lifetime || 0) + credits,
      'settings.autoAppendReferral': false,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    
    log(`✅ Successfully updated user ${userId}`, 'green');
    log(`   Credits: ${currentCredits} -> ${currentCredits + credits}`, 'green');
    
    return true;
  } catch (error) {
    log(`❌ Error processing subscription: ${error.message}`, 'red');
    return false;
  }
}

// Main recovery flow
async function runRecovery() {
  log('\n🔧 Stripe Webhook Recovery Tool\n', 'blue');
  
  const action = await prompt(`
What would you like to do?
1. Process a specific subscription
2. Check recent failed webhooks
3. Find user by email/customer ID
4. Exit

Enter your choice (1-4): `);

  switch (action) {
    case '1': {
      const subscriptionId = await prompt('\nEnter Stripe subscription ID: ');
      const userIdentifier = await prompt('Enter user email or Firebase user ID: ');
      
      let userId = userIdentifier;
      
      // If it looks like an email, find the user
      if (userIdentifier.includes('@')) {
        const user = await findUser(userIdentifier);
        if (user) {
          userId = user.id;
          log(`Found user: ${user.data.email} (${userId})`, 'green');
        } else {
          log('User not found!', 'red');
          break;
        }
      }
      
      await processSubscription(subscriptionId, userId);
      break;
    }
    
    case '2': {
      log('\nFetching recent events...', 'yellow');
      
      try {
        const events = await stripe.events.list({
          type: 'checkout.session.completed',
          limit: 20,
        });
        
        log(`\nFound ${events.data.length} recent checkout events:\n`, 'blue');
        
        for (const event of events.data) {
          const session = event.data.object;
          const timestamp = new Date(event.created * 1000).toLocaleString();
          
          log(`Event: ${event.id}`, 'yellow');
          log(`Time: ${timestamp}`);
          log(`Customer: ${session.customer}`);
          log(`Subscription: ${session.subscription}`);
          log(`Metadata: ${JSON.stringify(session.metadata)}`);
          log('---');
        }
      } catch (error) {
        log(`Error fetching events: ${error.message}`, 'red');
      }
      break;
    }
    
    case '3': {
      const identifier = await prompt('\nEnter email or Stripe customer ID: ');
      const user = await findUser(identifier);
      
      if (user) {
        log('\n✅ User found:', 'green');
        log(`ID: ${user.id}`);
        log(`Email: ${user.data.email}`);
        log(`Credits: ${user.data.credits?.available || 0}`);
        log(`Plan: ${user.data.subscription?.plan || 'free'}`);
        log(`Customer ID: ${user.data.subscription?.stripeCustomerId || 'none'}`);
      } else {
        log('❌ User not found', 'red');
      }
      break;
    }
    
    case '4':
      log('\nGoodbye! 👋\n', 'blue');
      rl.close();
      return;
    
    default:
      log('Invalid choice!', 'red');
  }
  
  // Ask if user wants to continue
  const continueChoice = await prompt('\nWould you like to perform another action? (y/n): ');
  if (continueChoice.toLowerCase() === 'y') {
    await runRecovery();
  } else {
    log('\nGoodbye! 👋\n', 'blue');
    rl.close();
  }
}

// Check environment variables
function checkEnv() {
  const required = [
    'STRIPE_SECRET_KEY',
    'FIREBASE_PROJECT_ID',
    'FIREBASE_CLIENT_EMAIL',
    'FIREBASE_PRIVATE_KEY',
  ];
  
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    log('❌ Missing required environment variables:', 'red');
    missing.forEach(key => log(`   - ${key}`, 'red'));
    log('\nPlease set these in your .env.local file', 'yellow');
    process.exit(1);
  }
}

// Run the script
checkEnv();
runRecovery().catch(error => {
  log(`\n❌ Fatal error: ${error.message}`, 'red');
  rl.close();
  process.exit(1);
});