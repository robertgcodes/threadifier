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
  const [magnifyPageIdx, setMagnifyPageIdx] = useState(initialPage);
  const [magnifyImage, setMagnifyImage] = useState<string | null>(null);
  const [magnifyLoading, setMagnifyLoading] = useState(false);
  const pdfDocRef = useRef<any>(null);

  const fabricCanvasRef = useRef<fabric.Canvas | null>(null);
  const fabricContainerRef = useRef<HTMLDivElement | null>(null);
  const modalContentRef = useRef<HTMLDivElement | null>(null);

  const [zoom, setZoom] = useState(1);
  const [panMode, setPanMode] = useState(false);
  const [penColor, setPenColor] = useState<string>("#e11d48");
  const [penSize, setPenSize] = useState<number>(4);
  const [isErasing, setIsErasing] = useState(false);
  const [cropMode, setCropMode] = useState(false);
  const [cropRect, setCropRect] = useState<fabric.Object | null>(null);
  const [canvasNaturalSize, setCanvasNaturalSize] = useState<{ width: number, height: number } | null>(null);

  // Sync with incoming props
  useEffect(() => {
    if (isOpen) {
        setMagnifyPageIdx(initialPage);
        // Reset modes when modal opens or page changes
        setPanMode(false);
        setCropMode(false);
        setCropRect(null);
    }
  }, [isOpen, initialPage]);

  // Load high-res image for the current page
  useEffect(() => {
    if (magnifyPageIdx === null) {
      setMagnifyImage(null);
      return;
    };
    
    setMagnifyLoading(true);
    const targetImage = editingMarkedUpImage && editingMarkedUpImage.pageNumber === (magnifyPageIdx + 1)
      ? editingMarkedUpImage.url
      : pageImages[magnifyPageIdx];

    setMagnifyImage(targetImage);
    setMagnifyLoading(false);

  }, [magnifyPageIdx, pageImages, editingMarkedUpImage]);

  const handleFitToWindow = () => {
     if (!canvasNaturalSize || !modalContentRef.current) return;
     const { width: imgW, height: imgH } = canvasNaturalSize;
     const container = modalContentRef.current;
     const containerW = container.clientWidth - 40; 
     const containerH = container.clientHeight - 80; // Account for toolbar
     const scale = Math.min(containerW / imgW, containerH / imgH, 1); // Don't zoom past 100% on fit
     setZoom(scale);
   };

  // Initialize Fabric.js canvas
  useEffect(() => {
    if (!isOpen || !magnifyImage || !fabricContainerRef.current) return;

    const container = fabricContainerRef.current;
    container.innerHTML = '';
    const canvasEl = document.createElement("canvas");
    container.appendChild(canvasEl);

    const canvas = new fabric.Canvas(canvasEl);
    fabricCanvasRef.current = canvas;

    fabric.Image.fromURL(magnifyImage, (img) => {
      setCanvasNaturalSize({ width: img.width!, height: img.height! });
      canvas.setWidth(img.width!);
      canvas.setHeight(img.height!);
      
      const isEditingThisImage = editingMarkedUpImage && editingMarkedUpImage.url === magnifyImage;

      if (isEditingThisImage && editingMarkedUpImage.json) {
        canvas.loadFromJSON(editingMarkedUpImage.json, () => {
          canvas.renderAll();
          handleFitToWindow();
          setZoom(canvas.getZoom());
        });
      } else {
        canvas.setBackgroundImage(img, () => {
          canvas.renderAll();
          handleFitToWindow();
        }, {
          scaleX: 1,
          scaleY: 1
        });
      }
    });

    return () => {
      if (fabricCanvasRef.current) {
        fabricCanvasRef.current.dispose();
        fabricCanvasRef.current = null;
      }
    };
  }, [magnifyImage, isOpen]); // Rerun when image changes

  // Update brush
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    canvas.isDrawingMode = !panMode && !cropMode;
    canvas.freeDrawingBrush.color = isErasing ? '#ffffff' : penColor;
    canvas.freeDrawingBrush.width = isErasing ? penSize * 2 : penSize;
  }, [penColor, penSize, isErasing, panMode, cropMode, fabricCanvasRef.current]);

  // Zoom
  const handleZoomIn = () => setZoom(z => Math.min(3, z + 0.1));
  const handleZoomOut = () => setZoom(z => Math.max(0.1, z - 0.1));
  const handleZoomReset = () => setZoom(1);

  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    canvas.setZoom(zoom);
    canvas.renderAll();
  }, [zoom]);
  
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
  }, [panMode, fabricCanvasRef.current])

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
          strokeWidth: 2,
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
          rect.set({ selectable: true, hasControls: true, lockRotation: true });
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
  }, [cropMode]);

  const handleResetAnnotation = () => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    // Get background image
    const bgImage = canvas.backgroundImage;
    canvas.clear();
    // Add background image back
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
        <Dialog.Panel ref={modalContentRef} className="bg-white rounded-lg shadow-xl w-full max-w-7xl h-[95vh] flex flex-col">
          <div className="flex items-center justify-between p-2 border-b gap-4 flex-wrap bg-gray-50 rounded-t-lg">
            <Dialog.Title className="text-lg font-semibold text-gray-800 pl-2">
              Editing Page {magnifyPageIdx !== null ? magnifyPageIdx + 1 : ''}
            </Dialog.Title>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm">Zoom:</span>
              <button onClick={handleZoomOut} className="btn-secondary p-2" title="Zoom Out"><Minus size={16} /></button>
              <button onClick={handleZoomReset} className="btn-secondary p-2" title="Reset Zoom"><RefreshCw size={16} /></button>
              <button onClick={handleZoomIn} className="btn-secondary p-2" title="Zoom In"><Plus size={16} /></button>
              <button onClick={handleFitToWindow} className="btn-secondary p-2" title="Fit to Window"><Maximize size={16} /></button>
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

          <div className="flex-grow overflow-auto bg-gray-200 flex items-center justify-center p-2">
            {magnifyLoading ? <Loader2 className="animate-spin text-blue-500" size={48} /> : (
              <div ref={fabricContainerRef} className="mx-auto shadow-lg" />
            )}
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
} 