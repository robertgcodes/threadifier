"use client";

import { useState } from "react";
import { useDropzone } from "react-dropzone";
import toast from "react-hot-toast";
import * as pdfjsLib from "pdfjs-dist";
import { Loader2, Twitter, Edit, Trash2, PlusCircle, Save, XCircle } from "lucide-react";

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
  const [editingPostId, setEditingPostId] = useState<number | null>(null);
  const [editingText, setEditingText] = useState("");

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
      const threadWithIds = data.thread.map((text: string, index: number) => ({ id: Date.now() + index, text }));
      setGeneratedThread(threadWithIds);
      toast.success("AI analysis complete!");

    } catch (error) {
      console.error("Failed to analyze text:", error);
      toast.error("AI analysis failed. Check the console for details.");
    } finally {
      setIsAnalyzing(false);
    }
  }
  
  // --- Editing Functions ---

  const startEditing = (post: ThreadPost) => {
    setEditingPostId(post.id);
    setEditingText(post.text);
  };

  const saveEdit = () => {
    setGeneratedThread(generatedThread.map(post => 
      post.id === editingPostId ? { ...post, text: editingText } : post
    ));
    setEditingPostId(null);
    setEditingText("");
    toast.success("Post updated!");
  };

  const cancelEdit = () => {
    setEditingPostId(null);
    setEditingText("");
  };

  const deletePost = (postId: number) => {
    setGeneratedThread(generatedThread.filter(post => post.id !== postId));
    toast.error("Post deleted.");
  };

  const addPost = () => {
    const newPost: ThreadPost = {
      id: Date.now(),
      text: "New post..."
    };
    setGeneratedThread([...generatedThread, newPost]);
    startEditing(newPost);
  };


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
          {/* Generated Thread Editor */}
          {generatedThread.length > 0 && (
            <div className="card">
              <h2 className="text-xl font-semibold mb-4 text-legal-700">Edit Your Thread</h2>
              <div className="space-y-4">
                {generatedThread.map((post, index) => (
                  <div key={post.id} className="flex gap-4 group">
                    <div className="flex-shrink-0">
                      <div className="h-10 w-10 rounded-full bg-legal-800 flex items-center justify-center">
                        <Twitter className="h-5 w-5 text-white" />
                      </div>
                    </div>
                    <div className="flex-grow">
                      <p className="font-semibold text-legal-800">Legal Eagle Bot <span className="text-legal-500 font-normal">· @threadifier</span></p>
                      {editingPostId === post.id ? (
                        <>
                          <textarea
                            className="input-field w-full h-24 text-base"
                            value={editingText}
                            onChange={(e) => setEditingText(e.target.value)}
                            autoFocus
                          />
                          <div className="flex gap-2 mt-2">
                            <button onClick={saveEdit} className="btn-primary py-1 px-3 text-sm"><Save className="w-4 h-4 mr-1 inline-block"/>Save</button>
                            <button onClick={cancelEdit} className="btn-secondary py-1 px-3 text-sm"><XCircle className="w-4 h-4 mr-1 inline-block"/>Cancel</button>
                          </div>
                        </>
                      ) : (
                        <>
                          <p className="text-legal-600 whitespace-pre-wrap">{post.text}</p>
                          <div className="flex items-center gap-4 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                             <button onClick={() => startEditing(post)} className="text-legal-500 hover:text-primary-600 text-sm flex items-center"><Edit className="w-4 h-4 mr-1"/>Edit</button>
                             <button onClick={() => deletePost(post.id)} className="text-legal-500 hover:text-red-600 text-sm flex items-center"><Trash2 className="w-4 h-4 mr-1"/>Delete</button>
                          </div>
                        </>
                      )}
                      <p className="text-legal-400 text-sm mt-1">{index + 1}/{generatedThread.length}</p>
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={addPost} className="btn-secondary mt-6 w-full flex items-center justify-center">
                <PlusCircle className="w-5 h-5 mr-2" /> Add Post to Thread
              </button>
            </div>
          )}

          {/* Extracted Text */}
          {extractedText && !isAnalyzing && generatedThread.length === 0 && (
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