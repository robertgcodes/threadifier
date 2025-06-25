#!/usr/bin/env node

/**
 * Stripe Setup Verification Script
 * 
 * This script checks if Stripe is properly configured for Threadifier
 * Run with: node scripts/verify-stripe-setup.js
 */

const fs = require('fs');
const path = require('path');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  bold: '\x1b[1m'
};

// Helper functions
const success = (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`);
const error = (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`);
const warning = (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`);
const info = (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`);
const header = (msg) => console.log(`\n${colors.bold}${msg}${colors.reset}`);

// Check if .env.local exists
function checkEnvFile() {
  header('Checking Environment File');
  
  const envPath = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) {
    error('.env.local file not found');
    info('Create .env.local and copy variables from .env.example');
    return false;
  }
  
  success('.env.local file exists');
  return true;
}

// Load and check environment variables
function checkEnvironmentVariables() {
  header('Checking Stripe Environment Variables');
  
  // Load .env.local
  const envPath = path.join(process.cwd(), '.env.local');
  const envContent = fs.readFileSync(envPath, 'utf8');
  const envVars = {};
  
  envContent.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) {
      envVars[key.trim()] = value.trim();
    }
  });
  
  // Required variables
  const required = [
    { key: 'STRIPE_SECRET_KEY', prefix: 'sk_', desc: 'Stripe Secret Key' },
    { key: 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', prefix: 'pk_', desc: 'Stripe Publishable Key' },
    { key: 'STRIPE_WEBHOOK_SECRET', prefix: 'whsec_', desc: 'Stripe Webhook Secret' }
  ];
  
  const priceIds = [
    { key: 'NEXT_PUBLIC_STRIPE_PRICE_PROFESSIONAL_MONTHLY', prefix: 'price_', desc: 'Professional Monthly Price' },
    { key: 'NEXT_PUBLIC_STRIPE_PRICE_PROFESSIONAL_YEARLY', prefix: 'price_', desc: 'Professional Yearly Price' },
    { key: 'NEXT_PUBLIC_STRIPE_PRICE_TEAM_MONTHLY', prefix: 'price_', desc: 'Team Monthly Price' },
    { key: 'NEXT_PUBLIC_STRIPE_PRICE_TEAM_YEARLY', prefix: 'price_', desc: 'Team Yearly Price' }
  ];
  
  let allValid = true;
  
  // Check required keys
  required.forEach(({ key, prefix, desc }) => {
    const value = envVars[key];
    if (!value) {
      error(`${desc} (${key}) is missing`);
      allValid = false;
    } else if (!value.startsWith(prefix)) {
      error(`${desc} (${key}) has invalid format. Should start with '${prefix}'`);
      allValid = false;
    } else {
      success(`${desc} is configured`);
    }
  });
  
  // Check price IDs (optional but recommended)
  console.log(''); // Empty line
  let pricesConfigured = 0;
  priceIds.forEach(({ key, prefix, desc }) => {
    const value = envVars[key];
    if (!value) {
      warning(`${desc} (${key}) is not configured`);
    } else if (!value.startsWith(prefix)) {
      warning(`${desc} (${key}) might have invalid format. Should start with '${prefix}'`);
    } else {
      success(`${desc} is configured`);
      pricesConfigured++;
    }
  });
  
  if (pricesConfigured === 0) {
    error('No price IDs are configured. Subscriptions will not work.');
    allValid = false;
  } else if (pricesConfigured < priceIds.length) {
    warning(`Only ${pricesConfigured}/${priceIds.length} price IDs are configured`);
  }
  
  // Check for test vs live mode
  console.log(''); // Empty line
  const secretKey = envVars['STRIPE_SECRET_KEY'] || '';
  const publishableKey = envVars['NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY'] || '';
  
  if (secretKey.includes('_test_') && publishableKey.includes('_test_')) {
    info('Using Stripe TEST mode (good for development)');
  } else if (secretKey.includes('_live_') && publishableKey.includes('_live_')) {
    warning('Using Stripe LIVE mode (real payments will be processed!)');
  } else if (secretKey && publishableKey) {
    error('Mixed test/live keys detected. Use either all test or all live keys.');
    allValid = false;
  }
  
  return allValid;
}

// Check TypeScript/JavaScript files for common issues
function checkCodeIssues() {
  header('Checking Code Configuration');
  
  const filesToCheck = [
    {
      path: 'app/components/PricingTable.tsx',
      checks: [
        { pattern: /stripePromise\s*=\s*process\.env\.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY\s*\?/, desc: 'Conditional Stripe loading' },
        { pattern: /tier\.price\s*===\s*0\s*\?\s*['"]Free['"]/, desc: 'Free tier display fix' }
      ]
    },
    {
      path: 'app/api/create-portal-session/route.ts',
      checks: [
        { pattern: /No configuration provided/, desc: 'Portal configuration error handling' }
      ]
    }
  ];
  
  let allPassed = true;
  
  filesToCheck.forEach(({ path: filePath, checks }) => {
    const fullPath = path.join(process.cwd(), filePath);
    if (!fs.existsSync(fullPath)) {
      warning(`File ${filePath} not found`);
      return;
    }
    
    const content = fs.readFileSync(fullPath, 'utf8');
    checks.forEach(({ pattern, desc }) => {
      if (pattern.test(content)) {
        success(`${filePath}: ${desc}`);
      } else {
        error(`${filePath}: Missing ${desc}`);
        allPassed = false;
      }
    });
  });
  
  return allPassed;
}

// Main verification
function main() {
  console.log(`${colors.bold}Stripe Setup Verification for Threadifier${colors.reset}`);
  console.log('========================================');
  
  let allPassed = true;
  
  // Run checks
  allPassed = checkEnvFile() && allPassed;
  if (allPassed) {
    allPassed = checkEnvironmentVariables() && allPassed;
  }
  allPassed = checkCodeIssues() && allPassed;
  
  // Summary
  header('Summary');
  if (allPassed) {
    success('All checks passed! Stripe should be working correctly.');
    info('Next steps:');
    info('1. Configure Customer Portal at https://dashboard.stripe.com/test/settings/billing/portal');
    info('2. Create products and copy price IDs to .env.local');
    info('3. Test with "npm run dev" and try subscribing');
  } else {
    error('Some checks failed. Please fix the issues above.');
    info('See COMPLETE_STRIPE_SETUP.md for detailed instructions');
  }
  
  // Additional tips
  header('Quick Tips');
  info('• Customer Portal must be configured and SAVED in Stripe Dashboard');
  info('• Use Stripe CLI for webhook testing: stripe listen --forward-to localhost:3000/api/stripe-webhook');
  info('• Check browser console for "Stripe loaded successfully" message');
  info('• React error #130 usually means missing environment variables');
}

// Run the script
main();