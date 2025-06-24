'use client';

import { useState } from 'react';
import { Send } from 'lucide-react';
import toast from 'react-hot-toast';

interface XPostButtonProps {
  posts: Array<{ id: number; text: string }>;
  disabled?: boolean;
}

export default function XPostButton({ posts, disabled }: XPostButtonProps) {
  const [isPosting, setIsPosting] = useState(false);

  const handlePostToX = async () => {
    if (!posts || posts.length === 0) {
      toast.error('No posts to share');
      return;
    }

    setIsPosting(true);

    try {
      const response = await fetch('/api/post-thread', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ posts }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          toast.error('Please connect your X account first');
          // Optionally redirect to settings or show connect modal
        } else if (response.status === 429) {
          toast.error('Rate limit reached. Please try again later.');
        } else {
          toast.error(data.error || 'Failed to post thread');
        }
        return;
      }

      if (data.success) {
        toast.success(`Thread posted! ${data.postedCount}/${data.totalCount} tweets sent`);
        
        // Open the thread in a new tab
        if (data.threadUrl) {
          window.open(data.threadUrl, '_blank');
        }
      }
    } catch (error) {
      console.error('Error posting to X:', error);
      toast.error('Network error. Please try again.');
    } finally {
      setIsPosting(false);
    }
  };

  return (
    <button
      onClick={handlePostToX}
      disabled={disabled || isPosting}
      className="flex items-center space-x-2 bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      <Send className="w-4 h-4" />
      <span>{isPosting ? 'Posting...' : 'Post to X'}</span>
    </button>
  );
}