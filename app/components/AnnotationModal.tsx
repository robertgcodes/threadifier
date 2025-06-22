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
}

type Tool = 'select' | 'draw' | 'erase' | 'pan' | 'crop' | 'text' | 'rect' | 'circle' | 'arrow';
type CropAspectRatio = 'free' | '1:1' | '4:5' | '16:9' | '9:16' | '4:3' | '3:4';

export default function AnnotationModal({
  isOpen,
  onClose,
  onSave,
  onCrop,
  pageImages,
  initialPage,
  editingMarkedUpImage
}: AnnotationModalProps) {
  const [currentPageIdx, setCurrentPageIdx] = useState(initialPage);
  const [currentImage, setCurrentImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
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
  const [cropAspectRatio, setCropAspectRatio] = useState<CropAspectRatio>('free');

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
      // Preload image to check for errors
      const img = new Image();
      img.onload = () => {
        setCurrentImage(targetImage);
        setIsLoading(false);
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
      // Only start new crop if not clicking on existing crop rect
      if (cropRect && canvas.getActiveObject() === cropRect) {
        return; // Allow manipulation of existing crop rect
      }

      const pointer = canvas.getPointer(opt.e);
      isDown = true;
      startX = pointer.x;
      startY = pointer.y;

      // Remove previous crop rect if exists
      if (cropRect) {
        canvas.remove(cropRect);
      }

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
      default: return 1;
    }
  };

  const createCropBoxWithAspectRatio = (aspectRatio: CropAspectRatio) => {
    const canvas = fabricCanvasRef.current;
    if (!canvas || aspectRatio === 'free') return;

    // Remove existing crop rect
    if (cropRect) {
      canvas.remove(cropRect);
    }

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
        const arrowPoints = [
          new fabric.Point(0, 0),
          new fabric.Point(80, 0),
          new fabric.Point(70, -10),
          new fabric.Point(80, 0),
          new fabric.Point(70, 10)
        ];
        shape = new fabric.Polyline(arrowPoints, {
          left: centerX - 40,
          top: centerY - 5,
          fill: penColor,
          stroke: penColor,
          strokeWidth: 2
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
    if (!canvas || !cropRect) return;

    const dataURL = canvas.toDataURL({
      format: 'png',
      left: cropRect.left,
      top: cropRect.top,
      width: cropRect.getScaledWidth(),
      height: cropRect.getScaledHeight(),
      multiplier: 2
    });
    
    // Create a new marked up image for the cropped result
    const newMarkedUpImage: MarkedUpImage = {
      id: `crop-${Date.now()}`,
      pageNumber: currentPageIdx !== null ? currentPageIdx : 0,
      url: dataURL,
      json: null
    };
    
    // Close current modal and open new one with cropped image
    onClose();
    // Note: This would need to be handled by the parent component
    // For now, we'll just use onCrop which should handle opening new modal
    onCrop(dataURL);
  };

  const aspectRatioOptions: { value: CropAspectRatio; label: string }[] = [
    { value: 'free', label: 'Free' },
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
                    {currentPageIdx !== null ? currentPageIdx + 1 : 0} of {pageImages.length}
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
            
            {/* Zoom Controls */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Zoom:</span>
              <button onClick={() => handleZoom(-0.1)} className="btn-secondary p-1" title="Zoom Out">
                <Minus size={14} />
              </button>
              <button onClick={handleZoomReset} className="btn-secondary p-1" title="Reset Zoom">
                <RefreshCw size={14} />
              </button>
              <button onClick={() => handleZoom(0.1)} className="btn-secondary p-1" title="Zoom In">
                <Plus size={14} />
              </button>
              <span className="text-xs w-12 text-center">{(zoom * 100).toFixed(0)}%</span>
            </div>

            {/* History Controls */}
            <div className="flex items-center gap-2">
              <button 
                onClick={handleUndo} 
                disabled={historyIndex <= 0}
                className="btn-secondary p-1 disabled:opacity-50" 
                title="Undo"
              >
                <RotateCcw size={14} />
              </button>
              <button 
                onClick={handleRedo} 
                disabled={historyIndex >= history.length - 1}
                className="btn-secondary p-1 disabled:opacity-50" 
                title="Redo"
              >
                <RefreshCw size={14} />
              </button>
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

            {/* Crop Aspect Ratio */}
            {activeTool === 'crop' && (
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Aspect:</span>
                <select 
                  value={cropAspectRatio} 
                  onChange={(e) => {
                    const newRatio = e.target.value as CropAspectRatio;
                    setCropAspectRatio(newRatio);
                    createCropBoxWithAspectRatio(newRatio);
                  }}
                  className="text-sm border rounded px-2 py-1"
                >
                  {aspectRatioOptions.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
            )}

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
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
                <Loader2 className="animate-spin text-blue-500" size={48} />
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
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}