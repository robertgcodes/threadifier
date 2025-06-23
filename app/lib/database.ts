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
  subscription?: {
    plan: 'free' | 'pro' | 'enterprise';
    status: 'active' | 'cancelled' | 'past_due';
    currentPeriodEnd?: Timestamp;
  };
  usage?: {
    threadsGenerated: number;
    monthlyThreads: number;
    lastResetDate: Timestamp;
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
  status: 'draft' | 'published';
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

// User Profile Operations
export const createUserProfile = async (user: any): Promise<void> => {
  console.log("=== CREATE USER PROFILE START ===");
  console.log("Creating profile for user:", user.uid);
  
  try {
    const userRef = doc(firestore, 'users', user.uid);
    console.log("User document reference created:", userRef);
    
    console.log("Checking if user document exists...");
    const userDoc = await getDoc(userRef);
    console.log("User document exists:", userDoc.exists());
    
    if (!userDoc.exists()) {
      console.log("Creating new user document...");
      const userData = {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
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
    return userDoc.data() as UserProfile;
  }
  return null;
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
export const incrementThreadUsage = async (userId: string): Promise<void> => {
  const userRef = doc(firestore, 'users', userId);
  const userDoc = await getDoc(userRef);
  
  if (userDoc.exists()) {
    const userData = userDoc.data() as UserProfile;
    const newUsage = {
      threadsGenerated: (userData.usage?.threadsGenerated || 0) + 1,
      monthlyThreads: (userData.usage?.monthlyThreads || 0) + 1,
      lastResetDate: userData.usage?.lastResetDate || serverTimestamp()
    };
    
    await updateDoc(userRef, {
      usage: newUsage,
      updatedAt: serverTimestamp()
    });
  }
};