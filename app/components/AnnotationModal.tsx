"use client";
import React, { useRef, useEffect, useState } from 'react';
import { fabric } from 'fabric';
import { XCircle, Save } from 'lucide-react';
import { MarkedUpImage } from '../types';

interface AnnotationModalProps {
  isOpen: boolean;
  onClose: () => void;
  image: { url: string; pageNumber: number; id?: string; json?: any; } | null;
  onSave: (imageData: { id: string; url: string; pageNumber: number; json: any; }) => void;
}

const AnnotationModal: React.FC<AnnotationModalProps> = ({ isOpen, onClose, image, onSave }) => {
  const canvasRef = useRef<fabric.Canvas | null>(null);
  const imageRef = useRef<fabric.Image | null>(null);
  const [isCropping, setIsCropping] = useState(false);
  const cropRectRef = useRef<fabric.Rect | null>(null);
  const startPointRef = useRef<{ x: number, y: number } | null>(null);

  useEffect(() => {
    if (isOpen && image) {
      const canvas = new fabric.Canvas('annotation-canvas', {
        backgroundColor: '#f0f0f0',
      });
      canvasRef.current = canvas;

      fabric.Image.fromURL(image.url, (img) => {
        const modal = document.querySelector('.annotation-modal-content');
        const modalWidth = modal ? modal.clientWidth - 40 : 800;
        const scale = modalWidth / img.width!;
        
        img.scale(scale);
        canvas.setDimensions({ width: img.getScaledWidth(), height: img.getScaledHeight() });
        canvas.add(img);
        img.center();
        imageRef.current = img;

        if (image.json) {
          canvas.loadFromJSON(image.json, () => {
             const loadedImg = canvas.getObjects('image')[0] as fabric.Image;
             loadedImg.scale(scale).center();
             imageRef.current = loadedImg;
             canvas.renderAll();
          });
        }
      });

      return () => {
        canvas.dispose();
        canvasRef.current = null;
      };
    }
  }, [isOpen, image]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !isCropping) return;

    const handleMouseDown = (o: fabric.IEvent) => {
      if (cropRectRef.current) {
        canvas.remove(cropRectRef.current);
        cropRectRef.current = null;
      }
      const pointer = canvas.getPointer(o.e);
      startPointRef.current = { x: pointer.x, y: pointer.y };

      const rect = new fabric.Rect({
        left: pointer.x,
        top: pointer.y,
        width: 0,
        height: 0,
        fill: 'rgba(0, 102, 255, 0.2)',
        stroke: '#0066ff',
        strokeWidth: 2,
        selectable: true,
        lockScalingX: false,
        lockScalingY: false,
      });
      cropRectRef.current = rect;
      canvas.add(rect);
    };

    const handleMouseMove = (o: fabric.IEvent) => {
      if (!startPointRef.current || !cropRectRef.current) return;
      const pointer = canvas.getPointer(o.e);
      let { x, y } = pointer;

      let left = startPointRef.current.x;
      let top = startPointRef.current.y;
      let width = x - left;
      let height = y - top;

      if (width < 0) {
        left = x;
        width = -width;
      }
      if (height < 0) {
        top = y;
        height = -height;
      }

      cropRectRef.current.set({ left, top, width, height });
      canvas.renderAll();
    };

    const handleMouseUp = () => {
      startPointRef.current = null;
      if (cropRectRef.current && (cropRectRef.current.width === 0 || cropRectRef.current.height === 0)) {
        canvas.remove(cropRectRef.current);
        cropRectRef.current = null;
      }
    };

    canvas.on('mouse:down', handleMouseDown);
    canvas.on('mouse:move', handleMouseMove);
    canvas.on('mouse:up', handleMouseUp);

    return () => {
      canvas.off('mouse:down', handleMouseDown);
      canvas.off('mouse:move', handleMouseMove);
      canvas.off('mouse:up', handleMouseUp);
    };
  }, [isCropping]);


  const handleSave = () => {
    const canvas = canvasRef.current;
    const cropRect = cropRectRef.current;

    if (!canvas || !imageRef.current) return;

    let dataUrl;
    if (cropRect && isCropping) {
        // Temporarily make the rectangle invisible for the export
        cropRect.set({ opacity: 0 });
        canvas.renderAll();

        dataUrl = canvas.toDataURL({
            format: 'png',
            left: cropRect.left,
            top: cropRect.top,
            width: cropRect.width,
            height: cropRect.height,
        });
        
        // Restore rectangle visibility
        cropRect.set({ opacity: 1 });
        canvas.renderAll();
    } else {
        dataUrl = canvas.toDataURL({ format: 'png' });
    }

    const newJson = canvas.toJSON();
    onSave({
      id: image?.id || '',
      url: dataUrl,
      pageNumber: image!.pageNumber,
      json: newJson,
    });
    onClose();
  };
  
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-40 flex justify-center items-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl h-[90vh] flex flex-col annotation-modal-content">
        <div className="flex justify-between items-center p-4 border-b border-legal-200">
          <h2 className="text-xl font-bold text-legal-800">Edit Page {image?.pageNumber}</h2>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsCropping(!isCropping)}
              className={`px-4 py-2 rounded-md text-sm font-semibold transition-colors ${isCropping ? 'bg-primary-600 text-white' : 'bg-legal-200 text-legal-700 hover:bg-legal-300'}`}
            >
              {isCropping ? 'Stop Cropping' : 'Crop Image'}
            </button>
            <button onClick={handleSave} className="btn-primary flex items-center gap-2">
              <Save size={18} />
              Save Annotation
            </button>
            <button onClick={onClose} className="p-2 rounded-full hover:bg-legal-100">
              <XCircle className="text-legal-500" />
            </button>
          </div>
        </div>
        <div className="flex-grow p-4 overflow-auto flex items-center justify-center">
          <canvas id="annotation-canvas" />
        </div>
      </div>
    </div>
  );
};

export default AnnotationModal; 