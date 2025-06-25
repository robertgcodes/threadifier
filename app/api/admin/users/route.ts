import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp, getApps, cert } from 'firebase-admin/app';

// Initialize Firebase Admin if not already initialized
if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const db = getFirestore();
const auth = getAuth();

// Admin email addresses that have access to user data
const ADMIN_EMAILS = [
  'robert@spotlightlawyer.com',
  // Add other admin emails here
];

interface UserData {
  uid: string;
  email: string;
  displayName?: string;
  createdAt: any;
  subscription?: {
    plan: string;
    status: string;
    currentPeriodEnd?: any;
  };
  usage?: {
    threadsGenerated: number;
    monthlyThreads: number;
    totalApiCost?: number;
  };
  credits?: {
    premiumCredits: number;
    lifetime: number;
    used: number;
  };
}

export async function GET(request: NextRequest) {
  try {
    const adminEmail = request.headers.get('X-Admin-Email');
    
    if (!adminEmail || !ADMIN_EMAILS.includes(adminEmail)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all users from Firestore
    const usersSnapshot = await db.collection('users').get();
    const users: UserData[] = usersSnapshot.docs.map((doc: any) => ({ 
      uid: doc.id, 
      ...doc.data() 
    }));

    // Sort users by creation date (newest first)
    users.sort((a, b) => {
      const aDate = a.createdAt?.toDate?.() || new Date(0);
      const bDate = b.createdAt?.toDate?.() || new Date(0);
      return bDate.getTime() - aDate.getTime();
    });

    return NextResponse.json({ users });
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
} 