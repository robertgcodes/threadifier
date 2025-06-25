import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { initializeApp, getApps, cert } from 'firebase-admin/app';

// Initialize Firebase Admin if not already initialized
if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  });
}

const db = getFirestore();
const storage = getStorage();

export async function DELETE(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await getAuth().verifyIdToken(token);
    const userId = decodedToken.uid;

    const { imageIds } = await request.json();

    if (!imageIds || !Array.isArray(imageIds)) {
      return NextResponse.json({ error: 'Invalid image IDs' }, { status: 400 });
    }

    const batch = db.batch();
    const storageDeletions = [];

    // Get all images to delete
    const imagesRef = db.collection('users').doc(userId).collection('images');
    const imageDocs = await Promise.all(
      imageIds.map(id => imagesRef.doc(id).get())
    );

    // Process each image
    for (let i = 0; i < imageDocs.length; i++) {
      const doc = imageDocs[i];
      if (doc.exists) {
        const imageData = doc.data();
        
        // Add to Firestore batch delete
        batch.delete(doc.ref);

        // Add to storage deletion queue
        if (imageData?.url) {
          try {
            const urlParts = imageData.url.split('/');
            const filename = urlParts.slice(-2).join('/');
            const file = storage.bucket().file(filename);
            storageDeletions.push(file.delete());
          } catch (storageError) {
            console.warn('Failed to queue storage deletion:', storageError);
          }
        }
      }
    }

    // Execute Firestore batch delete
    await batch.commit();

    // Execute storage deletions
    if (storageDeletions.length > 0) {
      await Promise.allSettled(storageDeletions);
    }

    return NextResponse.json({ 
      success: true, 
      deletedCount: imageIds.length 
    });
  } catch (error) {
    console.error('Error batch deleting images:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 