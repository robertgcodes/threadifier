"use client";
import React from 'react';
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragOverlay,
  closestCenter,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { PlusCircle } from 'lucide-react';
import SortableThreadRow from './SortableThreadRow';
import { ThreadPost, MarkedUpImage } from '../types';

interface ThreadEditorProps {
  generatedThread: ThreadPost[];
  setGeneratedThread: (thread: ThreadPost[]) => void;
  editingPostId: number | null;
  editingText: string;
  activeId: string | null;
  postPageMap: { [key: number]: any };
  startEditing: (post: ThreadPost) => void;
  deletePost: (id: number) => void;
  setEditingText: (text: string) => void;
  saveEdit: () => void;
  cancelEdit: () => void;
  handleCopy: (text: string) => void;
  handleDragStart: (event: DragStartEvent) => void;
  handleDragEnd: (event: DragEndEvent) => void;
  handleClearImage: (postId: number) => void;
  addPost: () => void;
}

const ThreadEditor: React.FC<ThreadEditorProps> = ({
  generatedThread,
  setGeneratedThread,
  editingPostId,
  editingText,
  activeId,
  postPageMap,
  startEditing,
  deletePost,
  setEditingText,
  saveEdit,
  cancelEdit,
  handleCopy,
  handleDragStart,
  handleDragEnd,
  handleClearImage,
  addPost
}) => {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const activePost = activeId ? generatedThread.find(p => p.id.toString() === activeId) : null;

  return (
    <div className="lg:col-span-2 space-y-4">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={generatedThread.map(p => p.id)} strategy={verticalListSortingStrategy}>
          {generatedThread.length > 0 && (
            <div className="sticky top-8 z-10 bg-legal-50/95 backdrop-blur-sm py-2 rounded-lg border border-legal-200">
              <div className="grid grid-cols-2 gap-4">
                <h2 className="text-xl font-semibold text-legal-700 px-4">Edit Your Thread</h2>
                <h2 className="text-xl font-semibold text-legal-700 px-4">Image Lane</h2>
              </div>
            </div>
          )}
          <div className="space-y-4">
            {generatedThread.map((post) => (
              <SortableThreadRow
                key={post.id}
                post={post}
                startEditing={startEditing}
                deletePost={deletePost}
                editingPostId={editingPostId}
                editingText={editingText}
                setEditingText={setEditingText}
                saveEdit={saveEdit}
                cancelEdit={cancelEdit}
                handleCopy={handleCopy}
                postPageMap={postPageMap}
                handleClearImage={handleClearImage}
              />
            ))}
          </div>
        </SortableContext>
        <DragOverlay>
          {activePost ? (
            <SortableThreadRow
              post={activePost}
              startEditing={startEditing}
              deletePost={deletePost}
              editingPostId={editingPostId}
              editingText={editingText}
              setEditingText={setEditingText}
              saveEdit={saveEdit}
              cancelEdit={cancelEdit}
              handleCopy={handleCopy}
              postPageMap={postPageMap}
              handleClearImage={handleClearImage}
            />
          ) : null}
        </DragOverlay>
      </DndContext>
      {generatedThread.length > 0 && (
        <button onClick={addPost} className="btn-secondary mt-6 w-full flex items-center justify-center">
          <PlusCircle className="w-5 h-5 mr-2" /> Add Post to Thread
        </button>
      )}
    </div>
  );
};

export default ThreadEditor; 