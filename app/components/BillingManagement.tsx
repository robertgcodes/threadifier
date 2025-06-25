"use client";

import { useState, useEffect } from 'react';
import { CreditCard, Calendar, Download, AlertCircle, Check, Loader2, RefreshCw, X, Infinity } from 'lucide-react';
import { Dialog } from '@headlessui/react';
import toast from 'react-hot-toast';
import { UserProfile } from '../lib/database';

interface BillingManagementProps {
  userProfile: UserProfile | null;
  onUpdateProfile: () => void;
}

interface SubscriptionDetails {
  subscription: {
    id: string;
    status: string;
    current_period_end: number;
    cancel_at_period_end: boolean;
    items: {
      data: Array<{
        price: {
          product: string;
          unit_amount: number;
          currency: string;
          recurring: {
            interval: string;
          };
        };
      }>;
    };
  };
  customer: {
    email: string;
    invoice_settings: {
      default_payment_method: {
        card: {
          brand: string;
          last4: string;
          exp_month: number;
          exp_year: number;
        };
      };
    };
  };
  invoices: Array<{
    id: string;
    number: string;
    created: number;
    amount_paid: number;
    currency: string;
    status: string;
    invoice_pdf: string;
    hosted_invoice_url: string;
  }>;
  upcomingInvoice: {
    amount_due: number;
    currency: string;
    created: number;
  } | null;
}

export default function BillingManagement({ userProfile, onUpdateProfile }: BillingManagementProps) {
  const [loading, setLoading] = useState(true);
  const [billingDetails, setBillingDetails] = useState<SubscriptionDetails | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showUpdatePaymentModal, setShowUpdatePaymentModal] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchBillingDetails();
  }, [userProfile]);

  const fetchBillingDetails = async () => {
    if (!userProfile?.subscription?.stripeCustomerId) {
      setLoading(false);
      return;
    }

    try {
      setRefreshing(true);
      const response = await fetch('/api/billing-details', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: userProfile.subscription.stripeCustomerId,
          subscriptionId: userProfile.subscription.stripeSubscriptionId
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setBillingDetails(data);
      } else {
        toast.error('Failed to load billing details');
      }
    } catch (error) {
      console.error('Error fetching billing details:', error);
      toast.error('Failed to load billing details');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!userProfile?.subscription?.stripeSubscriptionId) return;

    setCancelling(true);
    try {
      const response = await fetch('/api/cancel-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscriptionId: userProfile.subscription.stripeSubscriptionId
        }),
      });

      if (response.ok) {
        toast.success('Subscription cancelled successfully');
        setShowCancelModal(false);
        onUpdateProfile();
        fetchBillingDetails();
      } else {
        toast.error('Failed to cancel subscription');
      }
    } catch (error) {
      console.error('Error cancelling subscription:', error);
      toast.error('Failed to cancel subscription');
    } finally {
      setCancelling(false);
    }
  };

  const handleReactivateSubscription = async () => {
    if (!userProfile?.subscription?.stripeSubscriptionId) return;

    try {
      const response = await fetch('/api/reactivate-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscriptionId: userProfile.subscription.stripeSubscriptionId
        }),
      });

      if (response.ok) {
        toast.success('Subscription reactivated successfully');
        onUpdateProfile();
        fetchBillingDetails();
      } else {
        toast.error('Failed to reactivate subscription');
      }
    } catch (error) {
      console.error('Error reactivating subscription:', error);
      toast.error('Failed to reactivate subscription');
    }
  };

  const handleUpdatePaymentMethod = async () => {
    if (!userProfile?.subscription?.stripeCustomerId) return;

    try {
      const response = await fetch('/api/create-portal-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: userProfile.subscription.stripeCustomerId,
          returnUrl: `${window.location.origin}/?view=billing`
        }),
      });

      const data = await response.json();
      
      if (response.ok) {
        window.location.href = data.url;
      } else {
        if (data.setupRequired) {
          toast.error('Billing portal needs to be configured in Stripe dashboard');
          // Optionally open the setup link
          window.open('https://dashboard.stripe.com/test/settings/billing/portal', '_blank');
        } else {
          toast.error(data.error || 'Failed to open billing portal');
        }
      }
    } catch (error) {
      console.error('Error creating portal session:', error);
      toast.error('Failed to open billing portal');
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase()
    }).format(amount / 100);
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      active: { bg: 'bg-green-100 dark:bg-green-900', text: 'text-green-800 dark:text-green-200', label: 'Active' },
      cancelled: { bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-800 dark:text-gray-200', label: 'Cancelled' },
      past_due: { bg: 'bg-red-100 dark:bg-red-900', text: 'text-red-800 dark:text-red-200', label: 'Past Due' },
      trialing: { bg: 'bg-blue-100 dark:bg-blue-900', text: 'text-blue-800 dark:text-blue-200', label: 'Trial' },
      paused: { bg: 'bg-yellow-100 dark:bg-yellow-900', text: 'text-yellow-800 dark:text-yellow-200', label: 'Paused' }
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.active;
    
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text} dark:bg-opacity-20`}>
        {config.label}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-8">
        <div className="flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 dark:text-blue-400" />
        </div>
      </div>
    );
  }

  if (!userProfile?.subscription || userProfile.subscription.plan === 'free') {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-8">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">No Active Subscription</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            You have unlimited access to the basic tier.
          </p>
          {userProfile?.credits?.premiumCredits && userProfile.credits.premiumCredits > 0 ? (
            <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-4 mb-4">
              <p className="text-blue-900 dark:text-blue-100 font-medium">✨ You have {String(userProfile.credits.premiumCredits)} premium trial credits remaining!</p>
              <p className="text-blue-700 dark:text-blue-300 text-sm mt-1">These give you access to Claude Sonnet AI with no referral message.</p>
            </div>
          ) : (
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/30 dark:to-purple-900/30 rounded-lg p-4 mb-4">
              <div className="flex items-center gap-2 mb-2">
                <Infinity className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <p className="text-blue-900 dark:text-blue-100 font-medium">Unlimited Basic Tier Active</p>
              </div>
              <p className="text-blue-700 dark:text-blue-300 text-sm">Generate unlimited threads with Claude Haiku AI. Upgrade for Claude Sonnet!</p>
            </div>
          )}
          <button
            onClick={() => window.location.href = '/?view=billing'}
            className="btn-primary"
          >
            View Available Plans
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Usage Statistics */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-6">Current Usage</h2>
        <div className="grid md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="text-3xl font-bold text-purple-600">
              {String(userProfile.credits?.premiumCredits || 0)}
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Premium Credits</p>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-blue-600 flex items-center justify-center gap-2">
              {(userProfile.credits?.premiumCredits || 0) === 0 ? (
                <>
                  <Infinity className="w-8 h-8" />
                </>
              ) : (
                <span>Basic</span>
              )}
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Basic Tier Access</p>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-green-600">
              {String(userProfile.usage?.monthlyThreads || 0)}
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Threads This Month</p>
          </div>
        </div>
        
        {/* Progress Bar */}
        <div className="mt-6">
          <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-2">
            <span>Monthly Credit Usage</span>
            <span>{String(userProfile.credits?.used || 0)} / {
              userProfile.subscription?.plan === 'professional' ? '500' :
              userProfile.subscription?.plan === 'team' ? '2000' :
              '10'
            }</span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div 
              className="bg-blue-600 dark:bg-blue-500 h-2 rounded-full transition-all duration-300"
              style={{ 
                width: `${Math.min(
                  ((userProfile.credits?.used || 0) / (
                    userProfile.subscription?.plan === 'professional' ? 500 :
                    userProfile.subscription?.plan === 'team' ? 2000 :
                    10
                  )) * 100,
                  100
                )}%` 
              }}
            />
          </div>
        </div>
      </div>

      {/* Current Subscription */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-1">Current Subscription</h2>
            <p className="text-gray-600 dark:text-gray-400">Manage your subscription and billing details</p>
          </div>
          <button
            onClick={fetchBillingDetails}
            className={`p-2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors ${refreshing ? 'animate-spin' : ''}`}
            disabled={refreshing}
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Plan Details */}
          <div>
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Plan Details</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-gray-600 dark:text-gray-400">Plan</span>
                <span className="font-medium text-gray-900 dark:text-gray-100 capitalize">
                  {userProfile.subscription.plan}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600 dark:text-gray-400">Status</span>
                {getStatusBadge(userProfile.subscription.status)}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600 dark:text-gray-400">Premium Credits</span>
                <span className="font-medium text-purple-600">
                  {String(userProfile.credits?.premiumCredits || 0)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600 dark:text-gray-400">Basic Tier</span>
                <span className="font-medium text-blue-600">
                  {(userProfile.credits?.premiumCredits || 0) === 0 ? 'Unlimited' : 'Available'}
                </span>
              </div>
              {billingDetails?.subscription && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Amount</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {formatCurrency(
                      billingDetails.subscription.items.data[0]?.price.unit_amount || 0,
                      billingDetails.subscription.items.data[0]?.price.currency || 'usd'
                    )}/month
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Billing Info */}
          <div>
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Billing Information</h3>
            <div className="space-y-3">
              {billingDetails?.upcomingInvoice && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Next billing date</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {formatDate(billingDetails.subscription.current_period_end)}
                  </span>
                </div>
              )}
              {billingDetails?.customer?.invoice_settings?.default_payment_method && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Payment method</span>
                    <div className="flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                      <span className="font-medium text-gray-900 dark:text-gray-100">
                        {billingDetails.customer.invoice_settings.default_payment_method.card.brand} •••• {billingDetails.customer.invoice_settings.default_payment_method.card.last4}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Expires</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      {billingDetails.customer.invoice_settings.default_payment_method.card.exp_month}/
                      {billingDetails.customer.invoice_settings.default_payment_method.card.exp_year}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700 flex flex-wrap gap-3">
          <button
            onClick={handleUpdatePaymentMethod}
            className="btn-secondary"
          >
            Update Payment Method
          </button>
          {userProfile.subscription.status === 'active' && !userProfile.subscription.cancelAtPeriodEnd && (
            <button
              onClick={() => setShowCancelModal(true)}
              className="text-red-600 hover:text-red-700 font-medium"
            >
              Cancel Subscription
            </button>
          )}
          {userProfile.subscription.cancelAtPeriodEnd && (
            <>
              <button
                onClick={handleReactivateSubscription}
                className="btn-primary"
              >
                Reactivate Subscription
              </button>
              <div className="flex items-center gap-2 text-amber-600">
                <AlertCircle className="w-4 h-4" />
                <span className="text-sm">Subscription will end on {(() => {
                  if (!userProfile.subscription.currentPeriodEnd) {
                    return 'end of billing period';
                  }
                  
                  try {
                    const currentPeriodEnd = userProfile.subscription.currentPeriodEnd as any;
                    let timestamp: number;
                    
                    if (currentPeriodEnd.seconds) {
                      timestamp = currentPeriodEnd.seconds;
                    } else if (currentPeriodEnd instanceof Date) {
                      timestamp = Math.floor(currentPeriodEnd.getTime() / 1000);
                    } else if (typeof currentPeriodEnd === 'number') {
                      timestamp = currentPeriodEnd;
                    } else {
                      return 'end of billing period';
                    }
                    
                    return formatDate(timestamp);
                  } catch (error) {
                    return 'end of billing period';
                  }
                })()}</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Billing History */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-6">Billing History</h2>
        
        {billingDetails?.invoices && billingDetails.invoices.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead>
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Invoice
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {billingDetails.invoices.map((invoice) => (
                  <tr key={invoice.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                      {formatDate(invoice.created)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                      {invoice.number || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                      {formatCurrency(invoice.amount_paid, invoice.currency)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200">
                        <Check className="w-3 h-3 mr-1" />
                        Paid
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <a
                        href={invoice.invoice_pdf}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300 inline-flex items-center gap-1"
                      >
                        <Download className="w-4 h-4" />
                        Download
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8">
            <Calendar className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400">No billing history available yet</p>
          </div>
        )}
      </div>

      {/* Cancel Subscription Modal */}
      <Dialog open={showCancelModal} onClose={() => setShowCancelModal(false)} className="relative z-50">
        <Dialog.Backdrop className="fixed inset-0 bg-black/30 dark:bg-black/50" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-md w-full">
            <Dialog.Title className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Cancel Subscription
            </Dialog.Title>
            
            <div className="space-y-4">
              <p className="text-gray-600 dark:text-gray-400">
                Are you sure you want to cancel your subscription? You'll lose access to:
              </p>
              
              <ul className="list-disc list-inside space-y-2 text-gray-600 dark:text-gray-400">
                <li>Monthly credit allowance</li>
                <li>One-click posting to X/Twitter</li>
                <li>Priority support</li>
                <li>Advanced analytics and features</li>
              </ul>

              <div className="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-lg p-4">
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  Your subscription will remain active until {billingDetails?.subscription.current_period_end ? formatDate(billingDetails.subscription.current_period_end) : 'the end of your billing period'}.
                  You can reactivate anytime before then.
                </p>
              </div>
            </div>

            <div className="mt-6 flex gap-3 justify-end">
              <button
                onClick={() => setShowCancelModal(false)}
                className="btn-secondary"
              >
                Keep Subscription
              </button>
              <button
                onClick={handleCancelSubscription}
                disabled={cancelling}
                className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {cancelling ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Cancelling...
                  </>
                ) : (
                  'Cancel Subscription'
                )}
              </button>
            </div>
          </Dialog.Panel>
        </div>
      </Dialog>

      {/* Support Section */}
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Need Help?</h3>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">Common Questions</h4>
            <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
              <li>• Credits refresh monthly on your billing date</li>
              <li>• Unused credits don't roll over to the next month</li>
              <li>• You can change plans anytime - changes take effect immediately</li>
              <li>• Cancel anytime - you'll keep access until the end of your billing period</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">Contact Support</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              Have a billing question? We're here to help!
            </p>
            <div className="space-y-2">
              <a 
                href="mailto:support@threadifier.com?subject=Billing%20Question"
                className="inline-flex items-center text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 text-sm"
              >
                <AlertCircle className="w-4 h-4 mr-1" />
                Email: support@threadifier.com
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}