"use client";

import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function SubscriptionRecovery() {
  const { user } = useAuth();
  const [isRecovering, setIsRecovering] = useState(false);

  const handleRecoverSubscription = async () => {
    if (!user?.email) {
      toast.error('You must be logged in to recover subscription');
      return;
    }

    setIsRecovering(true);
    
    try {
      const response = await fetch('/api/recover-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': user.email,
        },
        body: JSON.stringify({
          userEmail: user.email,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success('Subscription recovered successfully! Refreshing...');
        // Refresh the page to show updated credits
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else {
        toast.error(data.error || 'Failed to recover subscription');
      }
    } catch (error) {
      console.error('Recovery error:', error);
      toast.error('An error occurred while recovering subscription');
    } finally {
      setIsRecovering(false);
    }
  };

  // Only show for admin email
  if (user?.email !== 'robert@spotlightlawyer.com') {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 bg-white rounded-lg shadow-lg p-4 border border-red-200">
      <h3 className="text-sm font-bold text-red-600 mb-2">Subscription Recovery Tool</h3>
      <p className="text-xs text-gray-600 mb-3">
        If your credits weren't applied after payment, click below to recover them.
      </p>
      <button
        onClick={handleRecoverSubscription}
        disabled={isRecovering}
        className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
      >
        {isRecovering ? 'Recovering...' : 'Recover My Subscription'}
      </button>
    </div>
  );
}