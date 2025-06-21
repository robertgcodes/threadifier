"use client";
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { fabric } from 'fabric';
import { Dialog } from '@headlessui/react';
import { 
  Crop, Loader2, Minus, Plus, RefreshCw, Hand, Trash2, 
  Square, Circle, ArrowRight, Type, Download, Save,
  RotateCcw, Palette, PenTool, Eraser, Upload
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
    if (!isOpen || !canvasElRef.current) return;

    const canvas = new fabric.Canvas(canvasElRef.current, {
      width: 800,
      height: 600,
      backgroundColor: '#f8f9fa'
    });

    fabricCanvasRef.current = canvas;

    // Set up canvas event handlers
    const saveToHistory = () => {
      const json = JSON.stringify(canvas.toJSON(['selectable', 'evented']));
      setHistory(prev => {
        const newHistory = prev.slice(0, historyIndex + 1);
        newHistory.push(json);
        return newHistory;
      });
      setHistoryIndex(prev => prev + 1);
    };

    canvas.on('path:created', saveToHistory);
    canvas.on('object:added', saveToHistory);
    canvas.on('object:removed', saveToHistory);
    canvas.on('object:modified', saveToHistory);

    return () => {
      canvas.dispose();
      fabricCanvasRef.current = null;
    };
  }, [isOpen]);

  // Load image into canvas
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas || !currentImage) return;

    setIsLoading(true);
    canvas.clear();

    const isEditingExisting = editingMarkedUpImage?.url === currentImage;
    
    if (isEditingExisting && editingMarkedUpImage.json) {
      // Load existing markup
      canvas.loadFromJSON(editingMarkedUpImage.json, () => {
        const bgImage = canvas.backgroundImage as fabric.Image;
        if (bgImage) {
          fitCanvasToImage(bgImage.width!, bgImage.height!);
        }
        canvas.renderAll();
        setIsLoading(false);
        initializeHistory();
      });
    } else {
      // Load fresh image
      fabric.Image.fromURL(
        currentImage,
        (img) => {
          const containerWidth = canvasContainerRef.current?.clientWidth || 800;
          const containerHeight = canvasContainerRef.current?.clientHeight || 600;
          
          // Handle tall documents (8.5x11 ratio ≈ 0.77)
          const imageAspectRatio = img.width! / img.height!;
          let canvasWidth, canvasHeight;
          
          if (imageAspectRatio < 0.9) { // Tall document
            canvasHeight = Math.min(containerHeight - 100, img.height!);
            canvasWidth = canvasHeight * imageAspectRatio;
          } else { // Wide or square document
            canvasWidth = Math.min(containerWidth - 100, img.width!);
            canvasHeight = canvasWidth / imageAspectRatio;
          }
          
          canvas.setDimensions({ width: canvasWidth, height: canvasHeight });
          
          // Scale image to fit canvas
          const scale = Math.min(canvasWidth / img.width!, canvasHeight / img.height!);
          img.scale(scale);
          
          // Center the image
          img.set({
            left: (canvasWidth - img.width! * scale) / 2,
            top: (canvasHeight - img.height! * scale) / 2,
            selectable: false,
            evented: false
          });
          
          canvas.setBackgroundImage(img, () => {
            canvas.renderAll();
            setIsLoading(false);
            initializeHistory();
          });
          
          imageElementRef.current = img;
          setZoom(1);
        },
        { 
          crossOrigin: 'anonymous',
          // Handle potential CORS issues with data URLs
          ...(currentImage.startsWith('data:') ? {} : { crossOrigin: 'anonymous' })
        }
      );
    }
  }, [currentImage, editingMarkedUpImage]);

  const initializeHistory = () => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    
    const json = JSON.stringify(canvas.toJSON(['selectable', 'evented']));
    setHistory([json]);
    setHistoryIndex(0);
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
        break;
      
      case 'erase':
        canvas.isDrawingMode = true;
        // Create eraser brush
        const eraser = new fabric.EraserBrush(canvas);
        eraser.width = penSize * 2;
        canvas.freeDrawingBrush = eraser;
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
      const evt = opt.e;
      isDragging = true;
      canvas.selection = false;
      lastPosX = evt.clientX;
      lastPosY = evt.clientY;
      canvas.defaultCursor = 'grabbing';
    };

    const onMouseMove = (opt: fabric.IEvent) => {
      if (isDragging) {
        const evt = opt.e;
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
      const pointer = canvas.getPointer(opt.e);
      isDown = true;
      startX = pointer.x;
      startY = pointer.y;

      rect = new fabric.Rect({
        left: startX,
        top: startY,
        width: 0,
        height: 0,
        stroke: '#e11d48',
        strokeWidth: 2,
        fill: 'rgba(225, 29, 72, 0.1)',
        selectable: true,
        strokeDashArray: [5, 5]
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
        const arrowPoints = [0, 0, 80, 0, 70, -10, 80, 0, 70, 10];
        shape = new fabric.Polyline(
          arrowPoints.reduce((acc, val, i) => {
            if (i % 2 === 0) acc.push({ x: val, y: arrowPoints[i + 1] });
            return acc;
          }, [] as fabric.Point[]),
          {
            left: centerX - 40,
            top: centerY - 5,
            fill: penColor,
            stroke: penColor,
            strokeWidth: 2
          }
        );
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
    setZoom(newZoom);
  };

  const handleZoomReset = () => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
    setZoom(1);
    canvas.renderAll();
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

    const bgImage = canvas.backgroundImage;
    canvas.clear();
    if (bgImage) {
      canvas.setBackgroundImage(bgImage, canvas.renderAll.bind(canvas));
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
          <div ref={canvasContainerRef} className="flex-1 overflow-hidden bg-gray-100 flex items-center justify-center p-4 relative">
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
              className="border border-gray-300 shadow-lg bg-white"
            />
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}