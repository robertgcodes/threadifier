"use client";
import React, { useRef, useEffect, useState } from 'react';
import { fabric } from 'fabric';
import { Dialog } from '@headlessui/react';
import { Crop, Loader2, Minus, Plus, RefreshCw, Maximize, GripVertical, Trash2, Hand } from 'lucide-react';
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

export default function AnnotationModal({
  isOpen,
  onClose,
  onSave,
  onCrop,
  pageImages,
  initialPage,
  editingMarkedUpImage
}: AnnotationModalProps) {
  // Component State
  const [magnifyPageIdx, setMagnifyPageIdx] = useState(initialPage);
  const [magnifyImage, setMagnifyImage] = useState<string | null>(null);
  const [magnifyLoading, setMagnifyLoading] = useState(false);
  
  // Fabric.js refs
  const fabricCanvasRef = useRef<fabric.Canvas | null>(null);
  const canvasElRef = useRef<HTMLCanvasElement>(null); // Ref to the actual canvas element
  const canvasContainerRef = useRef<HTMLDivElement>(null); // Container for the canvas

  // Toolbar State
  const [zoom, setZoom] = useState(1);
  const [panMode, setPanMode] = useState(false);
  const [penColor, setPenColor] = useState<string>("#e11d48");
  const [penSize, setPenSize] = useState<number>(4);
  const [isErasing, setIsErasing] = useState(false);
  const [cropMode, setCropMode] = useState(false);
  const [cropRect, setCropRect] = useState<fabric.Object | null>(null);

  // Sync with incoming props
  useEffect(() => {
    if (isOpen) {
        setMagnifyPageIdx(initialPage);
        setPanMode(false);
        setCropMode(false);
        setCropRect(null);
    }
  }, [isOpen, initialPage]);

  // Load image URL
  useEffect(() => {
    if (!isOpen) return;

    setMagnifyLoading(true);
    let targetImage = '';
    if (editingMarkedUpImage) {
        targetImage = editingMarkedUpImage.url;
    } else if (magnifyPageIdx !== null) {
        targetImage = pageImages[magnifyPageIdx];
    }
    
    setMagnifyImage(targetImage);
    setMagnifyLoading(false);

  }, [isOpen, magnifyPageIdx, pageImages, editingMarkedUpImage]);
  
  const fitCanvasToContainer = (imgWidth: number, imgHeight: number) => {
    const canvas = fabricCanvasRef.current;
    const container = canvasContainerRef.current;
    if (!canvas || !container) return;

    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;

    const scale = Math.min(containerWidth / imgWidth, containerHeight / imgHeight) * 0.95; // Add some padding
    
    canvas.setWidth(containerWidth);
    canvas.setHeight(containerHeight);
    canvas.setZoom(scale);
    
    const center = new fabric.Point(containerWidth / 2, containerHeight / 2);
    const newVpt = fabric.util.transformPoint(
      new fabric.Point(imgWidth/2, imgHeight/2),
      fabric.util.invertTransform(canvas.viewportTransform!)
    );
    canvas.absolutePan(newVpt.subtract(center));

    setZoom(scale);
  };

  // Initialize Fabric.js canvas ONCE when modal opens
  useEffect(() => {
    if (isOpen && canvasElRef.current && !fabricCanvasRef.current) {
        const canvas = new fabric.Canvas(canvasElRef.current);
        fabricCanvasRef.current = canvas;
    }
    
    // Cleanup on close
    return () => {
        if (!isOpen && fabricCanvasRef.current) {
            fabricCanvasRef.current.dispose();
            fabricCanvasRef.current = null;
        }
    };
  }, [isOpen]);

  // Load image or JSON into canvas
  useEffect(() => {
      if (!magnifyImage || !fabricCanvasRef.current) return;
      const canvas = fabricCanvasRef.current;
      canvas.clear();
      
      const isEditingThisImage = editingMarkedUpImage && editingMarkedUpImage.url === magnifyImage;

      if (isEditingThisImage && editingMarkedUpImage.json) {
          canvas.loadFromJSON(editingMarkedUpImage.json, () => {
            canvas.renderAll();
            const bgImage = canvas.backgroundImage as fabric.Image;
            if (bgImage) {
              fitCanvasToContainer(bgImage.getScaledWidth(), bgImage.getScaledHeight());
            } else {
              const group = new fabric.Group(canvas.getObjects());
              fitCanvasToContainer(group.getScaledWidth(), group.getScaledHeight());
            }
          });
      } else {
          fabric.Image.fromURL(magnifyImage, (img) => {
              fitCanvasToContainer(img.width!, img.height!);
              canvas.setBackgroundImage(img, canvas.renderAll.bind(canvas), {});
          }, { crossOrigin: 'anonymous' });
      }

  }, [magnifyImage]);


  // Update brush
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    canvas.isDrawingMode = !panMode && !cropMode;
    canvas.freeDrawingBrush.color = isErasing ? '#ffffff' : penColor;
    canvas.freeDrawingBrush.width = isErasing ? penSize * 2 : penSize;
  }, [penColor, penSize, isErasing, panMode, cropMode]);

  // Zoom handlers
  const handleZoom = (newZoom: number) => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    const center = canvas.getCenter();
    canvas.zoomToPoint(new fabric.Point(center.left, center.top), newZoom);
    setZoom(newZoom);
  };
  const handleZoomIn = () => handleZoom(Math.min(3, zoom + 0.1));
  const handleZoomOut = () => handleZoom(Math.max(0.1, zoom - 0.1));
  const handleZoomReset = () => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    const bgImage = canvas.backgroundImage as fabric.Image;
     if (bgImage && bgImage.width && bgImage.height) {
        fitCanvasToContainer(bgImage.width, bgImage.height);
      }
  };

  // Pan
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    if (panMode) {
      canvas.isDrawingMode = false;
      canvas.setCursor('grab');
      let isPanning = false;
      let lastPoint = { x: 0, y: 0 };
      
      canvas.on('mouse:down', function(opt) {
        if (opt.e.altKey || panMode) {
            isPanning = true;
            lastPoint = { x: opt.e.clientX, y: opt.e.clientY };
            canvas.setCursor('grabbing');
        }
      });
      canvas.on('mouse:move', function(opt) {
        if (isPanning) {
            const delta = new fabric.Point(opt.e.clientX - lastPoint.x, opt.e.clientY - lastPoint.y);
            canvas.relativePan(delta);
            lastPoint = { x: opt.e.clientX, y: opt.e.clientY };
        }
      });
      canvas.on('mouse:up', function() {
        isPanning = false;
        canvas.setCursor('grab');
      });
    } else {
       canvas.off('mouse:down');
       canvas.off('mouse:move');
       canvas.off('mouse:up');
       canvas.setCursor('default');
    }
    return () => {
      if (canvas) {
        canvas.off('mouse:down');
        canvas.off('mouse:move');
        canvas.off('mouse:up');
      }
    }
  }, [panMode]);

  // Crop
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const cleanup = () => {
      canvas.off('mouse:down');
      canvas.off('mouse:move');
      canvas.off('mouse:up');
      canvas.selection = false;
      canvas.setCursor('default');
    };

    if (cropMode) {
      canvas.isDrawingMode = false;
      canvas.selection = false; // Disable group selection
      canvas.setCursor('crosshair');
      
      if(cropRect) {
        canvas.remove(cropRect)
      }
      setCropRect(null);

      let isDown = false, startX = 0, startY = 0;
      let rect: fabric.Rect;

      const onMouseDown = (o: fabric.IEvent) => {
        if (!o.pointer) return;
        isDown = true;
        startX = o.pointer.x;
        startY = o.pointer.y;
        
        rect = new fabric.Rect({
          left: startX,
          top: startY,
          width: 0,
          height: 0,
          stroke: '#e11d48',
          strokeWidth: 2 / zoom, // Adjust stroke width for zoom
          strokeDashArray: [5, 5],
          fill: 'rgba(225, 29, 72, 0.1)',
          selectable: false,
          hasControls: false,
        });
        canvas.add(rect);
      };

      const onMouseMove = (o: fabric.IEvent) => {
        if (!isDown || !o.pointer || !rect) return;
        const x = o.pointer.x;
        const y = o.pointer.y;

        rect.set({
          left: Math.min(x, startX),
          top: Math.min(y, startY),
          width: Math.abs(x - startX),
          height: Math.abs(y - startY),
        });
        canvas.renderAll();
      };

      const onMouseUp = () => {
        isDown = false;
        if(rect) {
          rect.set({ 
              strokeWidth: 2 / canvas.getZoom(),
              selectable: true, 
              hasControls: true, 
              lockRotation: true 
          });
          rect.setCoords();
          canvas.setActiveObject(rect);
          canvas.selection = true;
          setCropRect(rect);
        }
        canvas.off('mouse:down', onMouseDown);
        canvas.off('mouse:move', onMouseMove);
        canvas.off('mouse:up', onMouseUp);
      };

      canvas.on('mouse:down', onMouseDown);
      canvas.on('mouse:move', onMouseMove);
      canvas.on('mouse:up', onMouseUp);

    } else { 
      if (cropRect) {
        canvas.remove(cropRect);
        setCropRect(null);
      }
      cleanup();
    }

    return cleanup;
  }, [cropMode, zoom]);

  const handleResetAnnotation = () => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    const bgImage = canvas.backgroundImage;
    canvas.clear();
    if (bgImage) {
      canvas.setBackgroundImage(bgImage, canvas.renderAll.bind(canvas));
    }
  };

  const handleSaveAndClose = () => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL({ format: 'png' });
    const json = canvas.toJSON();
    onSave(url, json);
    onClose();
  }

  const handleApplyCrop = () => {
    const canvas = fabricCanvasRef.current;
    if (!canvas || !cropRect) return;

    // The crop rectangle's coordinates are relative to the zoomed canvas.
    // We need to calculate the crop area on the original, unzoomed image.
    const zoom = canvas.getZoom();
    const url = canvas.toDataURL({
        format: 'png',
        left: cropRect.left,
        top: cropRect.top,
        width: cropRect.width,
        height: cropRect.height,
    });
    
    onCrop(url);
    setCropMode(false);
    setCropRect(null);
  }

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onClose={onClose} className="fixed z-50 inset-0">
      <Dialog.Overlay className="fixed inset-0 bg-black/60" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="bg-white rounded-lg shadow-xl w-full max-w-7xl h-[95vh] flex flex-col">
          <div className="flex items-center justify-between p-2 border-b gap-4 flex-wrap bg-gray-50 rounded-t-lg">
            <Dialog.Title className="text-lg font-semibold text-gray-800 pl-2">
              Editing Page {magnifyPageIdx !== null ? magnifyPageIdx + 1 : ''}
            </Dialog.Title>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm">Zoom:</span>
              <button onClick={handleZoomOut} className="btn-secondary p-2" title="Zoom Out"><Minus size={16} /></button>
              <button onClick={handleZoomReset} className="btn-secondary p-2" title="Reset Zoom"><RefreshCw size={16} /></button>
              <button onClick={handleZoomIn} className="btn-secondary p-2" title="Zoom In"><Plus size={16} /></button>
              <span className="text-sm w-12 text-center">{(zoom * 100).toFixed(0)}%</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-semibold text-sm">Tools:</span>
              <button onClick={() => {setPanMode(p => !p); setCropMode(false)}} className={`btn-secondary p-2 ${panMode ? 'bg-blue-200' : ''}`} title="Pan Tool"><Hand size={16} /></button>
              <button onClick={() => {setCropMode(c => !c); setPanMode(false)}} className={`btn-secondary p-2 ${cropMode ? 'bg-blue-200' : ''}`} title="Crop Tool"><Crop size={16} /></button>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-semibold text-sm">Drawing:</span>
              <input type="color" value={penColor} onChange={e => setPenColor(e.target.value)} className="w-8 h-8 rounded-md border-gray-300" />
              <input type="range" min="1" max="50" value={penSize} onChange={e => setPenSize(Number(e.target.value))} className="w-24" />
              <button onClick={() => setIsErasing(e => !e)} className={`btn-secondary p-2 ${isErasing ? 'bg-red-200' : ''}`} title="Eraser">Eraser</button>
            </div>
             <div className="flex items-center gap-2">
               <button onClick={handleResetAnnotation} className="btn-secondary p-2 flex items-center gap-1"><Trash2 size={16}/> Reset</button>
                {cropMode && cropRect && <button onClick={handleApplyCrop} className="btn-primary animate-pulse">Apply Crop</button>}
             </div>
            <div className="flex items-center gap-2 pr-2">
               <button onClick={handleSaveAndClose} className="btn-primary">Save & Close</button>
            </div>
          </div>

          <div ref={canvasContainerRef} className="flex-grow overflow-hidden bg-gray-200 flex items-center justify-center p-2 relative">
             {magnifyLoading && <Loader2 className="animate-spin text-blue-500 absolute" size={48} />}
             <canvas ref={canvasElRef} />
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
} 