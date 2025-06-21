"use client";

import React from 'react';
import { MarkedUpImage } from '../types';

// Define props for the modal
interface ImagePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  pageImages: string[];
  markedUpImages: MarkedUpImage[];
  onSelect: (type: 'pdf' | 'marked', value: number | string) => void;
}

export default function ImagePickerModal({ isOpen, onClose, pageImages, markedUpImages, onSelect }: ImagePickerModalProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center" onClick={onClose}>
      <div 
        className="bg-white rounded-lg shadow-xl p-6 w-full max-w-6xl max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()} // Prevent modal from closing when clicking inside
      >
        <div className="flex justify-between items-center mb-4 border-b pb-4">
          <h2 className="text-2xl font-bold text-legal-800">Select an Image</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="overflow-y-auto pr-2">
          {pageImages.length === 0 && markedUpImages.length === 0 ? (
            <p className="text-center text-gray-500 py-10">No images available to select.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <h3 className="text-xl font-semibold mb-4 text-legal-700 sticky top-0 bg-white py-2">From PDF</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {pageImages.map((img, idx) => (
                    <div
                      key={`picker-pdf-${idx}`}
                      onClick={() => onSelect('pdf', idx)}
                      className="border border-legal-200 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-primary-500 cursor-pointer hover:border-primary-500 transition-all transform hover:scale-105"
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => e.key === 'Enter' && onSelect('pdf', idx)}
                    >
                      <img src={img} alt={`Page ${idx + 1}`} className="w-full h-auto aspect-[7/9] object-cover" />
                      <div className="text-sm text-center text-legal-600 py-2 bg-gray-50">Page {idx + 1}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-xl font-semibold mb-4 text-legal-700 sticky top-0 bg-white py-2">From Mark-ups</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {markedUpImages.map((img) => (
                    <div
                      key={`picker-marked-${img.id}`}
                      onClick={() => onSelect('marked', img.id)}
                      className="border border-legal-200 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-primary-500 cursor-pointer hover:border-primary-500 transition-all transform hover:scale-105"
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => e.key === 'Enter' && onSelect('marked', img.id)}
                    >
                      <img src={img.url} alt={`Marked-up page ${img.pageNumber}`} className="w-full h-auto aspect-[7/9] object-cover" />
                      <div className="text-sm text-center text-legal-600 py-2 bg-gray-50">Page {img.pageNumber} Edited</div>
                    </div>
                  ))}
                </div>
                 {markedUpImages.length === 0 && <p className="text-gray-400">No marked-up images yet.</p>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 