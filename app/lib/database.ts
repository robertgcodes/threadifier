import { firestore } from './firebase';
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  serverTimestamp,
  Timestamp 
} from 'firebase/firestore';

// Types for database collections
export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  
  // Profile customization
  avatar?: string; // Custom avatar image
  username?: string; // Username
  xHandle?: string; // X/Twitter handle
  instagramHandle?: string; // Instagram handle
  darkMode?: boolean; // Dark mode preference
  globalAIInstructions?: string; // Global AI instructions
  customThreadStatuses?: string[]; // Custom thread statuses
  
  // Referral system
  referralCode?: string; // Unique code for this user
  referredBy?: string; // Who referred them
  referralCount?: number; // How many people they've referred
  
  // Credit system
  credits?: {
    available: number; // Current credits available (deprecated - use premiumCredits)
    lifetime: number; // Total credits ever received
    used: number; // Total credits used
    referralCredits: number; // Credits earned from referrals
    lastRefreshDate?: Timestamp; // Last time monthly credits were added
    // New credit types
    premiumCredits: number; // Premium credits (from trial, purchase, or subscription)
    trialUsed: boolean; // Whether the 100 trial credits have been used
  };
  
  // Settings
  settings?: {
    autoAppendReferral: boolean; // Auto-append referral message
    referralMessage?: string; // Custom referral message
  };
  
  subscription?: {
    plan: 'free' | 'professional' | 'team' | 'enterprise';
    status: 'active' | 'cancelled' | 'past_due' | 'trialing';
    currentPeriodEnd?: Timestamp;
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
    cancelAtPeriodEnd?: boolean;
  };
  
  usage?: {
    threadsGenerated: number;
    monthlyThreads: number;
    lastResetDate: Timestamp;
    totalApiCost?: number;
    monthlyApiCost?: number;
  };
}

export interface SavedThread {
  id?: string;
  userId: string;
  title: string;
  posts: Array<{
    id: number;
    text: string;
  }>;
  customInstructions?: string;
  settings: {
    charLimit: number;
    numPosts: number;
    useEmojis: boolean;
    useHashtags: boolean;
    useNumbering: boolean;
  };
  status: string; // Now supports custom statuses
  createdAt: Timestamp;
  updatedAt: Timestamp;
  publishedAt?: Timestamp;
  originalPdfName?: string;
  // Image association data
  postPageMap?: Record<number, {type: 'pdf' | 'marked', value: number | string}>;
  markedUpImages?: Array<{
    id: string;
    pageNumber: number;
    url: string;
    json: any;
  }>;
  pageImages?: string[];
}

export interface CustomPrompt {
  id?: string;
  userId: string;
  name: string;
  instructions: string;
  settings: {
    charLimit: number;
    numPosts: number;
    useEmojis: boolean;
    useHashtags: boolean;
    useNumbering: boolean;
  };
  isDefault: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Generate a unique referral code
const generateReferralCode = (uid: string): string => {
  // Take first 4 chars of uid and add random suffix
  const prefix = uid.substring(0, 4).toUpperCase();
  const suffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${suffix}`;
};

// User Profile Operations
export const createUserProfile = async (user: any, referralCode?: string): Promise<void> => {
  console.log("=== CREATE USER PROFILE START ===");
  console.log("Creating profile for user:", user.uid);
  console.log("Referral code:", referralCode);
  
  try {
    const userRef = doc(firestore, 'users', user.uid);
    console.log("User document reference created:", userRef);
    
    console.log("Checking if user document exists...");
    const userDoc = await getDoc(userRef);
    console.log("User document exists:", userDoc.exists());
    
    if (!userDoc.exists()) {
      console.log("Creating new user document...");
      
      // Generate unique referral code for this user
      const userReferralCode = generateReferralCode(user.uid);
      
      const userData = {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || user.email?.split('@')[0] || 'User',
        photoURL: user.photoURL,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        
        // Profile customization
        avatar: user.photoURL || null,
        username: user.email?.split('@')[0] || '',
        xHandle: user.email?.split('@')[0] || '',
        instagramHandle: user.email?.split('@')[0] || '',
        darkMode: false,
        globalAIInstructions: '',
        customThreadStatuses: ['Draft', 'Needs Review', 'Ready to Post', 'Posted'],
        
        // Referral system
        referralCode: userReferralCode,
        referredBy: referralCode || null,
        referralCount: 0,
        
        // Credit system - 100 premium trial credits on signup
        credits: {
          available: 100, // Keep for backward compatibility
          lifetime: 100,
          used: 0,
          referralCredits: 0,
          premiumCredits: 100, // 100 premium trial credits
          trialUsed: false,
        },
        
        // Settings
        settings: {
          autoAppendReferral: true, // Default on for free users
        },
        
        subscription: {
          plan: 'free',
          status: 'active'
        },
        
        usage: {
          threadsGenerated: 0,
          monthlyThreads: 0,
          lastResetDate: serverTimestamp()
        }
      };
      console.log("User data to save:", userData);
      
      await setDoc(userRef, userData);
      console.log("User profile created successfully");
      
      // If referred by someone, credit the referrer
      if (referralCode) {
        await creditReferrer(referralCode);
      }
    } else {
      console.log("User profile already exists, skipping creation");
    }
    console.log("=== CREATE USER PROFILE SUCCESS ===");
  } catch (error) {
    console.error("=== CREATE USER PROFILE ERROR ===");
    console.error("Error details:", error);
    throw error;
  }
};

export const getUserProfile = async (uid: string): Promise<UserProfile | null> => {
  const userRef = doc(firestore, 'users', uid);
  const userDoc = await getDoc(userRef);
  
  if (userDoc.exists()) {
    const data = userDoc.data() as UserProfile;
    
    // Generate referral code if missing (for existing users)
    if (!data.referralCode) {
      const newReferralCode = generateReferralCode(uid);
      await updateDoc(userRef, {
        referralCode: newReferralCode,
        updatedAt: serverTimestamp()
      });
      data.referralCode = newReferralCode;
    }
    
    return data;
  }
  return null;
};

export const updateUserProfile = async (uid: string, updates: Partial<UserProfile>): Promise<void> => {
  const userRef = doc(firestore, 'users', uid);
  
  // Remove fields that shouldn't be updated directly
  const { uid: _, email: __, createdAt: ___, ...safeUpdates } = updates;
  
  await updateDoc(userRef, {
    ...safeUpdates,
    updatedAt: serverTimestamp()
  });
};

// Thread Operations
export const saveThread = async (thread: Omit<SavedThread, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  console.log("=== SAVE THREAD DATABASE FUNCTION START ===");
  console.log("Input thread data:", thread);
  
  try {
    console.log("Getting firestore collection reference...");
    const threadsRef = collection(firestore, 'threads');
    console.log("Collection reference created:", threadsRef);
    
    const threadData = {
      ...thread,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    console.log("Thread data to save:", threadData);
    
    console.log("Calling addDoc...");
    const docRef = await addDoc(threadsRef, threadData);
    console.log("Document saved successfully with ID:", docRef.id);
    
    console.log("=== SAVE THREAD DATABASE FUNCTION SUCCESS ===");
    return docRef.id;
  } catch (error) {
    console.error("=== SAVE THREAD DATABASE FUNCTION ERROR ===");
    console.error("Error details:", error);
    throw error;
  }
};

export const updateThread = async (threadId: string, updates: Partial<SavedThread>): Promise<void> => {
  const threadRef = doc(firestore, 'threads', threadId);
  await updateDoc(threadRef, {
    ...updates,
    updatedAt: serverTimestamp()
  });
};

export const getUserThreads = async (userId: string): Promise<SavedThread[]> => {
  console.log("=== GET USER THREADS START ===");
  console.log("Getting threads for userId:", userId);
  
  try {
    const threadsRef = collection(firestore, 'threads');
    console.log("Collection reference created:", threadsRef);
    
    // Try simple query first without orderBy to avoid index requirements
    const q = query(
      threadsRef, 
      where('userId', '==', userId)
    );
    console.log("Query created:", q);
    
    console.log("Executing getDocs...");
    const querySnapshot = await getDocs(q);
    console.log("Query executed successfully, docs count:", querySnapshot.docs.length);
    
    const threads = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as SavedThread));
    
    // Sort by updatedAt in JavaScript to avoid index requirements
    threads.sort((a, b) => {
      const timeA = a.updatedAt?.toDate ? a.updatedAt.toDate().getTime() : 0;
      const timeB = b.updatedAt?.toDate ? b.updatedAt.toDate().getTime() : 0;
      return timeB - timeA; // Descending order (newest first)
    });
    
    console.log("Threads mapped and sorted:", threads);
    console.log("=== GET USER THREADS SUCCESS ===");
    return threads;
  } catch (error) {
    console.error("=== GET USER THREADS ERROR ===");
    console.error("Error details:", error);
    throw error;
  }
};

export const deleteThread = async (threadId: string): Promise<void> => {
  const threadRef = doc(firestore, 'threads', threadId);
  await deleteDoc(threadRef);
};

// Custom Prompt Operations
export const saveCustomPrompt = async (prompt: Omit<CustomPrompt, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  const promptsRef = collection(firestore, 'customPrompts');
  const docRef = await addDoc(promptsRef, {
    ...prompt,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  return docRef.id;
};

export const getUserCustomPrompts = async (userId: string): Promise<CustomPrompt[]> => {
  console.log("=== GET USER CUSTOM PROMPTS START ===");
  console.log("Getting custom prompts for userId:", userId);
  
  try {
    const promptsRef = collection(firestore, 'customPrompts');
    console.log("Collection reference created:", promptsRef);
    
    // Use simple query without orderBy to avoid index requirements
    const q = query(
      promptsRef,
      where('userId', '==', userId)
    );
    console.log("Query created:", q);
    
    console.log("Executing getDocs...");
    const querySnapshot = await getDocs(q);
    console.log("Query executed successfully, docs count:", querySnapshot.docs.length);
    
    const prompts = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as CustomPrompt));
    
    // Sort by updatedAt in JavaScript to avoid index requirements
    prompts.sort((a, b) => {
      const timeA = a.updatedAt?.toDate ? a.updatedAt.toDate().getTime() : 0;
      const timeB = b.updatedAt?.toDate ? b.updatedAt.toDate().getTime() : 0;
      return timeB - timeA; // Descending order (newest first)
    });
    
    console.log("Custom prompts mapped and sorted:", prompts);
    console.log("=== GET USER CUSTOM PROMPTS SUCCESS ===");
    return prompts;
  } catch (error) {
    console.error("=== GET USER CUSTOM PROMPTS ERROR ===");
    console.error("Error details:", error);
    throw error;
  }
};

export const updateCustomPrompt = async (promptId: string, updates: Partial<CustomPrompt>): Promise<void> => {
  const promptRef = doc(firestore, 'customPrompts', promptId);
  await updateDoc(promptRef, {
    ...updates,
    updatedAt: serverTimestamp()
  });
};

export const deleteCustomPrompt = async (promptId: string): Promise<void> => {
  const promptRef = doc(firestore, 'customPrompts', promptId);
  await deleteDoc(promptRef);
};

// Usage tracking
export const incrementThreadUsage = async (
  userId: string, 
  apiCost: number = 0
): Promise<void> => {
  const userRef = doc(firestore, 'users', userId);
  const userDoc = await getDoc(userRef);
  
  if (userDoc.exists()) {
    const userData = userDoc.data() as UserProfile;
    
    // Check if we need to reset monthly counters
    const lastReset = userData.usage?.lastResetDate?.toDate();
    const now = new Date();
    const shouldReset = !lastReset || 
      (lastReset.getMonth() !== now.getMonth() || 
       lastReset.getFullYear() !== now.getFullYear());
    
    const newUsage = {
      threadsGenerated: (userData.usage?.threadsGenerated || 0) + 1,
      monthlyThreads: shouldReset ? 1 : (userData.usage?.monthlyThreads || 0) + 1,
      lastResetDate: shouldReset ? serverTimestamp() : userData.usage?.lastResetDate,
      totalApiCost: (userData.usage?.totalApiCost || 0) + apiCost,
      monthlyApiCost: shouldReset ? apiCost : (userData.usage?.monthlyApiCost || 0) + apiCost,
    };
    
    await updateDoc(userRef, {
      usage: newUsage,
      updatedAt: serverTimestamp()
    });
  }
};

// Get user's current usage for the month
export const getUserMonthlyUsage = async (userId: string): Promise<{
  threadsUsed: number;
  apiCostUsed: number;
}> => {
  const userRef = doc(firestore, 'users', userId);
  const userDoc = await getDoc(userRef);
  
  if (userDoc.exists()) {
    const userData = userDoc.data() as UserProfile;
    
    // Check if we need to reset monthly counters
    const lastReset = userData.usage?.lastResetDate?.toDate();
    const now = new Date();
    const shouldReset = !lastReset || 
      (lastReset.getMonth() !== now.getMonth() || 
       lastReset.getFullYear() !== now.getFullYear());
    
    if (shouldReset) {
      // Reset monthly counters
      await updateDoc(userRef, {
        'usage.monthlyThreads': 0,
        'usage.monthlyApiCost': 0,
        'usage.lastResetDate': serverTimestamp(),
      });
      
      return { threadsUsed: 0, apiCostUsed: 0 };
    }
    
    return {
      threadsUsed: userData.usage?.monthlyThreads || 0,
      apiCostUsed: userData.usage?.monthlyApiCost || 0,
    };
  }
  
  return { threadsUsed: 0, apiCostUsed: 0 };
};

// Credit system functions
export const creditReferrer = async (referralCode: string): Promise<void> => {
  try {
    // Find user with this referral code
    const usersRef = collection(firestore, 'users');
    const q = query(usersRef, where('referralCode', '==', referralCode));
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      const referrerDoc = querySnapshot.docs[0];
      const referrerId = referrerDoc.id;
      
      // Add 100 credits to referrer
      const referrerData = referrerDoc.data();
      const referrerHasTrialCredits = (referrerData.credits?.premiumCredits || 0) > 0 || referrerData.subscription?.plan !== 'free';
      
      // Always give premium credits for referrals
      await updateDoc(doc(firestore, 'users', referrerId), {
        'credits.available': (referrerData.credits?.available || 0) + 100,
        'credits.premiumCredits': (referrerData.credits?.premiumCredits || 0) + 100,
        'credits.lifetime': (referrerData.credits?.lifetime || 0) + 100,
        'credits.referralCredits': (referrerData.credits?.referralCredits || 0) + 100,
        'referralCount': (referrerData.referralCount || 0) + 1,
        updatedAt: serverTimestamp(),
      });
      
      console.log(`Credited 100 premium threads to referrer: ${referrerId}`);
    }
  } catch (error) {
    console.error('Error crediting referrer:', error);
  }
};

export const useCredits = async (userId: string, amount: number = 1): Promise<{ success: boolean; creditType: 'premium' | 'basic' }> => {
  const userRef = doc(firestore, 'users', userId);
  const userDoc = await getDoc(userRef);
  
  if (!userDoc.exists()) return { success: false, creditType: 'basic' };
  
  const userData = userDoc.data() as UserProfile;
  const premiumCredits = userData.credits?.premiumCredits || 0;
  
  // Determine credit type based on premium credits availability
  let creditType: 'premium' | 'basic' = premiumCredits > 0 ? 'premium' : 'basic';
  let newPremiumCredits = premiumCredits;
  
  if (creditType === 'premium') {
    // Deduct from premium credits
    newPremiumCredits = Math.max(0, premiumCredits - amount);
  }
  // For basic tier, we don't deduct anything - it's unlimited
  
  // Check if trial credits are depleted
  const trialUsed = userData.credits?.trialUsed || false;
  const shouldMarkTrialUsed = !trialUsed && userData.subscription?.plan === 'free' && newPremiumCredits < 100;
  
  // Update credits
  await updateDoc(userRef, {
    'credits.available': newPremiumCredits, // Keep for backward compatibility
    'credits.premiumCredits': newPremiumCredits,
    'credits.used': (userData.credits?.used || 0) + amount,
    'credits.trialUsed': shouldMarkTrialUsed || trialUsed,
    updatedAt: serverTimestamp(),
  });
  
  return { success: true, creditType };
};

export const checkCredits = async (userId: string): Promise<{ hasUnlimitedBasic: boolean; premium: number; trialUsed: boolean }> => {
  const userDoc = await getUserProfile(userId);
  const premiumCredits = userDoc?.credits?.premiumCredits || 0;
  const trialUsed = userDoc?.credits?.trialUsed || false;
  
  return {
    hasUnlimitedBasic: premiumCredits === 0, // When no premium credits, user has unlimited basic
    premium: premiumCredits,
    trialUsed
  };
};

export const addCredits = async (userId: string, amount: number, source: 'purchase' | 'referral' | 'bonus' | 'subscription' = 'bonus'): Promise<void> => {
  const userRef = doc(firestore, 'users', userId);
  const userDoc = await getDoc(userRef);
  
  if (userDoc.exists()) {
    const userData = userDoc.data() as UserProfile;
    
    const updates: any = {
      'credits.available': (userData.credits?.available || 0) + amount,
      'credits.lifetime': (userData.credits?.lifetime || 0) + amount,
      updatedAt: serverTimestamp(),
    };
    
    // Always add as premium credits regardless of source
    updates['credits.premiumCredits'] = (userData.credits?.premiumCredits || 0) + amount;
    
    if (source === 'referral') {
      updates['credits.referralCredits'] = (userData.credits?.referralCredits || 0) + amount;
    }
    
    await updateDoc(userRef, updates);
  }
};

// Get user by referral code
export const getUserByReferralCode = async (referralCode: string): Promise<UserProfile | null> => {
  const usersRef = collection(firestore, 'users');
  const q = query(usersRef, where('referralCode', '==', referralCode));
  const querySnapshot = await getDocs(q);
  
  if (!querySnapshot.empty) {
    return querySnapshot.docs[0].data() as UserProfile;
  }
  
  return null;
};

// Handle monthly credit refresh for paid plans
export const refreshMonthlyCredits = async (userId: string): Promise<void> => {
  const userRef = doc(firestore, 'users', userId);
  const userDoc = await getDoc(userRef);
  
  if (!userDoc.exists()) return;
  
  const userData = userDoc.data() as UserProfile;
  const plan = userData.subscription?.plan;
  
  if (!plan || plan === 'free') return;
  
  // Check if it's time to refresh (first of the month or subscription renewal)
  const now = new Date();
  const lastRefresh = userData.credits?.lastRefreshDate?.toDate();
  
  if (lastRefresh && 
      lastRefresh.getMonth() === now.getMonth() && 
      lastRefresh.getFullYear() === now.getFullYear()) {
    return; // Already refreshed this month
  }
  
  let monthlyCredits = 0;
  let maxRollover = 0;
  
  switch (plan) {
    case 'professional':
      monthlyCredits = 500;
      maxRollover = 1000;
      break;
    case 'team':
      monthlyCredits = 2000;
      maxRollover = 5000;
      break;
    case 'enterprise':
      monthlyCredits = 10000;
      maxRollover = 20000;
      break;
  }
  
  const currentPremiumCredits = userData.credits?.premiumCredits || 0;
  const newPremiumCredits = Math.min(currentPremiumCredits + monthlyCredits, maxRollover);
  
  await updateDoc(userRef, {
    'credits.available': newPremiumCredits, // Keep for backward compatibility
    'credits.premiumCredits': newPremiumCredits,
    'credits.lastRefreshDate': serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  
  console.log(`Refreshed premium credits for user ${userId}: ${currentPremiumCredits} -> ${newPremiumCredits}`);
};