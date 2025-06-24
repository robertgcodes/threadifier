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
    const currentPremiumCredits = userData.credits?.premiumCredits || 0;
    
    let newPremiumCredits = currentPremiumCredits;

    // Apply the action to premium credits
    switch (action) {
      case 'add':
        newPremiumCredits = currentPremiumCredits + amount;
        break;
      case 'subtract':
        newPremiumCredits = Math.max(0, currentPremiumCredits - amount);
        break;
      case 'set':
        newPremiumCredits = Math.max(0, amount);
        break;
      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }

    // Update user credits
    await updateDoc(userRef, {
      'credits.available': newPremiumCredits, // Keep for backward compatibility
      'credits.premiumCredits': newPremiumCredits,
      'credits.lifetime': action === 'add' 
        ? (userData.credits?.lifetime || 0) + amount 
        : userData.credits?.lifetime || 0,
      updatedAt: serverTimestamp(),
    });

    // Log admin action (you might want to create a separate collection for this)
    console.log(`Admin action by ${adminEmail}: ${action} ${amount} premium credits for user ${userId}. Reason: ${reason || 'No reason provided'}`);

    return NextResponse.json({
      success: true,
      previousCredits: {
        premium: currentPremiumCredits,
        hasUnlimitedBasic: currentPremiumCredits === 0,
      },
      newCredits: {
        premium: newPremiumCredits,
        hasUnlimitedBasic: newPremiumCredits === 0,
      },
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