#!/usr/bin/env node

/**
 * Migration script to update existing users to the new unlimited basic tier system
 * This script will:
 * 1. Remove freeCredits field from all users
 * 2. Keep premiumCredits as is
 * 3. Update available credits to match premiumCredits
 */

import { firestore } from '../app/lib/firebase';
import { collection, getDocs, updateDoc, doc } from 'firebase/firestore';

async function migrateCredits() {
  console.log('Starting credit migration...');
  
  try {
    const usersRef = collection(firestore, 'users');
    const querySnapshot = await getDocs(usersRef);
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const userDoc of querySnapshot.docs) {
      try {
        const userData = userDoc.data();
        const currentCredits = userData.credits?.available || 0;
        const usedCredits = userData.credits?.used || 0;
        
        // Determine if user has used their trial
        const trialUsed = usedCredits > 0;
        
        // Get current premium credits (if exists) or use available credits
        const premiumCredits = userData.credits?.premiumCredits ?? currentCredits;
        
        // Update credits to new system
        const updates = {
          'credits.premiumCredits': premiumCredits,
          'credits.available': premiumCredits, // Keep in sync
          'credits.trialUsed': trialUsed,
          'credits.freeCredits': null, // Remove this field
        };
        
        console.log(`Migrating user ${userDoc.id}: ${premiumCredits} premium credits (unlimited basic tier when 0)`);
        
        await updateDoc(doc(firestore, 'users', userDoc.id), updates);
        successCount++;
      } catch (error) {
        console.error(`Error migrating user ${userDoc.id}:`, error);
        errorCount++;
      }
    }
    
    console.log('Migration complete!');
    console.log(`Successfully migrated: ${successCount} users`);
    console.log(`Errors: ${errorCount} users`);
    
    process.exit(0);
  } catch (error) {
    console.error('Fatal error during migration:', error);
    process.exit(1);
  }
}

// Run the migration
migrateCredits();