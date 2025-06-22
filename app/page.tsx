"use client";

import { useState, useEffect, useRef, useLayoutEffect } from "react";
import { useDropzone } from "react-dropzone";
import toast from "react-hot-toast";
import * as pdfjsLib from "pdfjs-dist";
import { Loader2, Twitter, Edit, Trash2, PlusCircle, Save, XCircle, GripVertical, Copy as CopyIcon, Crop, Image as ImageIcon } from "lucide-react";
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
import { AuthProvider } from '@/app/context/AuthContext';
import ThreadEditor from './components/ThreadEditor';
import ImagePickerModal from './components/ImagePickerModal';
import AnnotationModal from './components/AnnotationModal';
import AISuggestions from './components/AISuggestions';
import { Tab } from '@headlessui/react';
import { PageSuggestion } from './types';

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
            <p className="font-semibold text-legal-800">Legal Eagle Bot <span className="text-legal-500 font-normal">· @threadifier</span></p>
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

const AuthDisplay = () => {
  const { user } = useAuth();

  if (!user) {
    return <Link href="/login" className="btn-primary">Login</Link>;
  }

  return (
    <div className="flex items-center gap-4">
      <img src={user.photoURL || ''} alt="User photo" className="h-10 w-10 rounded-full" />
      <div>
        <p className="font-semibold">{user.displayName}</p>
        <button onClick={() => signOut()} className="text-sm text-red-500 hover:underline">Logout</button>
      </div>
    </div>
  );
}

function Page() {
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
  
  // Tab control state
  const [selectedTabIndex, setSelectedTabIndex] = useState(0);
  
  const onDrop = (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file && file.type === "application/pdf") {
      setPdfFile(file);
      setExtractedText("");
      setGeneratedThread([]);
      setMarkedUpImages([]);
      setHighResPageImages([]);
      setPostPageMap({});
      toast.success("PDF loaded successfully!");
      extractTextFromPDF(file);
    } else {
      toast.error("Please upload a valid PDF file.");
    }
  };
  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop });

  async function extractTextFromPDF(file: File) {
    setIsExtracting(true);
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const arrayBuffer = e.target?.result as ArrayBuffer;
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let fullText = "";
        const images: string[] = [];
        const highResImages: string[] = [];
        const individualPageTexts: string[] = [];
        
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
        toast.error("Failed to generate page suggestions.");
      }
    } catch (error) {
      console.error("Error generating page suggestions:", error);
      toast.error("An error occurred while generating page suggestions.");
    } finally {
      setSuggestionsLoading(false);
    }
  };

  async function handleAnalyze() {
    if (!extractedText) {
      toast.error("No text extracted from PDF. Please upload a PDF first.");
      return;
    }
    setIsAnalyzing(true);
    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          text: extractedText,
          postCount: numPosts,
          characterLimit: charLimit,
          customInstructions,
          useEmojis,
          useHashtags,
          useNumbering
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

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

      const resultText = new TextDecoder("utf-8").decode(chunksAll);
      const posts = JSON.parse(resultText);

      if (!posts || !Array.isArray(posts.thread)) {
        console.error("API response is not in the expected format: ", posts);
        toast.error("The AI returned an unexpected response format. Please try again.");
        return;
      }

      setGeneratedThread(
        posts.thread.map((postText: string, index: number) => ({
          id: index + 1,
          text: postText,
        }))
      );
      toast.success("Thread analyzed and generated successfully!");
      setSelectedTabIndex(1); // Automatically switch to Thread Editor tab
    } catch (error) {
      console.error("Analysis failed:", error);
      toast.error("Failed to analyze the document.");
    } finally {
      setIsAnalyzing(false);
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
            {isExtracting ? (
              <div className="flex items-center justify-center text-legal-600">
                <Loader2 className="animate-spin mr-2" />
                <p>Analyzing PDF...</p>
              </div>
            ) : pdfFile ? (
              <p className="text-legal-700">Loaded: <span className="font-semibold">{pdfFile.name}</span></p>
            ) : (
              <p className="text-legal-600">Drop a PDF here, or click to select a file</p>
            )}
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
              <label htmlFor="customInstructions" className="block text-sm font-medium text-legal-700">Custom Instructions</label>
              <textarea 
                id="customInstructions"
                value={customInstructions}
                onChange={e => setCustomInstructions(e.target.value)}
                placeholder="e.g., 'Act as a legal expert explaining this case to a layman...'"
                className="input-field mt-1 w-full"
                rows={3}
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
            </Tab.List>
            <Tab.Panels className="mt-2">
              <Tab.Panel className="rounded-xl bg-white p-3 ring-white ring-opacity-60 ring-offset-2 ring-offset-blue-400 focus:outline-none focus:ring-2">
                 <div className="space-y-6">
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
                    
                    {/* Marked-up Exhibits */}
                    <div>
                      <h2 className="text-xl font-bold text-legal-800 mb-4">Marked-up Exhibits</h2>
                      {markedUpImages.length === 0 ? (
                        <p className="text-legal-500 text-sm text-center py-4 bg-slate-100 rounded-lg">No exhibits created yet. Edit a page to create a markup or crop.</p>
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
                                Exhibit (from page {img.pageNumber})
                              </div>
                          </div>
                        ))}
                      </div>
                      )}
                    </div>
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
                          <button onClick={handleCopyAll} className="btn-secondary flex items-center"><CopyIcon className="w-4 h-4 mr-1"/>Copy All</button>
                        </div>
                      </div>
                    
                      <SortableContext
                        items={generatedThread.map(p => p.id.toString())}
                        strategy={verticalListSortingStrategy}
                      >
                        <div className="space-y-4">
                          {generatedThread.map((post, index) => (
                            <SortableThreadRow
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
                              handleCopy={handleCopy}
                              pageImages={pageImages}
                              markedUpImages={markedUpImages}
                              postPageMap={postPageMap}
                              handleClearImage={handleClearImage}
                              onAddImage={handleOpenImagePicker}
                            />
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
            </Tab.Panels>
          </Tab.Group>
        </div>
      </main>

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
          />
      )}

    </div>
  );
}

function PageClientWrapper() {
  return (
    <AuthProvider>
      <Page />
    </AuthProvider>
  );
}

export default PageClientWrapper;