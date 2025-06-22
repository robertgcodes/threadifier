"use client";
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { fabric } from 'fabric';
import { Dialog } from '@headlessui/react';
import { 
  Crop, Loader2, Minus, Plus, RefreshCw, Hand, Trash2, 
  Square, Circle, ArrowRight, Type, Download, Save,
  RotateCcw, PenTool, Eraser
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
  const [activeTool, setActiveTool] = useState<Tool>('select');
  const [penColor, setPenColor] = useState<string>("#e11d48");
  const [penSize, setPenSize] = useState<number>(4);
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
      setActiveTool('select');
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

  // Initialize fabric canvas
  useEffect(() => {
    if (!isOpen) return;

    // Wait for the modal to be fully rendered
    const initCanvas = () => {
      if (!canvasElRef.current) {
        console.log('Canvas element not ready, retrying...');
        setTimeout(initCanvas, 50);
        return;
      }

      // Only initialize if we don't already have a canvas
      if (fabricCanvasRef.current) {
        console.log('Canvas already exists, skipping initialization');
        return;
      }

      console.log('Initializing fabric canvas');
      console.log('Canvas element before fabric:', canvasElRef.current);
      
      // Get actual container dimensions
      const container = canvasContainerRef.current;
      const containerWidth = container?.clientWidth || 800;
      const containerHeight = container?.clientHeight || 600;
      
      console.log('Container dimensions:', containerWidth, 'x', containerHeight);
      
      try {
        const canvas = new fabric.Canvas(canvasElRef.current, {
          width: Math.min(containerWidth - 50, 1000), // Large but reasonable
          height: Math.min(containerHeight - 50, 800),
          backgroundColor: '#ffffff' // Clean white background
        });
        
        console.log('Canvas set to:', canvas.width, 'x', canvas.height);
        fabricCanvasRef.current = canvas;
        
        console.log('Fabric canvas created:', canvas);
        console.log('Canvas element after fabric:', canvasElRef.current);
        console.log('Canvas background color:', canvas.backgroundColor);
        
        // Set up canvas event handlers
        const saveToHistory = () => {
          if (!fabricCanvasRef.current) return;
          const json = JSON.stringify(fabricCanvasRef.current.toJSON(['selectable', 'evented']));
          setHistory(prev => {
            const newHistory = prev.slice(0, historyIndex + 1);
            newHistory.push(json);
            return newHistory;
          });
          setHistoryIndex(prev => prev + 1);
        };

        const handlePathCreated = (e: any) => {
          console.log('Path created:', e.path);
          saveToHistory();
        };

        canvas.on('path:created', handlePathCreated);
        canvas.on('object:added', saveToHistory);
        canvas.on('object:removed', saveToHistory);
        canvas.on('object:modified', saveToHistory);
        
        // Initial render
        canvas.renderAll();
        console.log('Canvas initialized successfully');
        
      } catch (error) {
        console.error('Error initializing canvas:', error);
        fabricCanvasRef.current = null;
      }
    };

    // Start initialization after a short delay
    const timer = setTimeout(initCanvas, 100);

    return () => {
      clearTimeout(timer);
    };
  }, [isOpen]);

  // Cleanup canvas when modal closes
  useEffect(() => {
    if (!isOpen && fabricCanvasRef.current) {
      console.log('Cleaning up canvas on modal close');
      try {
        fabricCanvasRef.current.off('path:created');
        fabricCanvasRef.current.off('object:added');
        fabricCanvasRef.current.off('object:removed');
        fabricCanvasRef.current.off('object:modified');
        fabricCanvasRef.current.dispose();
      } catch (error) {
        console.error('Error disposing canvas:', error);
      }
      fabricCanvasRef.current = null;
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
              
              canvas.renderAll();
              setIsLoading(false);
              initializeHistory();
              
              // Force re-render after a short delay
              setTimeout(() => {
                try {
                  console.log('Force re-rendering canvas');
                  console.log('Canvas objects after timeout:', canvas.getObjects().length);
                  canvas.renderAll();
                } catch (renderError) {
                  console.error('Error during force re-render:', renderError);
                }
              }, 200);
              
            } catch (error) {
              console.error('Error adding image to canvas:', error);
              setError('Failed to add image to canvas');
              setIsLoading(false);
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

    // Clean up previous tool
    canvas.isDrawingMode = false;
    canvas.selection = true;
    canvas.defaultCursor = 'default';
    canvas.hoverCursor = 'move';
    
    // Clear crop rect when switching tools
    if (tool !== 'crop' && cropRect) {
      canvas.remove(cropRect);
      setCropRect(null);
    }

    setActiveTool(tool);

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
        stroke: '#e11d48',
        strokeWidth: 3,
        fill: 'rgba(225, 29, 72, 0.15)',
        selectable: true,
        strokeDashArray: [8, 4],
        cornerColor: '#e11d48',
        cornerSize: 8,
        transparentCorners: false
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
          fontFamily: 'Arial',
          fontSize: 16,
          fill: penColor
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

  const handleCropAndSave = () => {
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
    
    onCrop(dataURL);
    onClose();
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
            <Dialog.Title className="text-lg font-semibold text-gray-800">
              {editingMarkedUpImage ? 'Edit Annotation' : `Edit Page ${currentPageIdx !== null ? currentPageIdx + 1 : ''}`}
            </Dialog.Title>
            
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
            <div className="flex items-center gap-2">
              <input 
                type="color" 
                value={penColor} 
                onChange={(e) => setPenColor(e.target.value)}
                className="w-8 h-8 rounded border"
                title="Color"
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
                  onChange={(e) => setCropAspectRatio(e.target.value as CropAspectRatio)}
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
              <button onClick={handleClear} className="btn-secondary p-2" title="Clear All">
                <Trash2 size={16} />
              </button>
              
              {activeTool === 'crop' && cropRect && (
                <button onClick={handleCropAndSave} className="btn-primary text-sm px-3 py-1">
                  Crop & Save
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
            
            <canvas 
              ref={canvasElRef}
              className="border border-gray-300 shadow-lg"
            />
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}