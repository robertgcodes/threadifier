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

// Admin email addresses that have access to support tickets
const ADMIN_EMAILS = [
  'robert@spotlightlawyer.com',
  // Add other admin emails here
];

interface SupportTicket {
  id?: string;
  userId: string;
  userEmail: string;
  subject: string;
  message: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  createdAt: any;
  updatedAt: any;
  assignedTo?: string;
  response?: string;
}

export async function GET(request: NextRequest) {
  try {
    const adminEmail = request.headers.get('X-Admin-Email');
    
    if (!adminEmail || !ADMIN_EMAILS.includes(adminEmail)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all support tickets from Firestore
    const ticketsSnapshot = await db.collection('supportTickets').get();
    const tickets: SupportTicket[] = ticketsSnapshot.docs.map((doc: any) => ({ 
      id: doc.id,
      ...doc.data() 
    }));

    // Sort tickets by creation date (newest first)
    tickets.sort((a, b) => {
      const aDate = a.createdAt?.toDate?.() || new Date(0);
      const bDate = b.createdAt?.toDate?.() || new Date(0);
      return bDate.getTime() - aDate.getTime();
    });

    return NextResponse.json({ tickets });
  } catch (error) {
    console.error('Error fetching support tickets:', error);
    return NextResponse.json({ error: 'Failed to fetch support tickets' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const adminEmail = request.headers.get('X-Admin-Email');
    
    if (!adminEmail || !ADMIN_EMAILS.includes(adminEmail)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { subject, message, priority } = body;

    if (!subject || !message) {
      return NextResponse.json({ error: 'Subject and message are required' }, { status: 400 });
    }

    // Create new support ticket
    const newTicket: Omit<SupportTicket, 'id'> = {
      userId: 'admin', // Admin-created ticket
      userEmail: adminEmail,
      subject,
      message,
      status: 'open',
      priority: priority || 'medium',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const docRef = await db.collection('supportTickets').add(newTicket);
    
    return NextResponse.json({ 
      success: true, 
      ticketId: docRef.id,
      message: 'Support ticket created successfully' 
    });
  } catch (error) {
    console.error('Error creating support ticket:', error);
    return NextResponse.json({ error: 'Failed to create support ticket' }, { status: 500 });
  }
} 