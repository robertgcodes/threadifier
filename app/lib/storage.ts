import { storage } from './firebase';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { v4 as uuidv4 } from 'uuid';

// Upload image to Firebase Storage and return download URL
export const uploadImageToStorage = async (
  imageDataUrl: string,
  userId: string,
  threadId?: string,
  retryCount: number = 0
): Promise<string> => {
  const maxRetries = 3;
  
  try {
    // Convert data URL to blob
    const response = await fetch(imageDataUrl);
    const blob = await response.blob();
    
    // Create a unique filename
    const fileName = `${uuidv4()}.png`;
    const storagePath = threadId 
      ? `threads/${userId}/${threadId}/${fileName}`
      : `temp/${userId}/${fileName}`;
    
    // Create storage reference and upload
    const storageRef = ref(storage, storagePath);
    const uploadResult = await uploadBytes(storageRef, blob);
    
    // Get download URL
    const downloadURL = await getDownloadURL(uploadResult.ref);
    return downloadURL;
  } catch (error: any) {
    console.error('Error uploading image to storage:', error);
    
    // Check if it's a CORS error
    if (error.message?.includes('CORS') || error.code === 'storage/unauthorized') {
      console.error('CORS configuration needed for Firebase Storage. Please run: gsutil cors set cors.json gs://threadifier.firebasestorage.app');
      throw new Error('Storage upload failed: CORS configuration required. Please contact support.');
    }
    
    // Retry on network errors
    if (retryCount < maxRetries && (error.code === 'storage/retry-limit-exceeded' || error.message?.includes('network'))) {
      console.log(`Retrying upload (${retryCount + 1}/${maxRetries})...`);
      await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1))); // exponential backoff
      return uploadImageToStorage(imageDataUrl, userId, threadId, retryCount + 1);
    }
    
    throw error;
  }
};

// Upload multiple images and return their URLs
export const uploadImagesToStorage = async (
  images: string[],
  userId: string,
  threadId?: string
): Promise<string[]> => {
  const uploadPromises = images.map(imageUrl => 
    uploadImageToStorage(imageUrl, userId, threadId)
  );
  
  return Promise.all(uploadPromises);
};

// Delete image from storage
export const deleteImageFromStorage = async (imageUrl: string): Promise<void> => {
  try {
    const imageRef = ref(storage, imageUrl);
    await deleteObject(imageRef);
  } catch (error) {
    console.error('Error deleting image from storage:', error);
    // Don't throw - deletion failures shouldn't break the app
  }
};

// Convert marked up images to storage URLs
export const uploadMarkedUpImagesToStorage = async (
  markedUpImages: Array<{
    id: string;
    pageNumber: number;
    url: string;
    json: any;
  }>,
  userId: string,
  threadId?: string
): Promise<Array<{
  id: string;
  pageNumber: number;
  url: string;
  json: any;
}>> => {
  const uploadedImages = [];
  
  for (const image of markedUpImages) {
    try {
      const storageUrl = await uploadImageToStorage(image.url, userId, threadId);
      uploadedImages.push({
        ...image,
        url: storageUrl
      });
    } catch (error) {
      console.error(`Error uploading marked up image ${image.id}:`, error);
      // Skip failed uploads
    }
  }
  
  return uploadedImages;
};