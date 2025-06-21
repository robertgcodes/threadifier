"use client";

import { useState, useEffect, useRef, useLayoutEffect } from "react";
import { useDropzone } from "react-dropzone";
import toast from "react-hot-toast";
import * as pdfjsLib from "pdfjs-dist";
import { Loader2, Twitter, Edit, Trash2, PlusCircle, Save, XCircle, GripVertical, Copy as CopyIcon, Crop } from "lucide-react";
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
import { Dialog } from '@headlessui/react';
import { fabric } from 'fabric';
import { v4 as uuidv4 } from 'uuid';

// Use a stable CDN for the PDF.js worker to ensure compatibility with Vercel's build environment.
// We also point to the '.mjs' version for modern module compatibility.
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.mjs`;

interface ThreadPost {
  id: number;
  text: string;
}

// --- Sortable Post Item Component ---
function SortablePostItem({ post, index, generatedThread, startEditing, deletePost, editingPostId, editingText, setEditingText, saveEdit, cancelEdit, handleCopy }: { post: ThreadPost, index: number, generatedThread: ThreadPost[], startEditing: (post: ThreadPost) => void, deletePost: (id: number) => void, editingPostId: number | null, editingText: string, setEditingText: (text: string) => void, saveEdit: () => void, cancelEdit: () => void, handleCopy: (text: string) => void }) {
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

  const [pageImages, setPageImages] = useState<string[]>([]);
  const [postPageMap, setPostPageMap] = useState<{ [postId: number]: { type: 'pdf' | 'marked', value: number | string } | null }>({});
  const [selectingForPost, setSelectingForPost] = useState<number | null>(null);
  const [magnifyPageIdx, setMagnifyPageIdx] = useState<number | null>(null);
  const [magnifyImage, setMagnifyImage] = useState<string | null>(null);
  const [magnifyLoading, setMagnifyLoading] = useState(false);
  const [markedUpImages, setMarkedUpImages] = useState<{ id: string, url: string, label: string, json: any }[]>([]);
  const [penColor, setPenColor] = useState<string>("#e11d48");
  const [penSize, setPenSize] = useState<number>(4);
  const [isErasing, setIsErasing] = useState(false);
  const pdfDocRef = useRef<any>(null);
  const fabricCanvasRef = useRef<fabric.Canvas | null>(null);
  const fabricContainerRef = useRef<HTMLDivElement | null>(null);
  const [editingMarkedUpId, setEditingMarkedUpId] = useState<string | null>(null);

  const [toolbarCollapsed, setToolbarCollapsed] = useState(false);
  const [cropMode, setCropMode] = useState(false);
  const [cropRect, setCropRect] = useState<fabric.Object | null>(null);
  const cropOverlayRef = useRef<fabric.Object[]>([]);

  const [zoom, setZoom] = useState(1);
  const minZoom = 0.25;
  const maxZoom = 2;
  const zoomStep = 0.1;
  const [panMode, setPanMode] = useState(false);
  const lastPan = useRef<{ x: number; y: number } | null>(null);

  const [canvasNaturalSize, setCanvasNaturalSize] = useState<{ width: number, height: number } | null>(null);
  const modalContentRef = useRef<HTMLDivElement | null>(null);

  const activeRectRef = useRef<fabric.Rect | null>(null);

  // Zoom handlers
  const handleZoomIn = () => setZoom(z => Math.min(maxZoom, +(z + zoomStep).toFixed(2)));
  const handleZoomOut = () => setZoom(z => Math.max(minZoom, +(z - zoomStep).toFixed(2)));
  const handleZoomReset = () => setZoom(1);

  // Apply zoom to fabric canvas
  useEffect(() => {
    if (fabricCanvasRef.current) {
      fabricCanvasRef.current.setZoom(zoom);
      // Optionally, center the canvas on zoom reset
      if (zoom === 1) {
        fabricCanvasRef.current.absolutePan({ x: 0, y: 0 });
      }
    }
  }, [zoom, magnifyImage, editingMarkedUpId]);

  // Pan support: hold spacebar or toggle pan mode
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    let isPanning = false;
    let lastPos = { x: 0, y: 0 };
    const onMouseDown = (opt: any) => {
      if (panMode || opt.e?.spaceKey) {
        isPanning = true;
        lastPos = { x: opt.e.clientX, y: opt.e.clientY };
        canvas.setCursor('grab');
        canvas.renderAll();
      }
    };
    const onMouseMove = (opt: any) => {
      if (isPanning) {
        const dx = opt.e.clientX - lastPos.x;
        const dy = opt.e.clientY - lastPos.y;
        lastPos = { x: opt.e.clientX, y: opt.e.clientY };
        const vp = canvas.viewportTransform;
        if (vp) {
          vp[4] += dx;
          vp[5] += dy;
          canvas.setViewportTransform(vp);
        }
      }
    };
    const onMouseUp = () => {
      isPanning = false;
      canvas.setCursor('default');
      canvas.renderAll();
    };
    canvas.on('mouse:down', onMouseDown);
    canvas.on('mouse:move', onMouseMove);
    canvas.on('mouse:up', onMouseUp);
    return () => {
      canvas.off('mouse:down', onMouseDown);
      canvas.off('mouse:move', onMouseMove);
      canvas.off('mouse:up', onMouseUp);
    };
  }, [panMode, fabricCanvasRef.current]);

  // Spacebar toggles pan mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') setPanMode(true);
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') setPanMode(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const updateCropOverlay = (canvas: fabric.Canvas, rect: fabric.Object | null) => {
    // Clear previous overlay
    cropOverlayRef.current.forEach(obj => canvas.remove(obj));
    cropOverlayRef.current = [];

    if (!rect) {
      canvas.renderAll();
      return;
    }

    const canvasWidth = canvas.getWidth();
    const canvasHeight = canvas.getHeight();
    const rectLeft = rect.left!;
    const rectTop = rect.top!;
    const rectWidth = rect.getScaledWidth();
    const rectHeight = rect.getScaledHeight();

    const overlayProps = {
      fill: 'rgba(0,0,0,0.5)',
      selectable: false,
      evented: false,
      excludeFromExport: true,
    };

    const overlays = [
      // Top
      new fabric.Rect({ left: 0, top: 0, width: canvasWidth, height: rectTop, ...overlayProps }),
      // Bottom
      new fabric.Rect({ left: 0, top: rectTop + rectHeight, width: canvasWidth, height: canvasHeight - (rectTop + rectHeight), ...overlayProps }),
      // Left
      new fabric.Rect({ left: 0, top: rectTop, width: rectLeft, height: rectHeight, ...overlayProps }),
      // Right
      new fabric.Rect({ left: rectLeft + rectWidth, top: rectTop, width: canvasWidth - (rectLeft + rectWidth), height: rectHeight, ...overlayProps }),
    ];

    overlays.forEach(obj => canvas.add(obj));
    cropOverlayRef.current = overlays;
    canvas.renderAll();
  };

  // Robust Crop Mode with manual rectangle drawing - FINAL version
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const cleanup = () => {
      canvas.off('mouse:down');
      canvas.off('mouse:move');
      canvas.off('mouse:up');
      canvas.defaultCursor = 'default';
      if (activeRectRef.current) {
        canvas.remove(activeRectRef.current);
        activeRectRef.current = null;
      }
      setCropRect(null);
      updateCropOverlay(canvas, null);
      canvas.renderAll();
    };

    if (cropMode) {
      canvas.isDrawingMode = false;
      canvas.selection = true; // Enable selection for the rect
      canvas.defaultCursor = 'crosshair';
      canvas.forEachObject(obj => { 
        // Make only the crop rect selectable
        if (obj !== activeRectRef.current) {
          obj.selectable = false;
        }
      });

      let isDrawing = false;
      let startPoint = { x: 0, y: 0 };

      const onMouseDown = (o: fabric.IEvent) => {
        // If we're clicking on the existing rectangle, let fabric.js handle it (move/scale)
        if (o.target === activeRectRef.current) {
          canvas.setActiveObject(activeRectRef.current!);
          return;
        }

        // If we click outside, clear the old rect and start drawing a new one
        if (activeRectRef.current) {
          canvas.remove(activeRectRef.current);
        }
        
        isDrawing = true;
        const pointer = canvas.getPointer(o.e);
        startPoint = pointer;

        const rect = new fabric.Rect({
          left: startPoint.x,
          top: startPoint.y,
          width: 0,
          height: 0,
          stroke: '#4A90E2',
          strokeWidth: 2 / canvas.getZoom(),
          fill: 'rgba(74, 144, 226, 0.1)',
          selectable: true,
          hasControls: true,
          lockRotation: true,
          cornerColor: '#4A90E2',
          cornerSize: 10,
          transparentCorners: false,
        });
        activeRectRef.current = rect;
        canvas.add(activeRectRef.current);
        setCropRect(null); // Hide apply button while drawing
      };

      const onMouseMove = (o: fabric.IEvent) => {
        if (!isDrawing || !activeRectRef.current) return;
        const pointer = canvas.getPointer(o.e);
        let left = startPoint.x;
        let top = startPoint.y;
        let width = pointer.x - startPoint.x;
        let height = pointer.y - startPoint.y;

        if (width < 0) {
          left = pointer.x;
          width = Math.abs(width);
        }
        if (height < 0) {
          top = pointer.y;
          height = Math.abs(height);
        }
        activeRectRef.current.set({ left, top, width, height });
        canvas.renderAll();
      };

      const onMouseUp = () => {
        isDrawing = false;
        if (activeRectRef.current && activeRectRef.current.width && activeRectRef.current.height && activeRectRef.current.width > 0 && activeRectRef.current.height > 0) {
          canvas.setActiveObject(activeRectRef.current);
          setCropRect(activeRectRef.current); // Show "Apply Crop" button
          
          const updateOverlayOnModify = () => updateCropOverlay(canvas, activeRectRef.current);
          
          activeRectRef.current.off('moving', updateOverlayOnModify);
          activeRectRef.current.off('scaling', updateOverlayOnModify);
          
          activeRectRef.current.on('moving', updateOverlayOnModify);
          activeRectRef.current.on('scaling', updateOverlayOnModify);

          updateCropOverlay(canvas, activeRectRef.current);
        } else if (activeRectRef.current) {
          // If the box has no size, remove it.
          canvas.remove(activeRectRef.current);
          activeRectRef.current = null;
          setCropRect(null);
          updateCropOverlay(canvas, null);
        }
      };
      
      canvas.on('mouse:down', onMouseDown);
      canvas.on('mouse:move', onMouseMove);
      canvas.on('mouse:up', onMouseUp);

      return cleanup;
    } else {
      cleanup();
    }

  }, [cropMode]);

  const handleApplyCrop = () => {
    const canvas = fabricCanvasRef.current;
    if (!cropRect || !canvas) return;
  
    // Create the cropped image data URL
    const croppedImageDataUrl = canvas.toDataURL({
      left: cropRect.left,
      top: cropRect.top,
      width: cropRect.width,
      height: cropRect.height,
      format: 'png',
    });
  
    // Add the new cropped image to the gallery
    const newId = `marked-up-${Date.now()}`;
    const newMarkedUpImage: { id: string, url: string, label: string, json: any } = {
      id: newId,
      url: croppedImageDataUrl,
      label: 'Cropped Image',
      json: null, // Cropped images are flat, no fabric data
    };
    setMarkedUpImages(prev => [...prev, newMarkedUpImage]);
  
    // ** KEY CHANGE: Update modal to show the newly cropped image **
    // Exit crop mode first to trigger cleanup
    setCropMode(false);
    
    // Clear any previous annotations
    setEditingMarkedUpId(null);
    
    // Set the new cropped image as the active image in the modal
    setMagnifyImage(croppedImageDataUrl);
  };

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

  // Copy to clipboard handler
  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard!");
  };

  // Extract PDF pages as images after upload
  useEffect(() => {
    if (!pdfFile) {
      setPageImages([]);
      return;
    }
    (async () => {
      const arrayBuffer = await pdfFile.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const images: string[] = [];
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 0.2 }); // thumbnail size
        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const context = canvas.getContext("2d");
        await page.render({ canvasContext: context!, viewport }).promise;
        images.push(canvas.toDataURL("image/png"));
      }
      setPageImages(images);
    })();
  }, [pdfFile]);

  // Store the loaded PDF document for high-res rendering
  useEffect(() => {
    if (!pdfFile) {
      pdfDocRef.current = null;
      return;
    }
    (async () => {
      const arrayBuffer = await pdfFile.arrayBuffer();
      pdfDocRef.current = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    })();
  }, [pdfFile]);

  // Render high-res image for magnifier modal
  useEffect(() => {
    if (magnifyPageIdx === null || !pdfDocRef.current) {
      setMagnifyImage(null);
      setMagnifyLoading(false);
      return;
    }
    setMagnifyLoading(true);
    (async () => {
      const page = await pdfDocRef.current.getPage(magnifyPageIdx + 1);
      const viewport = page.getViewport({ scale: 1.5 }); // high-res
      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const context = canvas.getContext("2d");
      await page.render({ canvasContext: context!, viewport }).promise;
      setMagnifyImage(canvas.toDataURL("image/png"));
      setMagnifyLoading(false);
    })();
  }, [magnifyPageIdx]);

  // Setup fabric.js canvas when magnifier modal opens
  useEffect(() => {
    if (!magnifyImage || !fabricContainerRef.current) return;
    // Clean up previous canvas
    if (fabricCanvasRef.current) {
      fabricCanvasRef.current.dispose();
      fabricCanvasRef.current = null;
    }
    // Create new canvas
    const img = new window.Image();
    img.onload = () => {
      const width = img.naturalWidth;
      const height = img.naturalHeight;
      setCanvasNaturalSize({ width, height });
      const canvasEl = document.createElement("canvas");
      canvasEl.width = width;
      canvasEl.height = height;
      fabricContainerRef.current!.innerHTML = "";
      fabricContainerRef.current!.appendChild(canvasEl);
      const canvas = new fabric.Canvas(canvasEl, {
        isDrawingMode: true,
        selection: false,
        width,
        height,
      });
      fabric.Image.fromURL(magnifyImage, (bgImg: any) => {
        bgImg.selectable = false;
        canvas.setBackgroundImage(bgImg, canvas.renderAll.bind(canvas), {
          left: 0,
          top: 0,
          scaleX: width / bgImg.width!,
          scaleY: height / bgImg.height!,
          originX: 'left',
          originY: 'top',
        });
      });
      canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
      canvas.freeDrawingBrush.color = penColor;
      canvas.freeDrawingBrush.width = penSize;
      fabricCanvasRef.current = canvas;
    };
    img.src = magnifyImage;
  }, [magnifyImage]);

  // Update pen color/size/eraser
  useEffect(() => {
    if (fabricCanvasRef.current) {
      if (isErasing) {
        fabricCanvasRef.current.isDrawingMode = true;
        fabricCanvasRef.current.freeDrawingBrush = new fabric.PencilBrush(fabricCanvasRef.current);
        fabricCanvasRef.current.freeDrawingBrush.color = "#ffffff";
        fabricCanvasRef.current.freeDrawingBrush.width = penSize * 2;
      } else {
        fabricCanvasRef.current.isDrawingMode = true;
        fabricCanvasRef.current.freeDrawingBrush = new fabric.PencilBrush(fabricCanvasRef.current);
        fabricCanvasRef.current.freeDrawingBrush.color = penColor;
        fabricCanvasRef.current.freeDrawingBrush.width = penSize;
      }
    }
  }, [penColor, penSize, isErasing, magnifyImage]);

  // Open modal for editing a marked-up image
  const handleEditMarkedUpImage = (id: string) => {
    const img = markedUpImages.find(m => m.id === id);
    if (img) {
      setEditingMarkedUpId(id);
      setMagnifyImage(img.url); // will be replaced by fabric load
      setMagnifyPageIdx(null); // not a PDF page
    }
  };

  // Save/download marked-up image (now also saves fabric JSON)
  const handleSaveMarkedUpImage = () => {
    if (fabricCanvasRef.current) {
      const url = fabricCanvasRef.current.toDataURL({ format: "png", multiplier: 1 });
      const json = fabricCanvasRef.current.toJSON();
      const label = magnifyPageIdx !== null ? `Page ${magnifyPageIdx + 1} (Marked)` : `Marked Image`;
      if (editingMarkedUpId) {
        setMarkedUpImages(prev => prev.map(m => m.id === editingMarkedUpId ? { ...m, url, label, json } : m));
        setEditingMarkedUpId(null);
      } else {
        setMarkedUpImages(prev => [...prev, { id: uuidv4(), url, label, json }]);
      }
      // Download
      const a = document.createElement('a');
      a.href = url;
      a.download = `${label.replace(/\s+/g, '_')}.png`;
      a.click();
    }
  };

  // Delete marked-up image with confirmation
  const handleDeleteMarkedUpImage = (id: string) => {
    if (window.confirm('Delete this marked-up image?')) {
      setMarkedUpImages(prev => prev.filter(m => m.id !== id));
    }
  };

  // When opening modal for editing a marked-up image, load its fabric JSON
  useEffect(() => {
    if (editingMarkedUpId && fabricContainerRef.current) {
      const img = markedUpImages.find(m => m.id === editingMarkedUpId);
      if (img && fabricContainerRef.current) {
        if (fabricCanvasRef.current) {
          fabricCanvasRef.current.dispose();
          fabricCanvasRef.current = null;
        }
        const canvasEl = document.createElement("canvas");
        canvasEl.width = 1000;
        canvasEl.height = 1400;
        fabricContainerRef.current.innerHTML = "";
        fabricContainerRef.current.appendChild(canvasEl);
        const canvas = new fabric.Canvas(canvasEl, {
          isDrawingMode: true,
          selection: false,
        });
        canvas.loadFromJSON(img.json, () => {
          canvas.renderAll();
        });
        fabricCanvasRef.current = canvas;
      }
    }
  }, [editingMarkedUpId]);

  // Reset/clear annotation
  const handleResetAnnotation = () => {
    if (fabricCanvasRef.current) {
      fabricCanvasRef.current.getObjects().forEach((obj: any) => {
        if (obj !== fabricCanvasRef.current!.backgroundImage) {
          fabricCanvasRef.current!.remove(obj);
        }
      });
      fabricCanvasRef.current.renderAll();
    }
  };

  // Handler to select a page or marked-up image for a post
  const handleSelectPage = (postId: number, type: 'pdf' | 'marked', value: number | string) => {
    setPostPageMap((prev) => ({ ...prev, [postId]: { type, value } }));
    setSelectingForPost(null);
  };

  // Fit to window handler
  const handleFitToWindow = () => {
    if (!canvasNaturalSize || !modalContentRef.current) return;
    const { width: imgW, height: imgH } = canvasNaturalSize;
    const container = modalContentRef.current;
    const containerW = container.clientWidth;
    const containerH = container.clientHeight;
    const scale = Math.min(containerW / imgW, containerH / imgH, 1);
    setZoom(+scale.toFixed(2));
  };

  // Save only (no download)
  const handleSaveOnlyMarkedUpImage = () => {
    if (fabricCanvasRef.current) {
      const url = fabricCanvasRef.current.toDataURL({ format: "png", multiplier: 1 });
      const json = fabricCanvasRef.current.toJSON();
      const label = magnifyPageIdx !== null ? `Page ${magnifyPageIdx + 1} (Marked)` : `Marked Image`;
      if (editingMarkedUpId) {
        setMarkedUpImages(prev => prev.map(m => m.id === editingMarkedUpId ? { ...m, url, label, json } : m));
        setEditingMarkedUpId(null);
      } else {
        setMarkedUpImages(prev => [...prev, { id: uuidv4(), url, label, json }]);
      }
    }
  };

  return (
    <main className="min-h-screen bg-legal-50 p-4 sm:p-8">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Controls */}
        <div className="card h-fit sticky top-8 col-span-1">
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
                    className="input-field h-32"
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
        {/* Middle Column: PDF Page Thumbnails */}
        <div className="col-span-1">
          <div className="card">
            <h2 className="text-lg font-semibold mb-4 text-legal-700">PDF Pages</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-[70vh] overflow-y-auto">
              {pageImages.length === 0 && <div className="text-legal-400">No PDF loaded.</div>}
              {pageImages.map((img, idx) => (
                <button
                  key={idx}
                  className="border border-legal-200 rounded overflow-hidden focus:ring-2 focus:ring-primary-500"
                  onClick={() => setMagnifyPageIdx(idx)}
                  tabIndex={0}
                  aria-label={`Magnify Page ${idx + 1}`}
                >
                  <img src={img} alt={`Page ${idx + 1}`} className="w-full h-auto" />
                  <div className="text-xs text-center text-legal-500 py-1">Page {idx + 1}</div>
                </button>
              ))}
            </div>
            {/* Marked-up Images Gallery */}
            {markedUpImages.length > 0 && (
              <div className="mt-6">
                <h3 className="text-sm font-semibold mb-2 text-legal-700">Marked-up Images</h3>
                <div className="flex flex-wrap gap-4">
                  {markedUpImages.map((img) => (
                    <div key={img.id} className="relative group border border-legal-200 rounded overflow-hidden shadow-lg" style={{ width: 120 }}>
                      <img src={img.url} alt={img.label} className="h-28 w-full object-contain bg-white" />
                      <div className="text-xs text-center text-legal-500 py-1 truncate">{img.label}</div>
                      <div className="absolute top-2 right-2 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button title="Edit" className="bg-blue-500 text-white rounded-full p-1 shadow" onClick={() => handleEditMarkedUpImage(img.id)}>
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M9 13l6-6m2 2l-6 6m-2 2h6" /></svg>
                        </button>
                        <button title="Download" className="bg-green-500 text-white rounded-full p-1 shadow" onClick={() => { const a = document.createElement('a'); a.href = img.url; a.download = `${img.label.replace(/\s+/g, '_')}.png`; a.click(); }}>
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V4" /></svg>
                        </button>
                        <button title="Delete" className="bg-red-500 text-white rounded-full p-1 shadow" onClick={() => handleDeleteMarkedUpImage(img.id)}>
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          {/* Magnifier Modal with Annotation */}
          <Dialog open={magnifyPageIdx !== null || editingMarkedUpId !== null} onClose={() => { setMagnifyPageIdx(null); setEditingMarkedUpId(null); }} className="fixed z-50 inset-0 flex items-center justify-center">
            <Dialog.Overlay className="fixed inset-0 bg-black/40" />
            <div className="relative z-10 bg-white rounded-lg shadow-lg p-4" style={{ width: '90vw', height: '90vh', maxWidth: '90vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              {/* Toolbar at the top */}
              <div className={`w-full flex items-center gap-2 bg-white/95 border-b border-legal-200 px-4 py-2 sticky top-0 z-20 ${toolbarCollapsed ? 'h-8 min-h-8' : ''}`} style={{ minHeight: toolbarCollapsed ? 32 : 56, transition: 'min-height 0.2s' }}>
                <button onClick={() => setToolbarCollapsed(c => !c)} className="text-legal-500 hover:text-primary-600 focus:outline-none mr-2" title={toolbarCollapsed ? 'Show Tools' : 'Hide Tools'}>
                  {toolbarCollapsed ? (
                    <svg width="20" height="20" fill="none" viewBox="0 0 24 24"><path d="M12 8v8m0 0l-4-4m4 4l4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  ) : (
                    <svg width="20" height="20" fill="none" viewBox="0 0 24 24"><path d="M12 16V8m0 0l-4 4m4-4l4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  )}
                </button>
                {!toolbarCollapsed && <>
                  <span className="font-semibold text-legal-700 select-none">✥ Tools</span>
                  <div className="flex items-center gap-1 flex-wrap">
                    <button className="btn-secondary px-2" onClick={handleZoomOut} title="Zoom Out">-</button>
                    <span className="text-xs w-10 text-center">{Math.round(zoom * 100)}%</span>
                    <button className="btn-secondary px-2" onClick={handleZoomIn} title="Zoom In">+</button>
                    <button className="btn-secondary px-2" onClick={handleZoomReset} title="Reset Zoom">⟳</button>
                    <button className="btn-secondary px-2" onClick={handleFitToWindow} title="Fit to Window">🗖</button>
                  </div>
                  <button className={`btn-secondary px-2 ${panMode ? 'bg-blue-200' : ''}`} onClick={() => setPanMode(p => !p)} title="Pan Mode (Hand Tool, disables drawing)">🖐️</button>
                  <button className={`btn-secondary px-2 ${cropMode ? 'bg-blue-200' : ''}`} onClick={() => setCropMode(c => !c)} title="Crop Tool">
                    <Crop className="w-4 h-4" />
                  </button>
                  <label className="text-sm text-legal-700">Pen Color:
                    <input type="color" value={penColor} onChange={e => setPenColor(e.target.value)} className="ml-2 w-8 h-8 border rounded-full" />
                  </label>
                  <label className="text-sm text-legal-700">Pen Size:
                    <input type="range" min={2} max={16} value={penSize} onChange={e => setPenSize(Number(e.target.value))} className="ml-2" />
                    <span className="ml-2">{penSize}px</span>
                  </label>
                  <button className={`btn-secondary py-1 px-3 text-sm ${isErasing ? 'bg-red-200' : ''}`} onClick={() => setIsErasing(e => !e)}>{isErasing ? 'Eraser (On)' : 'Eraser'}</button>
                  <button className="btn-secondary py-1 px-3 text-sm" onClick={handleResetAnnotation}>Reset</button>
                  <button className="btn-primary py-1 px-3 text-sm" onClick={handleSaveOnlyMarkedUpImage}>Save</button>
                  <button className="btn-primary py-1 px-3 text-sm" onClick={handleSaveMarkedUpImage}>Save & Download</button>
                  {cropRect && (
                    <button className="btn-primary py-1 px-3 text-sm animate-pulse" onClick={handleApplyCrop}>Apply Crop</button>
                  )}
                </>}
              </div>
              {magnifyLoading && <div className="text-legal-500">Loading high-res page...</div>}
              <div style={{ width: '100%', height: '100%', overflow: 'auto', flex: 1, background: '#f9f9f9', borderRadius: 8, border: '1px solid #eee', marginBottom: 16, display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'relative' }}>
                <div ref={fabricContainerRef} style={{ width: canvasNaturalSize ? canvasNaturalSize.width * zoom : undefined, height: canvasNaturalSize ? canvasNaturalSize.height * zoom : undefined, margin: 'auto' }} />
              </div>
              {(magnifyImage || editingMarkedUpId) && (
                <div className="flex gap-2 items-center mt-2">
                  {magnifyPageIdx !== null && (
                    <>
                      <button className="btn-secondary" disabled={magnifyPageIdx <= 0} onClick={() => setMagnifyPageIdx(idx => (idx !== null && idx > 0 ? idx - 1 : idx))}>Prev</button>
                      <span className="text-xs text-legal-700">Page {magnifyPageIdx + 1}</span>
                      <button className="btn-secondary" disabled={magnifyPageIdx >= pageImages.length - 1} onClick={() => setMagnifyPageIdx(idx => (idx !== null && idx < pageImages.length - 1 ? idx + 1 : idx))}>Next</button>
                    </>
                  )}
                  <button className="btn-secondary" onClick={() => { setMagnifyPageIdx(null); setEditingMarkedUpId(null); }}>Close</button>
                </div>
              )}
            </div>
          </Dialog>
        </div>
        {/* Right Column: Thread Editor */}
        <div className="col-span-1 lg:col-span-1 space-y-8">
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
                      <div key={post.id} className="relative">
                        <SortablePostItem 
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
                        />
                        {/* Manual Page Matching UI */}
                        <div className="mt-2 flex items-center gap-2">
                          <button
                            className="btn-secondary text-xs px-2 py-1"
                            onClick={() => setSelectingForPost(post.id)}
                          >
                            {postPageMap[post.id] ? 'Change Page/Image' : 'Select Page/Image'}
                          </button>
                          {postPageMap[post.id] && (
                            (() => {
                              const mapping = postPageMap[post.id];
                              if (mapping?.type === 'pdf' && typeof mapping.value === 'number' && pageImages[mapping.value]) {
                                return <img src={pageImages[mapping.value]} alt={`Page ${mapping.value + 1}`} className="h-16 w-auto border border-legal-200 rounded shadow-sm" />;
                              }
                              if (mapping?.type === 'marked' && typeof mapping.value === 'string') {
                                const img = markedUpImages.find(m => m.id === mapping.value);
                                if (img) return <img src={img.url} alt={img.label} className="h-16 w-auto border border-legal-200 rounded shadow-sm" />;
                              }
                              return null;
                            })()
                          )}
                        </div>
                        {/* Page/Image Picker Modal/Popover */}
                        {selectingForPost === post.id && (
                          <div className="absolute z-20 bg-white border border-legal-300 rounded shadow-lg p-2 mt-2 left-0 w-full max-w-xs">
                            <div className="text-xs text-legal-700 mb-2">Select a page or marked-up image for this post:</div>
                            <div className="grid grid-cols-4 gap-2 max-h-40 overflow-y-auto">
                              {/* Original PDF pages */}
                              {pageImages.map((img, idx) => (
                                <button
                                  key={`pdf-${idx}`}
                                  className="border border-legal-200 rounded focus:ring-2 focus:ring-primary-500"
                                  onClick={() => handleSelectPage(post.id, 'pdf', idx)}
                                >
                                  <img src={img} alt={`Page ${idx + 1}`} />
                                </button>
                              ))}
                              {/* Marked-up images */}
                              {markedUpImages.map((img) => (
                                <button
                                  key={`marked-${img.id}`}
                                  className="border border-legal-200 rounded focus:ring-2 focus:ring-primary-500"
                                  onClick={() => handleSelectPage(post.id, 'marked', img.id)}
                                >
                                  <img src={img.url} alt={img.label} />
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
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