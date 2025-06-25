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

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await getAuth().verifyIdToken(token);
    const userId = decodedToken.uid;

    const formData = await request.formData();
    const imageFile = formData.get('image') as File;
    const category = formData.get('category') as string || 'custom';

    if (!imageFile) {
      return NextResponse.json({ error: 'No image file provided' }, { status: 400 });
    }

    // Convert File to Buffer
    const bytes = await imageFile.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Generate unique filename
    const timestamp = Date.now();
    const filename = `${userId}/library/${timestamp}_${imageFile.name}`;

    // Upload to Firebase Storage
    const bucket = storage.bucket();
    const file = bucket.file(filename);
    
    await file.save(buffer, {
      metadata: {
        contentType: imageFile.type,
      },
    });

    // Make file publicly accessible
    await file.makePublic();

    // Get public URL
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${filename}`;

    // Save metadata to Firestore
    const imageData = {
      name: imageFile.name,
      url: publicUrl,
      size: imageFile.size,
      type: imageFile.type,
      category: category,
      tags: [],
      description: '',
      uploadedAt: new Date(),
    };

    const docRef = await db.collection('users').doc(userId).collection('images').add(imageData);

    return NextResponse.json({ 
      success: true, 
      imageId: docRef.id,
      image: { id: docRef.id, ...imageData }
    });
  } catch (error) {
    console.error('Error uploading image:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 