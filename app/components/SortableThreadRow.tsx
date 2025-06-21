"use client";
import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useDroppable } from '@dnd-kit/core';
import { GripVertical, ImageIcon, Trash2, Edit, CopyIcon, XCircle } from 'lucide-react';
import { ThreadPost, MarkedUpImage } from '../types';

// --- Droppable Zone for Images ---
function ImageDropZone({ id, post, postPageMap, handleClearImage }: { id: string, post: ThreadPost, postPageMap: any, handleClearImage: (postId: number) => void }) {
  const {isOver, setNodeRef} = useDroppable({ id });
  const imageUrl = postPageMap[post.id];

  return (
    <div
      ref={setNodeRef}
      style={{
        border: isOver ? '2px solid #2563eb' : '2px dashed #d1d5db',
        transition: 'border-color 0.2s',
      }}
      className="bg-legal-50/50 p-4 rounded-lg flex items-center justify-center text-legal-500 h-full relative"
    >
      {imageUrl ? (
        <>
          <img src={imageUrl} alt={`Page for post ${post.id}`} className="max-h-48 object-contain rounded-md" />
          <button 
            onClick={() => handleClearImage(post.id)} 
            className="absolute top-2 right-2 bg-white/50 backdrop-blur-sm rounded-full p-1 text-legal-600 hover:text-red-500 hover:bg-white"
            aria-label="Clear image"
          >
            <XCircle className="w-5 h-5" />
          </button>
        </>
      ) : (
        <div className="text-center">
          <ImageIcon className="w-8 h-8 mx-auto text-legal-400" />
          <p>Drop Image Here</p>
        </div>
      )}
    </div>
  );
}

// --- Sortable Post Item (The Draggable Text Part) ---
function SortablePostItem({ post, startEditing, deletePost, editingPostId, editingText, setEditingText, saveEdit, cancelEdit, handleCopy, dragHandleListeners, dragHandleAttributes }: { post: ThreadPost, startEditing: (post: ThreadPost) => void, deletePost: (id: number) => void, editingPostId: number | null, editingText: string, setEditingText: (text: string) => void, saveEdit: () => void, cancelEdit: () => void, handleCopy: (text: string) => void, dragHandleListeners: any, dragHandleAttributes: any }) {
  return (
    <div className="flex gap-2 items-start h-full group">
      <div {...dragHandleAttributes} {...dragHandleListeners} className="flex-shrink-0 touch-none cursor-grab text-legal-400 hover:text-legal-600 pt-3">
        <GripVertical size={20} />
      </div>
      <div className="flex-grow">
        <div className="text-sm text-legal-500 mb-1">Post {post.id}</div>
        {editingPostId === post.id ? (
          <div>
            <textarea
              value={editingText}
              onChange={(e) => setEditingText(e.target.value)}
              className="w-full p-2 border rounded-md shadow-inner bg-white"
              rows={5}
            />
            <div className="flex gap-2 mt-2">
              <button onClick={saveEdit} className="px-3 py-1 bg-primary-600 text-white rounded-md hover:bg-primary-700 text-sm">Save</button>
              <button onClick={cancelEdit} className="px-3 py-1 bg-legal-200 text-legal-700 rounded-md hover:bg-legal-300 text-sm">Cancel</button>
            </div>
          </div>
        ) : (
          <>
            <p className="text-legal-600 whitespace-pre-wrap">{post.text}</p>
            <div className="flex items-center gap-4 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={() => handleCopy(post.text)} className="text-legal-500 hover:text-primary-600 text-sm flex items-center"><CopyIcon className="w-4 h-4 mr-1"/>Copy</button>
              <button onClick={() => startEditing(post)} className="text-legal-500 hover:text-primary-600 text-sm flex items-center"><Edit className="w-4 h-4 mr-1"/>Edit</button>
              <button onClick={() => deletePost(post.id)} className="text-legal-500 hover:text-red-600 text-sm flex items-center"><Trash2 className="w-4 h-4 mr-1"/>Delete</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}


// --- Main SortableThreadRow Component ---
interface SortableThreadRowProps {
  post: ThreadPost;
  startEditing: (post: ThreadPost) => void;
  deletePost: (id: number) => void;
  editingPostId: number | null;
  editingText: string;
  setEditingText: (text: string) => void;
  saveEdit: () => void;
  cancelEdit: () => void;
  handleCopy: (text: string) => void;
  postPageMap: any;
  handleClearImage: (postId: number) => void;
}

const SortableThreadRow: React.FC<SortableThreadRowProps> = ({ post, ...props }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({id: post.id});

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className="grid grid-cols-2 gap-4 items-start">
      <div className="bg-white p-4 rounded-lg shadow-sm border border-legal-200 h-full">
        <SortablePostItem 
          post={post}
          startEditing={props.startEditing}
          deletePost={props.deletePost}
          editingPostId={props.editingPostId}
          editingText={props.editingText}
          setEditingText={props.setEditingText}
          saveEdit={props.saveEdit}
          cancelEdit={props.cancelEdit}
          handleCopy={props.handleCopy}
          dragHandleListeners={listeners}
          dragHandleAttributes={attributes}
        />
      </div>
      <ImageDropZone
        id={`droppable-${post.id}`}
        post={post}
        postPageMap={props.postPageMap}
        handleClearImage={props.handleClearImage}
      />
    </div>
  );
};

export default SortableThreadRow; 