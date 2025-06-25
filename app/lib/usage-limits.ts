import { getUserMonthlyUsage } from './database';

// Usage limits configuration by subscription tier
export const USAGE_LIMITS = {
  free: {
    monthlyGenerations: 3,
    maxPagesPerDocument: 10,
    maxCharactersPerDocument: 15000, // ~10 pages
    maxPostsPerThread: 5,
    canUseCustomInstructions: false,
    canUseImageSuggestions: false,
    canPostToX: false,
    canSaveThreads: true,
    maxSavedThreads: 5,
    canUseTemplates: false,
  },
  professional: {
    monthlyGenerations: 50,
    maxPagesPerDocument: 50,
    maxCharactersPerDocument: 75000, // ~50 pages
    maxPostsPerThread: 30,
    canUseCustomInstructions: true,
    canUseImageSuggestions: true,
    canPostToX: true,
    canSaveThreads: true,
    maxSavedThreads: -1, // unlimited
    canUseTemplates: true,
  },
  team: {
    monthlyGenerations: 200,
    maxPagesPerDocument: 100,
    maxCharactersPerDocument: 150000, // ~100 pages
    maxPostsPerThread: 40,
    canUseCustomInstructions: true,
    canUseImageSuggestions: true,
    canPostToX: true,
    canSaveThreads: true,
    maxSavedThreads: -1, // unlimited
    canUseTemplates: true,
    teamMembers: 3,
  },
  enterprise: {
    monthlyGenerations: -1, // unlimited
    maxPagesPerDocument: 500,
    maxCharactersPerDocument: 750000, // ~500 pages
    maxPostsPerThread: 50,
    canUseCustomInstructions: true,
    canUseImageSuggestions: true,
    canPostToX: true,
    canSaveThreads: true,
    maxSavedThreads: -1,
    canUseTemplates: true,
    teamMembers: -1, // unlimited
  },
} as const;

export type SubscriptionTier = keyof typeof USAGE_LIMITS;

// Cost safety thresholds
export const COST_THRESHOLDS = {
  // Alert if single generation would cost more than this
  maxCostPerGeneration: 0.50, // $0.50
  // Block if estimated cost exceeds this
  blockCostThreshold: 1.00, // $1.00
  // Alert admin if user's monthly API cost exceeds
  monthlyUserCostAlert: 25.00, // $25
};

// Calculate estimated API cost for a document
export function estimateApiCost(
  documentCharacters: number,
  includeImageSuggestions: boolean = false
): { estimatedCost: number; tokens: number } {
  // Rough token estimation (1 token ≈ 4 characters)
  const baseTokens = Math.ceil(documentCharacters / 4);
  const systemPromptTokens = 500;
  const outputTokens = 500;
  
  const inputTokens = baseTokens + systemPromptTokens;
  const totalTokens = inputTokens + outputTokens;
  
  // Claude 3.5 Sonnet pricing
  const inputCost = (inputTokens / 1_000_000) * 3.00;
  const outputCost = (outputTokens / 1_000_000) * 15.00;
  
  let totalCost = inputCost + outputCost;
  
  // Add costs for additional features
  if (includeImageSuggestions) {
    totalCost += 0.13; // Average cost for page + post suggestions
  }
  
  return {
    estimatedCost: totalCost,
    tokens: totalTokens,
  };
}

// Check if user has exceeded their limits
export async function checkUsageLimits(
  userId: string,
  tier: SubscriptionTier,
  documentStats: {
    pages: number;
    characters: number;
    requestedPosts: number;
  }
): Promise<{ allowed: boolean; reason?: string; estimatedCost?: number }> {
  const limits = USAGE_LIMITS[tier];
  
  // Check page limit
  if (documentStats.pages > limits.maxPagesPerDocument) {
    return {
      allowed: false,
      reason: `Document has ${documentStats.pages} pages. Your plan allows up to ${limits.maxPagesPerDocument} pages.`,
    };
  }
  
  // Check character limit
  if (documentStats.characters > limits.maxCharactersPerDocument) {
    return {
      allowed: false,
      reason: `Document is too large. Your plan allows up to ${(limits.maxCharactersPerDocument / 1000).toFixed(0)}k characters.`,
    };
  }
  
  // Check posts limit
  if (documentStats.requestedPosts > limits.maxPostsPerThread) {
    return {
      allowed: false,
      reason: `You requested ${documentStats.requestedPosts} posts. Your plan allows up to ${limits.maxPostsPerThread} posts per thread.`,
    };
  }
  
  // Estimate cost and check thresholds
  const { estimatedCost } = estimateApiCost(
    documentStats.characters,
    limits.canUseImageSuggestions
  );
  
  if (estimatedCost > COST_THRESHOLDS.blockCostThreshold) {
    return {
      allowed: false,
      reason: `This document would be too expensive to process. Please use a smaller document or upgrade your plan.`,
      estimatedCost,
    };
  }
  
  // Check monthly usage (would need to query from database)
  // This is a placeholder - implement actual database check
  const monthlyUsage = await getMonthlyUsage(userId);
  if (limits.monthlyGenerations !== -1 && monthlyUsage >= limits.monthlyGenerations) {
    return {
      allowed: false,
      reason: `You've reached your monthly limit of ${limits.monthlyGenerations} threads. Upgrade or wait for next month.`,
    };
  }
  
  return { allowed: true, estimatedCost };
}

// Get monthly usage from database
async function getMonthlyUsage(userId: string): Promise<number> {
  try {
    const usage = await getUserMonthlyUsage(userId);
    return usage.threadsUsed;
  } catch (error) {
    console.error('Error getting monthly usage:', error);
    return 0; // Default to 0 if there's an error
  }
}