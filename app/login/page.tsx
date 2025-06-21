"use client";
import React from 'react';
import { useRouter } from 'next/navigation';
import { signInWithGoogle } from '../lib/auth';
import toast from 'react-hot-toast';
import { useAuth } from '@/app/context/AuthContext';

export const dynamic = 'force-dynamic';

const LoginPage = () => {
  const router = useRouter();

  const handleSignIn = async () => {
    try {
      await signInWithGoogle();
      toast.success('Successfully signed in!');
      router.push('/');
    } catch (error) {
      console.error("Sign in failed", error);
      toast.error('Sign in failed. Please try again.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-legal-50">
      <div className="card max-w-sm w-full">
        <h1 className="text-2xl font-bold text-center text-legal-800 mb-6">Login to Threadifier</h1>
        <button
          onClick={handleSignIn}
          className="btn-primary w-full flex items-center justify-center gap-2"
        >
          {/* In a real app, you'd have a Google icon here */}
          Sign in with Google
        </button>
      </div>
    </div>
  );
};

export default LoginPage; 