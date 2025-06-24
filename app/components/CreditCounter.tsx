"use client";

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, ChevronDown } from 'lucide-react';

interface CreditCounterProps {
  credits: number;
  onCreditUsed?: boolean;
  className?: string;
}

export default function CreditCounter({ credits, onCreditUsed = false, className = '' }: CreditCounterProps) {
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

  return (
    <div className={`relative ${className}`}>
      <motion.button
        onClick={() => setIsExpanded(!isExpanded)}
        className="relative bg-blue-50 hover:bg-blue-100 rounded-full px-3 py-1.5 flex items-center gap-2 transition-all duration-200 ease-out"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <Sparkles className="w-4 h-4 text-blue-600" />
        
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
              <span className="text-sm font-medium text-blue-900">{credits}</span>
              <span className="text-xs text-blue-700">credits</span>
              <ChevronDown className="w-3 h-3 text-blue-600 rotate-180" />
            </motion.div>
          ) : (
            <motion.div
              key="collapsed"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronDown className="w-3 h-3 text-blue-600" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Pulse animation when credit is used */}
        {showPulse && (
          <motion.div
            className="absolute inset-0 rounded-full bg-blue-400"
            initial={{ scale: 1, opacity: 0.5 }}
            animate={{ scale: 1.5, opacity: 0 }}
            transition={{ duration: 0.6 }}
          />
        )}
      </motion.button>

      {/* Floating notification when credit is used */}
      <AnimatePresence>
        {showPulse && (
          <motion.div
            initial={{ y: 0, opacity: 1 }}
            animate={{ y: -30, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.5 }}
            className="absolute top-0 left-1/2 transform -translate-x-1/2 pointer-events-none"
          >
            <div className="bg-blue-600 text-white text-xs rounded-full px-2 py-1 whitespace-nowrap">
              -1 credit
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tooltip on hover when collapsed */}
      {!isExpanded && (
        <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 opacity-0 hover:opacity-100 pointer-events-none transition-opacity">
          <div className="bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap">
            {credits} credits remaining
          </div>
        </div>
      )}
    </div>
  );
}