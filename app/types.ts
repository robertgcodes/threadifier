export interface ThreadPost {
  id: number;
  text: string;
}

export interface MarkedUpImage {
  id: string;
  url: string;
  pageNumber: number;
  json: any; // To store fabric.js canvas state
}

export interface PageSuggestion {
  pageNumber: number;
  relevanceScore: number;
  suggestedPost: string;
  reasoning: string;
  keyQuotes: string[];
  confidence: 'high' | 'medium' | 'low';
}

export interface PostImageSuggestion {
  postIndex: number;
  postText: string;
  recommendedPages: {
    pageNumber: number;
    relevanceScore: number;
    reasoning: string;
    keyQuotes: string[];
    confidence: 'high' | 'medium' | 'low';
  }[];
}

export interface AnalyzeResponse {
  thread?: string[];
  pageSuggestions?: PageSuggestion[];
  postImageSuggestions?: PostImageSuggestion[];
} 