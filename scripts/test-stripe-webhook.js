#!/usr/bin/env node

/**
 * Stripe Webhook Testing Script
 * 
 * This script helps test and debug Stripe webhook issues by:
 * 1. Checking environment variables
 * 2. Testing webhook endpoint connectivity
 * 3. Simulating webhook events locally
 * 
 * Usage: node scripts/test-stripe-webhook.js
 */

const https = require('https');
const crypto = require('crypto');

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

// Check environment variables
function checkEnvVars() {
  log('\n=== Checking Environment Variables ===', 'blue');
  
  const requiredVars = [
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'NEXT_PUBLIC_APP_URL',
    'STRIPE_PRICE_PROFESSIONAL_MONTHLY',
    'STRIPE_PRICE_PROFESSIONAL_YEARLY',
    'STRIPE_PRICE_TEAM_MONTHLY',
    'STRIPE_PRICE_TEAM_YEARLY',
  ];

  let allPresent = true;
  
  requiredVars.forEach(varName => {
    const value = process.env[varName];
    if (value) {
      // Mask sensitive values
      let displayValue = value;
      if (varName.includes('SECRET') || varName.includes('KEY')) {
        displayValue = value.substring(0, 10) + '...' + value.substring(value.length - 4);
      }
      log(`✓ ${varName}: ${displayValue}`, 'green');
    } else {
      log(`✗ ${varName}: NOT SET`, 'red');
      allPresent = false;
    }
  });

  return allPresent;
}

// Generate Stripe webhook signature
function generateWebhookSignature(payload, secret) {
  const timestamp = Math.floor(Date.now() / 1000);
  const payloadString = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const signedPayload = `${timestamp}.${payloadString}`;
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(signedPayload)
    .digest('hex');
  
  return {
    signature: `t=${timestamp},v1=${expectedSignature}`,
    payload: payloadString,
  };
}

// Test webhook endpoint
async function testWebhookEndpoint(url, method = 'POST') {
  return new Promise((resolve) => {
    const urlObj = new URL(url);
    
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const req = (urlObj.protocol === 'https:' ? https : require('http')).request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          data: data,
        });
      });
    });

    req.on('error', (error) => {
      resolve({
        error: error.message,
      });
    });

    if (method === 'POST') {
      req.write('{"test": true}');
    }
    
    req.end();
  });
}

// Simulate a checkout.session.completed event
function createMockCheckoutSession(userId, plan = 'professional') {
  const priceId = plan === 'team' 
    ? process.env.STRIPE_PRICE_TEAM_MONTHLY 
    : process.env.STRIPE_PRICE_PROFESSIONAL_MONTHLY;

  return {
    id: 'evt_test_webhook',
    object: 'event',
    api_version: '2025-05-28.basil',
    created: Math.floor(Date.now() / 1000),
    data: {
      object: {
        id: 'cs_test_' + Math.random().toString(36).substring(7),
        object: 'checkout.session',
        customer: 'cus_test_' + Math.random().toString(36).substring(7),
        customer_email: 'test@example.com',
        metadata: {
          userId: userId,
        },
        mode: 'subscription',
        payment_status: 'paid',
        status: 'complete',
        subscription: 'sub_test_' + Math.random().toString(36).substring(7),
        success_url: process.env.NEXT_PUBLIC_APP_URL + '/billing?success=true',
      },
    },
    livemode: false,
    pending_webhooks: 1,
    request: {
      id: null,
      idempotency_key: null,
    },
    type: 'checkout.session.completed',
  };
}

// Main testing function
async function runTests() {
  log('\n🧪 Stripe Webhook Testing Script\n', 'blue');

  // 1. Check environment variables
  const envVarsOk = checkEnvVars();
  if (!envVarsOk) {
    log('\n⚠️  Missing environment variables. Please set them in .env.local', 'yellow');
    return;
  }

  // 2. Test webhook endpoint connectivity
  log('\n=== Testing Webhook Endpoint ===', 'blue');
  
  const webhookUrl = process.env.NEXT_PUBLIC_APP_URL + '/api/stripe-webhook';
  log(`Testing: ${webhookUrl}`, 'yellow');
  
  const testResult = await testWebhookEndpoint(webhookUrl);
  
  if (testResult.error) {
    log(`✗ Connection failed: ${testResult.error}`, 'red');
    log('  Make sure your server is running!', 'yellow');
  } else if (testResult.statusCode === 400) {
    log('✓ Endpoint is reachable (400 is expected for unsigned request)', 'green');
  } else {
    log(`⚠️  Unexpected status code: ${testResult.statusCode}`, 'yellow');
    log(`  Response: ${testResult.data}`, 'yellow');
  }

  // 3. Show how to test with Stripe CLI
  log('\n=== Testing with Stripe CLI ===', 'blue');
  log('To test webhooks locally, run these commands:', 'yellow');
  log('\n1. Install Stripe CLI:');
  log('   brew install stripe/stripe-cli/stripe\n');
  log('2. Login to Stripe:');
  log('   stripe login\n');
  log('3. Forward webhooks to your local server:');
  log('   stripe listen --forward-to localhost:3000/api/stripe-webhook\n');
  log('4. In another terminal, trigger a test event:');
  log('   stripe trigger checkout.session.completed\n');

  // 4. Generate sample webhook for manual testing
  log('\n=== Sample Webhook Event ===', 'blue');
  
  const mockEvent = createMockCheckoutSession('test_user_123');
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  
  if (webhookSecret) {
    const { signature, payload } = generateWebhookSignature(mockEvent, webhookSecret);
    
    log('\nYou can manually test the webhook with this curl command:', 'yellow');
    log(`\ncurl -X POST ${webhookUrl} \\`);
    log(`  -H "Content-Type: application/json" \\`);
    log(`  -H "stripe-signature: ${signature}" \\`);
    log(`  -d '${payload}'`);
  }

  log('\n✅ Testing complete!\n', 'green');
}

// Run the tests
runTests().catch(console.error);