"use client";

import { useState } from 'react';
import { Loader2, Plus, Minus, Settings } from 'lucide-react';
import toast from 'react-hot-toast';
import { getAuth } from 'firebase/auth';

interface AdminPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AdminPanel({ isOpen, onClose }: AdminPanelProps) {
  const [userId, setUserId] = useState('');
  const [action, setAction] = useState<'add' | 'subtract' | 'set'>('add');
  const [amount, setAmount] = useState(100);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!userId.trim()) {
      toast.error('Please enter a user ID');
      return;
    }

    if (amount <= 0) {
      toast.error('Amount must be greater than 0');
      return;
    }

    setLoading(true);

    try {
      const auth = getAuth();
      const token = await auth.currentUser?.getIdToken();

      if (!token) {
        toast.error('Authentication required');
        return;
      }

      const response = await fetch('/api/admin/manage-credits', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Email': auth.currentUser?.email || '',
        },
        body: JSON.stringify({
          userId,
          action,
          amount,
          reason,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update credits');
      }

      toast.success(
        `Successfully ${action === 'add' ? 'added' : action === 'subtract' ? 'removed' : 'set'} ${amount} credits. 
        User now has ${data.newCredits} credits.`
      );

      // Reset form
      setUserId('');
      setAmount(100);
      setReason('');
    } catch (error: any) {
      toast.error(error.message || 'Failed to update credits');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Admin Credit Manager</h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              User ID
            </label>
            <input
              type="text"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter user ID (from Firebase)"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Action
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => setAction('add')}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  action === 'add'
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <Plus className="w-4 h-4 inline mr-1" />
                Add
              </button>
              <button
                onClick={() => setAction('subtract')}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  action === 'subtract'
                    ? 'bg-red-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <Minus className="w-4 h-4 inline mr-1" />
                Remove
              </button>
              <button
                onClick={() => setAction('set')}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  action === 'set'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <Settings className="w-4 h-4 inline mr-1" />
                Set
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Amount
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(parseInt(e.target.value) || 0)}
              min="1"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Reason (optional)
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g., Customer support compensation, referral bonus, etc."
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                Processing...
              </>
            ) : (
              'Update Credits'
            )}
          </button>
        </div>

        <div className="mt-4 text-xs text-gray-500">
          <p>Note: Only authorized admins can use this feature.</p>
          <p className="mt-1">To find a user ID, check the Firebase console or ask them to share it from their profile.</p>
        </div>
      </div>
    </div>
  );
}