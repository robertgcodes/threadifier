"use client";

import React, { useState } from 'react';
import { Sparkles, Edit, Eye, ChevronRight, Lightbulb, Target } from 'lucide-react';
import { PageSuggestion } from '../types';

interface AISuggestionsProps {
  suggestions: PageSuggestion[];
  isLoading: boolean;
  onEditPage: (pageNumber: number) => void;
  onViewPage: (pageNumber: number) => void;
  customInstructions?: string;
}

export default function AISuggestions({
  suggestions,
  isLoading,
  onEditPage,
  onViewPage,
  customInstructions
}: AISuggestionsProps) {
  const [expandedSuggestion, setExpandedSuggestion] = useState<number | null>(null);

  const getConfidenceColor = (confidence: string) => {
    switch (confidence) {
      case 'high': return 'text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-900/20';
      case 'medium': return 'text-yellow-600 bg-yellow-50 dark:text-yellow-400 dark:bg-yellow-900/20';
      case 'low': return 'text-orange-600 bg-orange-50 dark:text-orange-400 dark:bg-orange-900/20';
      default: return 'text-gray-600 bg-gray-50 dark:text-gray-400 dark:bg-gray-800';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 dark:text-green-400';
    if (score >= 60) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-orange-600 dark:text-orange-400';
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        <div className="text-center">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Analyzing Pages...</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">AI is reviewing your document to find the best pages for your thread</p>
        </div>
      </div>
    );
  }

  if (!suggestions || suggestions.length === 0) {
    return (
      <div className="text-center py-12">
        <Sparkles className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-600" />
        <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">No suggestions yet</h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Upload a document and generate suggestions to see AI-recommended pages
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
        <div className="flex items-start space-x-3">
          <Sparkles className="h-5 w-5 text-blue-500 dark:text-blue-400 mt-0.5" />
          <div>
            <h3 className="text-sm font-medium text-blue-900 dark:text-blue-100">AI Suggestions</h3>
            <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
              {customInstructions 
                ? `Based on your focus: "${customInstructions}"`
                : "AI-recommended pages for your thread"
              }
            </p>
          </div>
        </div>
      </div>

      {/* Suggestions List */}
      <div className="space-y-4">
        {suggestions
          .sort((a, b) => b.relevanceScore - a.relevanceScore)
          .map((suggestion, index) => (
            <div
              key={suggestion.pageNumber}
              className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm hover:shadow-md dark:hover:shadow-gray-900/30 transition-shadow"
            >
              {/* Main Content */}
              <div className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    {/* Page Number & Score */}
                    <div className="flex items-center space-x-3 mb-2">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300">
                        Page {suggestion.pageNumber}
                      </span>
                      <span className={`text-sm font-medium ${getScoreColor(suggestion.relevanceScore)}`}>
                        {suggestion.relevanceScore}/100
                      </span>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getConfidenceColor(suggestion.confidence)}`}>
                        {suggestion.confidence} confidence
                      </span>
                    </div>

                    {/* Suggested Post */}
                    <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                      {suggestion.suggestedPost}
                    </h4>

                    {/* Key Quotes Preview */}
                    {suggestion.keyQuotes && suggestion.keyQuotes.length > 0 ? (
                      <div className="mb-3">
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Key quotes:</p>
                        <p className="text-sm text-gray-700 dark:text-gray-300 italic">
                          "{suggestion.keyQuotes[0]}"
                          {suggestion.keyQuotes.length > 1 && (
                            <span className="text-gray-400 dark:text-gray-500"> + {String(suggestion.keyQuotes.length - 1)} more</span>
                          )}
                        </p>
                      </div>
                    ) : null}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center space-x-2 ml-4">
                    <button
                      onClick={() => onViewPage(suggestion.pageNumber)}
                      className="inline-flex items-center px-2.5 py-1.5 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50"
                      title="View Page"
                    >
                      <Eye className="h-3 w-3 mr-1" />
                      View
                    </button>
                    <button
                      onClick={() => onEditPage(suggestion.pageNumber)}
                      className="inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded text-white bg-blue-600 hover:bg-blue-700"
                      title="Edit Page"
                    >
                      <Edit className="h-3 w-3 mr-1" />
                      Edit
                    </button>
                  </div>
                </div>

                {/* Expand/Collapse for Details */}
                <button
                  onClick={() => setExpandedSuggestion(
                    expandedSuggestion === suggestion.pageNumber ? null : suggestion.pageNumber
                  )}
                  className="flex items-center mt-2 text-xs text-blue-600 hover:text-blue-800"
                >
                  <ChevronRight 
                    className={`h-3 w-3 mr-1 transition-transform ${
                      expandedSuggestion === suggestion.pageNumber ? 'rotate-90' : ''
                    }`} 
                  />
                  {expandedSuggestion === suggestion.pageNumber ? 'Hide details' : 'Show details'}
                </button>
              </div>

              {/* Expanded Details */}
              {expandedSuggestion === suggestion.pageNumber && (
                <div className="border-t border-gray-100 px-4 py-3 bg-gray-50">
                  <div className="space-y-3">
                    {/* Reasoning */}
                    <div>
                      <div className="flex items-center space-x-2 mb-1">
                        <Lightbulb className="h-3 w-3 text-amber-500" />
                        <span className="text-xs font-medium text-gray-700">Why this page?</span>
                      </div>
                      <p className="text-xs text-gray-600 pl-5">{suggestion.reasoning}</p>
                    </div>

                    {/* All Key Quotes */}
                    {suggestion.keyQuotes && suggestion.keyQuotes.length > 1 && (
                      <div>
                        <div className="flex items-center space-x-2 mb-1">
                          <Target className="h-3 w-3 text-blue-500" />
                          <span className="text-xs font-medium text-gray-700">All key quotes:</span>
                        </div>
                        <div className="space-y-1 pl-5">
                          {suggestion.keyQuotes.map((quote, quoteIndex) => (
                            <p key={`quote-${quoteIndex}`} className="text-xs text-gray-600 italic">
                              "{quote}"
                            </p>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
      </div>

      {/* Footer */}
      <div className="text-center text-xs text-gray-500 dark:text-gray-400 border-t dark:border-gray-700 pt-4">
        Found {String(suggestions.length)} relevant page{suggestions.length !== 1 ? 's' : ''} for your thread
      </div>
    </div>
  );
}