"use client";

import React, { useState } from 'react';
import { signInWithEmail, signUpWithEmail } from '../lib/auth';
import { Twitter, Loader2, Sparkles, FileText, Image as ImageIcon, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';

interface LoginScreenProps {
  onBack?: () => void;
}

export default function LoginScreen({ onBack }: LoginScreenProps = {}) {
  const [isLoading, setIsLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    displayName: '',
    confirmPassword: ''
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isSignUp) {
      // Sign up validation
      if (formData.password !== formData.confirmPassword) {
        toast.error('Passwords do not match');
        return;
      }
      if (formData.password.length < 6) {
        toast.error('Password must be at least 6 characters');
        return;
      }
      if (!formData.displayName.trim()) {
        toast.error('Display name is required');
        return;
      }
    }
    
    setIsLoading(true);
    try {
      if (isSignUp) {
        await signUpWithEmail(formData.email, formData.password, formData.displayName);
        toast.success('Account created! Please check your email for verification.');
      } else {
        await signInWithEmail(formData.email, formData.password);
        toast.success('Welcome back to Threadifier!');
      }
    } catch (error: any) {
      console.error('Auth error:', error);
      const errorMessage = error.message || 'Authentication failed';
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4">
      <div className="max-w-md w-full space-y-8">
        {/* Back Button */}
        {onBack && (
          <button
            onClick={onBack}
            className="text-gray-600 hover:text-gray-900 flex items-center space-x-2 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span>Back to Homepage</span>
          </button>
        )}
        
        {/* Logo and Header */}
        <div className="text-center">
          <div className="mx-auto h-20 w-20 rounded-full bg-blue-600 flex items-center justify-center mb-4">
            <Twitter className="h-10 w-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Threadifier</h1>
          <p className="mt-2 text-lg text-gray-600">
            Transform PDFs into engaging social media threads
          </p>
        </div>

        {/* Features Preview */}
        <div className="bg-white rounded-xl shadow-lg p-6 space-y-4">
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0">
              <FileText className="h-5 w-5 text-blue-600" />
            </div>
            <div className="text-sm text-gray-700">
              Upload PDFs and generate AI-powered thread content
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0">
              <Sparkles className="h-5 w-5 text-purple-600" />
            </div>
            <div className="text-sm text-gray-700">
              Get smart image suggestions for each post
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0">
              <ImageIcon className="h-5 w-5 text-green-600" />
            </div>
            <div className="text-sm text-gray-700">
              Edit, crop, and annotate document pages
            </div>
          </div>
        </div>

        {/* Auth Form */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="mb-6">
            <div className="flex border-b border-gray-200">
              <button
                type="button"
                onClick={() => setIsSignUp(false)}
                className={`flex-1 py-2 px-4 text-sm font-medium border-b-2 transition-colors ${
                  !isSignUp 
                    ? 'border-blue-500 text-blue-600' 
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => setIsSignUp(true)}
                className={`flex-1 py-2 px-4 text-sm font-medium border-b-2 transition-colors ${
                  isSignUp 
                    ? 'border-blue-500 text-blue-600' 
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Sign Up
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <div>
                <label htmlFor="displayName" className="block text-sm font-medium text-gray-700 mb-1">
                  Display Name
                </label>
                <input
                  id="displayName"
                  name="displayName"
                  type="text"
                  required={isSignUp}
                  value={formData.displayName}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Your name"
                />
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email Address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                value={formData.email}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="your@email.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={formData.password}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {isSignUp && (
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                  Confirm Password
                </label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  required={isSignUp}
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Confirm password"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center items-center px-4 py-3 border border-transparent rounded-lg shadow-sm text-base font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? (
                <Loader2 className="animate-spin h-5 w-5" />
              ) : (
                isSignUp ? 'Create Account' : 'Sign In'
              )}
            </button>
          </form>
          
          <p className="mt-4 text-xs text-center text-gray-500">
            By {isSignUp ? 'creating an account' : 'signing in'}, you agree to our Terms of Service and Privacy Policy
          </p>
        </div>

        {/* Footer */}
        <div className="text-center">
          <p className="text-sm text-gray-500">
            Secure authentication powered by Firebase
          </p>
        </div>
      </div>
    </div>
  );
}