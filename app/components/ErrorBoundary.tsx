"use client";

import React from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    console.error('ErrorBoundary caught error:', error);
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error details:', error, errorInfo);
    // Log component stack to help identify where the error occurred
    console.error('Component stack:', errorInfo.componentStack);
    
    // Special handling for React error #130
    if (error.message && error.message.includes('130')) {
      console.error('🚨 React Error #130 detected - Text nodes cannot be a child of <View>');
      console.error('This usually means a number is being rendered directly as a child');
      console.error('Check the component stack above to find the problematic component');
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <h2 className="text-red-800 font-semibold">Something went wrong</h2>
          <details className="mt-2">
            <summary className="cursor-pointer text-red-600">Error details</summary>
            <pre className="mt-2 text-xs overflow-auto">
              {this.state.error?.toString()}
            </pre>
          </details>
        </div>
      );
    }

    return this.props.children;
  }
}