"use client";

import { useState } from 'react';
import { ChevronDown, ChevronUp, Twitter, Instagram, FileText, Sparkles, Users, TrendingUp, Shield, Zap, BookOpen, Briefcase, Stethoscope, FlaskConical, DollarSign, Code, CheckCircle, ArrowRight, Menu, X } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

interface HomepageProps {
  onLogin: () => void;
  onSignup: () => void;
}

export default function Homepage({ onLogin, onSignup }: HomepageProps) {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const faqs = [
    {
      question: "What is Threadifier and how does it work?",
      answer: "Threadifier is an AI-powered platform that transforms long-form content into engaging social media threads. Simply paste your content, customize it with our AI, and publish directly to X (Twitter) or Instagram. Our AI analyzes your content and creates compelling, platform-optimized threads that maximize engagement."
    },
    {
      question: "What's the difference between Basic (free) and Professional plans?",
      answer: "Basic plan uses Claude Haiku AI and includes a referral message in threads, while Professional ($29/mo) uses Claude Sonnet for superior creativity, removes all branding, and includes 500 premium credits per month. Both plans offer unlimited thread generation, but Professional delivers higher quality results."
    },
    {
      question: "How do the 100 free premium credits work?",
      answer: "Every new user receives 100 premium credits to try our advanced Claude Sonnet AI model. Each thread generation uses 1 credit. You can earn 100 more credits for each friend you refer. Credits expire after 90 days to encourage active usage. Once credits are exhausted, you can continue with the Basic plan or upgrade to Professional for monthly premium credits."
    },
    {
      question: "Do premium credits expire?",
      answer: "Yes, all premium credits expire after 90 days from when they were earned. This includes trial credits, referral credits, and credits from paid subscriptions. We encourage active usage and don't allow credit banking to prevent refund requests for unused credits."
    },
    {
      question: "Can I get a refund for unused credits?",
      answer: "No, we do not offer refunds for unused credits. Premium credits expire after 90 days and cannot be refunded. This policy encourages active usage and prevents users from banking credits and then requesting refunds. We recommend using your credits regularly to get the most value from your subscription."
    },
    {
      question: "Can I use Threadifier for both X (Twitter) and Instagram?",
      answer: "Yes! Threadifier supports both platforms. For X, we create numbered threads with optimal character counts. For Instagram, we generate carousel-ready content with customizable backgrounds and fonts. You can preview and edit before posting to either platform."
    },
    {
      question: "What types of content can I convert into threads?",
      answer: "Threadifier works with any text content: blog posts, research papers, legal documents, medical studies, financial reports, news articles, educational content, and more. Our AI understands context and adapts the threading style to match your industry and audience."
    },
    {
      question: "How does direct posting work?",
      answer: "For X (Twitter), you can post threads directly from Threadifier with one click. For Instagram, we generate carousel-ready images that you can download and upload to Instagram. Both methods save you time and ensure consistent formatting."
    },
    {
      question: "Is my content secure and private?",
      answer: "Absolutely. We use enterprise-grade encryption for all data transmission and storage. Your content is never shared or used for training AI models. You maintain full ownership of all content created on Threadifier."
    },
    {
      question: "Can I customize the AI's writing style?",
      answer: "Yes! You can create custom prompts to match your brand voice, industry terminology, and audience preferences. Save multiple prompts for different use cases - professional, casual, educational, or industry-specific tones."
    }
  ];

  const industries = [
    {
      icon: <Briefcase className="w-8 h-8" />,
      title: "Legal Professionals",
      description: "Transform complex legal documents, case summaries, and regulatory updates into digestible threads that educate clients and establish thought leadership.",
      useCase: "Turn a 20-page legal brief into a compelling thread that explains key points to clients"
    },
    {
      icon: <Stethoscope className="w-8 h-8" />,
      title: "Healthcare & Medical",
      description: "Break down medical research, health guidelines, and patient education materials into accessible social media content that saves lives.",
      useCase: "Convert medical studies into threads that patients can understand and share"
    },
    {
      icon: <FlaskConical className="w-8 h-8" />,
      title: "Scientists & Researchers",
      description: "Share groundbreaking research, explain complex theories, and engage with the scientific community through compelling thread narratives.",
      useCase: "Transform research papers into viral threads that spark scientific discussion"
    },
    {
      icon: <DollarSign className="w-8 h-8" />,
      title: "Financial Analysts",
      description: "Convert market analysis, earnings reports, and investment insights into threads that inform and engage your financial audience.",
      useCase: "Turn quarterly reports into insightful threads that drive investment decisions"
    },
    {
      icon: <Code className="w-8 h-8" />,
      title: "Tech & Developers",
      description: "Explain technical concepts, share coding tutorials, and document project updates in threads that the tech community loves.",
      useCase: "Convert technical documentation into educational threads for developers"
    },
    {
      icon: <BookOpen className="w-8 h-8" />,
      title: "Educators & Coaches",
      description: "Transform lessons, course content, and educational resources into engaging threads that maximize learning and retention.",
      useCase: "Break down complex topics into tweet-sized lessons that students actually read"
    }
  ];

  const features = [
    {
      title: "AI-Powered Thread Creation",
      description: "Advanced AI models (Claude Haiku & Sonnet) analyze your content and create perfectly structured threads",
      icon: <Sparkles className="w-6 h-6" />
    },
    {
      title: "Direct Publishing",
      description: "Post directly to X (Twitter) or generate Instagram carousels with one click",
      icon: <Zap className="w-6 h-6" />
    },
    {
      title: "Custom AI Instructions",
      description: "Train the AI with your brand voice and industry-specific terminology",
      icon: <FileText className="w-6 h-6" />
    },
    {
      title: "Image Editing & Annotations",
      description: "Add images, annotations, and visual elements to make threads more engaging",
      icon: <Instagram className="w-6 h-6" />
    },
    {
      title: "Thread Templates",
      description: "Save and reuse successful thread formats for consistent content creation",
      icon: <TrendingUp className="w-6 h-6" />
    },
    {
      title: "Analytics & Insights",
      description: "Track thread performance and optimize your content strategy",
      icon: <Users className="w-6 h-6" />
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Threadifier
              </h1>
            </div>
            
            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center space-x-8">
              <a href="#features" className="text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Features</a>
              <a href="#industries" className="text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Use Cases</a>
              <a href="#pricing" className="text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Pricing</a>
              <a href="#faq" className="text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">FAQ</a>
            </nav>

            <div className="hidden md:flex items-center space-x-4">
              <button
                onClick={onLogin}
                className="text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors font-medium"
              >
                Log In
              </button>
              <button
                onClick={onSignup}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                Get Started Free
              </button>
            </div>

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden text-gray-700 dark:text-gray-300"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
            <nav className="px-4 py-4 space-y-4">
              <a href="#features" className="block text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Features</a>
              <a href="#industries" className="block text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Use Cases</a>
              <a href="#pricing" className="block text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Pricing</a>
              <a href="#faq" className="block text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">FAQ</a>
              <div className="pt-4 space-y-3">
                <button
                  onClick={onLogin}
                  className="w-full text-center text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors font-medium py-2"
                >
                  Log In
                </button>
                <button
                  onClick={onSignup}
                  className="w-full bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  Get Started Free
                </button>
              </div>
            </nav>
          </div>
        )}
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-20 pb-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-5xl sm:text-6xl font-bold text-gray-900 dark:text-white mb-6">
              Transform Long Content Into
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">
                Viral Social Media Threads
              </span>
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 mb-8 max-w-3xl mx-auto">
              Powered by advanced AI, Threadifier converts your articles, documents, and reports into engaging threads for X (Twitter) and Instagram carousels in seconds.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
              <button
                onClick={onSignup}
                className="bg-blue-600 text-white px-8 py-4 rounded-lg hover:bg-blue-700 transition-colors font-medium text-lg flex items-center justify-center"
              >
                Start Free with 100 Premium Credits
                <ArrowRight className="ml-2 w-5 h-5" />
              </button>
              <button
                onClick={() => document.getElementById('demo')?.scrollIntoView({ behavior: 'smooth' })}
                className="bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-8 py-4 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors font-medium text-lg"
              >
                See How It Works
              </button>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No credit card required • 100 free premium credits • Unlimited basic threads
            </p>
          </div>

          {/* Platform Icons */}
          <div className="mt-16 flex justify-center items-center space-x-8">
            <div className="text-center">
              <div className="bg-black text-white p-4 rounded-2xl mb-2">
                <Twitter className="w-12 h-12" />
              </div>
              <p className="text-gray-600 dark:text-gray-400">X (Twitter)</p>
            </div>
            <div className="text-2xl text-gray-400">+</div>
            <div className="text-center">
              <div className="bg-gradient-to-br from-purple-600 to-pink-600 text-white p-4 rounded-2xl mb-2">
                <Instagram className="w-12 h-12" />
              </div>
              <p className="text-gray-600 dark:text-gray-400">Instagram</p>
            </div>
          </div>
        </div>
      </section>

      {/* Getting Started Section */}
      <section className="py-20 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h3 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Get Started in Minutes
            </h3>
            <p className="text-xl text-gray-600 dark:text-gray-300">
              Use our custom prompts and templates to create engaging threads instantly
            </p>
          </div>

          {/* Custom Prompts Showcase */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-16">
            <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-lg">
              <h4 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 flex items-center">
                <Sparkles className="w-6 h-6 text-blue-600 dark:text-blue-400 mr-2" />
                Custom AI Prompts
              </h4>
              <p className="text-gray-600 dark:text-gray-300 mb-6">
                Our pre-built prompts adapt to any industry. Just edit the details and you've got a menu of ideas!
              </p>
              
              <div className="space-y-4">
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                  <h5 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">📚 Explainer Thread</h5>
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    Break down complex topics into digestible, educational chunks with numbered steps and real-world examples.
                  </p>
                </div>
                
                <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                  <h5 className="font-semibold text-green-900 dark:text-green-100 mb-2">🎯 Problem-Solution</h5>
                  <p className="text-sm text-green-800 dark:text-green-200">
                    Present relatable problems and guide readers through practical solutions with actionable steps.
                  </p>
                </div>
                
                <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
                  <h5 className="font-semibold text-purple-900 dark:text-purple-100 mb-2">🏴‍☠️ Pirate Mode</h5>
                  <p className="text-sm text-purple-800 dark:text-purple-200">
                    Ar matey! Transform any content into swashbuckling pirate speak that's both entertaining and memorable.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-lg">
              <h4 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 flex items-center">
                <TrendingUp className="w-6 h-6 text-green-600 dark:text-green-400 mr-2" />
                Thread Templates
              </h4>
              <p className="text-gray-600 dark:text-gray-300 mb-6">
                Proven thread structures that work across all industries and platforms.
              </p>
              
              <div className="space-y-4">
                <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-lg">
                  <h5 className="font-semibold text-orange-900 dark:text-orange-100 mb-2">🔥 Hot Take Thread</h5>
                  <p className="text-sm text-orange-800 dark:text-orange-200">
                    Start with a controversial statement, build evidence, and end with a call to action.
                  </p>
                </div>
                
                <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">
                  <h5 className="font-semibold text-red-900 dark:text-red-100 mb-2">💡 How-To Guide</h5>
                  <p className="text-sm text-red-800 dark:text-red-200">
                    Step-by-step instructions with tips, warnings, and success stories.
                  </p>
                </div>
                
                <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-lg">
                  <h5 className="font-semibold text-indigo-900 dark:text-indigo-100 mb-2">📊 Data Story</h5>
                  <p className="text-sm text-indigo-800 dark:text-indigo-200">
                    Present statistics, explain the story behind the numbers, and reveal surprising insights.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Start Steps */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8">
            <h4 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 text-center">
              Quick Start Guide
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="text-center">
                <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">{'1'}</span>
                </div>
                <h5 className="font-semibold text-gray-900 dark:text-white mb-2">Upload Content</h5>
                <p className="text-gray-600 dark:text-gray-300 text-sm">
                  Drop your PDF, paste text, or upload any document you want to transform
                </p>
              </div>
              
              <div className="text-center">
                <div className="w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl font-bold text-green-600 dark:text-green-400">{'2'}</span>
                </div>
                <h5 className="font-semibold text-gray-900 dark:text-white mb-2">Choose Your Style</h5>
                <p className="text-gray-600 dark:text-gray-300 text-sm">
                  Select a custom prompt or template, adjust settings, and let AI work its magic
                </p>
              </div>
              
              <div className="text-center">
                <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl font-bold text-purple-600 dark:text-purple-400">{'3'}</span>
                </div>
                <h5 className="font-semibold text-gray-900 dark:text-white mb-2">Publish & Engage</h5>
                <p className="text-gray-600 dark:text-gray-300 text-sm">
                  Post directly to X (Twitter) or download for Instagram carousels
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-white dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h3 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Everything You Need to Create Viral Threads
            </h3>
            <p className="text-xl text-gray-600 dark:text-gray-300">
              Professional features that make thread creation effortless
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <div key={index} className="bg-gray-50 dark:bg-gray-800 p-6 rounded-xl hover:shadow-lg transition-shadow">
                <div className="text-blue-600 dark:text-blue-400 mb-4">{feature.icon}</div>
                <h4 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">{feature.title}</h4>
                <p className="text-gray-600 dark:text-gray-300">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Industries Section */}
      <section id="industries" className="py-20 bg-gray-50 dark:bg-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h3 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Built for Every Industry
            </h3>
            <p className="text-xl text-gray-600 dark:text-gray-300">
              See how professionals across industries use Threadifier to amplify their message
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {industries.map((industry, index) => (
              <div key={index} className="bg-white dark:bg-gray-900 p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow">
                <div className="text-blue-600 dark:text-blue-400 mb-4">{industry.icon}</div>
                <h4 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">{industry.title}</h4>
                <p className="text-gray-600 dark:text-gray-300 mb-4">{industry.description}</p>
                <div className="border-t pt-4">
                  <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                    <span className="font-medium">Example:</span> {industry.useCase}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 bg-white dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h3 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Simple, Transparent Pricing
            </h3>
            <p className="text-xl text-gray-600 dark:text-gray-300">
              Start free with 100 premium credits, upgrade anytime
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {/* Basic Plan */}
            <div className="bg-gray-50 dark:bg-gray-800 p-8 rounded-2xl">
              <h4 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Basic</h4>
              <p className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
                ${'0'}<span className="text-lg font-normal text-gray-600 dark:text-gray-400">/month</span>
              </p>
              <p className="text-gray-600 dark:text-gray-300 mb-6">Perfect for getting started</p>
              
              <ul className="space-y-3 mb-8">
                <li className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-green-500 mr-3 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-700 dark:text-gray-300">100 free premium credits on signup</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-green-500 mr-3 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-700 dark:text-gray-300">Unlimited basic AI threads (Claude Haiku)</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-green-500 mr-3 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-700 dark:text-gray-300">Direct posting to X (Twitter)</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-green-500 mr-3 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-700 dark:text-gray-300">Instagram carousel generation</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-green-500 mr-3 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-700 dark:text-gray-300">100 credits per referral</span>
                </li>
                <li className="flex items-start text-gray-500">
                  <X className="w-5 h-5 mr-3 flex-shrink-0 mt-0.5" />
                  <span>Includes referral message in threads</span>
                </li>
              </ul>

              <button
                onClick={onSignup}
                className="w-full bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 py-3 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors font-medium"
              >
                Get Started Free
              </button>
            </div>

            {/* Professional Plan */}
            <div className="bg-gradient-to-br from-blue-600 to-purple-600 p-8 rounded-2xl text-white relative">
              <div className="absolute top-4 right-4 bg-yellow-400 text-gray-900 px-3 py-1 rounded-full text-sm font-medium">
                Most Popular
              </div>
              <h4 className="text-2xl font-bold mb-2">Professional</h4>
              <p className="text-4xl font-bold mb-4">
                ${'29'}<span className="text-lg font-normal opacity-80">/month</span>
              </p>
              <p className="opacity-90 mb-6">For serious content creators</p>
              
              <ul className="space-y-3 mb-8">
                <li className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-white mr-3 flex-shrink-0 mt-0.5" />
                  <span>500 premium thread generations per month</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-white mr-3 flex-shrink-0 mt-0.5" />
                  <span>No referral messages - clean threads</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-white mr-3 flex-shrink-0 mt-0.5" />
                  <span>Priority email support & feature requests</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-white mr-3 flex-shrink-0 mt-0.5" />
                  <span>Advanced analytics & insights</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-white mr-3 flex-shrink-0 mt-0.5" />
                  <span>API access (coming soon)</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-white mr-3 flex-shrink-0 mt-0.5" />
                  <span>Save 2 months with annual billing</span>
                </li>
              </ul>

              <button
                onClick={onSignup}
                className="w-full bg-white text-blue-600 py-3 rounded-lg hover:bg-gray-100 transition-colors font-medium"
              >
                Start Free Trial
              </button>
            </div>

            {/* Team Plan */}
            <div className="bg-gray-900 p-8 rounded-2xl text-white relative border-2 border-gray-700">
              <h4 className="text-2xl font-bold mb-2">Team</h4>
              <p className="text-4xl font-bold mb-4">
                ${'79'}<span className="text-lg font-normal opacity-80">/month</span>
              </p>
              <p className="opacity-90 mb-6">For law firms and content teams</p>
              
              <ul className="space-y-3 mb-8">
                <li className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-green-400 mr-3 flex-shrink-0 mt-0.5" />
                  <span>2000 premium credits per month</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-green-400 mr-3 flex-shrink-0 mt-0.5" />
                  <span>Everything in Professional</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-green-400 mr-3 flex-shrink-0 mt-0.5" />
                  <span>3 team members included</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-green-400 mr-3 flex-shrink-0 mt-0.5" />
                  <span>Shared templates & prompts</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-green-400 mr-3 flex-shrink-0 mt-0.5" />
                  <span>Team analytics dashboard</span>
                </li>
              </ul>

              <button
                onClick={onSignup}
                className="w-full bg-gray-700 text-white py-3 rounded-lg hover:bg-gray-600 transition-colors font-medium"
              >
                Contact Sales
              </button>
            </div>
          </div>

          {/* Credits Explanation */}
          <div className="mt-16 bg-blue-50 dark:bg-blue-900/20 p-8 rounded-2xl max-w-3xl mx-auto">
            <h4 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
              <Sparkles className="w-6 h-6 text-blue-600 dark:text-blue-400 mr-2" />
              Understanding Premium Credits
            </h4>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              Premium credits let you experience our most advanced AI model (Claude Sonnet) which creates more creative, engaging, and higher-quality threads. Here's how they work:
            </p>
            <ul className="space-y-2 text-gray-700 dark:text-gray-300">
              <li>• <strong>100 free credits</strong> on signup - that's 100 premium threads!</li>
              <li>• <strong>1 credit = 1 thread</strong> with our advanced AI</li>
              <li>• <strong>Earn 100 credits</strong> for each friend who signs up with your referral</li>
              <li>• <strong>Credits expire after 90 days</strong> - use them while they're fresh!</li>
              <li>• <strong>Upgrade to Professional</strong> for monthly premium credits</li>
              <li>• <strong>No refunds</strong> for unused credits - we encourage active usage</li>
            </ul>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-20 bg-gray-50 dark:bg-gray-800">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h3 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Frequently Asked Questions
            </h3>
            <p className="text-xl text-gray-600 dark:text-gray-300">
              Everything you need to know about Threadifier
            </p>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <div key={index} className="bg-white dark:bg-gray-900 rounded-lg shadow-sm">
                <button
                  className="w-full px-6 py-4 text-left flex justify-between items-center hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  onClick={() => setOpenFaq(openFaq === index ? null : index)}
                >
                  <span className="font-medium text-gray-900 dark:text-white">{faq.question}</span>
                  {openFaq === index ? (
                    <ChevronUp className="w-5 h-5 text-gray-500" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-500" />
                  )}
                </button>
                {openFaq === index && (
                  <div className="px-6 pb-4">
                    <p className="text-gray-600 dark:text-gray-300">{faq.answer}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-blue-600 to-purple-600">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h3 className="text-4xl font-bold text-white mb-4">
            Ready to Transform Your Content?
          </h3>
          <p className="text-xl text-blue-100 mb-8">
            Join thousands of professionals creating viral threads with AI
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={onSignup}
              className="bg-white text-blue-600 px-8 py-4 rounded-lg hover:bg-gray-100 transition-colors font-medium text-lg"
            >
              Start Free with 100 Credits
            </button>
            <button
              onClick={onLogin}
              className="bg-blue-700 text-white px-8 py-4 rounded-lg hover:bg-blue-800 transition-colors font-medium text-lg"
            >
              Login to Your Account
            </button>
          </div>
          <p className="text-sm text-blue-100 mt-4">
            No credit card required • Setup in 30 seconds
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-300 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <h4 className="text-white font-semibold mb-4">Threadifier</h4>
              <p className="text-sm">Transform your content into viral social media threads with AI.</p>
            </div>
            <div>
              <h5 className="text-white font-semibold mb-4">Product</h5>
              <ul className="space-y-2 text-sm">
                <li><a href="#features" className="hover:text-white transition-colors">Features</a></li>
                <li><a href="#pricing" className="hover:text-white transition-colors">Pricing</a></li>
                <li><a href="#industries" className="hover:text-white transition-colors">Use Cases</a></li>
              </ul>
            </div>
            <div>
              <h5 className="text-white font-semibold mb-4">Support</h5>
              <ul className="space-y-2 text-sm">
                <li><a href="#faq" className="hover:text-white transition-colors">FAQ</a></li>
                <li><a href="mailto:support@threadifier.com" className="hover:text-white transition-colors">Contact</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Help Center</a></li>
              </ul>
            </div>
            <div>
              <h5 className="text-white font-semibold mb-4">Legal</h5>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white transition-colors">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Terms of Service</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Cookie Policy</a></li>
              </ul>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-gray-800 text-center text-sm">
            <p>&copy; 2024 Threadifier. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}