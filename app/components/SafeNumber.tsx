"use client";

import React from 'react';

interface SafeNumberProps {
  value: number | undefined | null;
  fallback?: string;
}

/**
 * SafeNumber component ensures numbers are always rendered as strings
 * to avoid React error #130 and hydration mismatches
 */
export default function SafeNumber({ value, fallback = '0' }: SafeNumberProps) {
  // Always convert to string to avoid React hydration errors
  const displayValue = value !== null && value !== undefined ? String(value) : fallback;
  
  return <>{displayValue}</>;
}

// Hook for safe number rendering
export function useSafeNumber(value: number | undefined | null, fallback = '0'): string {
  return value !== null && value !== undefined ? String(value) : fallback;
}