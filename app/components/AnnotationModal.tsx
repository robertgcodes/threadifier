"use client";
import React, { useRef, useEffect, useState } from 'react';
import { fabric } from 'fabric';
import { Dialog } from '@headlessui/react';
import { Crop, Loader2, Minus, Plus, RefreshCw, Maximize } from 'lucide-react';
import { MarkedUpImage } from '../types';

interface AnnotationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (url: string, json: any) => void;
  pageImages: string[];
  initialPage: number | null;
  editingMarkedUpImage?: MarkedUpImage;
}

export default function AnnotationModal({
  isOpen,
  onClose,
  onSave,
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

  // Load high-res image for the current page
  useEffect(() => {
    if (initialPage === null) return;
    setMagnifyPageIdx(initialPage);
  }, [initialPage]);

  useEffect(() => {
    if (magnifyPageIdx === null) {
      setMagnifyImage(null);
      return;
    };
    
    // If we're editing a marked up image, use its data URL directly
    if (editingMarkedUpImage) {
        setMagnifyImage(editingMarkedUpImage.url);
        return;
    }

    // Otherwise, render from the PDF
    if (!pageImages[magnifyPageIdx]) return;
    setMagnifyLoading(true);
    // This is a simplified stand-in for PDF rendering. 
    // In a real scenario, we'd use pdf.js to get a high-res page image.
    // For now, we'll just use the thumbnail URL.
    setMagnifyImage(pageImages[magnifyPageIdx]);
    setMagnifyLoading(false);

  }, [magnifyPageIdx, pageImages, editingMarkedUpImage]);

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
      
      // Load existing JSON if available
      if (editingMarkedUpImage?.json) {
        canvas.loadFromJSON(editingMarkedUpImage.json, () => {
          canvas.renderAll();
        });
      } else {
        canvas.setBackgroundImage(img, canvas.renderAll.bind(canvas), {
          scaleX: 1,
          scaleY: 1
        });
      }
    });

    return () => {
      canvas.dispose();
      fabricCanvasRef.current = null;
    };
  }, [magnifyImage, isOpen, editingMarkedUpImage]);

  // Update brush
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    canvas.freeDrawingBrush.color = isErasing ? '#ffffff' : penColor;
    canvas.freeDrawingBrush.width = isErasing ? penSize * 2 : penSize;
  }, [penColor, penSize, isErasing]);

  // Handlers
  const handleZoomIn = () => setZoom(z => Math.min(3, z + 0.1));
  const handleZoomOut = () => setZoom(z => Math.max(0.2, z - 0.1));
  const handleZoomReset = () => setZoom(1);
  const handleFitToWindow = () => {
     if (!canvasNaturalSize || !modalContentRef.current) return;
     const { width: imgW, height: imgH } = canvasNaturalSize;
     const container = modalContentRef.current;
     const containerW = container.clientWidth - 40; // padding
     const containerH = container.clientHeight - 100; // toolbar and other elements
     const scale = Math.min(containerW / imgW, containerH / imgH);
     setZoom(scale);
   };

  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    canvas.setZoom(zoom);
    canvas.renderAll();
  }, [zoom]);

  const handleSaveAndClose = () => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL({ format: 'png' });
    const json = canvas.toJSON();
    onSave(url, json);
    onClose();
  }

  if (!isOpen) {
    return null;
  }

  return (
    <Dialog open={isOpen} onClose={onClose} className="fixed z-50 inset-0">
      <Dialog.Overlay className="fixed inset-0 bg-black/50" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel ref={modalContentRef} className="bg-white rounded-lg shadow-xl w-full max-w-6xl h-[90vh] flex flex-col">
          {/* Toolbar */}
          <div className="flex items-center justify-between p-2 border-b gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="font-semibold px-2">Zoom:</span>
              <button onClick={handleZoomOut} className="btn-secondary p-2"><Minus size={16} /></button>
              <button onClick={handleZoomReset} className="btn-secondary p-2"><RefreshCw size={16} /></button>
              <button onClick={handleZoomIn} className="btn-secondary p-2"><Plus size={16} /></button>
              <button onClick={handleFitToWindow} className="btn-secondary p-2"><Maximize size={16} /></button>
              <span className="text-sm">{(zoom * 100).toFixed(0)}%</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold px-2">Drawing:</span>
              <input type="color" value={penColor} onChange={e => setPenColor(e.target.value)} className="w-8 h-8" />
              <input type="range" min="1" max="50" value={penSize} onChange={e => setPenSize(Number(e.target.value))} />
              <button onClick={() => setIsErasing(!isErasing)} className={`btn-secondary p-2 ${isErasing ? 'bg-red-200' : ''}`}>Eraser</button>
            </div>
            <div className="flex items-center gap-2">
               <button onClick={handleSaveAndClose} className="btn-primary">Save & Close</button>
            </div>
          </div>

          {/* Canvas */}
          <div className="flex-grow overflow-auto bg-gray-200 p-4">
            <div ref={fabricContainerRef} className="mx-auto" style={{ width: canvasNaturalSize?.width, height: canvasNaturalSize?.height }}>
              {magnifyLoading && <Loader2 className="animate-spin" />}
            </div>
          </div>

        </Dialog.Panel>
      </div>
    </Dialog>
  );
} 