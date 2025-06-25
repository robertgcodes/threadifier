"use client";

import { useState } from 'react';
import { Check, X, Infinity } from 'lucide-react';
import { loadStripe } from '@stripe/stripe-js';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY 
  ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
  : null;

interface PricingTier {
  id: string;
  name: string;
  price: number;
  priceYearly: number;
  description: string;
  features: string[];
  limitations: string[];
  recommended?: boolean;
  stripePriceId?: string;
  stripePriceIdYearly?: string;
}

const pricingTiers: PricingTier[] = [
  {
    id: 'free',
    name: 'Basic',
    price: 0,
    priceYearly: 0,
    description: 'Generate unlimited threads with basic AI',
    features: [
      'Unlimited thread generation',
      'Claude Haiku AI (basic model)',
      'Direct X posting capability',
      'Save unlimited threads',
      'Image editing & annotations',
      'Custom AI instructions',
      '100 premium trial credits on signup',
      'Earn 100 premium credits per referral',
    ],
    limitations: [
      'Auto-appended referral message',
      'Basic AI model (less creative)',
    ],
  },
  {
    id: 'professional',
    name: 'Professional',
    price: 29,
    priceYearly: 290,
    description: 'For legal professionals and content creators',
    features: [
      '500 premium credits per month',
      'Claude Sonnet AI (best model)',
      'No referral message',
      'Rollover up to 1000 credits',
      'Everything in Basic tier',
      'AI-powered image suggestions',
      'Custom thread statuses',
      'Priority email support',
    ],
    limitations: [],
    recommended: true,
    ...(process.env.NEXT_PUBLIC_STRIPE_PRICE_PROFESSIONAL_MONTHLY && process.env.NEXT_PUBLIC_STRIPE_PRICE_PROFESSIONAL_MONTHLY !== 'price_professional_monthly_id' ? {
      stripePriceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_PROFESSIONAL_MONTHLY,
    } : {}),
    ...(process.env.NEXT_PUBLIC_STRIPE_PRICE_PROFESSIONAL_YEARLY && process.env.NEXT_PUBLIC_STRIPE_PRICE_PROFESSIONAL_YEARLY !== 'price_professional_yearly_id' ? {
      stripePriceIdYearly: process.env.NEXT_PUBLIC_STRIPE_PRICE_PROFESSIONAL_YEARLY,
    } : {}),
  },
  {
    id: 'team',
    name: 'Team',
    price: 79,
    priceYearly: 790,
    description: 'For law firms and content teams',
    features: [
      '2000 premium credits per month',
      'Claude Sonnet AI (best model)',
      'Rollover up to 5000 credits',
      'Everything in Professional',
      '3 team members',
      'Shared templates & prompts',
      'Team analytics dashboard',
      'API access (coming soon)',
      'Priority phone support',
      'Custom branding options',
    ],
    limitations: [],
    ...(process.env.NEXT_PUBLIC_STRIPE_PRICE_TEAM_MONTHLY && process.env.NEXT_PUBLIC_STRIPE_PRICE_TEAM_MONTHLY !== 'price_team_monthly_id' ? {
      stripePriceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_TEAM_MONTHLY,
    } : {}),
    ...(process.env.NEXT_PUBLIC_STRIPE_PRICE_TEAM_YEARLY && process.env.NEXT_PUBLIC_STRIPE_PRICE_TEAM_YEARLY !== 'price_team_yearly_id' ? {
      stripePriceIdYearly: process.env.NEXT_PUBLIC_STRIPE_PRICE_TEAM_YEARLY,
    } : {}),
  },
];

export default function PricingTable({ currentPlan = 'free' }: { currentPlan?: string }) {
  const [isYearly, setIsYearly] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const { user } = useAuth();

  const handleSubscribe = async (tier: PricingTier) => {
    if (!user) {
      toast.error('Please sign in to subscribe');
      return;
    }

    if (tier.id === 'free') {
      toast.success('You are already on the free plan');
      return;
    }

    setLoading(tier.id);

    try {
      if (!stripePromise) {
        throw new Error('Stripe is not configured. Please add your Stripe publishable key to the environment variables.');
      }

      const priceId = isYearly ? tier.stripePriceIdYearly : tier.stripePriceId;
      
      if (!priceId || priceId.includes('_id')) {
        throw new Error('This subscription plan is not available for purchase yet. Please try again later or contact support.');
      }
      
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          priceId,
          userId: user.uid,
          userEmail: user.email,
        }),
      });

      const { sessionId, error } = await response.json();

      if (error) {
        throw new Error(error);
      }

      const stripe = await stripePromise;
      if (!stripe) throw new Error('Stripe not loaded');

      const { error: stripeError } = await stripe.redirectToCheckout({ sessionId });
      
      if (stripeError) {
        throw stripeError;
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to start checkout');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="py-12">
      {/* Stripe Configuration Warning */}
      {!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY === 'pk_test_your_stripe_publishable_key' ? (
        <div className="max-w-4xl mx-auto mb-8 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                Payment System Not Configured
              </h3>
              <div className="mt-2 text-sm text-yellow-700 dark:text-yellow-300">
                <p>
                  The payment system is not fully configured. Subscription buttons are disabled until Stripe is properly set up.
                  Contact support for assistance.
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Billing Toggle */}
      <div className="flex justify-center mb-12">
        <div className="bg-gray-100 dark:bg-gray-800 p-1 rounded-lg flex items-center">
          <button
            onClick={() => setIsYearly(false)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              !isYearly 
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm' 
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setIsYearly(true)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              isYearly 
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm' 
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
            }`}
          >
            Yearly
            <span className="ml-1 text-green-600 text-xs font-semibold">Save 17%</span>
          </button>
        </div>
      </div>

      {/* Pricing Cards */}
      <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
        {pricingTiers.map((tier) => (
          <div
            key={tier.id}
            className={`relative bg-white dark:bg-gray-800 rounded-2xl shadow-lg border-2 transition-all ${
              tier.recommended 
                ? 'border-blue-500 scale-105' 
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
          >
            {tier.recommended ? (
              <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                <span className="bg-blue-500 text-white px-4 py-1 rounded-full text-sm font-semibold">
                  RECOMMENDED
                </span>
              </div>
            ) : null}

            <div className="p-8">
              <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{tier.name}</h3>
              <p className="mt-2 text-gray-600 dark:text-gray-400">{tier.description}</p>
              
              <div className="mt-6">
                <span className="text-4xl font-bold text-gray-900 dark:text-gray-100">
                  {(() => {
                    if (tier.price === 0) return 'Free';
                    
                    let displayPrice: number;
                    if (isYearly && tier.priceYearly && tier.priceYearly > 0) {
                      displayPrice = Math.floor(tier.priceYearly / 12);
                    } else {
                      displayPrice = tier.price;
                    }
                    
                    // Ensure we have a valid number
                    if (isNaN(displayPrice) || !isFinite(displayPrice)) {
                      displayPrice = tier.price || 0;
                    }
                    
                    return `$${String(displayPrice)}`;
                  })()}
                </span>
                {tier.price > 0 ? <span className="text-gray-600 dark:text-gray-400">/month</span> : null}
                {isYearly && tier.priceYearly && tier.priceYearly > 0 ? (
                  <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                    Billed ${String(tier.priceYearly)} yearly
                  </p>
                ) : null}
              </div>

              <button
                onClick={() => handleSubscribe(tier)}
                disabled={loading !== null || currentPlan === tier.id || !process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY === 'pk_test_your_stripe_publishable_key'}
                className={`mt-6 w-full py-3 px-4 rounded-lg font-medium transition-colors ${
                  currentPlan === tier.id
                    ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                    : tier.recommended
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-gray-900 dark:bg-gray-700 text-white hover:bg-gray-800 dark:hover:bg-gray-600'
                } disabled:opacity-50`}
              >
                {loading === tier.id ? (
                  'Loading...'
                ) : currentPlan === tier.id ? (
                  'Current Plan'
                ) : tier.id === 'free' ? (
                  'Get Started'
                ) : !process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY === 'pk_test_your_stripe_publishable_key' ? (
                  'Coming Soon'
                ) : (
                  'Subscribe'
                )}
              </button>

              <div className="mt-8 space-y-4">
                <h4 className="font-semibold text-gray-900 dark:text-gray-100">Includes:</h4>
                <ul className="space-y-3">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-start">
                      <Check className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700 dark:text-gray-300 text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
                
                {tier.limitations && tier.limitations.length > 0 ? (
                  <>
                    <h4 className="font-semibold text-gray-900 dark:text-gray-100 mt-6">Not included:</h4>
                    <ul className="space-y-3">
                      {tier.limitations.map((limitation) => (
                        <li key={limitation} className="flex items-start">
                          <X className="w-5 h-5 text-gray-400 dark:text-gray-500 mr-2 flex-shrink-0 mt-0.5" />
                          <span className="text-gray-500 dark:text-gray-400 text-sm">{limitation}</span>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : null}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Credits Explanation */}
      <div className="mt-12 max-w-3xl mx-auto bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/30 dark:to-purple-900/30 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">How Credits Work</h3>
        
        <div className="grid md:grid-cols-2 gap-4 mb-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Infinity className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <h4 className="font-semibold text-gray-900 dark:text-gray-100">Basic Tier (Unlimited)</h4>
            </div>
            <ul className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
              <li>• Claude Haiku AI model</li>
              <li>• Auto-appended referral link</li>
              <li>• Full X posting capability</li>
              <li>• All core features included</li>
            </ul>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Check className="w-5 h-5 text-green-500 dark:text-green-400" />
              <h4 className="font-semibold text-gray-900 dark:text-gray-100">Premium Credits</h4>
            </div>
            <ul className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
              <li>• Claude Sonnet AI (best model)</li>
              <li>• No referral message</li>
              <li>• 100 trial credits for new users</li>
              <li>• Earn 100 per referral</li>
            </ul>
          </div>
        </div>
        
        <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
          <strong>New users get 100 premium trial credits</strong> to experience the full power of Claude Sonnet AI.
          After that, you have unlimited access to the basic tier!
        </p>
        
        <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
          <li className="flex items-start">
            <Check className="w-4 h-4 text-green-500 dark:text-green-400 mr-2 flex-shrink-0 mt-0.5" />
            <span>Refer friends to earn 100 premium credits per signup</span>
          </li>
          <li className="flex items-start">
            <Check className="w-4 h-4 text-green-500 dark:text-green-400 mr-2 flex-shrink-0 mt-0.5" />
            <span>Premium credits from paid plans can rollover each month</span>
          </li>
          <li className="flex items-start">
            <Check className="w-4 h-4 text-green-500 dark:text-green-400 mr-2 flex-shrink-0 mt-0.5" />
            <span>Image editing, saving, and viewing threads are always free</span>
          </li>
        </ul>
      </div>
      
      {/* Additional Info */}
      <div className="mt-8 text-center text-sm text-gray-600">
        <p>All plans include automatic updates and SSL security.</p>
        <p className="mt-2">
          Need more? <a href="mailto:support@threadifier.com" className="text-blue-600 hover:underline">
            Contact us for Enterprise pricing
          </a>
        </p>
      </div>
    </div>
  );
}