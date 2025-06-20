"use client";

import { useState } from "react";
import { useDropzone } from "react-dropzone";
import toast from "react-hot-toast";
import * as pdfjsLib from "pdfjs-dist";
import { Loader2, Twitter, Edit, Trash2, PlusCircle, Save, XCircle, GripVertical } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Switch } from '@headlessui/react';

// Use a stable CDN for the PDF.js worker to ensure compatibility with Vercel's build environment.
// We also point to the '.mjs' version for modern module compatibility.
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.mjs`;

interface ThreadPost {
  id: number;
  text: string;
}

// --- Sortable Post Item Component ---
function SortablePostItem({ post, index, generatedThread, startEditing, deletePost, editingPostId, editingText, setEditingText, saveEdit, cancelEdit }: { post: ThreadPost, index: number, generatedThread: ThreadPost[], startEditing: (post: ThreadPost) => void, deletePost: (id: number) => void, editingPostId: number | null, editingText: string, setEditingText: (text: string) => void, saveEdit: () => void, cancelEdit: () => void }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({id: post.id});

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex gap-4 group items-start">
      {/* Drag Handle */}
      <div {...attributes} {...listeners} className="flex-shrink-0 touch-none cursor-grab text-legal-400 hover:text-legal-600 pt-3">
        <GripVertical className="h-5 w-5" />
      </div>
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
              <button onClick={saveEdit} className="btn-primary py-1 px-3 text-sm flex items-center"><Save className="w-4 h-4 mr-1"/>Save</button>
              <button onClick={cancelEdit} className="btn-secondary py-1 px-3 text-sm flex items-center"><XCircle className="w-4 h-4 mr-1"/>Cancel</button>
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
  );
}

export default function HomePage() {
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [extractedText, setExtractedText] = useState<string>("");
  const [isExtracting, setIsExtracting] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [generatedThread, setGeneratedThread] = useState<ThreadPost[]>([]);
  const [editingPostId, setEditingPostId] = useState<number | null>(null);
  const [editingText, setEditingText] = useState("");
  
  // Prompt customization state
  const [charLimit, setCharLimit] = useState(280);
  const [numPosts, setNumPosts] = useState(5);
  const [customInstructions, setCustomInstructions] = useState("");
  const [useEmojis, setUseEmojis] = useState(false);
  const [useNumbering, setUseNumbering] = useState(false);
  const [useHashtags, setUseHashtags] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

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
        body: JSON.stringify({
          text: extractedText,
          charLimit,
          numPosts,
          customInstructions,
          useEmojis,
          useNumbering,
          useHashtags,
        }),
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
  
  function handleDragEnd(event: DragEndEvent) {
    const {active, over} = event;
    
    if (over && active.id !== over.id) {
      setGeneratedThread((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        
        return arrayMove(items, oldIndex, newIndex);
      });
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

          {/* Prompt Customization Panel */}
          {extractedText && (
            <div className="mt-8 border-t pt-6">
              <h3 className="text-lg font-semibold mb-4 text-legal-700">Customize AI Thread Generation</h3>
              <div className="space-y-4">
                {/* Custom Instructions (now primary) */}
                <div>
                  <label className="block text-legal-600 font-medium mb-1">Custom Instructions (style, tone, perspective, etc.):</label>
                  <textarea
                    className="input-field h-20"
                    placeholder="e.g. Write from a conservative perspective, use plain English, focus on the holding, etc."
                    value={customInstructions}
                    onChange={e => setCustomInstructions(e.target.value)}
                  />
                </div>
                {/* Character Limit Slider */}
                <div>
                  <label className="block text-legal-600 font-medium mb-1">Character Limit per Post: <span className="font-bold text-legal-800">{charLimit}</span></label>
                  <input
                    type="range"
                    min={100}
                    max={500}
                    step={10}
                    value={charLimit}
                    onChange={e => setCharLimit(Number(e.target.value))}
                    className="w-full accent-primary-600"
                  />
                </div>
                {/* Number of Posts Slider */}
                <div>
                  <label className="block text-legal-600 font-medium mb-1">Number of Posts: <span className="font-bold text-legal-800">{numPosts}</span></label>
                  <input
                    type="range"
                    min={1}
                    max={20}
                    step={1}
                    value={numPosts}
                    onChange={e => setNumPosts(Number(e.target.value))}
                    className="w-full accent-primary-600"
                  />
                </div>
                {/* Emojis Toggle */}
                <div className="flex items-center gap-3">
                  <Switch
                    checked={useEmojis}
                    onChange={setUseEmojis}
                    className={`${useEmojis ? 'bg-primary-600' : 'bg-legal-200'} relative inline-flex h-6 w-11 items-center rounded-full transition-colors`}
                  >
                    <span className="sr-only">Use Emojis</span>
                    <span
                      className={`${useEmojis ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
                    />
                  </Switch>
                  <span className="text-legal-700">Use Emojis</span>
                </div>
                {/* Number Sequencing Toggle */}
                <div className="flex items-center gap-3">
                  <Switch
                    checked={useNumbering}
                    onChange={setUseNumbering}
                    className={`${useNumbering ? 'bg-primary-600' : 'bg-legal-200'} relative inline-flex h-6 w-11 items-center rounded-full transition-colors`}
                  >
                    <span className="sr-only">Number Sequencing</span>
                    <span
                      className={`${useNumbering ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
                    />
                  </Switch>
                  <span className="text-legal-700">Number Sequencing (1/3, 2/3, ...)</span>
                </div>
                {/* Hashtags Toggle */}
                <div className="flex items-center gap-3">
                  <Switch
                    checked={useHashtags}
                    onChange={setUseHashtags}
                    className={`${useHashtags ? 'bg-primary-600' : 'bg-legal-200'} relative inline-flex h-6 w-11 items-center rounded-full transition-colors`}
                  >
                    <span className="sr-only">Include Hashtags</span>
                    <span
                      className={`${useHashtags ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
                    />
                  </Switch>
                  <span className="text-legal-700">Include Hashtags</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Results */}
        <div className="space-y-8">
          {/* Generated Thread Editor */}
          {generatedThread.length > 0 && (
            <DndContext 
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext 
                items={generatedThread}
                strategy={verticalListSortingStrategy}
              >
                <div className="card">
                  <h2 className="text-xl font-semibold mb-4 text-legal-700">Edit Your Thread</h2>
                  <div className="space-y-4">
                    {generatedThread.map((post, index) => (
                      <SortablePostItem 
                        key={post.id}
                        post={post}
                        index={index}
                        generatedThread={generatedThread}
                        startEditing={startEditing}
                        deletePost={deletePost}
                        editingPostId={editingPostId}
                        editingText={editingText}
                        setEditingText={setEditingText}
                        saveEdit={saveEdit}
                        cancelEdit={cancelEdit}
                      />
                    ))}
                  </div>
                  <button onClick={addPost} className="btn-secondary mt-6 w-full flex items-center justify-center">
                    <PlusCircle className="w-5 h-5 mr-2" /> Add Post to Thread
                  </button>
                </div>
              </SortableContext>
            </DndContext>
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