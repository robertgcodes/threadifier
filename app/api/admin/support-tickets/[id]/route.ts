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

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const adminEmail = request.headers.get('X-Admin-Email');
    
    if (!adminEmail || !ADMIN_EMAILS.includes(adminEmail)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;
    const body = await request.json();
    const { status, response, assignedTo } = body;

    if (!id) {
      return NextResponse.json({ error: 'Ticket ID is required' }, { status: 400 });
    }

    // Update the support ticket
    const updateData: any = {
      updatedAt: new Date(),
    };

    if (status) updateData.status = status;
    if (response) updateData.response = response;
    if (assignedTo) updateData.assignedTo = assignedTo;

    await db.collection('supportTickets').doc(id).update(updateData);
    
    return NextResponse.json({ 
      success: true, 
      message: 'Support ticket updated successfully' 
    });
  } catch (error) {
    console.error('Error updating support ticket:', error);
    return NextResponse.json({ error: 'Failed to update support ticket' }, { status: 500 });
  }
} 