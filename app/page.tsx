"use client";

import { useState } from "react";
import { useDropzone } from "react-dropzone";
import toast from "react-hot-toast";
import * as pdfjsLib from "pdfjs-dist";

// Use a stable CDN for the PDF.js worker to ensure compatibility with Vercel's build environment.
// We also point to the '.mjs' version for modern module compatibility.
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.mjs`;

export default function HomePage() {
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [extractedText, setExtractedText] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const onDrop = (acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setPdfFile(acceptedFiles[0]);
      setExtractedText("");
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"] },
    multiple: false,
  });

  async function extractTextFromPDF(file: File) {
    setLoading(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let text = "";
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        text += content.items.map((item: any) => item.str).join(" ") + "\n\n";
      }
      setExtractedText(text);
      toast.success("Text extracted from PDF!");
    } catch (err) {
      console.error("Error extracting PDF text:", err);
      toast.error("Failed to extract text from PDF.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-legal-50 p-8">
      <div className="card w-full max-w-xl">
        <h1 className="text-2xl font-bold mb-4 text-legal-800">Upload a Legal PDF</h1>
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
            isDragActive ? "border-primary-500 bg-primary-50" : "border-legal-300 bg-white"
          }`}
        >
          <input {...getInputProps()} />
          {pdfFile ? (
            <span className="text-legal-700">{pdfFile.name}</span>
          ) : (
            <span className="text-legal-400">Drag & drop a PDF here, or click to select</span>
          )}
        </div>
        <button
          className="btn-primary mt-4 w-full"
          disabled={!pdfFile || loading}
          onClick={() => pdfFile && extractTextFromPDF(pdfFile)}
        >
          {loading ? "Extracting..." : "Extract Text"}
        </button>
        {extractedText && (
          <div className="mt-6">
            <h2 className="text-lg font-semibold mb-2 text-legal-700">Extracted Text</h2>
            <textarea
              className="input-field h-64 resize-vertical"
              value={extractedText}
              readOnly
            />
          </div>
        )}
      </div>
    </main>
  );
} 