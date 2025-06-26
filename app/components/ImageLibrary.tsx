"use client";

import { useState, useEffect, useRef } from 'react';
import { Loader2, Upload, Image as ImageIcon, Trash2, Search, Filter, Grid, List, Download, Eye, Plus, Folder, Tag } from 'lucide-react';
import toast from 'react-hot-toast';
import { getAuth } from 'firebase/auth';
import { useDropzone } from 'react-dropzone';

interface LibraryImage {
  id: string;
  name: string;
  url: string;
  thumbnailUrl?: string;
  size: number;
  type: string;
  uploadedAt: any;
  tags: string[];
  category: 'document' | 'custom' | 'template';
  description?: string;
}

interface ImageCategory {
  id: string;
  name: string;
  color: string;
  count: number;
}

export default function ImageLibrary() {
  const [images, setImages] = useState<LibraryImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadingImages, setUploadingImages] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState<{[key: string]: number}>({});

  const categories: ImageCategory[] = [
    { id: 'all', name: 'All Images', color: 'bg-gray-500', count: images.length },
    { id: 'document', name: 'Document Images', color: 'bg-blue-500', count: images.filter(img => img.category === 'document').length },
    { id: 'custom', name: 'Custom Uploads', color: 'bg-green-500', count: images.filter(img => img.category === 'custom').length },
    { id: 'template', name: 'Templates', color: 'bg-purple-500', count: images.filter(img => img.category === 'template').length },
  ];

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.gif', '.webp']
    },
    onDrop: (acceptedFiles) => {
      setUploadingImages(acceptedFiles);
      setShowUploadModal(true);
    }
  });

  useEffect(() => {
    loadImages();
  }, []);

  const loadImages = async () => {
    setLoading(true);
    try {
      const auth = getAuth();
      const token = await auth.currentUser?.getIdToken();

      if (!token) {
        toast.error('Authentication required');
        return;
      }

      const response = await fetch('/api/library/images', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setImages(data.images);
      } else {
        throw new Error('Failed to load images');
      }
    } catch (error) {
      console.error('Error loading images:', error);
      toast.error('Failed to load images');
    } finally {
      setLoading(false);
    }
  };

  const uploadImages = async () => {
    if (uploadingImages.length === 0) return;

    setUploading(true);
    const progress: {[key: string]: number} = {};
    
    try {
      const auth = getAuth();
      const token = await auth.currentUser?.getIdToken();

      for (let i = 0; i < uploadingImages.length; i++) {
        const file = uploadingImages[i];
        const formData = new FormData();
        formData.append('image', file);
        formData.append('category', 'custom');

        // Update progress
        progress[file.name] = 0;
        setUploadProgress({...progress});

        const response = await fetch('/api/library/upload', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
          body: formData,
        });

        if (response.ok) {
          progress[file.name] = 100;
          setUploadProgress({...progress});
        } else {
          throw new Error(`Failed to upload ${file.name}`);
        }
      }

      toast.success(`${uploadingImages.length} images uploaded successfully`);
      setShowUploadModal(false);
      setUploadingImages([]);
      setUploadProgress({});
      loadImages();
    } catch (error: any) {
      toast.error(error.message || 'Failed to upload images');
    } finally {
      setUploading(false);
    }
  };

  const deleteImage = async (imageId: string) => {
    if (!confirm('Are you sure you want to delete this image?')) {
      return;
    }

    try {
      const auth = getAuth();
      const token = await auth.currentUser?.getIdToken();

      const response = await fetch(`/api/library/images/${imageId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        toast.success('Image deleted successfully');
        loadImages();
      } else {
        throw new Error('Failed to delete image');
      }
    } catch (error) {
      console.error('Error deleting image:', error);
      toast.error('Failed to delete image');
    }
  };

  const deleteSelectedImages = async () => {
    if (selectedImages.length === 0) return;

    if (!confirm(`Are you sure you want to delete ${selectedImages.length} images?`)) {
      return;
    }

    setLoading(true);
    try {
      const auth = getAuth();
      const token = await auth.currentUser?.getIdToken();

      const response = await fetch('/api/library/images/batch-delete', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ imageIds: selectedImages }),
      });

      if (response.ok) {
        toast.success(`${selectedImages.length} images deleted successfully`);
        setSelectedImages([]);
        loadImages();
      } else {
        throw new Error('Failed to delete images');
      }
    } catch (error) {
      console.error('Error deleting images:', error);
      toast.error('Failed to delete images');
    } finally {
      setLoading(false);
    }
  };

  const toggleImageSelection = (imageId: string) => {
    setSelectedImages(prev => 
      prev.includes(imageId) 
        ? prev.filter(id => id !== imageId)
        : [...prev, imageId]
    );
  };

  const filteredImages = images.filter(image => {
    const matchesSearch = image.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         image.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         image.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesCategory = selectedCategory === 'all' || image.category === selectedCategory;
    
    return matchesSearch && matchesCategory;
  });

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (loading && images.length === 0) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Image Library</h2>
          <p className="text-gray-600 dark:text-gray-400">Manage your images for threads and templates</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowUploadModal(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <Upload className="w-4 h-4" />
            Upload Images
          </button>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search images by name, description, or tags..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              />
            </div>
          </div>

          {/* Category Filter */}
          <div className="flex gap-2">
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedCategory === category.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                }`}
              >
                {category.name} ({String(category.count)})
              </button>
            ))}
          </div>

          {/* View Mode */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-lg transition-colors ${
                viewMode === 'grid'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-lg transition-colors ${
                viewMode === 'list'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Bulk Actions */}
        {selectedImages.length > 0 && (
          <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex items-center justify-between">
            <span className="text-sm text-blue-900 dark:text-blue-100">
              {selectedImages.length} image(s) selected
            </span>
            <button
              onClick={deleteSelectedImages}
              className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 text-sm flex items-center gap-1"
            >
              <Trash2 className="w-4 h-4" />
              Delete Selected
            </button>
          </div>
        )}
      </div>

      {/* Images Grid/List */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
          {filteredImages.map((image) => (
            <div
              key={image.id}
              className={`relative group bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden cursor-pointer transition-all ${
                selectedImages.includes(image.id) ? 'ring-2 ring-blue-500' : ''
              }`}
              onClick={() => toggleImageSelection(image.id)}
            >
              <div className="aspect-square relative">
                <img
                  src={image.thumbnailUrl || image.url}
                  alt={image.name}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all flex items-center justify-center">
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        window.open(image.url, '_blank');
                      }}
                      className="p-2 bg-white rounded-full text-gray-700 hover:text-gray-900"
                      title="View full size"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteImage(image.id);
                      }}
                      className="p-2 bg-red-500 rounded-full text-white hover:bg-red-600"
                      title="Delete image"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                {selectedImages.includes(image.id) && (
                  <div className="absolute top-2 right-2 w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center">
                    <span className="text-white text-xs">✓</span>
                  </div>
                )}
              </div>
              <div className="p-2">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{image.name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{formatFileSize(image.size)}</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {filteredImages.map((image) => (
              <div
                key={image.id}
                className={`p-4 flex items-center gap-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer ${
                  selectedImages.includes(image.id) ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                }`}
                onClick={() => toggleImageSelection(image.id)}
              >
                <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden flex-shrink-0">
                  <img
                    src={image.thumbnailUrl || image.url}
                    alt={image.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 dark:text-white truncate">{image.name}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {formatFileSize(image.size)} • {image.type} • {image.uploadedAt?.toDate?.()?.toLocaleDateString() || 'Unknown'}
                  </p>
                  {image.description && (
                    <p className="text-sm text-gray-600 dark:text-gray-300 truncate">{image.description}</p>
                  )}
                  {image.tags.length > 0 && (
                    <div className="flex gap-1 mt-1">
                      {image.tags.slice(0, 3).map((tag, index) => (
                        <span
                          key={index}
                          className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-xs text-gray-600 dark:text-gray-300 rounded"
                        >
                          {tag}
                        </span>
                      ))}
                      {image.tags.length > 3 && (
                        <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-xs text-gray-600 dark:text-gray-300 rounded">
                          +{image.tags.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      window.open(image.url, '_blank');
                    }}
                    className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    title="View full size"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteImage(image.id);
                    }}
                    className="p-2 text-red-400 hover:text-red-600 dark:hover:text-red-300"
                    title="Delete image"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {filteredImages.length === 0 && !loading && (
        <div className="text-center py-12">
          <ImageIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No images found</h3>
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            {searchTerm || selectedCategory !== 'all' 
              ? 'Try adjusting your search or filters'
              : 'Upload your first image to get started'
            }
          </p>
          {!searchTerm && selectedCategory === 'all' && (
            <button
              onClick={() => setShowUploadModal(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Upload Images
            </button>
          )}
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-md w-full">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Upload Images</h3>
            
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                isDragActive
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-300 dark:border-gray-600 hover:border-blue-500'
              }`}
            >
              <input {...getInputProps()} />
              <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-600 dark:text-gray-400">
                {isDragActive
                  ? 'Drop the images here...'
                  : 'Drag & drop images here, or click to select'
                }
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                Supports: JPG, PNG, GIF, WebP
              </p>
            </div>

            {uploadingImages.length > 0 && (
              <div className="mt-4">
                <h4 className="font-medium text-gray-900 dark:text-white mb-2">Selected Files:</h4>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {uploadingImages.map((file, index) => (
                    <div key={index} className="flex items-center justify-between text-sm">
                      <span className="text-gray-700 dark:text-gray-300 truncate">{file.name}</span>
                      <span className="text-gray-500 dark:text-gray-400">
                        {uploadProgress[file.name] || 0}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowUploadModal(false);
                  setUploadingImages([]);
                  setUploadProgress({});
                }}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={uploadImages}
                disabled={uploading || uploadingImages.length === 0}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                    Uploading...
                  </>
                ) : (
                  'Upload Images'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 