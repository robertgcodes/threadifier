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

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await getAuth().verifyIdToken(token);
    const userId = decodedToken.uid;

    const { email, role, permissions } = await request.json();

    if (!email || !role) {
      return NextResponse.json({ error: 'Email and role are required' }, { status: 400 });
    }

    // Check if user is already a team member
    const existingMember = await db.collection('users').doc(userId).collection('team').where('email', '==', email).get();
    
    if (!existingMember.empty) {
      return NextResponse.json({ error: 'User is already a team member' }, { status: 400 });
    }

    // Create invitation
    const invitationData = {
      email,
      role,
      permissions: permissions || [],
      status: 'pending',
      invitedBy: userId,
      invitedAt: new Date(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    };

    const invitationRef = await db.collection('users').doc(userId).collection('team').add(invitationData);

    // TODO: Send email invitation (implement email service)
    // For now, just return success
    console.log(`Invitation sent to ${email} for team ${userId}`);

    return NextResponse.json({ 
      success: true, 
      invitationId: invitationRef.id,
      invitation: { id: invitationRef.id, ...invitationData }
    });
  } catch (error) {
    console.error('Error creating team invitation:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 