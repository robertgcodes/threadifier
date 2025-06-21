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