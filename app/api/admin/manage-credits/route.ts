import { NextRequest, NextResponse } from 'next/server';
import { doc, updateDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { firestore } from '../../../lib/firebase';
import { addCreditsWithExpiration, checkAndExpireCredits } from '../../../lib/database';

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

    // First check and expire any expired credits
    await checkAndExpireCredits(userId);

    // Get current user data
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
    
    if (action === 'add') {
      // Add credits with 90-day expiration
      await addCreditsWithExpiration(userId, amount, 'purchase', 90);
      newPremiumCredits = currentPremiumCredits + amount;
    } else if (action === 'subtract') {
      newPremiumCredits = Math.max(0, currentPremiumCredits - amount);
      
      // Update user document
      await updateDoc(userRef, {
        'credits.premiumCredits': newPremiumCredits,
        'credits.available': newPremiumCredits, // Keep for backward compatibility
        updatedAt: serverTimestamp(),
      });
    } else if (action === 'set') {
      newPremiumCredits = amount;
      
      // Update user document
      await updateDoc(userRef, {
        'credits.premiumCredits': newPremiumCredits,
        'credits.available': newPremiumCredits, // Keep for backward compatibility
        updatedAt: serverTimestamp(),
      });
    }

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