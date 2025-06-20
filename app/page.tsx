"use client";

import { useState } from "react";
import { useDropzone } from "react-dropzone";
import toast from "react-hot-toast";
import * as pdfjsLib from "pdfjs-dist";
import { Loader2, Twitter } from "lucide-react";

// Use a stable CDN for the PDF.js worker to ensure compatibility with Vercel's build environment.
// We also point to the '.mjs' version for modern module compatibility.
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.mjs`;

interface ThreadPost {
  id: number;
  text: string;
}

export default function HomePage() {
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [extractedText, setExtractedText] = useState<string>("");
  const [isExtracting, setIsExtracting] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [generatedThread, setGeneratedThread] = useState<ThreadPost[]>([]);

  const onDrop = (acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setPdfFile(acceptedFiles[0]);
      setExtractedText("");
      setGeneratedThread([]);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"] },
    multiple: false,
  });

  async function extractTextFromPDF(file: File) {
    setIsExtracting(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let text = "";
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const pageText = content.items.map((item: any) => item.str).join(" ");
        text += pageText + "\n\n";
      }
      setExtractedText(text);
      toast.success("Text extracted! Ready for analysis.");
    } catch (err) {
      console.error("Error extracting PDF text:", err);
      toast.error("Failed to extract text from PDF.");
    } finally {
      setIsExtracting(false);
    }
  }

  async function handleAnalyze() {
    if (!extractedText) {
      toast.error("Please extract text from a PDF first.");
      return;
    }
    setIsAnalyzing(true);
    setGeneratedThread([]);
    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: extractedText }),
      });

      if (!response.ok) {
        throw new Error(`Error: ${response.statusText}`);
      }

      const data = await response.json();
      const threadWithIds = data.thread.map((text: string, index: number) => ({ id: index + 1, text }));
      setGeneratedThread(threadWithIds);
      toast.success("AI analysis complete!");

    } catch (error) {
      console.error("Failed to analyze text:", error);
      toast.error("AI analysis failed. Check the console for details.");
    } finally {
      setIsAnalyzing(false);
    }
  }

  return (
    <main className="min-h-screen bg-legal-50 p-4 sm:p-8">
      <div className="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Left Column: Controls */}
        <div className="card h-fit sticky top-8">
          <h1 className="text-2xl font-bold mb-4 text-legal-800">Threadifier</h1>
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              isDragActive ? "border-primary-500 bg-primary-50" : "border-legal-300 hover:border-primary-400"
            }`}
          >
            <input {...getInputProps()} />
            {pdfFile ? (
              <span className="text-legal-700 font-medium">{pdfFile.name}</span>
            ) : (
              <span className="text-legal-500">Drag & drop a PDF, or click to select</span>
            )}
          </div>
          <div className="flex flex-col sm:flex-row gap-4 mt-4">
            <button
              className="btn-secondary w-full"
              disabled={!pdfFile || isExtracting}
              onClick={() => pdfFile && extractTextFromPDF(pdfFile)}
            >
              {isExtracting ? <Loader2 className="animate-spin mx-auto" /> : "1. Extract Text"}
            </button>
            <button
              className="btn-primary w-full"
              disabled={!extractedText || isAnalyzing}
              onClick={handleAnalyze}
            >
              {isAnalyzing ? <Loader2 className="animate-spin mx-auto" /> : "2. Generate Thread"}
            </button>
          </div>
        </div>

        {/* Right Column: Results */}
        <div className="space-y-8">
          {/* Generated Thread */}
          {generatedThread.length > 0 && (
            <div className="card">
              <h2 className="text-xl font-semibold mb-4 text-legal-700">Generated X Thread</h2>
              <div className="space-y-4">
                {generatedThread.map((post, index) => (
                  <div key={post.id} className="flex gap-4">
                    <div className="flex-shrink-0 h-10 w-10 rounded-full bg-legal-800 flex items-center justify-center">
                       <Twitter className="h-5 w-5 text-white" />
                    </div>
                    <div className="flex-grow">
                      <p className="font-semibold text-legal-800">Legal Eagle Bot <span className="text-legal-500 font-normal">· @threadifier</span></p>
                      <p className="text-legal-600">{post.text}</p>
                      <p className="text-legal-400 text-sm mt-1">{index + 1}/{generatedThread.length}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Extracted Text */}
          {extractedText && (
            <div className="card">
              <h2 className="text-xl font-semibold mb-2 text-legal-700">Extracted Document Text</h2>
              <textarea
                className="input-field h-96 text-sm bg-legal-50"
                value={extractedText}
                readOnly
              />
            </div>
          )}
        </div>
      </div>
    </main>
  );
} 