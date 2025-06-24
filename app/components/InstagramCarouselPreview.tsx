"use client";

import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Heart, MessageCircle, Send, Bookmark, MoreHorizontal, Copy, Download, Moon, Sun } from 'lucide-react';
import { ThreadPost } from '../types';
import toast from 'react-hot-toast';

interface InstagramCarouselPreviewProps {
  posts: ThreadPost[];
  userProfile: any;
  user: any;
  isDarkMode?: boolean;
  onDarkModeToggle?: () => void;
}

export default function InstagramCarouselPreview({ posts, userProfile, user, isDarkMode = false, onDarkModeToggle }: InstagramCarouselPreviewProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [canvasDarkMode, setCanvasDarkMode] = useState(false);

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % posts.length);
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + posts.length) % posts.length);
  };

  const handleCopyText = () => {
    const fullText = posts.map(post => post.text).join('\n\n');
    navigator.clipboard.writeText(fullText);
    toast.success('Thread text copied to clipboard!');
  };

  const handleDownloadImages = async () => {
    // Create canvas for each post
    posts.forEach(async (post, index) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Instagram square dimensions
      canvas.width = 1080;
      canvas.height = 1080;

      // Background
      ctx.fillStyle = canvasDarkMode ? '#111827' : '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Content padding
      const padding = 80;
      const contentWidth = canvas.width - (padding * 2);
      const startX = padding;
      let currentY = 240; // Start position for content

      // Profile section
      const profileSize = 56;
      
      // Profile picture
      if (userProfile?.avatar) {
        // Load and draw avatar image
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          // Draw circular mask
          ctx.save();
          ctx.beginPath();
          ctx.arc(startX + profileSize/2, currentY + profileSize/2, profileSize/2, 0, 2 * Math.PI);
          ctx.clip();
          ctx.drawImage(img, startX, currentY, profileSize, profileSize);
          ctx.restore();
          
          // Continue with the rest of the drawing
          drawRestOfPost();
        };
        img.onerror = () => {
          // Fallback to placeholder if image fails to load
          ctx.fillStyle = '#3B82F6';
          ctx.beginPath();
          ctx.arc(startX + profileSize/2, currentY + profileSize/2, profileSize/2, 0, 2 * Math.PI);
          ctx.fill();
          
          // Profile initial
          ctx.fillStyle = '#FFFFFF';
          ctx.font = 'bold 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const initial = userProfile?.displayName?.charAt(0)?.toUpperCase() || user?.displayName?.charAt(0)?.toUpperCase() || 'U';
          ctx.fillText(initial, startX + profileSize/2, currentY + profileSize/2);
          
          drawRestOfPost();
        };
        img.src = userProfile.avatar;
      } else {
        // Profile picture placeholder
        ctx.fillStyle = '#3B82F6';
        ctx.beginPath();
        ctx.arc(startX + profileSize/2, currentY + profileSize/2, profileSize/2, 0, 2 * Math.PI);
        ctx.fill();
        
        // Profile initial
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const initial = userProfile?.displayName?.charAt(0)?.toUpperCase() || user?.displayName?.charAt(0)?.toUpperCase() || 'U';
        ctx.fillText(initial, startX + profileSize/2, currentY + profileSize/2);
        
        drawRestOfPost();
      }

      function drawRestOfPost() {
        // Username and handle
        const textStartX = startX + profileSize + 16;
        
        // Username
        ctx.fillStyle = canvasDarkMode ? '#FFFFFF' : '#000000';
        ctx.font = 'bold 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        const displayName = userProfile?.displayName || user?.displayName || 'User';
        ctx.fillText(displayName, textStartX, currentY + 8);
        
        // Handle
        ctx.fillStyle = canvasDarkMode ? '#9CA3AF' : '#6B7280';
        ctx.font = '18px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial';
        const handle = `@${userProfile?.instagramHandle || userProfile?.xHandle || user?.email?.split('@')[0] || 'username'}`;
        ctx.fillText(handle, textStartX, currentY + 32);

        // Move down for post text
        currentY += profileSize + 24;

        // Post text
        ctx.fillStyle = canvasDarkMode ? '#FFFFFF' : '#000000';
        ctx.font = '28px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        
        // Word wrap the text
        const words = post.text.split(' ');
        const lines = [];
        let currentLine = '';
        const maxWidth = contentWidth;
        
        words.forEach(word => {
          const testLine = currentLine + word + ' ';
          const metrics = ctx.measureText(testLine);
          if (metrics.width > maxWidth && currentLine) {
            lines.push(currentLine.trim());
            currentLine = word + ' ';
          } else {
            currentLine = testLine;
          }
        });
        if (currentLine) {
          lines.push(currentLine.trim());
        }

        // Draw text lines
        const lineHeight = 40;
        
        lines.forEach((line, i) => {
          ctx.fillText(line, startX, currentY + (i * lineHeight));
        });

        // Convert to blob and download
        canvas.toBlob((blob) => {
          if (blob) {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `instagram-carousel-${index + 1}.png`;
            a.click();
            URL.revokeObjectURL(url);
          }
        });
      }
    });

    toast.success(`Downloading ${posts.length} carousel images...`);
  };

  return (
    <div className="space-y-6">
      {/* Header with Dark Mode Toggle */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-800">Instagram Carousel Preview</h2>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setCanvasDarkMode(false)}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                !canvasDarkMode ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
              title="Light canvas"
            >
              Light
            </button>
            <button
              onClick={() => setCanvasDarkMode(true)}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                canvasDarkMode ? 'bg-gray-800 text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
              title="Dark canvas"
            >
              Dark
            </button>
          </div>
          {onDarkModeToggle && (
            <button
              onClick={onDarkModeToggle}
              className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors"
              title={`Switch app to ${isDarkMode ? 'light' : 'dark'} mode`}
            >
              {isDarkMode ? (
                <Sun className="w-4 h-4 text-gray-600" />
              ) : (
                <Moon className="w-4 h-4 text-gray-600" />
              )}
            </button>
          )}
          <span className="text-sm text-gray-600">
            {posts.length} slide{posts.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Instagram Post Container */}
      <div className={`max-w-[470px] mx-auto rounded-lg overflow-hidden ${isDarkMode ? 'bg-black' : 'bg-white border border-gray-300'}`}>
        {/* Header */}
        <div className={`flex items-center justify-between p-3 ${isDarkMode ? 'border-b border-gray-800' : 'border-b border-gray-200'}`}>
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center overflow-hidden">
              {userProfile?.avatar ? (
                <img src={userProfile.avatar} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <span className="text-white text-sm font-bold">
                  {userProfile?.displayName?.charAt(0)?.toUpperCase() || user?.displayName?.charAt(0)?.toUpperCase() || 'U'}
                </span>
              )}
            </div>
            <div>
              <div className={`font-semibold text-sm ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                {userProfile?.instagramHandle || userProfile?.xHandle || user?.email?.split('@')[0] || 'username'}
              </div>
            </div>
          </div>
          <button className={isDarkMode ? 'text-white' : 'text-gray-900'}>
            <MoreHorizontal className="w-5 h-5" />
          </button>
        </div>

        {/* Carousel */}
        <div className="relative aspect-square bg-gray-100">
          {/* Current Slide */}
          <div className={`absolute inset-0 p-10 overflow-hidden ${canvasDarkMode ? 'bg-gray-900' : 'bg-white'}`}>
            <div className="h-full flex flex-col justify-center max-w-full">
              {/* Profile Header */}
              <div className="flex items-start gap-3 mb-4">
                <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0">
                  {userProfile?.avatar ? (
                    <img src={userProfile.avatar} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-white text-lg font-bold">
                      {userProfile?.displayName?.charAt(0)?.toUpperCase() || user?.displayName?.charAt(0)?.toUpperCase() || 'U'}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`font-bold text-base ${canvasDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    {userProfile?.displayName || user?.displayName || 'User'}
                  </div>
                  <div className={`text-sm ${canvasDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    @{userProfile?.instagramHandle || userProfile?.xHandle || user?.email?.split('@')[0] || 'username'}
                  </div>
                </div>
              </div>
              
              {/* Post Text */}
              <div className={`text-lg leading-relaxed ${canvasDarkMode ? 'text-white' : 'text-gray-900'} break-words`}>
                {posts[currentSlide]?.text}
              </div>
            </div>
          </div>

          {/* Navigation Arrows */}
          {posts.length > 1 && (
            <>
              {currentSlide > 0 && (
                <button
                  onClick={prevSlide}
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/80 rounded-full flex items-center justify-center shadow-lg hover:bg-white transition-colors"
                >
                  <ChevronLeft className="w-5 h-5 text-gray-900" />
                </button>
              )}
              {currentSlide < posts.length - 1 && (
                <button
                  onClick={nextSlide}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/80 rounded-full flex items-center justify-center shadow-lg hover:bg-white transition-colors"
                >
                  <ChevronRight className="w-5 h-5 text-gray-900" />
                </button>
              )}
            </>
          )}

          {/* Slide Indicators */}
          {posts.length > 1 && (
            <div className="absolute top-4 left-0 right-0 flex justify-center space-x-1">
              {posts.map((_, index) => (
                <div
                  key={`indicator-${index}`}
                  className={`h-1.5 rounded-full transition-all ${
                    index === currentSlide
                      ? 'w-8 bg-blue-600'
                      : 'w-1.5 bg-gray-300'
                  }`}
                />
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className={`p-3 ${isDarkMode ? 'border-t border-gray-800' : 'border-t border-gray-200'}`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-4">
              <button 
                onClick={() => setLiked(!liked)}
                className={`transition-colors ${liked ? 'text-red-500' : isDarkMode ? 'text-white' : 'text-gray-900'}`}
              >
                <Heart className={`w-6 h-6 ${liked ? 'fill-current' : ''}`} />
              </button>
              <button className={isDarkMode ? 'text-white' : 'text-gray-900'}>
                <MessageCircle className="w-6 h-6" />
              </button>
              <button className={isDarkMode ? 'text-white' : 'text-gray-900'}>
                <Send className="w-6 h-6" />
              </button>
            </div>
            <button 
              onClick={() => setSaved(!saved)}
              className={`transition-colors ${saved ? 'text-gray-900' : isDarkMode ? 'text-white' : 'text-gray-900'}`}
            >
              <Bookmark className={`w-6 h-6 ${saved ? 'fill-current' : ''}`} />
            </button>
          </div>

          {/* Likes */}
          <div className={`font-semibold text-sm mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            {Math.floor(Math.random() * 1000) + 100} likes
          </div>

          {/* Caption Preview */}
          <div className={`text-sm ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            <span className="font-semibold">{userProfile?.instagramHandle || userProfile?.xHandle || user?.email?.split('@')[0] || 'username'}</span>
            <span className="ml-2 line-clamp-2">
              {posts.map(p => p.text).join(' ')}
            </span>
          </div>

          {/* Time */}
          <div className="text-xs text-gray-500 mt-2">
            2 HOURS AGO
          </div>
        </div>
      </div>

      {/* Thread Text & Actions */}
      <div className="max-w-[470px] mx-auto space-y-4">
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-900">Full Thread Text</h3>
            <button
              onClick={handleCopyText}
              className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700"
            >
              <Copy className="w-4 h-4" />
              Copy All
            </button>
          </div>
          <div className="text-sm text-gray-600 whitespace-pre-wrap max-h-48 overflow-y-auto">
            {posts.map(post => post.text).join('\n\n')}
          </div>
        </div>

        <button
          onClick={handleDownloadImages}
          className="w-full btn-primary flex items-center justify-center gap-2"
        >
          <Download className="w-4 h-4" />
          Download All {posts.length} Carousel Images
        </button>
      </div>
    </div>
  );
}