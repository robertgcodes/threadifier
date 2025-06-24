"use client";
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { fabric } from 'fabric';
import { Dialog } from '@headlessui/react';
import { 
  Crop, Loader2, Minus, Plus, RefreshCw, Hand, 
  Square, Circle, ArrowRight, Type, Download, Save,
  RotateCcw, PenTool, Eraser, ChevronLeft, ChevronRight
} from 'lucide-react';
import { MarkedUpImage } from '../types';

interface AnnotationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (url: string, json: any) => void;
  onCrop: (url: string) => void;
  pageImages: string[];
  initialPage: number | null;
  editingMarkedUpImage?: MarkedUpImage;
  userProfile?: {
    displayName: string;
    username: string;
    xHandle: string;
    instagramHandle: string;
    avatar: string | null;
  };
}

type Tool = 'select' | 'draw' | 'erase' | 'pan' | 'crop' | 'text' | 'rect' | 'circle' | 'arrow';
type CropAspectRatio = 'free' | '1:1' | '4:5' | '16:9' | '9:16' | '4:3' | '3:4' | 'twitter-single' | 'twitter-multi';

export default function AnnotationModal({
  isOpen,
  onClose,
  onSave,
  onCrop,
  pageImages,
  initialPage,
  editingMarkedUpImage,
  userProfile
}: AnnotationModalProps) {
  const [currentPageIdx, setCurrentPageIdx] = useState(initialPage);
  const [currentImage, setCurrentImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCropping, setIsCropping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const fabricCanvasRef = useRef<fabric.Canvas | null>(null);
  const canvasElRef = useRef<HTMLCanvasElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const imageElementRef = useRef<fabric.Image | null>(null);

  // Tool state
  const [activeTool, setActiveTool] = useState<Tool>('draw');
  const [penColor, setPenColor] = useState<string>("#e11d48");
  const [penSize, setPenSize] = useState<number>(4);
  const [textColor, setTextColor] = useState<string>("#000000");
  const [textSize, setTextSize] = useState<number>(16);
  const [textFont, setTextFont] = useState<string>("Arial");
  const [zoom, setZoom] = useState(1);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  
  // Crop state
  const [cropRect, setCropRect] = useState<fabric.Rect | null>(null);
  const [cropAspectRatio, setCropAspectRatio] = useState<CropAspectRatio>('twitter-single');
  const [forceUpdateCounter, setForceUpdateCounter] = useState(0); // Force re-renders for validation
  
  // X (Twitter) preview mode
  const [showXPreview, setShowXPreview] = useState(false);
  
  // Image quality validation
  const [imageDimensions, setImageDimensions] = useState<{width: number, height: number} | null>(null);
  const [imageQualityWarnings, setImageQualityWarnings] = useState<string[]>([]);
  const [showWarnings, setShowWarnings] = useState(() => {
    // Persist collapse state in localStorage
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('annotation-x-warnings-expanded');
      return saved !== null ? JSON.parse(saved) : true;
    }
    return true;
  });

  // Save warnings collapse state
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('annotation-x-warnings-expanded', JSON.stringify(showWarnings));
    }
  }, [showWarnings]);

  // Initialize image when modal opens
  useEffect(() => {
    if (!isOpen) {
      setCurrentImage(null);
      setError(null);
      setActiveTool('draw');
      setHistory([]);
      setHistoryIndex(-1);
      setCropRect(null);
      setZoom(1);
      return;
    }

    setCurrentPageIdx(initialPage);
    setIsLoading(true);
    setError(null);

    let targetImage = '';
    if (editingMarkedUpImage) {
      targetImage = editingMarkedUpImage.url;
    } else if (initialPage !== null && pageImages[initialPage]) {
      targetImage = pageImages[initialPage];
    }

    if (targetImage) {
      // Preload image to check for errors and get dimensions
      const img = new Image();
      img.onload = () => {
        setCurrentImage(targetImage);
        setIsLoading(false);
        
        // Capture image dimensions and validate for X
        const dimensions = { width: img.naturalWidth, height: img.naturalHeight };
        setImageDimensions(dimensions);
        const warnings = validateImageForX(dimensions.width, dimensions.height);
        setImageQualityWarnings(warnings);
      };
      img.onerror = () => {
        setError('Failed to load image');
        setIsLoading(false);
      };
      img.src = targetImage;
    } else {
      setError('No image available');
      setIsLoading(false);
    }
  }, [isOpen, initialPage, pageImages, editingMarkedUpImage]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' && currentPageIdx !== null && currentPageIdx > 0) {
        e.preventDefault();
        const newPageIdx = currentPageIdx - 1;
        setCurrentPageIdx(newPageIdx);
        const newImage = pageImages[newPageIdx];
        if (newImage) {
          setCurrentImage(newImage);
        }
      } else if (e.key === 'ArrowRight' && currentPageIdx !== null && currentPageIdx < pageImages.length - 1) {
        e.preventDefault();
        const newPageIdx = currentPageIdx + 1;
        setCurrentPageIdx(newPageIdx);
        const newImage = pageImages[newPageIdx];
        if (newImage) {
          setCurrentImage(newImage);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentPageIdx, pageImages]);

  // Initialize fabric canvas with DOM isolation
  useEffect(() => {
    if (!isOpen) return;

    let isInitializing = false;
    let initAttempts = 0;
    const maxAttempts = 10;

    // Wait for the modal to be fully rendered
    const initCanvas = () => {
      if (isInitializing || initAttempts >= maxAttempts) return;
      initAttempts++;
      
      const wrapper = document.getElementById('fabric-canvas-wrapper');
      if (!wrapper || !canvasElRef.current) {
        console.log(`Canvas wrapper not ready, attempt ${initAttempts}/${maxAttempts}, retrying...`);
        setTimeout(initCanvas, 100);
        return;
      }

      // Only initialize if we don't already have a canvas
      if (fabricCanvasRef.current) {
        console.log('Canvas already exists, skipping initialization');
        return;
      }

      isInitializing = true;
      console.log('Initializing fabric canvas with DOM isolation');
      
      try {
        // Create a completely new canvas element to avoid React interference
        const newCanvas = document.createElement('canvas');
        newCanvas.style.display = 'block';
        
        // Remove the React-managed canvas and replace with our own
        const reactCanvas = canvasElRef.current;
        wrapper.removeChild(reactCanvas);
        wrapper.appendChild(newCanvas);
        
        // We'll use newCanvas directly instead of updating the ref
        
        // Get container dimensions
        const container = canvasContainerRef.current;
        const containerWidth = container?.clientWidth || 800;
        const containerHeight = container?.clientHeight || 600;
        
        console.log('Container dimensions:', containerWidth, 'x', containerHeight);
        
        // Initialize fabric on our isolated canvas
        const canvas = new fabric.Canvas(newCanvas, {
          width: Math.min(containerWidth - 50, 1000),
          height: Math.min(containerHeight - 50, 800),
          backgroundColor: '#ffffff',
          enableRetinaScaling: false,
          skipOffscreen: false,
          renderOnAddRemove: false,
          allowTouchScrolling: false,
          stopContextMenu: true,
          fireRightClick: false,
          stateful: false
        });
        
        console.log('Canvas set to:', canvas.width, 'x', canvas.height);
        fabricCanvasRef.current = canvas;
        
        // Set up canvas event handlers with error protection
        const saveToHistory = () => {
          try {
            if (!fabricCanvasRef.current) return;
            const json = JSON.stringify(fabricCanvasRef.current.toJSON(['selectable', 'evented']));
            setHistory(prev => {
              const newHistory = prev.slice(0, historyIndex + 1);
              newHistory.push(json);
              return newHistory;
            });
            setHistoryIndex(prev => prev + 1);
          } catch (error) {
            console.error('Error saving to history:', error);
          }
        };

        const handlePathCreated = (e: any) => {
          try {
            console.log('Path created:', e.path);
            saveToHistory();
          } catch (error) {
            console.error('Error handling path creation:', error);
          }
        };

        canvas.on('path:created', handlePathCreated);
        canvas.on('object:added', saveToHistory);
        canvas.on('object:removed', saveToHistory);
        canvas.on('object:modified', saveToHistory);
        
        // Initial render with protection
        requestAnimationFrame(() => {
          try {
            if (fabricCanvasRef.current === canvas) {
              canvas.renderAll();
              console.log('Canvas initialized successfully with DOM isolation');
            }
          } catch (renderError) {
            console.error('Error during initial render:', renderError);
          } finally {
            isInitializing = false;
          }
        });
        
      } catch (error) {
        console.error('Error initializing canvas:', error);
        fabricCanvasRef.current = null;
        isInitializing = false;
      }
    };

    // Start initialization after DOM is stable
    const timer = setTimeout(initCanvas, 500);

    return () => {
      clearTimeout(timer);
      isInitializing = false;
    };
  }, [isOpen]);

  // Real-time crop quality validation
  useEffect(() => {
    if (!imageDimensions) return;
    
    // Update warnings when crop rect changes
    const updateValidation = () => {
      // Always call validateImageForX with original dimensions - it will handle crop logic internally
      const warnings = validateImageForX(imageDimensions.width, imageDimensions.height);
      setImageQualityWarnings(warnings);
    };

    // Set up canvas listener for crop rect modifications
    const canvas = fabricCanvasRef.current;
    if (canvas && cropRect) {
      const handleObjectChange = (e: any) => {
        // Only update if the modified object is the crop rectangle
        if (e.target === cropRect) {
          console.log('Crop rect being modified:', e.type, cropRect.width, cropRect.height);
          // Force immediate update for real-time feedback
          requestAnimationFrame(() => {
            updateValidation();
            setForceUpdateCounter(prev => prev + 1); // Force component re-render
          });
        }
      };
      
      const handleObjectModified = (e: any) => {
        // Only update if the modified object is the crop rectangle
        if (e.target === cropRect) {
          console.log('Crop rect modification complete:', e.type, cropRect.width, cropRect.height);
          // Force immediate update for real-time feedback
          requestAnimationFrame(updateValidation);
        }
      };
      
      // Listen to real-time events during interaction
      canvas.on('object:scaling', handleObjectChange);
      canvas.on('object:moving', handleObjectChange);
      canvas.on('object:resizing', handleObjectChange);
      canvas.on('object:rotating', handleObjectChange);
      
      // Listen to completion events
      canvas.on('object:modified', handleObjectModified);
      
      // Also add a direct listener to the crop rectangle itself
      if (cropRect.on) {
        cropRect.on('scaling', () => {
          console.log('Direct crop rect scaling event');
          requestAnimationFrame(updateValidation);
        });
        cropRect.on('moving', () => {
          console.log('Direct crop rect moving event');
          requestAnimationFrame(updateValidation);
        });
        cropRect.on('modified', () => {
          console.log('Direct crop rect modified event');
          requestAnimationFrame(updateValidation);
        });
      }
      
      // Initial validation update
      updateValidation();
      
      return () => {
        canvas.off('object:scaling', handleObjectChange);
        canvas.off('object:moving', handleObjectChange);
        canvas.off('object:resizing', handleObjectChange);
        canvas.off('object:rotating', handleObjectChange);
        canvas.off('object:modified', handleObjectModified);
        
        // Clean up direct listeners on crop rect
        if (cropRect.off) {
          cropRect.off('scaling');
          cropRect.off('moving');
          cropRect.off('modified');
        }
      };
    } else {
      // Update validation even when no crop rect (for original image analysis)
      updateValidation();
    }
  }, [cropRect, imageDimensions, cropAspectRatio, fabricCanvasRef.current, forceUpdateCounter]);

  // Additional effect to watch for crop rect property changes using RAF
  useEffect(() => {
    if (!cropRect || !imageDimensions) return;

    let animationFrameId: number;
    let lastKnownDimensions = { 
      left: cropRect.left, 
      top: cropRect.top, 
      width: cropRect.getScaledWidth(), 
      height: cropRect.getScaledHeight(),
      scaleX: cropRect.scaleX,
      scaleY: cropRect.scaleY
    };

    const checkForChanges = () => {
      if (cropRect && fabricCanvasRef.current) {
        const currentDimensions = {
          left: cropRect.left,
          top: cropRect.top,
          width: cropRect.getScaledWidth(),
          height: cropRect.getScaledHeight(),
          scaleX: cropRect.scaleX,
          scaleY: cropRect.scaleY
        };

        // Check if dimensions have changed (including scale)
        if (
          currentDimensions.left !== lastKnownDimensions.left ||
          currentDimensions.top !== lastKnownDimensions.top ||
          currentDimensions.width !== lastKnownDimensions.width ||
          currentDimensions.height !== lastKnownDimensions.height ||
          currentDimensions.scaleX !== lastKnownDimensions.scaleX ||
          currentDimensions.scaleY !== lastKnownDimensions.scaleY
        ) {
          console.log('RAF detected crop rect change:', currentDimensions);
          // Call validateImageForX with original dimensions - it handles crop internally
          const warnings = validateImageForX(imageDimensions.width, imageDimensions.height);
          setImageQualityWarnings(warnings);
          setForceUpdateCounter(prev => prev + 1); // Force component re-render
          lastKnownDimensions = currentDimensions;
        }
      }
      
      animationFrameId = requestAnimationFrame(checkForChanges);
    };

    animationFrameId = requestAnimationFrame(checkForChanges);

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [cropRect, imageDimensions]);

  // Cleanup canvas when modal closes
  useEffect(() => {
    if (!isOpen && fabricCanvasRef.current) {
      console.log('Cleaning up isolated canvas on modal close');
      try {
        const canvas = fabricCanvasRef.current;
        
        // Remove all event listeners
        canvas.off('path:created');
        canvas.off('object:added');
        canvas.off('object:removed');
        canvas.off('object:modified');
        canvas.off('mouse:down');
        canvas.off('mouse:move');
        canvas.off('mouse:up');
        
        // Clear all objects
        canvas.clear();
        
        // Dispose of the canvas
        canvas.dispose();
      } catch (error) {
        console.error('Error disposing canvas:', error);
      }
      fabricCanvasRef.current = null;
      imageElementRef.current = null;
    }
  }, [isOpen]);

  // Load image into canvas
  useEffect(() => {
    if (!currentImage) {
      console.log('No current image to load');
      return;
    }

    // Wait for canvas to be ready with better error handling
    const loadImage = () => {
      const canvas = fabricCanvasRef.current;
      if (!canvas || !canvas.getContext) {
        console.log('Canvas not ready for image loading, retrying...');
        setTimeout(loadImage, 150);
        return;
      }
      
      console.log('Loading image into canvas:', currentImage);
      setIsLoading(true);
      
      try {
        // Disable rendering during canvas operations
        canvas.renderOnAddRemove = false;
        canvas.clear();
      } catch (error) {
        console.error('Error clearing canvas:', error);
        setTimeout(loadImage, 200);
        return;
      }

      const isEditingExisting = editingMarkedUpImage?.url === currentImage;
      
      if (isEditingExisting && editingMarkedUpImage.json) {
        // Load existing markup
        console.log('Loading existing markup');
        canvas.loadFromJSON(editingMarkedUpImage.json, () => {
          // Find the background image object (should be the first/bottom object)
          const objects = canvas.getObjects();
          const bgImage = objects.find(obj => obj instanceof fabric.Image) as fabric.Image;
          if (bgImage) {
            fitCanvasToImage(bgImage.width! * bgImage.scaleX!, bgImage.height! * bgImage.scaleY!);
          }
          canvas.renderAll();
          setIsLoading(false);
          initializeHistory();
        });
      } else {
        // Load fresh image
        console.log('Loading fresh image from URL:', currentImage);
        
        // Add error handling for fabric.Image.fromURL
        fabric.Image.fromURL(
          currentImage,
          (img) => {
            console.log('Image loaded successfully:', img.width, 'x', img.height);
            
            if (!canvas || !img.width || !img.height) {
              console.error('Invalid canvas or image dimensions');
              setError('Failed to load image');
              setIsLoading(false);
              return;
            }

            const containerWidth = canvasContainerRef.current?.clientWidth || 800;
            const containerHeight = canvasContainerRef.current?.clientHeight || 600;
            
            // Use the canvas dimensions we already set
            const canvasWidth = canvas.width!;
            const canvasHeight = canvas.height!;
            
            console.log('Using canvas dimensions:', canvasWidth, 'x', canvasHeight);
            console.log('Original image dimensions:', img.width, 'x', img.height);
            
            // Calculate scale to fit image nicely in canvas
            const scaleX = (canvasWidth * 0.9) / img.width!; // Use 90% of canvas width
            const scaleY = (canvasHeight * 0.9) / img.height!; // Use 90% of canvas height
            const scale = Math.min(scaleX, scaleY); // Keep aspect ratio
            
            console.log('Image scale factor:', scale);
            
            // Center the image in the canvas
            const scaledWidth = img.width! * scale;
            const scaledHeight = img.height! * scale;
            
            img.set({
              left: (canvasWidth - scaledWidth) / 2,
              top: (canvasHeight - scaledHeight) / 2,
              scaleX: scale,
              scaleY: scale,
              selectable: false,
              evented: false,
              lockMovementX: true,
              lockMovementY: true,
              lockScalingX: true,
              lockScalingY: true,
              lockRotation: true,
              hasControls: false,
              hasBorders: false,
              opacity: 1.0,
              visible: true
            });
            
            console.log('Image positioned at:', {
              left: img.left,
              top: img.top,
              scaleX: img.scaleX,
              scaleY: img.scaleY,
              scaledWidth,
              scaledHeight
            });
            
            try {
              // Add image as the first object (bottom layer)
              canvas.add(img);
              canvas.sendToBack(img); // Ensure it's behind all other objects
              
              console.log('Image added to canvas successfully');
              console.log('Canvas objects count:', canvas.getObjects().length);
              console.log('Image visible?', img.visible);
              console.log('Image opacity:', img.opacity);
              
              // Re-enable rendering and render once using RAF
              canvas.renderOnAddRemove = true;
              
              // Use requestAnimationFrame to prevent DOM conflicts
              requestAnimationFrame(() => {
                try {
                  if (fabricCanvasRef.current === canvas) {
                    canvas.renderAll();
                    setIsLoading(false);
                    initializeHistory();
                    
                    // Additional render after a frame to ensure stability
                    requestAnimationFrame(() => {
                      try {
                        if (fabricCanvasRef.current === canvas) {
                          console.log('Force re-rendering canvas');
                          console.log('Canvas objects after RAF:', canvas.getObjects().length);
                          canvas.renderAll();
                        }
                      } catch (renderError) {
                        console.error('Error during force re-render:', renderError);
                      }
                    });
                  }
                } catch (renderError) {
                  console.error('Error during RAF render:', renderError);
                  setIsLoading(false);
                }
              });
              
            } catch (error) {
              console.error('Error adding image to canvas:', error);
              setError('Failed to add image to canvas');
              setIsLoading(false);
              // Re-enable rendering even on error
              canvas.renderOnAddRemove = true;
            }
            
            imageElementRef.current = img;
            setZoom(1);
          },
          {
            crossOrigin: 'anonymous'
          }
        );
      }
    };

    // Start loading after canvas is ready
    loadImage();

  }, [currentImage, editingMarkedUpImage]);

  const initializeHistory = () => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    
    // Create history snapshot including the background image
    const json = JSON.stringify(canvas.toJSON(['selectable', 'evented', 'lockMovementX', 'lockMovementY', 'lockScalingX', 'lockScalingY', 'lockRotation', 'hasControls', 'hasBorders']));
    setHistory([json]);
    setHistoryIndex(0);
    console.log('History initialized with', canvas.getObjects().length, 'objects');
  };

  const fitCanvasToImage = (imgWidth: number, imgHeight: number) => {
    const canvas = fabricCanvasRef.current;
    const container = canvasContainerRef.current;
    if (!canvas || !container) return;

    const containerWidth = container.clientWidth - 40;
    const containerHeight = container.clientHeight - 40;
    
    // For tall documents, prioritize height
    const imageAspectRatio = imgWidth / imgHeight;
    let newWidth, newHeight;
    
    if (imageAspectRatio < 0.9) { // Tall document
      newHeight = Math.min(containerHeight, imgHeight);
      newWidth = newHeight * imageAspectRatio;
    } else {
      newWidth = Math.min(containerWidth, imgWidth);
      newHeight = newWidth / imageAspectRatio;
    }
    
    // Ensure minimum size for usability
    newWidth = Math.max(newWidth, 400);
    newHeight = Math.max(newHeight, 300);
    
    console.log('Fitting canvas to image:', { newWidth, newHeight, containerWidth, containerHeight });
    canvas.setDimensions({ width: newWidth, height: newHeight });
    canvas.renderAll();
  };

  // Tool handlers
  const handleToolChange = useCallback((tool: Tool) => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    try {
      // Clean up previous tool and event listeners
      canvas.isDrawingMode = false;
      canvas.selection = true;
      canvas.defaultCursor = 'default';
      canvas.hoverCursor = 'move';
      
      // Remove any existing pan/crop event listeners
      canvas.off('mouse:down');
      canvas.off('mouse:move');
      canvas.off('mouse:up');
      
      // Clear crop rect when switching tools
      if (tool !== 'crop' && cropRect) {
        canvas.remove(cropRect);
        setCropRect(null);
      }

      setActiveTool(tool);
    } catch (error) {
      console.error('Error during tool change:', error);
      return;
    }

    try {
      switch (tool) {
        case 'draw':
          canvas.isDrawingMode = true;
          canvas.freeDrawingBrush.color = penColor;
          canvas.freeDrawingBrush.width = penSize;
          canvas.freeDrawingBrush.strokeLineCap = 'round';
          canvas.freeDrawingBrush.strokeLineJoin = 'round';
          canvas.renderAll();
          break;
        
        case 'erase':
          canvas.isDrawingMode = true;
          // Use white brush for erasing effect
          canvas.freeDrawingBrush.color = '#ffffff';
          canvas.freeDrawingBrush.width = penSize * 2;
          canvas.freeDrawingBrush.strokeLineCap = 'round';
          canvas.freeDrawingBrush.strokeLineJoin = 'round';
          break;
        
        case 'pan':
          canvas.selection = false;
          canvas.defaultCursor = 'grab';
          canvas.hoverCursor = 'grab';
          setupPanMode(canvas);
          break;
        
        case 'crop':
          canvas.selection = false;
          canvas.defaultCursor = 'crosshair';
          setupCropMode(canvas);
          break;
      }
    } catch (error) {
      console.error('Error setting up tool:', tool, error);
    }
  }, [penColor, penSize, cropRect]);

  const setupPanMode = (canvas: fabric.Canvas) => {
    let isDragging = false;
    let lastPosX = 0;
    let lastPosY = 0;

    const onMouseDown = (opt: fabric.IEvent) => {
      const evt = opt.e as MouseEvent;
      isDragging = true;
      canvas.selection = false;
      lastPosX = evt.clientX;
      lastPosY = evt.clientY;
      canvas.defaultCursor = 'grabbing';
    };

    const onMouseMove = (opt: fabric.IEvent) => {
      if (isDragging) {
        const evt = opt.e as MouseEvent;
        const vpt = canvas.viewportTransform!;
        vpt[4] += evt.clientX - lastPosX;
        vpt[5] += evt.clientY - lastPosY;
        canvas.requestRenderAll();
        lastPosX = evt.clientX;
        lastPosY = evt.clientY;
      }
    };

    const onMouseUp = () => {
      isDragging = false;
      canvas.selection = true;
      canvas.defaultCursor = 'grab';
    };

    canvas.on('mouse:down', onMouseDown);
    canvas.on('mouse:move', onMouseMove);
    canvas.on('mouse:up', onMouseUp);
  };

  const setupCropMode = (canvas: fabric.Canvas) => {
    let isDown = false;
    let startX = 0;
    let startY = 0;
    let rect: fabric.Rect;

    const onMouseDown = (opt: fabric.IEvent) => {
      // Check if we're clicking on an existing crop rect (more robust detection)
      const target = opt.target;
      if (target && target instanceof fabric.Rect && target.stroke === '#3b82f6' && target.strokeWidth === 2) {
        return; // Allow manipulation of existing crop rect
      }

      // Also check if we have a tracked crop rect and it's the target
      if (cropRect && target === cropRect) {
        return; // Allow manipulation of existing crop rect
      }

      const pointer = canvas.getPointer(opt.e);
      isDown = true;
      startX = pointer.x;
      startY = pointer.y;

      // Remove all existing crop rectangles (not just the tracked one)
      const objects = canvas.getObjects();
      objects.forEach(obj => {
        if (obj instanceof fabric.Rect && obj.stroke === '#3b82f6' && obj.strokeWidth === 2) {
          canvas.remove(obj);
        }
      });
      setCropRect(null);

      rect = new fabric.Rect({
        left: startX,
        top: startY,
        width: 0,
        height: 0,
        stroke: '#3b82f6',
        strokeWidth: 2,
        fill: 'rgba(59, 130, 246, 0.1)',
        selectable: true,
        strokeDashArray: [],
        cornerColor: '#3b82f6',
        cornerSize: 6,
        transparentCorners: false,
        cornerStyle: 'circle',
        borderColor: '#3b82f6',
        borderDashArray: [5, 5]
      });

      canvas.add(rect);
      setCropRect(rect);
    };

    const onMouseMove = (opt: fabric.IEvent) => {
      if (!isDown || !rect) return;

      const pointer = canvas.getPointer(opt.e);
      let width = pointer.x - startX;
      let height = pointer.y - startY;

      // Apply aspect ratio constraints
      if (cropAspectRatio !== 'free') {
        const aspectRatio = getAspectRatioValue(cropAspectRatio);
        if (Math.abs(width) / Math.abs(height) > aspectRatio) {
          width = height * aspectRatio * Math.sign(width);
        } else {
          height = width / aspectRatio * Math.sign(height);
        }
      }

      rect.set({
        width: Math.abs(width),
        height: Math.abs(height),
        left: width < 0 ? startX + width : startX,
        top: height < 0 ? startY + height : startY
      });

      canvas.renderAll();
      
      // Update validation in real-time while drawing crop
      if (imageDimensions && rect) {
        // Temporarily set the cropRect so validation can use it
        setCropRect(rect);
        requestAnimationFrame(() => {
          const warnings = validateImageForX(imageDimensions.width, imageDimensions.height);
          setImageQualityWarnings(warnings);
          setForceUpdateCounter(prev => prev + 1);
        });
      }
    };

    const onMouseUp = () => {
      isDown = false;
      if (rect) {
        rect.setCoords();
        canvas.setActiveObject(rect);
        // Remove event listeners after crop is complete
        canvas.off('mouse:down', onMouseDown);
        canvas.off('mouse:move', onMouseMove);
        canvas.off('mouse:up', onMouseUp);
        
        // Re-enable selection mode
        canvas.selection = true;
        console.log('Crop rectangle created, switching to selection mode');
      }
    };

    canvas.on('mouse:down', onMouseDown);
    canvas.on('mouse:move', onMouseMove);
    canvas.on('mouse:up', onMouseUp);
  };

  const getAspectRatioValue = (ratio: CropAspectRatio): number => {
    switch (ratio) {
      case '1:1': return 1;
      case '4:5': return 0.8;
      case '16:9': return 16/9;
      case '9:16': return 9/16;
      case '4:3': return 4/3;
      case '3:4': return 3/4;
      case 'twitter-single': return 16/9; // 1200x675 optimal for single X images
      case 'twitter-multi': return 2/1; // 1200x600 optimal for multiple X images
      default: return 1;
    }
  };

  const createCropBoxWithAspectRatio = (aspectRatio: CropAspectRatio) => {
    const canvas = fabricCanvasRef.current;
    if (!canvas || aspectRatio === 'free') return;

    // Remove all existing crop rectangles (not just the tracked one)
    const objects = canvas.getObjects();
    objects.forEach(obj => {
      if (obj instanceof fabric.Rect && obj.stroke === '#3b82f6' && obj.strokeWidth === 2) {
        canvas.remove(obj);
      }
    });
    
    // Clear the tracked crop rect
    setCropRect(null);

    const aspectValue = getAspectRatioValue(aspectRatio);
    const canvasCenter = canvas.getCenter();
    
    // Default size
    let width = 200;
    let height = width / aspectValue;
    
    // Adjust if too tall for canvas
    if (height > canvas.height! * 0.8) {
      height = canvas.height! * 0.8;
      width = height * aspectValue;
    }
    
    // Adjust if too wide for canvas
    if (width > canvas.width! * 0.8) {
      width = canvas.width! * 0.8;
      height = width / aspectValue;
    }

    const rect = new fabric.Rect({
      left: canvasCenter.left - width / 2,
      top: canvasCenter.top - height / 2,
      width: width,
      height: height,
      stroke: '#3b82f6',
      strokeWidth: 2,
      fill: 'rgba(59, 130, 246, 0.1)',
      selectable: true,
      strokeDashArray: [],
      cornerColor: '#3b82f6',
      cornerSize: 6,
      transparentCorners: false,
      cornerStyle: 'circle',
      borderColor: '#3b82f6',
      borderDashArray: [5, 5],
      lockUniScaling: true // Lock aspect ratio during scaling
    });

    canvas.add(rect);
    canvas.setActiveObject(rect);
    setCropRect(rect);
    canvas.renderAll();
    
    // Trigger validation update after crop rect is created
    if (imageDimensions) {
      requestAnimationFrame(() => {
        const warnings = validateImageForX(imageDimensions.width, imageDimensions.height);
        setImageQualityWarnings(warnings);
      });
    }
  };

  const addShape = (type: 'rect' | 'circle' | 'arrow' | 'text') => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const centerX = canvas.width! / 2;
    const centerY = canvas.height! / 2;

    let shape: fabric.Object;

    switch (type) {
      case 'rect':
        shape = new fabric.Rect({
          left: centerX - 50,
          top: centerY - 25,
          width: 100,
          height: 50,
          fill: 'transparent',
          stroke: penColor,
          strokeWidth: 2
        });
        break;
      
      case 'circle':
        shape = new fabric.Circle({
          left: centerX - 25,
          top: centerY - 25,
          radius: 25,
          fill: 'transparent',
          stroke: penColor,
          strokeWidth: 2
        });
        break;
      
      case 'arrow':
        // Create arrow using Path for better shape
        const arrowPath = 'M 0 0 L 60 0 M 60 0 L 50 -8 M 60 0 L 50 8';
        shape = new fabric.Path(arrowPath, {
          left: centerX - 30,
          top: centerY,
          fill: '',
          stroke: penColor,
          strokeWidth: 3,
          strokeLineCap: 'round',
          strokeLineJoin: 'round'
        });
        break;
      
      case 'text':
        shape = new fabric.IText('Double click to edit', {
          left: centerX - 75,
          top: centerY - 10,
          fontFamily: textFont,
          fontSize: textSize,
          fill: textColor
        });
        break;
    }

    canvas.add(shape);
    canvas.setActiveObject(shape);
    canvas.renderAll();
  };

  const handleZoom = (delta: number) => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const newZoom = Math.min(Math.max(zoom + delta, 0.1), 5);
    const center = canvas.getCenter();
    canvas.zoomToPoint(new fabric.Point(center.left, center.top), newZoom);
    canvas.renderAll(); // Force re-render
    setZoom(newZoom);
  };

  const handleZoomReset = () => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
    canvas.renderAll();
    setZoom(1);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      const canvas = fabricCanvasRef.current;
      if (!canvas) return;

      const prevState = history[historyIndex - 1];
      canvas.loadFromJSON(prevState, () => {
        canvas.renderAll();
        setHistoryIndex(historyIndex - 1);
      });
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const canvas = fabricCanvasRef.current;
      if (!canvas) return;

      const nextState = history[historyIndex + 1];
      canvas.loadFromJSON(nextState, () => {
        canvas.renderAll();
        setHistoryIndex(historyIndex + 1);
      });
    }
  };

  const handleClear = () => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const backgroundImg = imageElementRef.current;
    canvas.clear();
    
    // Re-add the background image if it exists
    if (backgroundImg) {
      canvas.add(backgroundImg);
      canvas.sendToBack(backgroundImg);
      canvas.renderAll();
    }
  };

  const handleSave = () => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const dataURL = canvas.toDataURL({
      format: 'png',
      quality: 1,
      multiplier: 2 // Higher resolution
    });
    const json = canvas.toJSON(['selectable', 'evented']);
    
    onSave(dataURL, json);
    onClose();
  };

  const handleSaveAndDownload = () => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const dataURL = canvas.toDataURL({
      format: 'png',
      quality: 1,
      multiplier: 2
    });
    
    // Trigger download
    const link = document.createElement('a');
    link.download = `annotation-${Date.now()}.png`;
    link.href = dataURL;
    link.click();
    
    // Also save to parent
    const json = canvas.toJSON(['selectable', 'evented']);
    onSave(dataURL, json);
  };

  const handleCrop = () => {
    const canvas = fabricCanvasRef.current;
    const bgImage = imageElementRef.current;
    
    if (!canvas || !cropRect || !currentImage || !imageDimensions || !bgImage) {
      console.error('Missing requirements for crop');
      return;
    }

    // Get crop dimensions info to calculate proper coordinates
    const cropInfo = getCropAreaDimensions();
    if (!cropInfo) {
      console.error('Could not calculate crop dimensions');
      return;
    }
    
    // Start loading state
    setIsCropping(true);

    // Create a high-resolution temporary canvas for the crop
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return;

    // Set temp canvas size to the actual crop dimensions in original resolution
    tempCanvas.width = cropInfo.width;
    tempCanvas.height = cropInfo.height;

    // Calculate crop coordinates in original image space
    const cropLeft = cropRect.left || 0;
    const cropTop = cropRect.top || 0;
    const cropWidth = cropRect.getScaledWidth();
    const cropHeight = cropRect.getScaledHeight();

    // Get the background image's position and scale
    const imgLeft = bgImage.left || 0;
    const imgTop = bgImage.top || 0;
    const imgScaleX = bgImage.scaleX || 1;
    const imgScaleY = bgImage.scaleY || 1;
    
    // Calculate the displayed dimensions of the image on canvas
    const displayedImgWidth = (bgImage.width || imageDimensions.width) * imgScaleX;
    const displayedImgHeight = (bgImage.height || imageDimensions.height) * imgScaleY;

    // Calculate the crop position relative to the image on canvas
    const relativeLeft = cropLeft - imgLeft;
    const relativeTop = cropTop - imgTop;

    // Calculate the source coordinates in original image pixels
    const sourceX = (relativeLeft / displayedImgWidth) * imageDimensions.width;
    const sourceY = (relativeTop / displayedImgHeight) * imageDimensions.height;
    const sourceWidth = (cropWidth / displayedImgWidth) * imageDimensions.width;
    const sourceHeight = (cropHeight / displayedImgHeight) * imageDimensions.height;

    console.log('Crop calculations:', {
      sourceX, sourceY, sourceWidth, sourceHeight,
      outputWidth: cropInfo.width,
      outputHeight: cropInfo.height
    });

    // Load the original image at full resolution
    const originalImg = new Image();
    originalImg.crossOrigin = 'anonymous';
    
    originalImg.onload = () => {
      // Draw the cropped portion at full resolution
      tempCtx.drawImage(
        originalImg,
        sourceX, sourceY, sourceWidth, sourceHeight, // Source rectangle from original
        0, 0, cropInfo.width, cropInfo.height // Destination (full temp canvas)
      );

      const croppedDataURL = tempCanvas.toDataURL('image/png', 1.0);
      
      // Remove the crop rectangle
      canvas.remove(cropRect);
      setCropRect(null);
      setActiveTool('draw');
      
      // Clear the canvas of all annotations
      const objects = canvas.getObjects();
      objects.forEach(obj => {
        if (obj !== bgImage) {
          canvas.remove(obj);
        }
      });
      
      // Update the current image to the cropped version
      setCurrentImage(croppedDataURL);
      
      // Reset image dimensions for the cropped image
      const croppedImg = new Image();
      croppedImg.onload = () => {
        setImageDimensions({ width: croppedImg.width, height: croppedImg.height });
        
        // Clear warnings and recalculate for the new cropped image
        const warnings = validateImageForX(croppedImg.width, croppedImg.height);
        setImageQualityWarnings(warnings);
      };
      croppedImg.src = croppedDataURL;
      
      // Reset history for the new cropped image
      initializeHistory();
      
      // End loading state
      setIsCropping(false);
    };
    
    originalImg.onerror = () => {
      console.error('Failed to load original image for cropping');
      setIsCropping(false);
    };
    
    originalImg.src = currentImage;
  };

  // X image quality validation
  const getCropAreaDimensions = (): { width: number; height: number; cropPercentage: number } | null => {
    const canvas = fabricCanvasRef.current;
    const bgImage = imageElementRef.current;
    
    if (!canvas || !cropRect || !imageDimensions || !bgImage) {
      console.log('getCropAreaDimensions: Missing requirements', { 
        canvas: !!canvas, 
        cropRect: !!cropRect, 
        imageDimensions: !!imageDimensions,
        bgImage: !!bgImage
      });
      return null;
    }

    // Get the scaled crop rect dimensions (includes any scaling applied to the rect)
    const cropWidth = cropRect.getScaledWidth();
    const cropHeight = cropRect.getScaledHeight();
    const cropLeft = cropRect.left || 0;
    const cropTop = cropRect.top || 0;

    console.log('Crop rect scaled dimensions:', { cropLeft, cropTop, cropWidth, cropHeight });

    // Get the background image's position and scale on the canvas
    const imgLeft = bgImage.left || 0;
    const imgTop = bgImage.top || 0;
    const imgScaleX = bgImage.scaleX || 1;
    const imgScaleY = bgImage.scaleY || 1;
    
    // Calculate the displayed dimensions of the image on canvas
    const displayedImgWidth = (bgImage.width || imageDimensions.width) * imgScaleX;
    const displayedImgHeight = (bgImage.height || imageDimensions.height) * imgScaleY;

    console.log('Image on canvas:', {
      imgLeft, imgTop, imgScaleX, imgScaleY,
      displayedImgWidth, displayedImgHeight,
      originalWidth: imageDimensions.width,
      originalHeight: imageDimensions.height
    });

    // Calculate what portion of the displayed image the crop covers
    // This gives us the scale factor from canvas pixels to original image pixels
    const scaleToOriginalX = imageDimensions.width / displayedImgWidth;
    const scaleToOriginalY = imageDimensions.height / displayedImgHeight;

    // Calculate actual crop dimensions in original image pixels
    const actualCropWidth = Math.round(cropWidth * scaleToOriginalX);
    const actualCropHeight = Math.round(cropHeight * scaleToOriginalY);

    // Calculate what percentage of the original image this crop represents
    const originalArea = imageDimensions.width * imageDimensions.height;
    const cropArea = actualCropWidth * actualCropHeight;
    const cropPercentage = (cropArea / originalArea) * 100;

    console.log('Calculated crop dimensions:', { 
      actualCropWidth, 
      actualCropHeight, 
      cropPercentage: cropPercentage.toFixed(1),
      scaleToOriginalX,
      scaleToOriginalY
    });

    return {
      width: actualCropWidth,
      height: actualCropHeight,
      cropPercentage
    };
  };

  const validateImageForX = (width: number, height: number): string[] => {
    const warnings: string[] = [];
    const aspectRatio = width / height;
    
    // Get crop area info if available
    const cropInfo = getCropAreaDimensions();
    const isUsingCrop = !!(cropRect && cropInfo);
    
    // Use crop dimensions if available, otherwise original dimensions
    const effectiveWidth = isUsingCrop && cropInfo ? cropInfo.width : width;
    const effectiveHeight = isUsingCrop && cropInfo ? cropInfo.height : height;
    const effectiveAspectRatio = effectiveWidth / effectiveHeight;
    
    // Original image info
    warnings.push(`📊 Original: ${width}×${height}px (${aspectRatio.toFixed(2)}:1)`);
    
    // Crop area info
    if (isUsingCrop && cropInfo) {
      warnings.push(`✂️ Crop area: ${effectiveWidth}×${effectiveHeight}px (${effectiveAspectRatio.toFixed(2)}:1)`);
      warnings.push(`📈 Using ${cropInfo.cropPercentage.toFixed(1)}% of original image resolution`);
      
      // Warn about very small crop areas
      if (cropInfo.cropPercentage < 25) {
        warnings.push(`⚠️ Small crop area reduces sharpness - consider using more of the original image`);
      }
    }
    
    // Check minimum dimensions (using effective dimensions)
    if (effectiveWidth < 600 || effectiveHeight < 335) {
      warnings.push(`🚨 ${isUsingCrop ? 'Cropped area' : 'Image'} too small (${effectiveWidth}×${effectiveHeight}). X upscales to 600×335 minimum, causing blur on all devices.`);
    }
    
    // Check if dimensions are below X's optimal size
    if (effectiveWidth < 1200) {
      warnings.push(`⚠️ For crisp display on high-DPI screens, use 1200px+ width (${isUsingCrop ? 'crop' : 'current'}: ${effectiveWidth}px). Image may appear soft on Retina displays.`);
    }
    
    // Check aspect ratio for single images
    if (cropAspectRatio === 'twitter-single') {
      if (Math.abs(effectiveAspectRatio - (16/9)) > 0.1) {
        warnings.push(`✂️ Timeline feed will crop to 16:9 (${effectiveAspectRatio.toFixed(2)}:1 → 1.78:1). Full image visible when clicked.`);
      } else {
        warnings.push(`✅ Perfect 16:9 ratio - displays fully in timeline feed and expanded view!`);
      }
    }
    
    // Check aspect ratio for multi images
    if (cropAspectRatio === 'twitter-multi') {
      if (Math.abs(effectiveAspectRatio - 2) > 0.1) {
        warnings.push(`✂️ Multi-image posts crop to 2:1 in timeline (${effectiveAspectRatio.toFixed(2)}:1 → 2:1). Full image when clicked.`);
      } else {
        warnings.push(`✅ Perfect 2:1 ratio for multi-image posts - optimal timeline display!`);
      }
    }
    
    // Check if image will be cropped by X
    if (cropAspectRatio === 'free') {
      if (effectiveAspectRatio < 1.5) {
        warnings.push(`📱 Timeline feed may crop top/bottom on mobile. Desktop shows more. Full image always available on click.`);
      } else if (effectiveAspectRatio > 3) {
        warnings.push(`📱 Very wide image - timeline will crop sides on mobile. Better for desktop viewing.`);
      } else {
        warnings.push(`👍 Good aspect ratio for timeline display across devices.`);
      }
    }
    
    // Quality recommendations and platform context
    if (isUsingCrop && effectiveWidth >= 1200 && effectiveHeight >= 675) {
      warnings.push(`🎯 Excellent crop quality - crisp on all devices and screen sizes!`);
    }
    
    // Add general platform context
    if (warnings.length <= 3) { // Only add if we don't have many warnings already
      warnings.push(`💡 Tip: Timeline shows preview, clicking opens full-size image. Optimize for timeline engagement!`);
    }
    
    return warnings;
  };

  const aspectRatioOptions: { value: CropAspectRatio; label: string }[] = [
    { value: 'free', label: 'Free' },
    { value: 'twitter-single', label: '𝕏 Single (16:9)' },
    { value: 'twitter-multi', label: '𝕏 Multi (2:1)' },
    { value: '1:1', label: '1:1 (Square)' },
    { value: '4:5', label: '4:5 (Instagram)' },
    { value: '16:9', label: '16:9 (Landscape)' },
    { value: '9:16', label: '9:16 (Portrait)' },
    { value: '4:3', label: '4:3 (Standard)' },
    { value: '3:4', label: '3:4 (Portrait)' }
  ];

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onClose={onClose} className="fixed z-50 inset-0">
      <Dialog.Overlay className="fixed inset-0 bg-black/70" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="bg-white rounded-lg shadow-xl w-full max-w-[95vw] h-[95vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-3 border-b bg-gray-50 rounded-t-lg flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Dialog.Title className="text-lg font-semibold text-gray-800">
                {editingMarkedUpImage ? 'Edit Annotation' : `Edit Page ${currentPageIdx !== null ? currentPageIdx + 1 : ''}`}
              </Dialog.Title>
              
              {/* Navigation arrows */}
              {!editingMarkedUpImage && pageImages.length > 1 && (
                <div className="flex items-center gap-1">
                  <button 
                    onClick={() => {
                      if (currentPageIdx !== null && currentPageIdx > 0) {
                        const newPageIdx = currentPageIdx - 1;
                        setCurrentPageIdx(newPageIdx);
                        setCurrentImage(pageImages[newPageIdx]);
                      }
                    }}
                    disabled={currentPageIdx === null || currentPageIdx <= 0}
                    className="btn-secondary p-1 disabled:opacity-50" 
                    title="Previous Page"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span className="text-sm text-gray-600">
                    {String(currentPageIdx !== null ? currentPageIdx + 1 : 0)} of {String(pageImages.length)}
                  </span>
                  <button 
                    onClick={() => {
                      if (currentPageIdx !== null && currentPageIdx < pageImages.length - 1) {
                        const newPageIdx = currentPageIdx + 1;
                        setCurrentPageIdx(newPageIdx);
                        setCurrentImage(pageImages[newPageIdx]);
                      }
                    }}
                    disabled={currentPageIdx === null || currentPageIdx >= pageImages.length - 1}
                    className="btn-secondary p-1 disabled:opacity-50" 
                    title="Next Page"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              )}
            </div>
            
          </div>


          {/* Toolbar */}
          <div className="flex items-center gap-2 p-2 border-b bg-gray-50 flex-wrap">
            {/* Tools */}
            <div className="flex items-center gap-1">
              <span className="text-sm font-medium mr-2">Tools:</span>
              <button 
                onClick={() => handleToolChange('select')}
                className={`btn-secondary p-2 ${activeTool === 'select' ? 'bg-blue-200' : ''}`}
                title="Select"
              >
                ↖️
              </button>
              <button 
                onClick={() => handleToolChange('draw')}
                className={`btn-secondary p-2 ${activeTool === 'draw' ? 'bg-blue-200' : ''}`}
                title="Draw"
              >
                <PenTool size={16} />
              </button>
              <button 
                onClick={() => handleToolChange('erase')}
                className={`btn-secondary p-2 ${activeTool === 'erase' ? 'bg-blue-200' : ''}`}
                title="Eraser"
              >
                <Eraser size={16} />
              </button>
              <button 
                onClick={() => handleToolChange('pan')}
                className={`btn-secondary p-2 ${activeTool === 'pan' ? 'bg-blue-200' : ''}`}
                title="Pan"
              >
                <Hand size={16} />
              </button>
              <button 
                onClick={() => handleToolChange('crop')}
                className={`btn-secondary p-2 ${activeTool === 'crop' ? 'bg-blue-200' : ''}`}
                title="Crop"
              >
                <Crop size={16} />
              </button>
            </div>

            {/* Drawing Options */}
            {(activeTool === 'draw' || activeTool === 'erase') && (
              <div className="flex items-center gap-2">
                <input 
                  type="color" 
                  value={penColor} 
                  onChange={(e) => setPenColor(e.target.value)}
                  className="w-8 h-8 rounded border"
                  title="Pen Color"
                />
                <input 
                  type="range" 
                  min="1" 
                  max="20" 
                  value={penSize} 
                  onChange={(e) => setPenSize(Number(e.target.value))}
                  className="w-20"
                  title="Brush Size"
                />
                <span className="text-xs">{penSize}px</span>
              </div>
            )}

            {/* Text Options */}
            {activeTool === 'text' && (
              <div className="flex items-center gap-2">
                <input 
                  type="color" 
                  value={textColor} 
                  onChange={(e) => setTextColor(e.target.value)}
                  className="w-8 h-8 rounded border"
                  title="Text Color"
                />
                <select 
                  value={textFont} 
                  onChange={(e) => setTextFont(e.target.value)}
                  className="text-sm border rounded px-2 py-1"
                  title="Font Family"
                >
                  <option value="Arial">Arial</option>
                  <option value="Times New Roman">Times</option>
                  <option value="Helvetica">Helvetica</option>
                  <option value="Georgia">Georgia</option>
                  <option value="Verdana">Verdana</option>
                </select>
                <input 
                  type="range" 
                  min="8" 
                  max="72" 
                  value={textSize} 
                  onChange={(e) => setTextSize(Number(e.target.value))}
                  className="w-20"
                  title="Font Size"
                />
                <span className="text-xs">{textSize}px</span>
              </div>
            )}

            {/* Shapes */}
            <div className="flex items-center gap-1">
              <span className="text-sm font-medium mr-2">Shapes:</span>
              <button onClick={() => addShape('rect')} className="btn-secondary p-2" title="Rectangle">
                <Square size={16} />
              </button>
              <button onClick={() => addShape('circle')} className="btn-secondary p-2" title="Circle">
                <Circle size={16} />
              </button>
              <button onClick={() => addShape('arrow')} className="btn-secondary p-2" title="Arrow">
                <ArrowRight size={16} />
              </button>
              <button onClick={() => addShape('text')} className="btn-secondary p-2" title="Text">
                <Type size={16} />
              </button>
            </div>

            {/* Quick Crop Buttons */}
            {activeTool === 'crop' && (
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Quick Crop:</span>
                <button 
                  onClick={() => {
                    setCropAspectRatio('twitter-single');
                    createCropBoxWithAspectRatio('twitter-single');
                  }}
                  className={`text-xs px-2 py-1 rounded border ${
                    cropAspectRatio === 'twitter-single' 
                      ? 'bg-black text-white' 
                      : 'bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200'
                  }`}
                  title="X Single Image (16:9)"
                >
                  <span className="text-xs font-bold">𝕏</span> Single
                </button>
                <button 
                  onClick={() => {
                    setCropAspectRatio('twitter-multi');
                    createCropBoxWithAspectRatio('twitter-multi');
                  }}
                  className={`text-xs px-2 py-1 rounded border ${
                    cropAspectRatio === 'twitter-multi' 
                      ? 'bg-black text-white' 
                      : 'bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200'
                  }`}
                  title="X Multi Image (2:1)"
                >
                  <span className="text-xs font-bold">𝕏</span> Multi
                </button>
                <button 
                  onClick={() => {
                    setCropAspectRatio('1:1');
                    createCropBoxWithAspectRatio('1:1');
                  }}
                  className={`text-xs px-2 py-1 rounded border ${
                    cropAspectRatio === '1:1' 
                      ? 'bg-pink-100 border-pink-300 text-pink-700' 
                      : 'bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200'
                  }`}
                  title="Instagram Square (1:1)"
                >
                  📷 Square
                </button>
                <button 
                  onClick={() => {
                    setCropAspectRatio('4:5');
                    createCropBoxWithAspectRatio('4:5');
                  }}
                  className={`text-xs px-2 py-1 rounded border ${
                    cropAspectRatio === '4:5' 
                      ? 'bg-pink-100 border-pink-300 text-pink-700' 
                      : 'bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200'
                  }`}
                  title="Instagram Portrait (4:5)"
                >
                  📷 Portrait
                </button>
                <button 
                  onClick={() => {
                    setCropAspectRatio('free');
                    createCropBoxWithAspectRatio('free');
                  }}
                  className={`text-xs px-2 py-1 rounded border ${
                    cropAspectRatio === 'free' 
                      ? 'bg-green-100 border-green-300 text-green-700' 
                      : 'bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200'
                  }`}
                  title="Free Crop"
                >
                  ✂️ Free
                </button>
              </div>
            )}

            {/* Zoom Controls */}
            <div className="flex items-center gap-1">
              <span className="text-sm font-medium mr-2">Zoom:</span>
              <button onClick={() => handleZoom(-0.1)} className="btn-secondary p-2" title="Zoom Out">
                <Minus size={16} />
              </button>
              <button onClick={handleZoomReset} className="btn-secondary p-2" title="Reset Zoom">
                <RefreshCw size={16} />
              </button>
              <button onClick={() => handleZoom(0.1)} className="btn-secondary p-2" title="Zoom In">
                <Plus size={16} />
              </button>
              <span className="text-xs w-12 text-center">{(zoom * 100).toFixed(0)}%</span>
            </div>

            {/* History Controls */}
            <div className="flex items-center gap-1">
              <span className="text-sm font-medium mr-2">History:</span>
              <button 
                onClick={handleUndo} 
                disabled={historyIndex <= 0}
                className="btn-secondary p-2 disabled:opacity-50" 
                title="Undo"
              >
                <RotateCcw size={16} />
              </button>
              <button 
                onClick={handleRedo} 
                disabled={historyIndex >= history.length - 1}
                className="btn-secondary p-2 disabled:opacity-50" 
                title="Redo"
              >
                <RefreshCw size={16} />
              </button>
            </div>

            {/* X Preview Toggle */}
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setShowXPreview(!showXPreview)}
                className={`text-sm px-3 py-1 rounded border flex items-center gap-1 ${
                  showXPreview 
                    ? 'bg-black text-white' 
                    : 'bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200'
                }`}
                title="Toggle X Preview"
              >
                <span className="text-sm font-bold">𝕏</span>
                {showXPreview ? 'Hide Preview' : 'Show Preview'}
              </button>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 ml-auto">
              <button onClick={handleClear} className="btn-secondary text-sm px-3 py-1" title="Reset Canvas">
                Reset
              </button>
              
              {activeTool === 'crop' && cropRect && (
                <button onClick={handleCrop} className="btn-primary text-sm px-3 py-1">
                  Crop
                </button>
              )}
              
              <button onClick={handleSaveAndDownload} className="btn-secondary text-sm px-3 py-1 flex items-center gap-1">
                <Download size={14} />
                Save & Download
              </button>
              
              <button onClick={handleSave} className="btn-primary text-sm px-3 py-1 flex items-center gap-1">
                <Save size={14} />
                Save & Close
              </button>
            </div>
          </div>

          {/* Canvas Container */}
          <div ref={canvasContainerRef} className="flex-1 overflow-hidden bg-gray-200 flex items-center justify-center p-4 relative">
            {/* Regular Editor Mode - Always present */}
            <div className={showXPreview ? 'hidden' : 'block'}>
              {(isLoading || isCropping) && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="animate-spin text-blue-500" size={48} />
                    {isCropping && <p className="text-gray-600">Cropping image at full resolution...</p>}
                  </div>
                </div>
              )}
              
              {error && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
                  <div className="text-center">
                    <p className="text-red-500 font-medium">{error}</p>
                    <button onClick={onClose} className="btn-secondary mt-2">Close</button>
                  </div>
                </div>
              )}
              
              <div 
                id="fabric-canvas-wrapper"
                className="border border-gray-300 shadow-lg"
                style={{ 
                  position: 'relative',
                  width: 'fit-content',
                  height: 'fit-content'
                }}
              >
                <canvas 
                  ref={canvasElRef}
                  style={{ display: 'block' }}
                />
              </div>
            </div>

            {/* X Preview Mode */}
            {showXPreview && (
              <div className="h-full w-full overflow-auto flex items-center justify-center p-4">
                <div className="bg-black rounded-lg p-6 w-full max-w-[598px] max-h-full overflow-auto">
                  <div className="bg-black rounded-lg p-4">
                  <div className="flex items-start space-x-3">
                    {/* Profile Picture */}
                    <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center overflow-hidden">
                      {userProfile?.avatar ? (
                        <img src={userProfile.avatar} alt="Profile" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-white text-base font-bold">
                          {userProfile?.displayName?.charAt(0)?.toUpperCase() || 'U'}
                        </span>
                      )}
                    </div>
                    
                    {/* Post Content */}
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <span className="text-white font-bold text-[15px]">
                          {userProfile?.displayName || 'Your Name'}
                        </span>
                        <span className="text-gray-500 text-[15px]">
                          @{userProfile?.xHandle || userProfile?.username || 'username'}
                        </span>
                        <span className="text-gray-500">·</span>
                        <span className="text-gray-500 text-[15px]">now</span>
                      </div>
                      
                      <div className="text-white text-[15px] leading-6 mb-3">
                        Your thread post content will appear here with the edited image below.
                      </div>
                      
                      {/* X-formatted Image Preview */}
                      {currentImage && (
                        <div className="mb-3">
                          <img 
                            src={currentImage} 
                            alt="X Preview"
                            className="w-full rounded-2xl"
                            style={{
                              aspectRatio: cropAspectRatio === 'twitter-single' ? '16/9' : 
                                          cropAspectRatio === 'twitter-multi' ? '2/1' : 'auto',
                              objectFit: cropAspectRatio === 'twitter-single' || cropAspectRatio === 'twitter-multi' ? 'cover' : 'contain',
                              maxHeight: cropAspectRatio === 'twitter-single' ? '506px' : 
                                         cropAspectRatio === 'twitter-multi' ? '506px' : '60vh',
                              height: cropAspectRatio === 'twitter-single' || cropAspectRatio === 'twitter-multi' ? 'auto' : 'auto'
                            }}
                          />
                        </div>
                      )}
                      
                      {/* Engagement Icons */}
                      <div className="flex items-center justify-between max-w-md pt-1">
                        <div className="flex items-center space-x-2 text-gray-500">
                          <div className="p-2 rounded-full hover:bg-blue-900/20">💬</div>
                          <span className="text-[13px]">24</span>
                        </div>
                        <div className="flex items-center space-x-2 text-gray-500">
                          <div className="p-2 rounded-full hover:bg-green-900/20">🔄</div>
                          <span className="text-[13px]">12</span>
                        </div>
                        <div className="flex items-center space-x-2 text-gray-500">
                          <div className="p-2 rounded-full hover:bg-red-900/20">❤️</div>
                          <span className="text-[13px]">156</span>
                        </div>
                        <div className="text-gray-500">
                          <div className="p-2 rounded-full hover:bg-blue-900/20">🔖</div>
                        </div>
                        <div className="text-gray-500">
                          <div className="p-2 rounded-full hover:bg-blue-900/20">📤</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                  <div className="text-center mt-4 text-white/70 text-sm">
                    Preview of how your image will appear on X
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {/* X (Twitter) Quality Warnings - Bottom Left Popup */}
          {imageQualityWarnings.length > 0 && (
            <div className="absolute bottom-4 left-4 max-w-md z-20">
              <div className={`bg-white/95 backdrop-blur-sm rounded-lg shadow-xl border border-gray-200 transition-all duration-300 ${
                showWarnings ? 'max-h-[400px]' : 'max-h-[52px]'
              } overflow-hidden`}>
                <button 
                  onClick={() => setShowWarnings(!showWarnings)}
                  className="w-full px-4 py-3 text-left flex items-center justify-between hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center space-x-2">
                    <span className="text-black font-bold text-lg">𝕏</span>
                    <span className="text-sm font-medium text-gray-800">
                      Display Analysis ({String(imageQualityWarnings.length)})
                    </span>
                  </div>
                  <span className="text-gray-600 text-sm">
                    {showWarnings ? '▼' : '▲'}
                  </span>
                </button>
                
                {showWarnings && (
                  <div className="px-4 pb-3 border-t border-gray-200 max-h-[340px] overflow-y-auto">
                    <div className="text-xs text-gray-600 mt-2 mb-3 italic">
                      How your image will appear in X timeline feeds vs. expanded view
                    </div>
                    <div className="space-y-2">
                      {imageQualityWarnings.map((warning, index) => (
                        <div key={`annotation-${index}`} className="text-xs text-gray-700 p-2 bg-gray-50 rounded-md">
                          {warning}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}