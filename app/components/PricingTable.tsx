"use client";

import { useState } from 'react';
import { Check, X } from 'lucide-react';
import { loadStripe } from '@stripe/stripe-js';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

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
    name: 'Starter',
    price: 0,
    priceYearly: 0,
    description: 'Perfect for trying out Threadifier',
    features: [
      '100 free credits on signup',
      'Earn 100 credits per referral',
      'Basic thread generation',
      'Save unlimited threads',
      'Standard support',
      'Auto-append referral message',
    ],
    limitations: [
      'Limited to earned credits',
      'Referral message required',
      'No priority support',
    ],
  },
  {
    id: 'professional',
    name: 'Professional',
    price: 29,
    priceYearly: 290, // 2 months free
    description: 'For legal professionals and content creators',
    features: [
      '500 credits per month',
      'Rollover up to 1000 credits',
      'No referral message required',
      'Custom AI instructions',
      'Direct X posting',
      'Image editing & annotations',
      'AI image suggestions',
      'Custom thread statuses',
      'Priority email support',
    ],
    limitations: [],
    recommended: true,
    stripePriceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_PROFESSIONAL_MONTHLY,
    stripePriceIdYearly: process.env.NEXT_PUBLIC_STRIPE_PRICE_PROFESSIONAL_YEARLY,
  },
  {
    id: 'team',
    name: 'Team',
    price: 79,
    priceYearly: 790, // 2 months free
    description: 'For law firms and content teams',
    features: [
      '2000 credits per month',
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
    stripePriceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_TEAM_MONTHLY,
    stripePriceIdYearly: process.env.NEXT_PUBLIC_STRIPE_PRICE_TEAM_YEARLY,
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
      const priceId = isYearly ? tier.stripePriceIdYearly : tier.stripePriceId;
      
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
      {/* Billing Toggle */}
      <div className="flex justify-center mb-12">
        <div className="bg-gray-100 p-1 rounded-lg flex items-center">
          <button
            onClick={() => setIsYearly(false)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              !isYearly 
                ? 'bg-white text-gray-900 shadow-sm' 
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setIsYearly(true)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              isYearly 
                ? 'bg-white text-gray-900 shadow-sm' 
                : 'text-gray-600 hover:text-gray-900'
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
            className={`relative bg-white rounded-2xl shadow-lg border-2 transition-all ${
              tier.recommended 
                ? 'border-blue-500 scale-105' 
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            {tier.recommended && (
              <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                <span className="bg-blue-500 text-white px-4 py-1 rounded-full text-sm font-semibold">
                  RECOMMENDED
                </span>
              </div>
            )}

            <div className="p-8">
              <h3 className="text-2xl font-bold text-gray-900">{tier.name}</h3>
              <p className="mt-2 text-gray-600">{tier.description}</p>
              
              <div className="mt-6">
                <span className="text-4xl font-bold text-gray-900">
                  ${isYearly ? Math.floor(tier.priceYearly / 12) : tier.price}
                </span>
                <span className="text-gray-600">/month</span>
                {isYearly && tier.priceYearly > 0 && (
                  <p className="text-sm text-green-600 mt-1">
                    Billed ${tier.priceYearly} yearly
                  </p>
                )}
              </div>

              <button
                onClick={() => handleSubscribe(tier)}
                disabled={loading !== null || currentPlan === tier.id}
                className={`mt-6 w-full py-3 px-4 rounded-lg font-medium transition-colors ${
                  currentPlan === tier.id
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : tier.recommended
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-gray-900 text-white hover:bg-gray-800'
                } disabled:opacity-50`}
              >
                {loading === tier.id ? (
                  'Loading...'
                ) : currentPlan === tier.id ? (
                  'Current Plan'
                ) : tier.id === 'free' ? (
                  'Get Started'
                ) : (
                  'Subscribe'
                )}
              </button>

              <div className="mt-8 space-y-4">
                <h4 className="font-semibold text-gray-900">Includes:</h4>
                <ul className="space-y-3">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-start">
                      <Check className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700 text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
                
                {tier.limitations.length > 0 && (
                  <>
                    <h4 className="font-semibold text-gray-900 mt-6">Not included:</h4>
                    <ul className="space-y-3">
                      {tier.limitations.map((limitation) => (
                        <li key={limitation} className="flex items-start">
                          <X className="w-5 h-5 text-gray-400 mr-2 flex-shrink-0 mt-0.5" />
                          <span className="text-gray-500 text-sm">{limitation}</span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Credits Explanation */}
      <div className="mt-12 max-w-3xl mx-auto bg-blue-50 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">What are credits?</h3>
        <p className="text-gray-700 mb-3">
          1 credit = 1 thread generation. Credits are deducted when you generate a thread from your document.
        </p>
        <ul className="space-y-2 text-sm text-gray-600">
          <li className="flex items-start">
            <Check className="w-4 h-4 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
            <span>Free users start with 100 credits and earn 100 more for each referral</span>
          </li>
          <li className="flex items-start">
            <Check className="w-4 h-4 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
            <span>Paid plans receive monthly credits that can rollover (up to plan limits)</span>
          </li>
          <li className="flex items-start">
            <Check className="w-4 h-4 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
            <span>Image editing, saving threads, and viewing threads do NOT use credits</span>
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