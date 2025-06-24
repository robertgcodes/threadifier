import { NextRequest, NextResponse } from 'next/server';
import { doc, updateDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { firestore } from '../../../lib/firebase';

// List of admin email addresses - add yours here
const ADMIN_EMAILS = [
  'robert@spotlightlawyer.com',
  // Add other admin emails as needed
];

export async function POST(req: NextRequest) {
  try {
    // Get the admin email from request header (set by client)
    const adminEmail = req.headers.get('x-admin-email');
    
    // Check if user is admin
    if (!adminEmail || !ADMIN_EMAILS.includes(adminEmail)) {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      );
    }

    // Get request data
    const { userId, action, amount, reason } = await req.json();

    if (!userId || !action || typeof amount !== 'number') {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    // Get user document
    const userRef = doc(firestore, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const userData = userDoc.data();
    const currentCredits = userData.credits?.available || 0;
    let newCredits = currentCredits;

    switch (action) {
      case 'add':
        newCredits = currentCredits + amount;
        break;
      case 'subtract':
        newCredits = Math.max(0, currentCredits - amount);
        break;
      case 'set':
        newCredits = Math.max(0, amount);
        break;
      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }

    // Update user credits
    await updateDoc(userRef, {
      'credits.available': newCredits,
      'credits.lifetime': action === 'add' 
        ? (userData.credits?.lifetime || 0) + amount 
        : userData.credits?.lifetime || 0,
      updatedAt: serverTimestamp(),
    });

    // Log admin action (you might want to create a separate collection for this)
    console.log(`Admin action by ${adminEmail}: ${action} ${amount} credits for user ${userId}. Reason: ${reason || 'No reason provided'}`);

    return NextResponse.json({
      success: true,
      previousCredits: currentCredits,
      newCredits: newCredits,
      action: action,
      amount: amount,
      adminEmail: adminEmail,
    });

  } catch (error: any) {
    console.error('Admin manage credits error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}