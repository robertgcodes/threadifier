"use client";

import { useState, useEffect, useRef, useLayoutEffect } from "react";
import { useDropzone } from "react-dropzone";
import toast from "react-hot-toast";
import * as pdfjsLib from "pdfjs-dist";
import { Loader2, Twitter, Edit, Trash2, PlusCircle, Save, XCircle, GripVertical, Copy as CopyIcon, Crop, Image as ImageIcon, BookOpen, DownloadCloud, CheckCircle, SortAsc, Send, MoreHorizontal, MessageCircle, Repeat2, Heart, Share, User, Camera, Moon, Sun, Bookmark } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  useDraggable,
  useDroppable,
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
import { Dialog } from '@headlessui/react';
import { fabric } from 'fabric';
import { v4 as uuidv4 } from 'uuid';
import { useAuth } from "./context/AuthContext";
import { signOut } from './lib/auth';
import Link from 'next/link';
import ThreadEditor from './components/ThreadEditor';
import ImagePickerModal from './components/ImagePickerModal';
import AnnotationModal from './components/AnnotationModal';
import AISuggestions from './components/AISuggestions';
import LoginScreen from './components/LoginScreen';
import { Tab } from '@headlessui/react';
import { PageSuggestion, PostImageSuggestion } from './types';
import { saveThread, incrementThreadUsage, getUserThreads, SavedThread, saveCustomPrompt, getUserCustomPrompts, updateCustomPrompt, deleteCustomPrompt, CustomPrompt } from './lib/database';
import { uploadImagesToStorage, uploadMarkedUpImagesToStorage } from './lib/storage';

export const dynamic = 'force-dynamic';

// Use a stable CDN for the PDF.js worker to ensure compatibility with Vercel's build environment.
// We also point to the '.mjs' version for modern module compatibility.
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.mjs`;

interface ThreadPost {
  id: number;
  text: string;
}

interface MarkedUpImage {
  id: string;
  pageNumber: number;
  url: string;
  json: any;
}

// --- Droppable Zone for Images ---
function ImageDropZone({ id, post, pageImages, markedUpImages, postPageMap, handleClearImage, onAddImage }: { id: string, post: ThreadPost, pageImages: string[], markedUpImages: MarkedUpImage[], postPageMap: any, handleClearImage: (postId: number) => void, onAddImage: (postId: number) => void }) {
  const {setNodeRef} = useDroppable({ id, disabled: true });

  const imageInfo = postPageMap[post.id];
  let imageUrl: string | null = null;
  let imageAlt = 'Placeholder';

  if (imageInfo) {
    if (imageInfo.type === 'pdf') {
      imageUrl = pageImages[imageInfo.value];
      imageAlt = `Page ${imageInfo.value + 1}`;
    } else {
      const markedImg = markedUpImages.find(m => m.id === imageInfo.value);
      if (markedImg) {
        imageUrl = markedImg.url;
        imageAlt = `Page ${markedImg.pageNumber} Edited`;
      }
    }
  }

  return (
    <div
      ref={setNodeRef}
      style={{
        border: imageUrl ? '2px solid #2563eb' : '2px dashed #d1d5db',
        transition: 'border-color 0.2s',
      }}
      className="bg-legal-50/50 p-4 rounded-lg flex items-center justify-center text-legal-500 h-full relative"
    >
      {imageUrl ? (
        <>
          <img src={imageUrl} alt={`Page for post ${post.id}`} className="max-h-48 object-contain rounded-md" />
          <button 
            onClick={() => handleClearImage(post.id)} 
            className="absolute top-2 right-2 bg-white/50 backdrop-blur-sm rounded-full p-1 text-legal-600 hover:text-red-500 hover:bg-white"
            aria-label="Clear image"
          >
            <XCircle className="w-5 h-5" />
          </button>
        </>
      ) : (
        <button onClick={() => onAddImage(post.id)} className="w-full h-full flex flex-col items-center justify-center text-center text-legal-500 hover:bg-legal-100 transition-colors rounded-lg">
          <ImageIcon className="w-8 h-8 mx-auto text-legal-400 mb-2" />
          <p>Add Image</p>
        </button>
      )}
    </div>
  );
}

// --- Sortable Post Item Component ---
function SortablePostItem({ post, index, generatedThread, startEditing, deletePost, editingPostId, editingText, setEditingText, saveEdit, cancelEdit, handleCopy, dragHandleListeners, setDragHandleRef }: { post: ThreadPost, index: number, generatedThread: ThreadPost[], startEditing: (post: ThreadPost) => void, deletePost: (id: number) => void, editingPostId: number | null, editingText: string, setEditingText: (text: string) => void, saveEdit: () => void, cancelEdit: () => void, handleCopy: (text: string) => void, dragHandleListeners: any, setDragHandleRef: (element: HTMLElement | null) => void }) {
  
  return (
    <div className="flex gap-2 items-start h-full group">
      {/* Drag Handle */}
      <div ref={setDragHandleRef} {...dragHandleListeners} className="flex-shrink-0 touch-none cursor-grab text-legal-400 hover:text-legal-600 pt-3">
        <GripVertical size={20} />
      </div>
      <div className="flex-grow flex flex-col">
        <div className="flex items-center mb-2">
            <div className="h-10 w-10 rounded-full bg-legal-800 flex items-center justify-center mr-3 flex-shrink-0">
              <Twitter className="h-5 w-5 text-white" />
            </div>
            <p className="font-semibold text-legal-800">Threadifier Bot <span className="text-legal-500 font-normal">· @threadifier</span></p>
        </div>
        <div className="flex-grow">
            {editingPostId === post.id ? (
              <>
                <textarea
                  className="input-field w-full h-36 text-base"
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
                  <button onClick={() => handleCopy(post.text)} className="text-legal-500 hover:text-primary-600 text-sm flex items-center"><CopyIcon className="w-4 h-4 mr-1"/>Copy</button>
                  <button onClick={() => startEditing(post)} className="text-legal-500 hover:text-primary-600 text-sm flex items-center"><Edit className="w-4 h-4 mr-1"/>Edit</button>
                  <button onClick={() => deletePost(post.id)} className="text-legal-500 hover:text-red-600 text-sm flex items-center"><Trash2 className="w-4 h-4 mr-1"/>Delete</button>
                </div>
              </>
            )}
        </div>
        <p className="text-legal-400 text-sm mt-auto pt-2">{index + 1}/{generatedThread.length}</p>
      </div>
    </div>
  );
}

// --- Sortable Thread Row ---
function SortableThreadRow({ post, index, generatedThread, ...props }: { post: ThreadPost, index: number, generatedThread: ThreadPost[], startEditing: (post: ThreadPost) => void, deletePost: (id: number) => void, editingPostId: number | null, editingText: string, setEditingText: (text: string) => void, saveEdit: () => void, cancelEdit: () => void, handleCopy: (text: string) => void, pageImages: string[], markedUpImages: MarkedUpImage[], postPageMap: any, handleClearImage: (postId: number) => void, onAddImage: (postId: number) => void }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
  } = useSortable({
    id: post.id.toString(),
    data: {
      type: 'post',
      post: post,
    }
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} className="grid grid-cols-2 gap-4 items-start">
      {/* Post Item Column */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-legal-200 h-full">
        <SortablePostItem 
          post={post} 
          index={index} 
          generatedThread={generatedThread}
          dragHandleListeners={listeners}
          setDragHandleRef={setActivatorNodeRef}
          {...props} 
        />
      </div>
      {/* Image Drop Zone Column */}
      <ImageDropZone
        id={`droppable-${post.id}`}
        post={post}
        pageImages={props.pageImages}
        markedUpImages={props.markedUpImages}
        postPageMap={props.postPageMap}
        handleClearImage={props.handleClearImage}
        onAddImage={props.onAddImage}
      />
    </div>
  );
}


function Page() {
  const { user } = useAuth();
  
  // Show login screen if user is not authenticated
  if (!user) {
    return <LoginScreen />;
  }

  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pageImages, setPageImages] = useState<string[]>([]);
  const [highResPageImages, setHighResPageImages] = useState<string[]>([]);
  const [markedUpImages, setMarkedUpImages] = useState<MarkedUpImage[]>([]);
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

  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeItem, setActiveItem] = useState<any>(null); // For DragOverlay
  const [isAnnotationModalOpen, setIsAnnotationModalOpen] = useState(false);
  const [editingMarkedUpImage, setEditingMarkedUpImage] = useState<MarkedUpImage | undefined>(undefined);
  const [magnifyInitialPage, setMagnifyInitialPage] = useState<number | null>(null);

  // Define sensors. We're going back to a simpler config as we are
  // separating click and drag targets.
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // --- State for Modals ---
  const [editingMarkedUpImageId, setEditingMarkedUpImageId] = useState<string | null>(null);
  const [isImagePickerOpen, setIsImagePickerOpen] = useState(false);
  const [imagePickerPostId, setImagePickerPostId] = useState<number | null>(null);

  const [postPageMap, setPostPageMap] = useState<Record<number, {type: 'pdf' | 'marked', value: number | string}>>({});

  // AI Suggestions state
  const [pageSuggestions, setPageSuggestions] = useState<PageSuggestion[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [pageTexts, setPageTexts] = useState<string[]>([]);
  const [postImageSuggestions, setPostImageSuggestions] = useState<PostImageSuggestion[]>([]);
  
  // Tab control state
  const [selectedTabIndex, setSelectedTabIndex] = useState(0);
  
  // Navigation state
  const [currentView, setCurrentView] = useState<'main' | 'myThreads' | 'templates' | 'billing' | 'customPrompts' | 'profile'>('main');
  const [savedThreads, setSavedThreads] = useState<SavedThread[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  
  // Custom Prompts state
  const [customPrompts, setCustomPrompts] = useState<CustomPrompt[]>([]);
  const [selectedPromptId, setSelectedPromptId] = useState<string>('');
  const [isSavingPrompt, setIsSavingPrompt] = useState(false);
  const isLoadingPromptsRef = useRef(false);
  const [promptSortBy, setPromptSortBy] = useState<'name' | 'date'>('date');
  const [showNewPromptModal, setShowNewPromptModal] = useState(false);
  
  // User Profile state
  const [userProfile, setUserProfile] = useState(() => {
    // Load from localStorage if available
    if (typeof window !== 'undefined' && user?.uid) {
      const savedProfile = localStorage.getItem(`userProfile_${user.uid}`);
      if (savedProfile) {
        return JSON.parse(savedProfile);
      }
    }
    
    return {
      displayName: user?.displayName || '',
      username: user?.email?.split('@')[0] || '',
      twitterHandle: user?.email?.split('@')[0] || '',
      instagramHandle: user?.email?.split('@')[0] || '',
      avatar: null as string | null,
    };
  });
  
  // Twitter Preview settings
  const [twitterPreviewMode, setTwitterPreviewMode] = useState<'dark' | 'light'>('dark');
  
  // AI Reasoning Log state
  const [aiReasoningLogs, setAiReasoningLogs] = useState<string[]>([]);
  const [showReasoningLog, setShowReasoningLog] = useState(false);
  
  // Progress bar state
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Save user profile to localStorage whenever it changes
  useEffect(() => {
    if (user?.uid && typeof window !== 'undefined') {
      localStorage.setItem(`userProfile_${user.uid}`, JSON.stringify(userProfile));
    }
  }, [userProfile, user?.uid]);
  
  // Helper function to add AI reasoning logs
  const addReasoningLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = `[${timestamp}] ${message}`;
    setAiReasoningLogs(prev => [...prev, logEntry]);
  };
  
  // Clear reasoning logs
  const clearReasoningLogs = () => {
    setAiReasoningLogs([]);
  };
  
  // Auto-scroll to bottom of logs
  const logsEndRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [aiReasoningLogs]);
  
  const onDrop = (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file && file.type === "application/pdf") {
      setPdfFile(file);
      setExtractedText("");
      setGeneratedThread([]);
      setMarkedUpImages([]);
      setHighResPageImages([]);
      setPostPageMap({});
      setPostImageSuggestions([]);
      addReasoningLog(`📁 PDF uploaded: ${file.name} (${(file.size / 1024 / 1024).toFixed(1)}MB)`);
      toast.success("PDF loaded successfully!");
      extractTextFromPDF(file);
    } else {
      addReasoningLog("❌ Invalid file type - only PDF files are supported");
      toast.error("Please upload a valid PDF file.");
    }
  };
  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop });

  async function extractTextFromPDF(file: File) {
    setIsExtracting(true);
    addReasoningLog("🔍 Starting PDF analysis...");
    
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const arrayBuffer = e.target?.result as ArrayBuffer;
        addReasoningLog("📖 Loading PDF document...");
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        addReasoningLog(`📄 PDF loaded: ${pdf.numPages} pages detected`);
        
        let fullText = "";
        const images: string[] = [];
        const highResImages: string[] = [];
        const individualPageTexts: string[] = [];
        
        addReasoningLog("🖼️ Generating page thumbnails and extracting text...");
        
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          
          // Generate thumbnail for UI
          const thumbnailViewport = page.getViewport({ scale: 0.2 });
          const thumbnailCanvas = document.createElement("canvas");
          thumbnailCanvas.width = thumbnailViewport.width;
          thumbnailCanvas.height = thumbnailViewport.height;
          const thumbnailContext = thumbnailCanvas.getContext("2d");
          await page.render({ canvasContext: thumbnailContext!, viewport: thumbnailViewport }).promise;
          images.push(thumbnailCanvas.toDataURL("image/png"));
          
          // Generate high-resolution for editing (2x scale for crisp text)
          const highResViewport = page.getViewport({ scale: 2.0 });
          const highResCanvas = document.createElement("canvas");
          highResCanvas.width = highResViewport.width;
          highResCanvas.height = highResViewport.height;
          const highResContext = highResCanvas.getContext("2d");
          await page.render({ canvasContext: highResContext!, viewport: highResViewport }).promise;
          highResImages.push(highResCanvas.toDataURL("image/png"));
          
          // Extract text from page
          const pageText = await page.getTextContent();
          const pageTextString = pageText.items.map((item: any) => item.str).join(" ");
          individualPageTexts.push(pageTextString);
          fullText += pageTextString + "\n\n";
        }
        setPageImages(images);
        setHighResPageImages(highResImages);
        setExtractedText(fullText);
        setPageTexts(individualPageTexts);
        
        addReasoningLog(`✅ PDF processing complete: ${fullText.length} characters extracted`);
        addReasoningLog(`🎨 Generated ${images.length} page thumbnails`);
        addReasoningLog("🚀 Ready to generate thread - click 'Generate Thread' to continue");
        
        setIsExtracting(false);
      };
      reader.readAsArrayBuffer(file);
    } catch (error) {
      console.error("Error extracting PDF text:", error);
      toast.error("Failed to extract text from PDF.");
      setIsExtracting(false);
    }
  }

  const generatePageSuggestions = async () => {
    if (!pageTexts.length) {
      toast.error("No pages available for analysis. Please upload a PDF first.");
      return;
    }

    console.log('Starting page suggestions generation...', {
      pageTextsLength: pageTexts.length,
      customInstructions: customInstructions || 'none'
    });

    setSuggestionsLoading(true);
    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: "", // Not needed for suggestions only
          charLimit,
          numPosts,
          customInstructions,
          useEmojis,
          useNumbering,
          useHashtags,
          suggestPages: true,
          pageTexts: pageTexts,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.pageSuggestions) {
          setPageSuggestions(data.pageSuggestions);
          toast.success(`Found ${data.pageSuggestions.length} page suggestions!`);
        } else {
          toast.error("No page suggestions received from AI.");
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error("Page suggestions failed:", {
          status: response.status,
          statusText: response.statusText,
          error: errorData
        });
        toast.error("Failed to generate page suggestions.");
      }
    } catch (error) {
      console.error("Error generating page suggestions:", error);
      toast.error("An error occurred while generating page suggestions.");
    } finally {
      setSuggestionsLoading(false);
    }
  };

  const ensureAllPostsHaveSuggestions = (suggestions: PostImageSuggestion[], threadPosts: string[]): PostImageSuggestion[] => {
    const enhanced = [...suggestions];
    
    // Check each post index
    for (let i = 0; i < threadPosts.length; i++) {
      const existingSuggestion = enhanced.find(s => s.postIndex === i);
      
      if (!existingSuggestion || existingSuggestion.recommendedPages.length === 0) {
        // Create fallback suggestions for posts without any
        const fallbackPages = [];
        
        // Smart fallback logic
        for (let pageNum = 1; pageNum <= pageTexts.length; pageNum++) {
          let score = 25; // Base fallback score
          let reasoning = "General document page - available as fallback option";
          
          // Boost score for strategic pages
          if (i === 0 && pageNum === 1) {
            score = 65; // First post, first page (likely title)
            reasoning = "Title/cover page - good for introductory posts";
          } else if (pageNum === Math.ceil(pageTexts.length / 2)) {
            score = 35; // Middle pages often have substance
            reasoning = "Middle section - may contain key content";
          } else if (pageNum === pageTexts.length && pageTexts.length > 2) {
            score = 30; // Last page
            reasoning = "Final page - may contain conclusions or signatures";
          }
          
          fallbackPages.push({
            pageNumber: pageNum,
            relevanceScore: score,
            reasoning: reasoning,
            keyQuotes: [],
            confidence: score > 50 ? 'medium' : 'low' as 'high' | 'medium' | 'low'
          });
        }
        
        // Sort by score and take top 2-3
        fallbackPages.sort((a, b) => b.relevanceScore - a.relevanceScore);
        
        if (existingSuggestion) {
          // Add to existing suggestion
          existingSuggestion.recommendedPages = fallbackPages.slice(0, 2);
        } else {
          // Create new suggestion
          enhanced.push({
            postIndex: i,
            postText: threadPosts[i],
            recommendedPages: fallbackPages.slice(0, 2)
          });
        }
      }
    }
    
    return enhanced.sort((a, b) => a.postIndex - b.postIndex);
  };

  const generatePostImageSuggestions = async (threadPosts: string[]) => {
    if (!pageTexts.length) {
      addReasoningLog("⚠️ No pages available for image analysis");
      return;
    }

    setIsProcessing(true);
    addReasoningLog(`🎯 Analyzing ${threadPosts.length} posts against ${pageTexts.length} document pages`);
    addReasoningLog("🤖 AI is reading through each post to understand content themes...");
    addReasoningLog("📊 Matching semantic content between posts and document sections...");
    
    try {
      addReasoningLog("📡 Sending analysis request to AI...");
      
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          suggestPostImages: true,
          threadPosts,
          pageTexts,
          customInstructions
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      addReasoningLog("🧠 AI is examining document pages for relevance to each post...");
      const result = await response.json();
      
      if (result.postImageSuggestions) {
        addReasoningLog("✨ Processing AI recommendations and ensuring all posts have suggestions...");
        
        // Ensure every post has at least one suggestion
        const enhancedSuggestions = ensureAllPostsHaveSuggestions(result.postImageSuggestions, threadPosts);
        setPostImageSuggestions(enhancedSuggestions);
        
        addReasoningLog(`✅ Generated ${enhancedSuggestions.length} post-specific image recommendations`);
        addReasoningLog("🎨 Image suggestions are now available for each post!");
        addReasoningLog("👀 Check the Thread Editor tab to see recommended images for each post");
      } else {
        addReasoningLog("❌ No image suggestions received from AI");
      }
    } catch (error: any) {
      console.error("Error generating post-image suggestions:", error);
      addReasoningLog(`❌ Error generating image suggestions: ${error?.message || 'Unknown error'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  async function handleAnalyze() {
    if (!extractedText) {
      toast.error("No text extracted from PDF. Please upload a PDF first.");
      return;
    }
    
    // Clear previous logs and start fresh
    clearReasoningLogs();
    setIsAnalyzing(true);
    setIsProcessing(true);
    
    addReasoningLog("🚀 Starting thread generation process...");
    addReasoningLog(`📄 Analyzing ${extractedText.length} characters of extracted text`);
    addReasoningLog(`⚙️ Target: ${numPosts} posts, ${charLimit} character limit`);
    
    try {
      addReasoningLog("📡 Sending document to Claude AI for analysis...");
      
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          text: extractedText,
          numPosts: numPosts,
          charLimit: charLimit,
          customInstructions,
          useEmojis,
          useHashtags,
          useNumbering
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      addReasoningLog("🤖 Claude is reading and understanding the document...");
      addReasoningLog("✍️ Generating engaging social media posts...");

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("Failed to get response reader");
      }

      let receivedLength = 0;
      let chunks = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        receivedLength += value.length;
      }

      let chunksAll = new Uint8Array(receivedLength);
      let position = 0;
      for (let chunk of chunks) {
        chunksAll.set(chunk, position);
        position += chunk.length;
      }

      addReasoningLog("📝 Processing AI response...");
      const resultText = new TextDecoder("utf-8").decode(chunksAll);
      const posts = JSON.parse(resultText);

      if (!posts || !Array.isArray(posts.thread)) {
        console.error("API response is not in the expected format: ", posts);
        addReasoningLog("❌ AI returned unexpected response format");
        toast.error("The AI returned an unexpected response format. Please try again.");
        return;
      }

      addReasoningLog(`✅ Thread generated successfully with ${posts.thread.length} posts`);
      
      const newThread = posts.thread.map((postText: string, index: number) => ({
        id: index + 1,
        text: postText,
      }));
      
      setGeneratedThread(newThread);
      toast.success("Thread analyzed and generated successfully!");
      
      addReasoningLog("📊 Recording usage analytics...");
      
      // Track usage
      if (user) {
        try {
          await incrementThreadUsage(user.uid);
        } catch (error) {
          console.error("Error tracking usage:", error);
        }
      }
      
      // Automatically generate post-specific image suggestions
      if (pageTexts.length > 0) {
        addReasoningLog("🔄 Starting intelligent image suggestion analysis...");
        addReasoningLog("🧠 AI will now match post content to relevant document sections");
        generatePostImageSuggestions(posts.thread);
      } else {
        addReasoningLog("⚠️ No document pages available for image suggestions");
      }
      
      addReasoningLog("🎉 Thread generation complete! Switching to editor view...");
      setSelectedTabIndex(1); // Automatically switch to Thread Editor tab
    } catch (error: any) {
      console.error("Analysis failed:", error);
      addReasoningLog(`❌ Analysis failed: ${error?.message || 'Unknown error'}`);
      toast.error("Failed to analyze the document.");
    } finally {
      setIsAnalyzing(false);
      setIsProcessing(false);
    }
  }

  const startEditing = (post: ThreadPost) => {
    setEditingPostId(post.id);
    setEditingText(post.text);
  };

  const saveEdit = () => {
    setGeneratedThread(
      generatedThread.map((p) =>
        p.id === editingPostId ? { ...p, text: editingText } : p
      )
    );
    setEditingPostId(null);
    setEditingText("");
    toast.success("Post updated!");
  };

  const cancelEdit = () => {
    setEditingPostId(null);
    setEditingText("");
  };

  const deletePost = (postId: number) => {
    setGeneratedThread(generatedThread.filter((p) => p.id !== postId));
  };

  const addPost = () => {
    const newId = generatedThread.length > 0 ? Math.max(...generatedThread.map(p => p.id)) + 1 : 1;
    const newPost = { id: newId, text: "" };
    setGeneratedThread([...generatedThread, newPost]);
    startEditing(newPost);
  };

  function handleDragStart(event: DragStartEvent) {
    const { active } = event;
    setActiveId(active.id as string);
    if (active.data.current?.type === 'post') {
      setActiveItem(active.data.current.post);
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (over && active.id !== over.id) {
       if (active.data.current?.type === 'post') {
        setGeneratedThread((items) => {
          const oldIndex = items.findIndex(item => item.id === Number(active.id));
          const newIndex = items.findIndex(item => item.id === Number(over.id));
          if (oldIndex === -1 || newIndex === -1) {
            return items;
          }
          return arrayMove(items, oldIndex, newIndex);
        });
      }
    }
    setActiveId(null);
    setActiveItem(null);
  }

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Post content copied to clipboard!");
  };

  const handleCopyAll = () => {
    const allTweets = generatedThread.map((post, index) => `Tweet ${index + 1}/${generatedThread.length}\n${post.text}`).join('\n\n');
    navigator.clipboard.writeText(allTweets);
    toast.success("Entire thread copied to clipboard!");
  };

  const testFirebaseConnection = async () => {
    console.log("=== FIREBASE CONNECTION TEST ===");
    
    if (!user) {
      toast.error("Please sign in first");
      return;
    }
    
    try {
      console.log("Testing simple Firestore write...");
      const { firestore } = await import('./lib/firebase');
      const { collection, addDoc, serverTimestamp } = await import('firebase/firestore');
      
      const testData = {
        userId: user.uid,
        testMessage: "Hello from Threadifier!",
        timestamp: serverTimestamp()
      };
      
      console.log("Writing test document...", testData);
      
      const testRef = collection(firestore, 'test');
      const docRef = await addDoc(testRef, testData);
      
      console.log("Test document written successfully with ID:", docRef.id);
      toast.success("Firebase connection test successful!");
      
    } catch (error: any) {
      console.error("Firebase connection test failed:", error);
      console.error("Error code:", error?.code);
      console.error("Error message:", error?.message);
      toast.error(`Firebase test failed: ${error?.message || 'Unknown error'}`);
    }
  };

  const handleSaveDraft = async () => {
    console.log("=== SAVE DRAFT START ===");
    addReasoningLog("💾 Saving thread as draft...");
    
    if (!user) {
      toast.error("Please sign in first");
      return;
    }
    
    if (generatedThread.length === 0) {
      toast.error("Please generate a thread first");
      return;
    }

    setIsSaving(true);
    setIsProcessing(true);
    
    try {
      const threadTitle = generatedThread[0]?.text.substring(0, 50) + "..." || "Untitled Thread";
      
      addReasoningLog("📤 Uploading images to cloud storage...");
      
      // Upload images to Firebase Storage to avoid document size limits
      let uploadedPageImages: string[] = [];
      let uploadedMarkedUpImages: typeof markedUpImages = [];
      
      try {
        // Upload page images if they exist
        if (pageImages.length > 0) {
          addReasoningLog(`📷 Uploading ${pageImages.length} page images...`);
          uploadedPageImages = await uploadImagesToStorage(pageImages, user.uid);
        }
        
        // Upload marked up images if they exist  
        if (markedUpImages.length > 0) {
          addReasoningLog(`🎨 Uploading ${markedUpImages.length} annotated images...`);
          uploadedMarkedUpImages = await uploadMarkedUpImagesToStorage(markedUpImages, user.uid);
        }
        
        addReasoningLog("✅ All images uploaded successfully!");
      } catch (uploadError) {
        console.error("Error uploading images:", uploadError);
        addReasoningLog("⚠️ Some images failed to upload, saving thread without images...");
        // Continue saving without images rather than failing completely
      }
      
      addReasoningLog("💾 Saving thread to database...");
      
      const threadId = await saveThread({
        userId: user.uid,
        title: threadTitle,
        posts: generatedThread,
        customInstructions,
        settings: {
          charLimit,
          numPosts,
          useEmojis,
          useHashtags,
          useNumbering
        },
        status: 'draft',
        originalPdfName: pdfFile?.name,
        // Use uploaded image URLs instead of base64 data
        postPageMap,
        markedUpImages: uploadedMarkedUpImages,
        pageImages: uploadedPageImages
      });
      
      addReasoningLog(`✅ Thread saved successfully as draft (ID: ${threadId.substring(0, 8)}...)`);
      toast.success("Thread saved as draft!");
      
      // Refresh the threads list
      await loadUserThreads();
      
    } catch (error: any) {
      console.error("=== SAVE DRAFT ERROR ===");
      console.error("Error saving thread:", error);
      
      if (error?.message?.includes('maximum allowed size')) {
        addReasoningLog("❌ Thread too large for database - please reduce image count");
        toast.error('Thread too large! Please reduce the number of images.');
      } else if (error?.code === 'permission-denied') {
        toast.error('Firebase permissions error. Please check your connection.');
      } else {
        addReasoningLog(`❌ Save failed: ${error?.message || 'Unknown error'}`);
        toast.error(`Failed to save thread: ${error?.message || 'Unknown error'}`);
      }
    } finally {
      setIsSaving(false);
      setIsProcessing(false);
    }
  };

  const loadUserThreads = async () => {
    if (!user) return;
    
    try {
      console.log("Loading user threads for:", user.uid);
      const threads = await getUserThreads(user.uid);
      console.log("Loaded threads:", threads);
      setSavedThreads(threads);
    } catch (error) {
      console.error("Error loading threads:", error);
      toast.error("Failed to load threads");
    }
  };

  // Custom Prompts functions
  const loadCustomPrompts = async () => {
    if (!user || isLoadingPromptsRef.current) return;
    
    isLoadingPromptsRef.current = true;
    try {
      addReasoningLog("📝 Loading custom prompts...");
      const prompts = await getUserCustomPrompts(user.uid);
      setCustomPrompts(prompts);
      addReasoningLog(`✅ Loaded ${prompts.length} custom prompts`);
    } catch (error) {
      console.error("Error loading custom prompts:", error);
      toast.error("Failed to load custom prompts");
    } finally {
      isLoadingPromptsRef.current = false;
    }
  };

  const saveCurrentPrompt = async () => {
    if (!user) {
      toast.error("Please sign in first");
      return;
    }
    
    if (!customInstructions.trim()) {
      toast.error("Enter some custom instructions first");
      return;
    }

    setIsSavingPrompt(true);
    addReasoningLog("💾 Saving current prompt...");

    try {
      const promptName = `Custom Prompt ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`;
      
      const promptId = await saveCustomPrompt({
        userId: user.uid,
        name: promptName,
        instructions: customInstructions,
        settings: {
          charLimit,
          numPosts,
          useEmojis,
          useHashtags,
          useNumbering
        },
        isDefault: false
      });

      addReasoningLog(`✅ Prompt saved: "${promptName}"`);
      toast.success("Prompt saved successfully!");
      
      // Reload prompts to show the new one
      loadCustomPrompts();
      
      // Set as selected
      setSelectedPromptId(promptId);
    } catch (error) {
      console.error("Error saving prompt:", error);
      addReasoningLog("❌ Failed to save prompt");
      toast.error("Failed to save prompt");
    } finally {
      setIsSavingPrompt(false);
    }
  };

  const applySelectedPrompt = (promptId: string) => {
    const prompt = customPrompts.find(p => p.id === promptId);
    if (!prompt) return;

    setCustomInstructions(prompt.instructions);
    setCharLimit(prompt.settings.charLimit);
    setNumPosts(prompt.settings.numPosts);
    setUseEmojis(prompt.settings.useEmojis);
    setUseHashtags(prompt.settings.useHashtags);
    setUseNumbering(prompt.settings.useNumbering);
    setSelectedPromptId(promptId);

    addReasoningLog(`🎯 Applied prompt: "${prompt.name}"`);
    toast.success(`Applied prompt: ${prompt.name}`);
  };

  // Sort prompts helper function
  const getSortedPrompts = () => {
    return [...customPrompts].sort((a, b) => {
      if (promptSortBy === 'name') {
        return a.name.localeCompare(b.name);
      } else {
        const timeA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
        const timeB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
        return timeB - timeA; // Newest first
      }
    });
  };

  // Create new prompt from modal
  const createNewPrompt = async (name: string, instructions: string, settings: any) => {
    if (!user) {
      toast.error("Please sign in first");
      return;
    }

    try {
      const promptId = await saveCustomPrompt({
        userId: user.uid,
        name,
        instructions,
        settings,
        isDefault: false
      });

      toast.success("Prompt created successfully!");
      loadCustomPrompts();
      setShowNewPromptModal(false);
    } catch (error) {
      console.error("Error creating prompt:", error);
      toast.error("Failed to create prompt");
    }
  };

  // Load custom prompts when user changes
  useEffect(() => {
    if (user) {
      loadCustomPrompts();
    } else {
      setCustomPrompts([]);
    }
  }, [user]);

  // Save profile to localStorage whenever it changes
  useEffect(() => {
    if (user?.uid && typeof window !== 'undefined') {
      localStorage.setItem(`userProfile_${user.uid}`, JSON.stringify(userProfile));
    }
  }, [userProfile, user?.uid]);

  // Update profile when user changes
  useEffect(() => {
    if (user?.uid) {
      const savedProfile = localStorage.getItem(`userProfile_${user.uid}`);
      if (savedProfile) {
        setUserProfile(JSON.parse(savedProfile));
      } else {
        // Initialize with user data if no saved profile
        setUserProfile({
          displayName: user?.displayName || '',
          username: user?.email?.split('@')[0] || '',
          twitterHandle: user?.email?.split('@')[0] || '',
          instagramHandle: user?.email?.split('@')[0] || '',
          avatar: null,
        });
      }
    }
  }, [user]);

  // AuthDisplay component with access to state
  const AuthDisplay = () => {
    if (!user) {
      return <Link href="/login" className="btn-primary">Login</Link>;
    }

    return (
      <div className="flex items-center gap-6">
        {/* Navigation Links */}
        <nav className="hidden md:flex items-center gap-4">
          <button 
            onClick={() => setCurrentView('main')}
            className={`text-sm transition-colors ${currentView === 'main' ? 'text-blue-600 font-medium' : 'text-gray-600 hover:text-gray-900'}`}
          >
            Home
          </button>
          <button 
            onClick={() => {
              setCurrentView('myThreads');
              loadUserThreads();
            }}
            className={`text-sm transition-colors ${currentView === 'myThreads' ? 'text-blue-600 font-medium' : 'text-gray-600 hover:text-gray-900'}`}
          >
            My Threads
          </button>
          <button 
            onClick={() => {
              setCurrentView('customPrompts');
              loadCustomPrompts();
            }}
            className={`text-sm transition-colors ${currentView === 'customPrompts' ? 'text-blue-600 font-medium' : 'text-gray-600 hover:text-gray-900'}`}
          >
            Custom Prompts
          </button>
          <button 
            onClick={() => setCurrentView('templates')}
            className={`text-sm transition-colors ${currentView === 'templates' ? 'text-blue-600 font-medium' : 'text-gray-600 hover:text-gray-900'}`}
          >
            Templates
          </button>
          <button 
            onClick={() => setCurrentView('billing')}
            className={`text-sm transition-colors ${currentView === 'billing' ? 'text-blue-600 font-medium' : 'text-gray-600 hover:text-gray-900'}`}
          >
            Billing
          </button>
          <button 
            onClick={() => setCurrentView('profile')}
            className={`text-sm transition-colors ${currentView === 'profile' ? 'text-blue-600 font-medium' : 'text-gray-600 hover:text-gray-900'}`}
          >
            Profile
          </button>
        </nav>
        
        {/* User Profile */}
        <button 
          onClick={() => setCurrentView('profile')}
          className="flex items-center gap-3 hover:bg-gray-50 rounded-lg p-2 transition-colors"
        >
          <div className="h-8 w-8 bg-blue-600 rounded-full flex items-center justify-center">
            {userProfile.avatar ? (
              <img src={userProfile.avatar} alt="Profile" className="w-full h-full rounded-full object-cover" />
            ) : (
              <span className="text-white text-sm font-medium">
                {userProfile.displayName?.charAt(0)?.toUpperCase() || user.displayName?.charAt(0)?.toUpperCase() || user.email?.charAt(0)?.toUpperCase() || 'U'}
              </span>
            )}
          </div>
          <div className="hidden sm:block text-left">
            <p className="text-sm font-medium text-gray-900">{userProfile.displayName || user.displayName || user.email}</p>
            <p className="text-xs text-gray-500">@{userProfile.twitterHandle}</p>
          </div>
        </button>
      </div>
    );
  };

  // --- Modal Handlers ---

  const handleEditMarkedUpImage = (id: string) => {
    const imageToEdit = markedUpImages.find(img => img.id === id);
    if (imageToEdit) {
      setEditingMarkedUpImage(imageToEdit);
      setMagnifyInitialPage(imageToEdit.pageNumber - 1);
      setIsAnnotationModalOpen(true);
    }
  };

  const closeMagnify = () => {
    setIsAnnotationModalOpen(false);
    setEditingMarkedUpImage(undefined);
    setMagnifyInitialPage(null);
  };

  const handleSaveMarkedUpImage = (url: string, json: any) => {
    if (editingMarkedUpImage) {
      // Update existing marked-up image
      setMarkedUpImages(prev => prev.map(img => 
        img.id === editingMarkedUpImage.id ? { ...img, url, json } : img
      ));
    } else if (magnifyInitialPage !== null) {
      // Create new marked-up image from a page
      const newId = uuidv4();
      const newImage: MarkedUpImage = {
        id: newId,
        pageNumber: magnifyInitialPage + 1,
        url,
        json,
      };
      setMarkedUpImages(prev => [...prev, newImage]);
    }
    closeMagnify();
  };
  
  const handleCrop = (croppedImageUrl: string) => {
    if (magnifyInitialPage !== null) {
      const newId = uuidv4();
      const newImage: MarkedUpImage = {
        id: newId,
        pageNumber: magnifyInitialPage + 1,
        url: croppedImageUrl,
        json: null, // Cropped images don't have fabric.js data
      };
      setMarkedUpImages(prev => [...prev, newImage]);
    } else if (editingMarkedUpImage) {
        // If cropping an existing markup, we create a new one based on it
        const newId = uuidv4();
        const newImage: MarkedUpImage = {
          id: newId,
          pageNumber: editingMarkedUpImage.pageNumber,
          url: croppedImageUrl,
          json: null,
        };
        setMarkedUpImages(prev => [...prev, newImage]);
    }
    closeMagnify();
  };

  const handleDeleteMarkedUpImage = (id: string) => {
    setMarkedUpImages(prev => prev.filter(img => img.id !== id));
    // Also remove from any posts that might be using it
    setPostPageMap(currentMap => {
      const newMap = {...currentMap};
      Object.entries(newMap).forEach(([postId, imageInfo]) => {
        if (imageInfo.type === 'marked' && imageInfo.value === id) {
          delete newMap[Number(postId)];
        }
      });
      return newMap;
    })
    toast.success("Markup deleted.");
  };

  const handleOpenImagePicker = (postId: number) => {
    setImagePickerPostId(postId);
    setIsImagePickerOpen(true);
  };

  const handleCloseImagePicker = () => {
    setIsImagePickerOpen(false);
    setImagePickerPostId(null);
  };

  const handleSelectPage = (type: 'pdf' | 'marked', value: number | string) => {
    if (imagePickerPostId !== null) {
      setPostPageMap({ ...postPageMap, [imagePickerPostId]: { type, value } });
    }
    handleCloseImagePicker();
  };

  const handleClearImage = (postId: number) => {
    const newMap = { ...postPageMap };
    delete newMap[postId];
    setPostPageMap(newMap);
  };

  // Render different views based on currentView state
  const renderMainView = () => (
    <main className="p-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* --- Left Column: PDF & Controls --- */}
        <div className="lg:col-span-4 space-y-6">
          <div
            {...getRootProps()}
            className={`p-6 border-2 border-dashed rounded-lg text-center cursor-pointer transition-colors ${
              isDragActive ? "border-primary-600 bg-primary-50" : "border-legal-300 bg-white hover:bg-legal-50"
            }`}
          >
            <input {...getInputProps()} />
            <div className="flex flex-col items-center justify-center min-h-[80px] gap-2">
              {isExtracting ? (
                <>
                  <Loader2 className="animate-spin h-8 w-8 text-primary-600" />
                  <span className="text-legal-600">Analyzing PDF...</span>
                </>
              ) : pdfFile ? (
                <>
                  <CheckCircle className="h-8 w-8 text-green-600" />
                  <span className="text-legal-700">Loaded: <span className="font-semibold">{pdfFile.name}</span></span>
                </>
              ) : (
                <>
                  <DownloadCloud className="h-8 w-8 text-legal-400" />
                  <span className="text-legal-600">Drop a PDF here, or click to select a file</span>
                </>
              )}
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow-sm border border-legal-200">
            <h2 className="text-xl font-bold text-legal-800 mb-4">Customize Thread</h2>
            
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label htmlFor="charLimit" className="block text-sm font-medium text-legal-700">Char Limit</label>
                <input id="charLimit" type="number" value={charLimit} onChange={e => setCharLimit(Number(e.target.value))} className="input-field mt-1" />
              </div>
              <div>
                <label htmlFor="numPosts" className="block text-sm font-medium text-legal-700">Number of Posts</label>
                <input id="numPosts" type="number" value={numPosts} onChange={e => setNumPosts(Number(e.target.value))} className="input-field mt-1" />
              </div>
            </div>

            <div className="mb-4">
              <label htmlFor="customInstructions" className="block text-sm font-bold text-legal-700 mb-2">Custom Instructions</label>
              
              {/* Custom Prompts Controls */}
              <div className="flex items-center gap-2 mb-3">
                {/* Custom Prompts Dropdown */}
                <select
                  value={selectedPromptId}
                  onChange={(e) => {
                    if (e.target.value) {
                      applySelectedPrompt(e.target.value);
                    } else {
                      setSelectedPromptId('');
                      setCustomInstructions('');
                    }
                  }}
                  className="flex-1 text-sm border border-gray-300 rounded px-3 py-2 text-gray-700 bg-white"
                >
                  <option value="">Select a saved prompt...</option>
                  {customPrompts.map((prompt) => (
                    <option key={prompt.id} value={prompt.id}>
                      {prompt.name}
                    </option>
                  ))}
                </select>
                
                {/* Save Prompt Button */}
                <button
                  onClick={saveCurrentPrompt}
                  disabled={isSavingPrompt || !customInstructions.trim()}
                  className="text-sm bg-blue-50 hover:bg-blue-100 text-blue-700 px-3 py-2 rounded border border-blue-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  title="Save current prompt"
                >
                  {isSavingPrompt ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  Save
                </button>
              </div>
              <textarea 
                id="customInstructions"
                value={customInstructions}
                onChange={e => {
                  setCustomInstructions(e.target.value);
                  // Clear selection if user manually edits
                  if (selectedPromptId && customPrompts.find(p => p.id === selectedPromptId)?.instructions !== e.target.value) {
                    setSelectedPromptId('');
                  }
                }}
                placeholder="Enter detailed instructions for the AI. You can include examples, rules, tone preferences, and specific formatting requirements. For example:

'Act as a legal expert explaining complex cases to a general audience. Use clear, accessible language while maintaining accuracy. Structure each post with a hook, key facts, and implications. Include relevant legal terminology with brief explanations. Focus on the human impact and broader significance of the case.'"
                className="input-field mt-1 w-full"
                rows={6}
              />
            </div>

            <div className="flex justify-between items-center mb-4">
              <span className="text-sm font-medium text-legal-700">Use Emojis</span>
              <Switch checked={useEmojis} onChange={setUseEmojis} className={`${useEmojis ? 'bg-primary-600' : 'bg-gray-200'} relative inline-flex h-6 w-11 items-center rounded-full transition-colors`}>
                <span className={`${useEmojis ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}/>
              </Switch>
            </div>
            <div className="flex justify-between items-center mb-4">
              <span className="text-sm font-medium text-legal-700">Use Hashtags</span>
              <Switch checked={useHashtags} onChange={setUseHashtags} className={`${useHashtags ? 'bg-primary-600' : 'bg-gray-200'} relative inline-flex h-6 w-11 items-center rounded-full transition-colors`}>
                <span className={`${useHashtags ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}/>
              </Switch>
            </div>
             <div className="flex justify-between items-center mb-4">
              <span className="text-sm font-medium text-legal-700">Use Numbering</span>
              <Switch checked={useNumbering} onChange={setUseNumbering} className={`${useNumbering ? 'bg-primary-600' : 'bg-gray-200'} relative inline-flex h-6 w-11 items-center rounded-full transition-colors`}>
                <span className={`${useNumbering ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}/>
              </Switch>
            </div>

            <button
              onClick={handleAnalyze}
              disabled={isAnalyzing || isExtracting || !pdfFile}
              className="btn-primary w-full disabled:bg-opacity-50"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="animate-spin mr-2" />
                  Generating...
                </>
              ) : (
                "Generate Thread"
              )}
            </button>
          </div>

          {/* AI Activity Log - Claude Code Style */}
          <div className="bg-white rounded-lg shadow-sm border border-legal-200">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${isAnalyzing ? 'bg-green-400 animate-pulse' : 'bg-gray-400'}`}></div>
                <h3 className="font-medium text-gray-900">Activity Log</h3>
              </div>
              {aiReasoningLogs.length > 0 && (
                <button
                  onClick={clearReasoningLogs}
                  className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
            
            <div className="h-64 overflow-y-auto p-3 bg-gray-50 font-mono text-xs">
              {aiReasoningLogs.length === 0 ? (
                <div className="text-gray-500 italic">
                  Activity will appear here during processing...
                  <br />
                  <br />
                  • Upload a PDF to begin
                  <br />
                  • Generate thread to see AI analysis
                  <br />
                  • Watch real-time processing steps
                </div>
              ) : (
                <div className="space-y-1">
                  {aiReasoningLogs.map((log, index) => (
                    <div 
                      key={index} 
                      className="text-gray-700 leading-relaxed border-l-2 border-blue-400 pl-2 py-1"
                    >
                      {log}
                    </div>
                  ))}
                  {isAnalyzing && (
                    <div className="flex items-center gap-2 text-blue-600 border-l-2 border-green-400 pl-2 py-1">
                      <div className="w-1 h-1 bg-green-400 rounded-full animate-pulse"></div>
                      <span>Processing...</span>
                    </div>
                  )}
                  <div ref={logsEndRef} />
                </div>
              )}
            </div>
          </div>

        </div>

        {/* --- Right Column: Tabbed View for Document and Thread --- */}
        <div className="lg:col-span-8">
          <Tab.Group selectedIndex={selectedTabIndex} onChange={setSelectedTabIndex}>
            <Tab.List className="flex space-x-1 rounded-xl bg-blue-900/20 p-1 mb-4">
              <Tab className={({ selected }) =>
                `w-full rounded-lg py-2.5 text-sm font-medium leading-5 text-blue-700
                ring-white ring-opacity-60 ring-offset-2 ring-offset-blue-400 focus:outline-none focus:ring-2
                ${selected ? 'bg-white shadow' : 'text-blue-100 hover:bg-white/[0.12] hover:text-white'}`
              }>
                Document & Exhibits
              </Tab>
              <Tab className={({ selected }) =>
                `w-full rounded-lg py-2.5 text-sm font-medium leading-5 text-blue-700
                ring-white ring-opacity-60 ring-offset-2 ring-offset-blue-400 focus:outline-none focus:ring-2
                ${selected ? 'bg-white shadow' : 'text-blue-100 hover:bg-white/[0.12] hover:text-white'}`
              }>
                Thread Editor
              </Tab>
              <Tab className={({ selected }) =>
                `w-full rounded-lg py-2.5 text-sm font-medium leading-5 text-blue-700
                ring-white ring-opacity-60 ring-offset-2 ring-offset-blue-400 focus:outline-none focus:ring-2
                ${selected ? 'bg-white shadow' : 'text-blue-100 hover:bg-white/[0.12] hover:text-white'}`
              }>
                AI Suggestions
              </Tab>
              <Tab className={({ selected }) =>
                `w-full rounded-lg py-2.5 text-sm font-medium leading-5 text-blue-700
                ring-white ring-opacity-60 ring-offset-2 ring-offset-blue-400 focus:outline-none focus:ring-2 flex items-center gap-2
                ${selected ? 'bg-white shadow' : 'text-blue-100 hover:bg-white/[0.12] hover:text-white'}`
              }>
                <Twitter className="w-4 h-4" />
                Twitter Preview
              </Tab>
            </Tab.List>
            <Tab.Panels className="mt-2">
              <Tab.Panel className="rounded-xl bg-white p-3 ring-white ring-opacity-60 ring-offset-2 ring-offset-blue-400 focus:outline-none focus:ring-2">
                 <div className="space-y-6">
                    {/* Source Document Pages */}
                    <div >
                      <h2 className="text-xl font-bold text-legal-800 mb-4">Source Document Pages</h2>
                      <div className="grid grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4 max-h-[60vh] overflow-y-auto p-2 bg-slate-100 rounded-lg">
                        {pageImages.map((img, index) => (
                          <div key={`page-${index}`} className="group relative border border-legal-200 rounded-lg overflow-hidden">
                            <img src={img} alt={`Page ${index + 1}`} className="w-full h-auto object-contain" />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <button onClick={() => { setMagnifyInitialPage(index); setIsAnnotationModalOpen(true); }} className="p-2 bg-white/80 rounded-full text-legal-700 hover:bg-white hover:text-primary-600 backdrop-blur-sm" title="Edit Page">
                                <Edit className="w-5 h-5" />
                              </button>
                            </div>
                             <div className="absolute bottom-0 w-full bg-black/50 text-white text-xs text-center py-0.5">
                                Page {index + 1}
                              </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    {/* Marked-up Images */}
                    <div>
                      <h2 className="text-xl font-bold text-legal-800 mb-4">Marked-up Images</h2>
                      {markedUpImages.length === 0 ? (
                        <p className="text-legal-500 text-sm text-center py-4 bg-slate-100 rounded-lg">No images created yet. Edit a page to create a markup or crop.</p>
                      ) : (
                      <div className="grid grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4 max-h-[60vh] overflow-y-auto p-2 bg-slate-100 rounded-lg">
                        {markedUpImages.map((img) => (
                          <div key={img.id} className="group relative border border-legal-200 rounded-lg overflow-hidden">
                            <img src={img.url} alt={`Markup ${img.id}`} className="w-full h-auto object-contain" />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                              <button onClick={() => handleEditMarkedUpImage(img.id)} className="p-2 bg-white/80 rounded-full text-legal-700 hover:bg-white hover:text-primary-600 backdrop-blur-sm" title="Edit Markup">
                                <Edit className="w-5 h-5" />
                              </button>
                                <button onClick={() => handleDeleteMarkedUpImage(img.id)} className="p-2 bg-white/80 rounded-full text-red-500 hover:bg-white backdrop-blur-sm" title="Delete Markup">
                                <Trash2 className="w-5 h-5" />
                              </button>
                            </div>
                             <div className="absolute bottom-0 w-full bg-black/50 text-white text-xs text-center py-0.5">
                                Image (from page {img.pageNumber})
                              </div>
                          </div>
                        ))}
                      </div>
                      )}
                    </div>

                    {/* Extracted Text */}
                    {extractedText && (
                      <div>
                        <h2 className="text-xl font-bold text-legal-800 mb-4">Extracted Text</h2>
                        <textarea
                          className="w-full h-64 p-2 border border-legal-200 rounded-md bg-legal-50 font-mono text-xs"
                          value={extractedText}
                          readOnly
                          placeholder="Text extracted from the PDF will appear here."
                        />
                      </div>
                    )}
                 </div>
              </Tab.Panel>
              <Tab.Panel className="rounded-xl bg-white p-3 ring-white ring-opacity-60 ring-offset-2 ring-offset-blue-400 focus:outline-none focus:ring-2">
                 <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                  >
                    <div className="bg-white p-6 rounded-lg shadow-sm border border-legal-200">
                      <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-bold text-legal-800">Generated Thread</h2>
                        <div className="flex gap-2">
                          <button onClick={addPost} className="btn-secondary flex items-center"><PlusCircle className="w-4 h-4 mr-1"/>Add Post</button>
                          <button 
                            onClick={() => {
                              if (generatedThread.length > 0) {
                                addReasoningLog("🔄 Manually generating fresh image suggestions...");
                                generatePostImageSuggestions(generatedThread.map(p => p.text));
                              } else {
                                toast.error("Generate a thread first to get image suggestions");
                              }
                            }}
                            disabled={isAnalyzing || !pageTexts.length}
                            className="btn-secondary flex items-center bg-purple-50 hover:bg-purple-100 border-purple-200 text-purple-700 disabled:opacity-50"
                          >
                            <ImageIcon className="w-4 h-4 mr-1"/>
                            Get Image Ideas
                          </button>
                          <button 
                            onClick={handleSaveDraft} 
                            disabled={isSaving}
                            className="btn-secondary flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isSaving ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-1 animate-spin"/>
                                Saving...
                              </>
                            ) : (
                              <>
                                <BookOpen className="w-4 h-4 mr-1"/>
                                Save Draft
                              </>
                            )}
                          </button>
                          <button onClick={handleCopyAll} className="btn-secondary flex items-center"><CopyIcon className="w-4 h-4 mr-1"/>Copy All</button>
                        </div>
                      </div>
                    
                      <SortableContext
                        items={generatedThread.map(p => p.id.toString())}
                        strategy={verticalListSortingStrategy}
                      >
                        <div className="space-y-4">
                          {generatedThread.map((post, index) => (
                            <div key={post.id}>
                              <SortableThreadRow
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
                                handleCopy={handleCopy}
                                pageImages={pageImages}
                                markedUpImages={markedUpImages}
                                postPageMap={postPageMap}
                                handleClearImage={handleClearImage}
                                onAddImage={handleOpenImagePicker}
                              />
                              
                              {/* Post-specific image suggestions */}
                              {postImageSuggestions.find(suggestion => suggestion.postIndex === index) && (
                                <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center space-x-2">
                                      <ImageIcon className="h-4 w-4 text-blue-600" />
                                      <span className="text-sm font-medium text-blue-900">AI Recommended Images</span>
                                    </div>
                                    <span className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded">
                                      {postImageSuggestions.find(s => s.postIndex === index)?.recommendedPages.length || 0} suggestions
                                    </span>
                                  </div>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                    {postImageSuggestions
                                      .find(suggestion => suggestion.postIndex === index)
                                      ?.recommendedPages.filter(rec => rec.relevanceScore >= 10).slice(0, 6)
                                      .map((recommendation, recIndex) => (
                                        <div 
                                          key={recIndex}
                                          className="flex items-center space-x-2 p-2 bg-white rounded border hover:border-blue-300 cursor-pointer"
                                          onClick={() => {
                                            setMagnifyInitialPage(recommendation.pageNumber - 1);
                                            setIsAnnotationModalOpen(true);
                                          }}
                                        >
                                          <img 
                                            src={pageImages[recommendation.pageNumber - 1]} 
                                            alt={`Page ${recommendation.pageNumber}`}
                                            className="w-8 h-10 object-cover rounded border"
                                          />
                                          <div className="flex-1 min-w-0">
                                            <div className="text-xs font-medium text-gray-900">
                                              Page {recommendation.pageNumber}
                                            </div>
                                            <div className={`text-xs font-medium ${
                                              recommendation.relevanceScore >= 80 ? 'text-green-600' :
                                              recommendation.relevanceScore >= 60 ? 'text-blue-600' :
                                              recommendation.relevanceScore >= 40 ? 'text-yellow-600' :
                                              'text-orange-600'
                                            }`}>
                                              {recommendation.relevanceScore}% {
                                                recommendation.relevanceScore >= 80 ? '🎯' :
                                                recommendation.relevanceScore >= 60 ? '✅' :
                                                recommendation.relevanceScore >= 40 ? '⚡' :
                                                '💡'
                                              }
                                            </div>
                                            <div className="text-xs text-gray-500 truncate">
                                              {recommendation.reasoning}
                                            </div>
                                          </div>
                                        </div>
                                      ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </SortableContext>
                    </div>
                    
                    <DragOverlay>
                      {activeId && activeItem ? (
                        <div className="grid grid-cols-2 gap-4 items-start">
                            <div className="bg-white p-4 rounded-lg shadow-lg border border-legal-200 h-full">
                              <SortablePostItem 
                                post={activeItem} 
                                index={generatedThread.findIndex(p => p.id === Number(activeId))} 
                                generatedThread={generatedThread}
                                dragHandleListeners={{}}
                                setDragHandleRef={() => {}}
                                startEditing={() => {}} deletePost={() => {}} editingPostId={null} editingText="" setEditingText={() => {}} saveEdit={() => {}} cancelEdit={() => {}} handleCopy={() => {}}
                              />
                            </div>
                            <div className="bg-legal-50/50 p-4 rounded-lg flex items-center justify-center text-legal-500 h-full border-2 border-dashed border-legal-300">
                              <ImageIcon className="w-8 h-8 mx-auto text-legal-400" />
                            </div>
                        </div>
                      ) : null}
                    </DragOverlay>

                  </DndContext>
              </Tab.Panel>
              <Tab.Panel className="rounded-xl bg-white p-3 ring-white ring-opacity-60 ring-offset-2 ring-offset-blue-400 focus:outline-none focus:ring-2">
                <div className="space-y-6">
                  {/* Generate Suggestions Button */}
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold text-gray-800">AI Page Suggestions</h2>
                    <button
                      onClick={generatePageSuggestions}
                      disabled={suggestionsLoading || !pageTexts.length}
                      className={`flex items-center space-x-2 px-4 py-2 rounded-md text-sm font-medium
                        ${suggestionsLoading || !pageTexts.length
                          ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                          : 'bg-blue-600 text-white hover:bg-blue-700'
                        }`}
                    >
                      {suggestionsLoading ? (
                        <>
                          <Loader2 className="animate-spin h-4 w-4" />
                          <span>Analyzing...</span>
                        </>
                      ) : (
                        <>
                          <span>Generate Suggestions</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* AI Suggestions Component */}
                  <AISuggestions
                    suggestions={pageSuggestions}
                    isLoading={suggestionsLoading}
                    onEditPage={(pageNumber) => {
                      setMagnifyInitialPage(pageNumber - 1); // Convert to 0-based index
                      setIsAnnotationModalOpen(true);
                    }}
                    onViewPage={(pageNumber) => {
                      // Could implement a view-only modal or scroll to page in document tab
                      toast(`Viewing page ${pageNumber} (feature coming soon)`);
                    }}
                    customInstructions={customInstructions}
                  />
                </div>
              </Tab.Panel>
              <Tab.Panel className="rounded-xl bg-white p-3 ring-white ring-opacity-60 ring-offset-2 ring-offset-blue-400 focus:outline-none focus:ring-2">
                <TwitterPreview
                  posts={generatedThread}
                  postPageMap={postPageMap}
                  pageImages={pageImages}
                  markedUpImages={markedUpImages}
                  user={user}
                />
              </Tab.Panel>
            </Tab.Panels>
          </Tab.Group>
        </div>
      </main>
  );

  const renderMyThreadsView = () => (
    <main className="p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">My Threads</h1>
        
        {savedThreads.length === 0 ? (
          <div className="text-center py-12">
            <BookOpen className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No saved threads yet</h3>
            <p className="text-gray-500 mb-6">Create your first thread to see it here</p>
            <button
              onClick={() => setCurrentView('main')}
              className="btn-primary"
            >
              Create Thread
            </button>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {savedThreads.map((thread) => (
              <div key={thread.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 line-clamp-2">{thread.title}</h3>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                    thread.status === 'draft' 
                      ? 'bg-yellow-100 text-yellow-800' 
                      : 'bg-green-100 text-green-800'
                  }`}>
                    {thread.status}
                  </span>
                </div>
                
                <div className="text-sm text-gray-500 mb-4">
                  <div className="flex items-center gap-4">
                    <span>{thread.posts.length} posts</span>
                    <span>{thread.createdAt?.toDate ? thread.createdAt.toDate().toLocaleDateString() : 'Unknown date'}</span>
                  </div>
                  {thread.originalPdfName && (
                    <div className="mt-1 truncate">
                      From: {thread.originalPdfName}
                    </div>
                  )}
                </div>
                
                <div className="text-sm text-gray-700 mb-4 line-clamp-3">
                  {thread.posts[0]?.text || 'No content'}
                </div>
                
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      // Load this thread for editing
                      setGeneratedThread(thread.posts);
                      setCustomInstructions(thread.customInstructions || '');
                      if (thread.settings) {
                        setCharLimit(thread.settings.charLimit || 280);
                        setNumPosts(thread.settings.numPosts || 5);
                        setUseEmojis(thread.settings.useEmojis || false);
                        setUseHashtags(thread.settings.useHashtags || false);
                        setUseNumbering(thread.settings.useNumbering || false);
                      }
                      // Restore image association data
                      if (thread.postPageMap) {
                        setPostPageMap(thread.postPageMap);
                      } else {
                        setPostPageMap({});
                      }
                      if (thread.markedUpImages) {
                        setMarkedUpImages(thread.markedUpImages);
                      } else {
                        setMarkedUpImages([]);
                      }
                      if (thread.pageImages) {
                        // Images are now stored as Firebase Storage URLs, ready to use
                        setPageImages(thread.pageImages);
                      }
                      setCurrentView('main');
                      setSelectedTabIndex(1); // Switch to thread editor tab
                      toast.success('Thread loaded for editing');
                    }}
                    className="btn-secondary text-sm flex-1"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => {
                      const allTweets = thread.posts.map((post, index) => 
                        `Tweet ${index + 1}/${thread.posts.length}\n${post.text}`
                      ).join('\n\n');
                      navigator.clipboard.writeText(allTweets);
                      toast.success("Thread copied to clipboard!");
                    }}
                    className="btn-secondary text-sm"
                  >
                    <CopyIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );

  const renderTemplatesView = () => (
    <main className="p-8">
      <div className="max-w-4xl mx-auto text-center py-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Templates</h1>
        <p className="text-gray-500 mb-6">Custom thread templates coming soon!</p>
        <button
          onClick={() => setCurrentView('main')}
          className="btn-primary"
        >
          Back to Home
        </button>
      </div>
    </main>
  );

  const renderCustomPromptsView = () => (
    <main className="p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Custom Prompts</h1>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowNewPromptModal(true)}
              className="btn-primary flex items-center gap-2"
            >
              <PlusCircle className="w-4 h-4" />
              Add New Prompt
            </button>
            <button
              onClick={() => setCurrentView('main')}
              className="btn-secondary"
            >
              Back to Home
            </button>
          </div>
        </div>

        {/* Sorting Controls */}
        {customPrompts.length > 0 && (
          <div className="flex items-center gap-4 mb-6">
            <div className="flex items-center gap-2">
              <SortAsc className="w-4 h-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">Sort by:</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPromptSortBy('date')}
                className={`px-3 py-1 text-sm rounded ${
                  promptSortBy === 'date' 
                    ? 'bg-blue-100 text-blue-700 border border-blue-300' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Date Created
              </button>
              <button
                onClick={() => setPromptSortBy('name')}
                className={`px-3 py-1 text-sm rounded ${
                  promptSortBy === 'name' 
                    ? 'bg-blue-100 text-blue-700 border border-blue-300' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Name
              </button>
            </div>
          </div>
        )}
        
        {customPrompts.length === 0 ? (
          <div className="text-center py-12">
            <Edit className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No custom prompts yet</h3>
            <p className="text-gray-500 mb-6">Create your first custom prompt</p>
            <button
              onClick={() => setShowNewPromptModal(true)}
              className="btn-primary"
            >
              Create Prompt
            </button>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
            {getSortedPrompts().map((prompt) => (
              <CustomPromptCard 
                key={prompt.id} 
                prompt={prompt} 
                onEdit={(prompt) => {
                  // Apply to main editor and go back
                  applySelectedPrompt(prompt.id!);
                  setCurrentView('main');
                  toast.success('Prompt loaded in editor for modification');
                }}
                onDelete={async (promptId) => {
                  try {
                    await deleteCustomPrompt(promptId);
                    toast.success('Prompt deleted');
                    loadCustomPrompts(); // Reload list
                  } catch (error) {
                    console.error('Error deleting prompt:', error);
                    toast.error('Failed to delete prompt');
                  }
                }}
                onUpdate={async (promptId, updates) => {
                  try {
                    await updateCustomPrompt(promptId, updates);
                    toast.success('Prompt updated');
                    loadCustomPrompts(); // Reload list
                  } catch (error) {
                    console.error('Error updating prompt:', error);
                    toast.error('Failed to update prompt');
                  }
                }}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );

  const renderBillingView = () => (
    <main className="p-8">
      <div className="max-w-4xl mx-auto text-center py-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Billing</h1>
        <p className="text-gray-500 mb-6">Billing and subscription management coming soon!</p>
        <button
          onClick={() => setCurrentView('main')}
          className="btn-primary"
        >
          Back to Home
        </button>
      </div>
    </main>
  );

  const renderProfileView = () => {
    const handleAvatarUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
        if (file.size > 5 * 1024 * 1024) { // 5MB limit
          toast.error('File size must be less than 5MB');
          return;
        }
        
        const reader = new FileReader();
        reader.onload = (e) => {
          setUserProfile(prev => ({
            ...prev,
            avatar: e.target?.result as string
          }));
          toast.success('Profile picture updated!');
        };
        reader.readAsDataURL(file);
      }
    };

    const handleProfileSave = () => {
      if (user?.uid && typeof window !== 'undefined') {
        localStorage.setItem(`userProfile_${user.uid}`, JSON.stringify(userProfile));
        toast.success('Profile saved successfully!');
      } else {
        toast.error('Unable to save profile. Please try again.');
      }
    };

    return (
      <main className="p-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Profile Settings</h1>
            <button
              onClick={() => setCurrentView('main')}
              className="btn-secondary"
            >
              Back to Home
            </button>
          </div>

          <div className="grid gap-8 lg:grid-cols-3">
            {/* Profile Picture */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Profile Picture</h2>
                <div className="flex flex-col items-center">
                  <div className="w-32 h-32 bg-blue-600 rounded-full flex items-center justify-center mb-4 overflow-hidden">
                    {userProfile.avatar ? (
                      <img src={userProfile.avatar} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-white text-3xl font-bold">
                        {userProfile.displayName?.charAt(0)?.toUpperCase() || user?.displayName?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || 'U'}
                      </span>
                    )}
                  </div>
                  <label className="btn-secondary cursor-pointer flex items-center gap-2">
                    <Camera className="w-4 h-4" />
                    Upload Photo
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarUpload}
                      className="hidden"
                    />
                  </label>
                  <p className="text-xs text-gray-500 mt-2 text-center">
                    JPG, PNG up to 5MB
                  </p>
                </div>
              </div>
            </div>

            {/* Profile Information */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-6">Profile Information</h2>
                
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Display Name
                    </label>
                    <input
                      type="text"
                      value={userProfile.displayName}
                      onChange={(e) => setUserProfile(prev => ({ ...prev, displayName: e.target.value }))}
                      className="input-field"
                      placeholder="Your display name"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Twitter Handle
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm">@</span>
                        <input
                          type="text"
                          value={userProfile.twitterHandle}
                          onChange={(e) => setUserProfile(prev => ({ ...prev, twitterHandle: e.target.value }))}
                          className="input-field pl-8"
                          placeholder="username"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Instagram Handle
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm">@</span>
                        <input
                          type="text"
                          value={userProfile.instagramHandle}
                          onChange={(e) => setUserProfile(prev => ({ ...prev, instagramHandle: e.target.value }))}
                          className="input-field pl-8"
                          placeholder="username"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email
                    </label>
                    <input
                      type="email"
                      value={user?.email || ''}
                      disabled
                      className="input-field bg-gray-50 cursor-not-allowed"
                    />
                    <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button
                      onClick={handleProfileSave}
                      className="btn-primary flex items-center gap-2"
                    >
                      <Save className="w-4 h-4" />
                      Save Changes
                    </button>
                    <button
                      onClick={() => signOut()}
                      className="btn-secondary text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      Sign Out
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Preview Section */}
          <div className="mt-8">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Preview</h2>
              <p className="text-gray-600 mb-4">This is how your profile will appear in Twitter previews:</p>
              
              {/* Twitter Preview Sample */}
              <div className="bg-black rounded-lg p-4 max-w-md">
                <div className="flex space-x-3">
                  <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center overflow-hidden">
                    {userProfile.avatar ? (
                      <img src={userProfile.avatar} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-white text-base font-bold">
                        {userProfile.displayName?.charAt(0)?.toUpperCase() || user?.displayName?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || 'U'}
                      </span>
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="font-bold text-white text-[17px]">
                        {userProfile.displayName || user?.displayName || 'Your Name'}
                      </span>
                      <span className="text-gray-500 text-[15px]">
                        @{userProfile.twitterHandle || 'username'}
                      </span>
                      <span className="text-gray-500">·</span>
                      <span className="text-gray-500 text-[15px]">now</span>
                    </div>
                    <div className="text-white text-[17px] leading-6">
                      This is how your thread posts will appear on Twitter with your custom profile! 🧵
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    );
  };

  // CustomPromptCard component
  const CustomPromptCard = ({ 
    prompt, 
    onEdit, 
    onDelete, 
    onUpdate 
  }: { 
    prompt: CustomPrompt; 
    onEdit: (prompt: CustomPrompt) => void;
    onDelete: (promptId: string) => void;
    onUpdate: (promptId: string, updates: Partial<CustomPrompt>) => void;
  }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState(prompt.name);
    const [editInstructions, setEditInstructions] = useState(prompt.instructions);

    const handleSave = () => {
      onUpdate(prompt.id!, {
        name: editName,
        instructions: editInstructions
      });
      setIsEditing(false);
    };

    const handleCancel = () => {
      setEditName(prompt.name);
      setEditInstructions(prompt.instructions);
      setIsEditing(false);
    };

    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-start justify-between mb-4">
          {isEditing ? (
            <input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="text-lg font-semibold text-gray-900 border-b border-gray-300 bg-transparent outline-none flex-1"
            />
          ) : (
            <h3 className="text-lg font-semibold text-gray-900 line-clamp-2">{prompt.name}</h3>
          )}
          <div className="flex gap-2 ml-4">
            {isEditing ? (
              <>
                <button
                  onClick={handleSave}
                  className="text-green-600 hover:text-green-700"
                  title="Save"
                >
                  <Save className="w-4 h-4" />
                </button>
                <button
                  onClick={handleCancel}
                  className="text-gray-500 hover:text-gray-700"
                  title="Cancel"
                >
                  <XCircle className="w-4 h-4" />
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setIsEditing(true)}
                  className="text-blue-600 hover:text-blue-700"
                  title="Edit"
                >
                  <Edit className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onEdit(prompt)}
                  className="text-purple-600 hover:text-purple-700"
                  title="Load in editor"
                >
                  <CopyIcon className="w-4 h-4" />
                </button>
                <button
                  onClick={() => {
                    if (confirm('Are you sure you want to delete this prompt?')) {
                      onDelete(prompt.id!);
                    }
                  }}
                  className="text-red-600 hover:text-red-700"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </div>
        
        <div className="text-sm text-gray-500 mb-4">
          <div className="flex items-center gap-4">
            <span>Created: {prompt.createdAt?.toDate ? prompt.createdAt.toDate().toLocaleDateString() : 'Unknown'}</span>
            <span>Posts: {prompt.settings.numPosts}</span>
            <span>Chars: {prompt.settings.charLimit}</span>
          </div>
        </div>
        
        {isEditing ? (
          <textarea
            value={editInstructions}
            onChange={(e) => setEditInstructions(e.target.value)}
            className="w-full h-32 p-2 border border-gray-300 rounded text-sm resize-none"
          />
        ) : (
          <div className="text-sm text-gray-700 bg-gray-50 p-3 rounded border line-clamp-3">
            {prompt.instructions || 'No instructions'}
          </div>
        )}
        
        <div className="flex items-center gap-2 mt-4 text-xs text-gray-500">
          {prompt.settings.useEmojis && <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded">Emojis</span>}
          {prompt.settings.useHashtags && <span className="bg-green-100 text-green-700 px-2 py-1 rounded">Hashtags</span>}
          {prompt.settings.useNumbering && <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded">Numbers</span>}
        </div>
      </div>
    );
  };

  // NewPromptModal component
  const NewPromptModal = () => {
    const [newPromptName, setNewPromptName] = useState('');
    const [newPromptInstructions, setNewPromptInstructions] = useState('');
    const [newPromptCharLimit, setNewPromptCharLimit] = useState(280);
    const [newPromptNumPosts, setNewPromptNumPosts] = useState(5);
    const [newPromptUseEmojis, setNewPromptUseEmojis] = useState(false);
    const [newPromptUseHashtags, setNewPromptUseHashtags] = useState(false);
    const [newPromptUseNumbering, setNewPromptUseNumbering] = useState(false);
    const [isCreating, setIsCreating] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newPromptName.trim() || !newPromptInstructions.trim()) {
        toast.error('Please fill in all required fields');
        return;
      }

      setIsCreating(true);
      try {
        await createNewPrompt(newPromptName, newPromptInstructions, {
          charLimit: newPromptCharLimit,
          numPosts: newPromptNumPosts,
          useEmojis: newPromptUseEmojis,
          useHashtags: newPromptUseHashtags,
          useNumbering: newPromptUseNumbering
        });
      } finally {
        setIsCreating(false);
      }
    };

    const handleClose = () => {
      setShowNewPromptModal(false);
      // Reset form
      setNewPromptName('');
      setNewPromptInstructions('');
      setNewPromptCharLimit(280);
      setNewPromptNumPosts(5);
      setNewPromptUseEmojis(false);
      setNewPromptUseHashtags(false);
      setNewPromptUseNumbering(false);
    };

    return (
      <Dialog open={showNewPromptModal} onClose={handleClose} className="relative z-50">
        <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="mx-auto max-w-2xl w-full bg-white rounded-lg shadow-xl">
            <form onSubmit={handleSubmit} className="p-6">
              <Dialog.Title className="text-lg font-medium text-gray-900 mb-4">
                Create New Custom Prompt
              </Dialog.Title>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Prompt Name *
                  </label>
                  <input
                    type="text"
                    value={newPromptName}
                    onChange={(e) => setNewPromptName(e.target.value)}
                    className="input-field"
                    placeholder="e.g., Legal Expert Tone, Social Media Style..."
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Instructions *
                  </label>
                  <textarea
                    value={newPromptInstructions}
                    onChange={(e) => setNewPromptInstructions(e.target.value)}
                    className="input-field w-full"
                    rows={6}
                    placeholder="Enter detailed instructions for the AI..."
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Character Limit
                    </label>
                    <input
                      type="number"
                      value={newPromptCharLimit}
                      onChange={(e) => setNewPromptCharLimit(Number(e.target.value))}
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Number of Posts
                    </label>
                    <input
                      type="number"
                      value={newPromptNumPosts}
                      onChange={(e) => setNewPromptNumPosts(Number(e.target.value))}
                      className="input-field"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-700">Use Emojis</span>
                    <Switch 
                      checked={newPromptUseEmojis} 
                      onChange={setNewPromptUseEmojis} 
                      className={`${newPromptUseEmojis ? 'bg-blue-600' : 'bg-gray-200'} relative inline-flex h-6 w-11 items-center rounded-full transition-colors`}
                    >
                      <span className={`${newPromptUseEmojis ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}/>
                    </Switch>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-700">Use Hashtags</span>
                    <Switch 
                      checked={newPromptUseHashtags} 
                      onChange={setNewPromptUseHashtags} 
                      className={`${newPromptUseHashtags ? 'bg-blue-600' : 'bg-gray-200'} relative inline-flex h-6 w-11 items-center rounded-full transition-colors`}
                    >
                      <span className={`${newPromptUseHashtags ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}/>
                    </Switch>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-700">Use Numbering</span>
                    <Switch 
                      checked={newPromptUseNumbering} 
                      onChange={setNewPromptUseNumbering} 
                      className={`${newPromptUseNumbering ? 'bg-blue-600' : 'bg-gray-200'} relative inline-flex h-6 w-11 items-center rounded-full transition-colors`}
                    >
                      <span className={`${newPromptUseNumbering ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}/>
                    </Switch>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={handleClose}
                  className="btn-secondary"
                  disabled={isCreating}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary flex items-center gap-2 disabled:opacity-50"
                  disabled={isCreating || !newPromptName.trim() || !newPromptInstructions.trim()}
                >
                  {isCreating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Create Prompt
                    </>
                  )}
                </button>
              </div>
            </form>
          </Dialog.Panel>
        </div>
      </Dialog>
    );
  };

  // TwitterPreview component
  const TwitterPreview = ({ 
    posts, 
    postPageMap, 
    pageImages, 
    markedUpImages, 
    user 
  }: { 
    posts: ThreadPost[];
    postPageMap: any;
    pageImages: string[];
    markedUpImages: MarkedUpImage[];
    user: any;
  }) => {
    const getImageForPost = (postId: number) => {
      const imageInfo = postPageMap[postId];
      if (!imageInfo) return null;
      
      if (imageInfo.type === 'pdf') {
        return pageImages[imageInfo.value];
      } else {
        const markedImg = markedUpImages.find(m => m.id === imageInfo.value);
        return markedImg?.url || null;
      }
    };

    const getCharacterCount = (text: string) => {
      return text.length;
    };

    const isOverLimit = (text: string) => {
      return text.length > 280;
    };

    if (posts.length === 0) {
      return (
        <div className="text-center py-12">
          <Twitter className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No thread to preview</h3>
          <p className="text-gray-500">Generate a thread first to see the Twitter preview</p>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-800">Twitter Thread Preview</h2>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              {/* Theme Toggle */}
              <button
                onClick={() => setTwitterPreviewMode(twitterPreviewMode === 'dark' ? 'light' : 'dark')}
                className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors"
                title={`Switch to ${twitterPreviewMode === 'dark' ? 'light' : 'dark'} mode`}
              >
                {twitterPreviewMode === 'dark' ? (
                  <Sun className="w-4 h-4 text-gray-600" />
                ) : (
                  <Moon className="w-4 h-4 text-gray-600" />
                )}
              </button>
              <span className="text-sm text-gray-600">
                {posts.length} tweet{posts.length !== 1 ? 's' : ''}
              </span>
            </div>
            <button
              disabled={posts.some(post => isOverLimit(post.text))}
              className="btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-4 h-4" />
              Publish Thread
            </button>
          </div>
        </div>

        {/* Twitter Thread Interface - Authentic Structure */}
        <div className={`rounded-lg overflow-hidden max-h-[70vh] overflow-y-auto ${
          twitterPreviewMode === 'dark' 
            ? 'bg-black' 
            : 'bg-white border border-gray-200'
        }`}>
          <div className="space-y-0">
            {posts.map((post, index) => {
              const imageUrl = getImageForPost(post.id);
              const isMainPost = index === 0;
              const isThreadPost = index > 0;
              const isLastPost = index === posts.length - 1;
              
              return (
                <div key={post.id} className={`
                  ${isMainPost ? 'border-b' : ''} 
                  ${twitterPreviewMode === 'dark' ? 'border-gray-800' : 'border-gray-200'}
                `}>
                  <div className={`p-4 ${isThreadPost ? 'pl-16' : ''}`}> {/* Indent thread posts */}
                    <div className="flex space-x-3">
                      {/* Profile Picture Column */}
                      <div className="flex flex-col items-center">
                        {/* Main post gets large profile */}
                        {isMainPost && (
                          <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center overflow-hidden">
                            {userProfile.avatar ? (
                              <img src={userProfile.avatar} alt="Profile" className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-white text-base font-bold">
                                {userProfile.displayName?.charAt(0)?.toUpperCase() || user?.displayName?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || 'U'}
                              </span>
                            )}
                          </div>
                        )}
                        
                        {/* Thread posts get smaller profile with connecting line */}
                        {isThreadPost && (
                          <>
                            {/* Connecting line from above */}
                            <div className="w-0.5 h-4 bg-gray-600"></div>
                            {/* Smaller profile picture */}
                            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center overflow-hidden">
                              {userProfile.avatar ? (
                                <img src={userProfile.avatar} alt="Profile" className="w-full h-full object-cover" />
                              ) : (
                                <span className="text-white text-xs font-bold">
                                  {userProfile.displayName?.charAt(0)?.toUpperCase() || user?.displayName?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || 'U'}
                                </span>
                              )}
                            </div>
                            {/* Continue line below if not last post */}
                            {!isLastPost && (
                              <div className="w-0.5 bg-gray-600 flex-1 min-h-4 mt-2"></div>
                            )}
                          </>
                        )}
                      </div>

                      {/* Post Content */}
                      <div className="flex-1 min-w-0">
                        {/* Header - All posts get header */}
                        <div className="flex items-center space-x-2 mb-2">
                          <span className={`font-bold ${twitterPreviewMode === 'dark' ? 'text-white' : 'text-gray-900'} text-[15px]`}>
                            {userProfile.displayName || user?.displayName || user?.email?.split('@')[0] || 'User'}
                          </span>
                          <span className="text-gray-500 text-[15px]">
                            @{userProfile.twitterHandle || user?.email?.split('@')[0] || 'username'}
                          </span>
                          <span className="text-gray-500">·</span>
                          <span className="text-gray-500 text-[15px]">
                            {isMainPost ? 'now' : `${index}m`}
                          </span>
                        </div>
                        
                        {/* Post Text */}
                        <div className={`${twitterPreviewMode === 'dark' ? 'text-white' : 'text-gray-900'} text-[15px] leading-6 mb-3`}>
                          {post.text}
                        </div>
                        
                        {/* Post Image - Full Width */}
                        {imageUrl && (
                          <div className="mb-3"> 
                            <img 
                              src={imageUrl} 
                              alt="Attached content"
                              className="w-full h-auto rounded-2xl object-cover max-h-96"
                            />
                          </div>
                        )}
                        
                        {/* Timestamp and Views for main post only */}
                        {isMainPost && (
                          <div className="flex items-center space-x-1 text-gray-500 text-[15px] mb-3">
                            <span>9:31 AM</span>
                            <span>·</span>
                            <span>Jun 22, 2025</span>
                            <span>·</span>
                            <span className="font-bold text-gray-700">
                              {(Math.floor(Math.random() * 50) + 10)}K Views
                            </span>
                          </div>
                        )}
                        
                        {/* Social engagement icons for ALL posts */}
                        <div className="flex items-center justify-between max-w-md pt-1">
                          <button className="flex items-center space-x-2 text-gray-500 hover:text-blue-400 transition-colors group">
                            <div className={`p-2 rounded-full group-hover:${twitterPreviewMode === 'dark' ? 'bg-blue-900/20' : 'bg-blue-100'}`}>
                              <MessageCircle className="w-5 h-5" />
                            </div>
                            <span className="text-[13px]">{Math.floor(Math.random() * 50) + 12}</span>
                          </button>
                          
                          <button className="flex items-center space-x-2 text-gray-500 hover:text-green-400 transition-colors group">
                            <div className={`p-2 rounded-full group-hover:${twitterPreviewMode === 'dark' ? 'bg-green-900/20' : 'bg-green-100'}`}>
                              <Repeat2 className="w-5 h-5" />
                            </div>
                            <span className="text-[13px]">{Math.floor(Math.random() * 30) + 5}</span>
                          </button>
                          
                          <button className="flex items-center space-x-2 text-gray-500 hover:text-red-400 transition-colors group">
                            <div className={`p-2 rounded-full group-hover:${twitterPreviewMode === 'dark' ? 'bg-red-900/20' : 'bg-red-100'}`}>
                              <Heart className="w-5 h-5" />
                            </div>
                            <span className="text-[13px]">{Math.floor(Math.random() * 200) + 45}</span>
                          </button>
                          
                          <button className="text-gray-500 hover:text-blue-400 transition-colors group">
                            <div className={`p-2 rounded-full group-hover:${twitterPreviewMode === 'dark' ? 'bg-blue-900/20' : 'bg-blue-100'}`}>
                              <Bookmark className="w-5 h-5" />
                            </div>
                          </button>
                          
                          <button className="text-gray-500 hover:text-blue-400 transition-colors group">
                            <div className={`p-2 rounded-full group-hover:${twitterPreviewMode === 'dark' ? 'bg-blue-900/20' : 'bg-blue-100'}`}>
                              <Share className="w-5 h-5" />
                            </div>
                          </button>
                        </div>

                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Thread Stats */}
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-gray-900">{posts.length}</div>
              <div className="text-sm text-gray-600">Tweets</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">
                {posts.reduce((total, post) => total + post.text.length, 0)}
              </div>
              <div className="text-sm text-gray-600">Total Characters</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">
                {Object.keys(postPageMap).length}
              </div>
              <div className="text-sm text-gray-600">Images Attached</div>
            </div>
            <div>
              <div className={`text-2xl font-bold ${posts.some(post => isOverLimit(post.text)) ? 'text-red-600' : 'text-green-600'}`}>
                {posts.some(post => isOverLimit(post.text)) ? 'FAIL' : 'PASS'}
              </div>
              <div className="text-sm text-gray-600">Validation</div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-legal-100 min-h-screen">
      <header className="bg-white shadow-sm p-4 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-legal-800 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-lg">T</span>
          </div>
          <h1 className="text-2xl font-bold text-legal-800">Threadifier</h1>
        </div>
        <AuthDisplay />
      </header>
      
      {/* Progress Bar */}
      {isProcessing && (
        <div className="h-1 bg-gray-200 relative overflow-hidden">
          <div className="h-full bg-blue-500 absolute top-0 left-0 animate-pulse" 
               style={{
                 width: '100%',
                 animation: 'progress 3s ease-in-out infinite'
               }}>
          </div>
        </div>
      )}
      
      {/* Conditional rendering based on currentView */}
      {currentView === 'main' && renderMainView()}
      {currentView === 'myThreads' && renderMyThreadsView()}
      {currentView === 'customPrompts' && renderCustomPromptsView()}
      {currentView === 'templates' && renderTemplatesView()}
      {currentView === 'billing' && renderBillingView()}
      {currentView === 'profile' && renderProfileView()}


      {isImagePickerOpen && (
        <ImagePickerModal
          isOpen={isImagePickerOpen}
          onClose={handleCloseImagePicker}
          onSelect={handleSelectPage}
          pageImages={pageImages}
          markedUpImages={markedUpImages}
        />
      )}

      {isAnnotationModalOpen && (
          <AnnotationModal
            isOpen={isAnnotationModalOpen}
            onClose={closeMagnify}
            onSave={handleSaveMarkedUpImage}
            onCrop={handleCrop}
            pageImages={highResPageImages.length > 0 ? highResPageImages : pageImages}
            initialPage={magnifyInitialPage}
            editingMarkedUpImage={editingMarkedUpImage}
            userProfile={userProfile}
          />
      )}

      <NewPromptModal />

    </div>
  );
}

export default Page;