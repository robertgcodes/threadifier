"use client"
import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { MarkedUpImage } from '../types';

function DraggableImage({ id, children }: { id: string, children: React.ReactNode }) {
  const {attributes, listeners, setNodeRef, transform} = useDraggable({ id });
  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    zIndex: 100, // Ensure dragged item is on top
  } : undefined;

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
      {children}
    </div>
  );
}

interface SourceImageGalleryProps {
  pageImages: string[];
  markedUpImages: MarkedUpImage[];
  onMagnify: (index: number) => void;
  onEdit: (image: MarkedUpImage) => void;
  onDelete: (id: string) => void;
}

const SourceImageGallery: React.FC<SourceImageGalleryProps> = ({
  pageImages,
  markedUpImages,
  onMagnify,
  onEdit,
  onDelete,
}) => {
  return (
    <div className="lg:col-span-1 space-y-6">
      {/* PDF Pages Gallery */}
      <div>
        <h2 className="text-xl font-semibold text-legal-700 mb-3">Image Sources</h2>
        <div className="p-4 bg-white rounded-lg border border-legal-200 shadow-sm">
          <h3 className="font-semibold text-legal-600 mb-2">Original PDF Pages</h3>
          {pageImages.length > 0 ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-3 lg:grid-cols-4 gap-2">
              {pageImages.map((imgSrc, index) => (
                <DraggableImage key={`pdf-dnd-${index}`} id={`pdf-${index}`}>
                  <div className="relative group border border-legal-200 rounded overflow-hidden">
                    <button onClick={() => onMagnify(index)} className="w-full h-full text-left">
                      <img src={imgSrc} alt={`Page ${index + 1}`} className="h-28 w-full object-contain bg-gray-200" />
                      <div className="text-xs text-center text-legal-500 py-1">Page {index + 1}</div>
                    </button>
                  </div>
                </DraggableImage>
              ))}
            </div>
          ) : (
            <div className="text-center text-legal-400 py-8">Upload a PDF to see page images.</div>
          )}
        </div>
      </div>

      {/* Marked Up Images Gallery */}
      {markedUpImages.length > 0 && (
        <div>
          <h3 className="font-semibold text-legal-600 mb-2">Your Markups</h3>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {markedUpImages.map((img) => (
              <DraggableImage key={`markup-dnd-${img.id}`} id={`markup-${img.id}`}>
                <div className="relative group border border-legal-200 rounded overflow-hidden shadow-lg">
                  <button onClick={() => onEdit(img)} className="w-full h-full text-left">
                    <img src={img.url} alt={`Page ${img.pageNumber} Edited`} className="h-28 w-full object-contain bg-white" />
                    <div className="text-xs text-center text-legal-500 py-1 truncate">Page {img.pageNumber} Edited</div>
                  </button>
                  <div className="absolute top-1 right-1 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button title="Delete" className="bg-red-500 text-white rounded-full p-1 shadow" onClick={(e) => { e.stopPropagation(); onDelete(img.id); }}>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                </div>
              </DraggableImage>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default SourceImageGallery; 