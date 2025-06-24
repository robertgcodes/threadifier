"use client";

import { AlertCircle, Sparkles, Infinity } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

interface FreeTierNoticeProps {
  referralCode?: string;
  hasTrialCredits: boolean;
}

export default function FreeTierNotice({ referralCode, hasTrialCredits }: FreeTierNoticeProps) {
  if (hasTrialCredits) {
    return null; // Don't show notice if user still has trial credits
  }

  const referralLink = referralCode ? `https://threadifier.com?ref=${referralCode}` : null;

  return (
    <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-4 mb-6">
      <div className="flex items-start gap-3">
        <Infinity className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <h3 className="font-semibold text-blue-900 mb-1">Unlimited Basic Tier</h3>
          <p className="text-blue-800 text-sm mb-3">
            You have unlimited thread generation! Basic tier includes:
          </p>
          <ul className="text-blue-700 text-sm space-y-1 mb-3">
            <li>✅ Unlimited thread generation</li>
            <li>✅ Full X posting capability</li>
            <li>🤖 Claude Haiku AI (basic model)</li>
            <li>🔗 Auto-appended referral message</li>
          </ul>
          
          <div className="flex flex-col sm:flex-row gap-3 mt-4">
            <Link
              href="/?view=billing"
              className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              <Sparkles className="w-4 h-4 mr-1.5" />
              Upgrade for Claude Sonnet AI
            </Link>
            
            {referralLink && (
              <button
                onClick={() => {
                  navigator.clipboard.writeText(referralLink);
                  toast.success('Referral link copied! Share it to earn 100 credits per signup.');
                }}
                className="inline-flex items-center justify-center px-4 py-2 bg-white border border-blue-300 text-blue-700 rounded-lg hover:bg-blue-50 transition-colors text-sm font-medium"
              >
                Copy Referral Link (Earn 100 Premium Credits)
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}