#!/usr/bin/env node

/**
 * Migration script to update existing users to the new unlimited basic tier system
 * This script will:
 * 1. Remove freeCredits field from all users
 * 2. Keep premiumCredits as is
 * 3. Update available credits to match premiumCredits
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { Timestamp } from 'firebase/firestore';

// Firebase configuration
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

interface UserProfile {
  uid: string;
  credits?: {
    available: number;
    premiumCredits: number;
    creditExpirations?: Array<{
      amount: number;
      earnedAt: Timestamp;
      expiresAt: Timestamp;
      source: 'trial' | 'referral' | 'subscription' | 'purchase';
    }>;
  };
}

async function migrateCredits() {
  console.log('Starting credit migration...');
  
  try {
    const usersRef = collection(db, 'users');
    console.log('Getting users collection...');
    const snapshot = await getDocs(usersRef);
    console.log(`Found ${snapshot.docs.length} users to process`);
    
    let migratedCount = 0;
    let skippedCount = 0;
    
    for (const userDoc of snapshot.docs) {
      const userData = userDoc.data() as UserProfile;
      const userId = userDoc.id;
      
      console.log(`Processing user ${userId}...`);
      
      // Skip users who already have credit expirations
      if (userData.credits?.creditExpirations && userData.credits.creditExpirations.length > 0) {
        console.log(`Skipping user ${userId} - already has credit expirations`);
        skippedCount++;
        continue;
      }
      
      const premiumCredits = userData.credits?.premiumCredits || 0;
      console.log(`User ${userId} has ${premiumCredits} premium credits`);
      
      if (premiumCredits > 0) {
        console.log(`Migrating user ${userId} with ${premiumCredits} credits`);
        
        // Calculate expiration date (90 days from now)
        const now = new Date();
        const expiresAt = new Date(now.getTime() + (90 * 24 * 60 * 60 * 1000));
        
        // Create credit expiration entry
        const creditExpiration = {
          amount: premiumCredits,
          earnedAt: serverTimestamp() as Timestamp,
          expiresAt: Timestamp.fromDate(expiresAt),
          source: 'trial' as const, // Assume trial credits for existing users
        };
        
        // Update user document
        await updateDoc(doc(db, 'users', userId), {
          'credits.creditExpirations': [creditExpiration],
          updatedAt: serverTimestamp(),
        });
        
        migratedCount++;
        console.log(`Successfully migrated user ${userId}`);
      } else {
        console.log(`Skipping user ${userId} - no premium credits`);
        skippedCount++;
      }
    }
    
    console.log(`Migration completed!`);
    console.log(`Migrated: ${migratedCount} users`);
    console.log(`Skipped: ${skippedCount} users`);
    
  } catch (error) {
    console.error('Migration failed:', error);
  }
}

// Run migration if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  migrateCredits()
    .then(() => {
      console.log('Migration script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration script failed:', error);
      process.exit(1);
    });
}

export { migrateCredits };