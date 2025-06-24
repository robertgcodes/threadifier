"use client";

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle, Sparkles, Zap, Shield, HeadphonesIcon, X } from 'lucide-react';
import confetti from 'canvas-confetti';
import { useAuth } from '../context/AuthContext';
import { getUserProfile, UserProfile } from '../lib/database';
import Link from 'next/link';

export default function BillingSuccessPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const isSuccess = searchParams.get('success') === 'true';
  const isCanceled = searchParams.get('canceled') === 'true';

  useEffect(() => {
    // Load user profile to get subscription details
    if (user?.uid) {
      getUserProfile(user.uid).then(profile => {
        setUserProfile(profile);
        setLoading(false);
      });
    }
  }, [user]);

  useEffect(() => {
    // Fire confetti on success!
    if (isSuccess && !loading) {
      const duration = 3 * 1000;
      const animationEnd = Date.now() + duration;
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

      function randomInRange(min: number, max: number) {
        return Math.random() * (max - min) + min;
      }

      const interval: any = setInterval(function() {
        const timeLeft = animationEnd - Date.now();

        if (timeLeft <= 0) {
          return clearInterval(interval);
        }

        const particleCount = 50 * (timeLeft / duration);
        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
        });
        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
        });
      }, 250);
    }
  }, [isSuccess, loading]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (isCanceled) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <X className="w-8 h-8 text-gray-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Payment Canceled</h1>
          <p className="text-gray-600 mb-6">
            No worries! You can upgrade anytime when you're ready.
          </p>
          <div className="space-y-3">
            <Link href="/" className="btn-primary w-full block text-center">
              Back to Threadifier
            </Link>
            <Link href="/?view=billing" className="btn-secondary w-full block text-center">
              View Plans Again
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const plan = userProfile?.subscription?.plan || 'free';
  const isProfessional = plan === 'professional';
  const isTeam = plan === 'team';

  const features = isProfessional ? [
    { icon: Sparkles, title: "500 Monthly Credits", description: "Generate up to 500 threads every month" },
    { icon: Zap, title: "No Referral Message", description: "Your threads are clean and professional" },
    { icon: Shield, title: "Priority Support", description: "Get help faster with priority email support" },
    { icon: HeadphonesIcon, title: "Custom AI Instructions", description: "Personalize AI to match your style" },
  ] : [
    { icon: Sparkles, title: "2000 Monthly Credits", description: "Generate up to 2000 threads every month" },
    { icon: Zap, title: "Team Collaboration", description: "Work with up to 3 team members" },
    { icon: Shield, title: "Phone Support", description: "Direct phone line for immediate help" },
    { icon: HeadphonesIcon, title: "Analytics Dashboard", description: "Track your team's performance" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="max-w-4xl mx-auto px-4 py-16">
        {/* Success Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-4">
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Welcome to Threadifier {isProfessional ? 'Professional' : 'Team'}! 🎉
          </h1>
          <p className="text-xl text-gray-600">
            Your account has been upgraded successfully
          </p>
        </div>

        {/* Features Grid */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
            Here's what you've unlocked:
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            {features.map((feature, index) => (
              <div key={index} className="flex items-start space-x-4">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <feature.icon className="w-6 h-6 text-blue-600" />
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{feature.title}</h3>
                  <p className="text-gray-600 text-sm">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Start Guide */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl shadow-xl p-8 text-white mb-8">
          <h2 className="text-2xl font-bold mb-4">Quick Start Guide</h2>
          <ol className="space-y-3">
            <li className="flex items-start">
              <span className="bg-white/20 rounded-full w-7 h-7 flex items-center justify-center text-sm font-bold mr-3 flex-shrink-0">1</span>
              <span>Upload any legal document or PDF to start creating threads</span>
            </li>
            <li className="flex items-start">
              <span className="bg-white/20 rounded-full w-7 h-7 flex items-center justify-center text-sm font-bold mr-3 flex-shrink-0">2</span>
              <span>Customize your AI instructions in Profile Settings for personalized results</span>
            </li>
            <li className="flex items-start">
              <span className="bg-white/20 rounded-full w-7 h-7 flex items-center justify-center text-sm font-bold mr-3 flex-shrink-0">3</span>
              <span>Use AI suggestions to automatically match images with your posts</span>
            </li>
            <li className="flex items-start">
              <span className="bg-white/20 rounded-full w-7 h-7 flex items-center justify-center text-sm font-bold mr-3 flex-shrink-0">4</span>
              <span>Post directly to X with one click - no copy/paste needed!</span>
            </li>
          </ol>
        </div>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link 
            href="/"
            className="btn-primary text-center flex items-center justify-center gap-2"
          >
            <Sparkles className="w-5 h-5" />
            Start Creating Threads
          </Link>
          <Link 
            href="/?view=profile"
            className="btn-secondary text-center"
          >
            Customize Your Profile
          </Link>
        </div>

        {/* Support Footer */}
        <div className="text-center mt-12 text-gray-600">
          <p className="mb-2">Need help getting started?</p>
          <p>
            Email us at{' '}
            <a href="mailto:support@threadifier.com" className="text-blue-600 hover:underline">
              support@threadifier.com
            </a>
            {isTeam && ' or call us at 1-800-THREADS'}
          </p>
        </div>
      </div>
    </div>
  );
}