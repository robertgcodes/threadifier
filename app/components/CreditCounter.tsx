"use client";

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, ChevronDown, Infinity } from 'lucide-react';

interface CreditCounterProps {
  premiumCredits: number;
  hasUnlimitedBasic: boolean;
  onCreditUsed?: boolean;
  className?: string;
  usingPremium?: boolean;
}

export default function CreditCounter({ premiumCredits = 0, hasUnlimitedBasic = false, onCreditUsed = false, className = '', usingPremium = false }: CreditCounterProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showPulse, setShowPulse] = useState(false);

  useEffect(() => {
    if (onCreditUsed) {
      setShowPulse(true);
      const timer = setTimeout(() => {
        setShowPulse(false);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [onCreditUsed]);

  const bgColor = premiumCredits > 0 ? 'bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50' : 'bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700';
  const iconColor = premiumCredits > 0 ? 'text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400';
  const textColor = premiumCredits > 0 ? 'text-blue-900 dark:text-blue-100' : 'text-gray-900 dark:text-gray-100';
  const subTextColor = premiumCredits > 0 ? 'text-blue-700 dark:text-blue-300' : 'text-gray-700 dark:text-gray-300';
  const pulseColor = usingPremium ? 'bg-blue-400 dark:bg-blue-500' : 'bg-gray-400 dark:bg-gray-500';

  return (
    <div className={`relative ${className}`}>
      <motion.button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`relative ${bgColor} rounded-full px-3 py-1.5 flex items-center gap-2 transition-all duration-200 ease-out ${showPulse && usingPremium ? 'ring-2 ring-blue-400 ring-opacity-50' : ''}`}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        {hasUnlimitedBasic ? (
          <Infinity className={`w-4 h-4 ${iconColor}`} />
        ) : (
          <Sparkles className={`w-4 h-4 ${iconColor}`} />
        )}
        
        <AnimatePresence mode="wait">
          {isExpanded ? (
            <motion.div
              key="expanded"
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 'auto' }}
              exit={{ opacity: 0, width: 0 }}
              transition={{ duration: 0.2 }}
              className="flex items-center gap-1"
            >
              {hasUnlimitedBasic ? (
                <>
                  <span className={`text-sm font-medium ${textColor}`}>Unlimited</span>
                  <span className={`text-xs ${subTextColor}`}>basic</span>
                </>
              ) : (
                <>
                  <span className={`text-sm font-medium ${textColor}`}>{String(premiumCredits || 0)}</span>
                  <span className={`text-xs ${subTextColor}`}>premium</span>
                </>
              )}
              <ChevronDown className={`w-3 h-3 ${iconColor} rotate-180`} />
            </motion.div>
          ) : (
            <motion.div
              key="collapsed"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronDown className={`w-3 h-3 ${iconColor}`} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Pulse animation when credit is used */}
        {showPulse && (
          <motion.div
            className={`absolute inset-0 rounded-full ${pulseColor}`}
            initial={{ scale: 1, opacity: 0.5 }}
            animate={{ scale: 1.5, opacity: 0 }}
            transition={{ duration: 0.6 }}
          />
        )}
      </motion.button>

      {/* Floating notification when credit is used */}
      <AnimatePresence>
        {showPulse && !hasUnlimitedBasic && (
          <motion.div
            initial={{ y: 0, opacity: 1 }}
            animate={{ y: -30, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.5 }}
            className="absolute top-0 left-1/2 transform -translate-x-1/2 pointer-events-none"
          >
            <div className={`${usingPremium ? 'bg-blue-600' : 'bg-gray-600'} text-white text-xs rounded-full px-2 py-1 whitespace-nowrap`}>
              -1 {usingPremium ? 'premium' : 'basic'}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tooltip on hover when collapsed */}
      {!isExpanded && (
        <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 opacity-0 hover:opacity-100 pointer-events-none transition-opacity">
          <div className="bg-gray-900 dark:bg-gray-700 text-white text-xs rounded px-2 py-1 whitespace-nowrap">
            {hasUnlimitedBasic ? (
              <>Unlimited basic tier (AI: Claude Haiku)</>
            ) : (
              <>{String(premiumCredits || 0)} premium credits (AI: Claude Sonnet)</>
            )}
          </div>
        </div>
      )}
    </div>
  );
}