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
  Timestamp,
  writeBatch 
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
    addCallToAction?: boolean;
    threadStyle?: string;
  };
  isDefault?: boolean;
  createdAt?: any;
  updatedAt?: any;
}

// Generate a unique referral code
const generateReferralCode = (uid: string): string => {
  // Take first 4 chars of uid and add random suffix
  const prefix = uid.substring(0, 4).toUpperCase();
  const suffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${suffix}`;
};

// User Profile Operations
// Create default prompts for new users
const createDefaultPrompts = async (userId: string): Promise<void> => {
  const defaultPrompts = [
    {
      name: "📚 Explainer Thread",
      instructions: `Break down complex topics into digestible, educational chunks. Each post should build upon the previous one, creating a learning journey.

Structure:
- Post 1: Hook with the big picture or surprising fact
- Posts 2-N: Break down key concepts, one per post
- Use analogies and real-world examples
- Define technical terms in simple language
- End with key takeaways or action items

Example: "Let me explain how [complex topic] actually works in simple terms... 🧵"

Tips:
- Use numbered lists for steps
- Include "why this matters" context
- Add helpful visuals or diagrams when possible`,
      settings: {
        charLimit: 280,
        numPosts: 8,
        useEmojis: true,
        useHashtags: false,
        useNumbering: true,
        addCallToAction: true,
        threadStyle: 'educational'
      }
    },
    {
      name: "🎯 Problem-Solution Thread",
      instructions: `Present a relatable problem and guide readers through a practical solution. Perfect for how-to content and addressing pain points.

Structure:
- Post 1: Identify the problem clearly (make it relatable)
- Posts 2-3: Explain why this problem exists/matters
- Posts 4-6: Present your solution step-by-step
- Post 7: Address common objections or pitfalls
- Final post: Summarize and call to action

Example: "Struggling with [problem]? Here's the exact system I used to [solution]... 🧵"

Tips:
- Use "you" language to connect with readers
- Include specific examples and metrics
- Anticipate reader questions`,
      settings: {
        charLimit: 280,
        numPosts: 8,
        useEmojis: true,
        useHashtags: false,
        useNumbering: true,
        addCallToAction: true,
        threadStyle: 'practical'
      }
    },
    {
      name: "📖 Storytelling Thread",
      instructions: `Transform content into a compelling narrative. Use story structure to make information memorable and engaging.

Structure:
- Post 1: Set the scene (time, place, stakes)
- Posts 2-3: Introduce the challenge/conflict
- Posts 4-5: Build tension, show attempts/failures
- Posts 6-7: The turning point or revelation
- Final posts: Resolution and lessons learned

Example: "In 2019, I made a decision that changed everything. Here's what happened... 🧵"

Tips:
- Use vivid, sensory details
- Create cliffhangers between posts
- Make it personal and vulnerable
- Extract universal lessons from specific stories`,
      settings: {
        charLimit: 280,
        numPosts: 10,
        useEmojis: true,
        useHashtags: false,
        useNumbering: false,
        addCallToAction: true,
        threadStyle: 'narrative'
      }
    },
    {
      name: "🔥 Contrarian Take",
      instructions: `Challenge conventional wisdom with well-reasoned arguments. Present an unpopular opinion backed by evidence.

Structure:
- Post 1: State the contrarian position boldly
- Post 2: Acknowledge the popular view
- Posts 3-5: Present evidence/reasoning for your position
- Posts 6-7: Address likely objections
- Final post: Nuanced conclusion

Example: "Unpopular opinion: [Contrarian view]. Here's why everyone's wrong about this... 🧵"

Tips:
- Back claims with data or credible sources
- Stay respectful, attack ideas not people
- Acknowledge where the mainstream view has merit
- End with nuance, not absolutism`,
      settings: {
        charLimit: 280,
        numPosts: 8,
        useEmojis: true,
        useHashtags: false,
        useNumbering: true,
        addCallToAction: true,
        threadStyle: 'argumentative'
      }
    },
    {
      name: "❓ Question Raiser",
      instructions: `Analyze content by raising thought-provoking questions. Perfect for stimulating discussion and critical thinking.

Structure:
- Post 1: Present the topic/claim being examined
- Posts 2-N: Each post raises a different critical question
- Consider multiple perspectives
- Challenge assumptions
- Final post: Invite readers to share their thoughts

Example: "Everyone's talking about [topic], but nobody's asking these crucial questions... 🧵"

Tips:
- Ask "what if" and "why" questions
- Question both obvious and hidden assumptions
- Include questions readers can answer
- Balance skepticism with genuine curiosity`,
      settings: {
        charLimit: 280,
        numPosts: 7,
        useEmojis: true,
        useHashtags: false,
        useNumbering: true,
        addCallToAction: true,
        threadStyle: 'analytical'
      }
    },
    {
      name: "💪 Advocate & Persuade",
      instructions: `Make a compelling case for a position, product, or idea. Use persuasion techniques ethically to win hearts and minds.

Structure:
- Post 1: State your position with confidence
- Posts 2-3: Establish credibility and common ground
- Posts 4-5: Present strongest arguments/benefits
- Post 6: Address concerns preemptively
- Post 7: Social proof or success stories
- Final post: Clear call to action

Example: "Here's why [position/product] is the best decision you'll make this year... 🧵"

Tips:
- Lead with benefits, not features
- Use social proof and authority
- Appeal to both logic and emotion
- Make the next step crystal clear`,
      settings: {
        charLimit: 280,
        numPosts: 8,
        useEmojis: true,
        useHashtags: false,
        useNumbering: true,
        addCallToAction: true,
        threadStyle: 'persuasive'
      }
    },
    {
      name: "🔍 Issue Spotter",
      instructions: `Identify, analyze, and propose solutions to problems within the content. Great for consultants and critical analysis.

Structure:
- Post 1: Overview of what you're analyzing
- Posts 2-4: Identify specific issues/problems
- Posts 5-6: Analyze root causes
- Posts 7-8: Propose concrete solutions
- Final post: Priority actions and next steps

Example: "I reviewed [document/situation] and found 5 critical issues that need immediate attention... 🧵"

Tips:
- Be specific about problems
- Separate symptoms from root causes
- Prioritize issues by impact
- Make solutions actionable`,
      settings: {
        charLimit: 280,
        numPosts: 9,
        useEmojis: true,
        useHashtags: false,
        useNumbering: true,
        addCallToAction: true,
        threadStyle: 'analytical'
      }
    },
    {
      name: "😄 Humor & Entertainment",
      instructions: `Transform content into entertaining, shareable posts using humor. Make learning fun and memorable.

Structure:
- Post 1: Setup with a relatable observation
- Posts 2-N: Build humor through:
  - Unexpected comparisons
  - Exaggeration for effect
  - Self-deprecating moments
  - Callbacks to earlier jokes
- Final post: Punchline or plot twist

Example: "My lawyer just explained [complex topic] to me like I'm 5, and honestly, I still don't get it... 🧵"

Tips:
- Know your audience's humor style
- Balance humor with actual value
- Use memes/GIFs when appropriate
- Don't force jokes - let them emerge naturally`,
      settings: {
        charLimit: 280,
        numPosts: 7,
        useEmojis: true,
        useHashtags: false,
        useNumbering: false,
        addCallToAction: true,
        threadStyle: 'casual'
      }
    },
    {
      name: "⚖️ IRAC Legal Analysis",
      instructions: `Structure legal analysis using Issue, Rule, Application, Conclusion format. Perfect for case analysis and legal education.

Structure:
- Post 1: Present the ISSUE clearly
- Posts 2-3: State the RULE (law, precedent, statute)
- Posts 4-6: APPLICATION - apply rule to facts
- Post 7: Address counterarguments
- Final post: CONCLUSION with implications

Example: "Let's break down [case name] using IRAC method. The issue is whether... 🧵"

Tips:
- Define legal terms for lay audience
- Cite relevant authorities
- Consider both sides
- Explain practical implications`,
      settings: {
        charLimit: 280,
        numPosts: 8,
        useEmojis: false,
        useHashtags: false,
        useNumbering: true,
        addCallToAction: false,
        threadStyle: 'professional'
      }
    },
    {
      name: "🤝 Feel-Felt-Found",
      instructions: `Use this empathy-based format to connect with readers facing similar challenges. Great for testimonials and trust-building.

Structure:
- Posts 1-2: "I understand how you FEEL..." (empathize)
- Posts 3-4: "Others have FELT the same..." (normalize)
- Posts 5-7: "What they FOUND was..." (solution)
- Final post: Invitation to experience same results

Example: "I know how frustrating [problem] can be. I felt the same way until... 🧵"

Tips:
- Be genuinely empathetic
- Include specific examples
- Share real stories (with permission)
- Focus on transformation`,
      settings: {
        charLimit: 280,
        numPosts: 8,
        useEmojis: true,
        useHashtags: false,
        useNumbering: false,
        addCallToAction: true,
        threadStyle: 'empathetic'
      }
    },
    {
      name: "🎓 Myth Buster",
      instructions: `Debunk common misconceptions with facts and evidence. Educational and attention-grabbing.

Structure:
- Post 1: State the myth boldly
- Post 2: Explain why people believe it
- Posts 3-5: Present contradicting evidence
- Post 6: Reveal the truth
- Post 7: Explain implications
- Final post: Other related myths to explore

Example: "MYTH: [Common belief]. The truth is actually shocking... 🧵"

Tips:
- Start with widely-held beliefs
- Use credible sources
- Be respectful of why myths persist
- Provide actionable truth`,
      settings: {
        charLimit: 280,
        numPosts: 8,
        useEmojis: true,
        useHashtags: false,
        useNumbering: true,
        addCallToAction: true,
        threadStyle: 'educational'
      }
    },
    {
      name: "📜 The Definitive Thread",
      instructions: `Create the ultimate, comprehensive thread that serves as the definitive resource on this topic. This thread should be so thorough that it becomes the go-to reference people bookmark and share.

Structure:
- Post 1: "This is the definitive thread explaining everything inside [topic]. I spent [time/effort] researching this so you don't have to... 🧵"
- Post 2: Start with the fundamental context - what is this and why does it matter NOW
- Posts 3-5: Historical background and evolution - how we got here
- Posts 6-10: Core concepts broken down - the essential knowledge
- Posts 11-15: Deep dive into key components/aspects
- Posts 16-18: Common misconceptions debunked with evidence
- Posts 19-21: Real-world applications and case studies
- Posts 22-24: Future implications and what to watch for
- Posts 25-26: Resources for further learning
- Final post: Summary and why this matters to YOU

Key Elements:
- Use primary sources and cite credible references
- Include surprising facts that challenge assumptions
- Break complex ideas into digestible chunks
- Use analogies to make abstract concepts concrete
- Address multiple perspectives fairly
- Anticipate and answer likely questions
- Create natural breaking points for easy sharing
- End each section with a mini-summary

Example opening: "This is the definitive thread explaining everything inside Web3 infrastructure. I analyzed 200+ protocols, interviewed 50+ builders, and distilled 1000+ hours of research into this thread... 🧵"

Tips:
- Be authoritative but not arrogant
- Acknowledge complexity while maintaining clarity
- Use numbered points for easy reference
- Include "If you only remember one thing..." moments
- Make it scannable with clear section headers
- Balance depth with accessibility`,
      settings: {
        charLimit: 280,
        numPosts: 26,
        useEmojis: true,
        useHashtags: false,
        useNumbering: true,
        addCallToAction: true,
        threadStyle: 'authoritative'
      }
    },
    {
      name: "📊 Data Storyteller",
      instructions: `Transform statistics and data into compelling narratives. Make numbers meaningful and memorable.

Structure:
- Post 1: Lead with surprising statistic
- Posts 2-3: Context for the data
- Posts 4-5: Break down what it means
- Post 6: Compare to relatable examples
- Post 7: Implications and trends
- Final post: What readers should do with this info

Example: "This one statistic changed how I think about [topic]: [surprising stat]... 🧵"

Tips:
- Use analogies for large numbers
- Include visuals when possible
- Focus on "so what?" factor
- Make data personally relevant`,
      settings: {
        charLimit: 280,
        numPosts: 8,
        useEmojis: true,
        useHashtags: false,
        useNumbering: true,
        addCallToAction: true,
        threadStyle: 'analytical'
      }
    }
  ];

  // Create all default prompts for the user
  const batch = writeBatch(firestore);
  
  for (const prompt of defaultPrompts) {
    const promptRef = doc(collection(firestore, 'customPrompts'));
    batch.set(promptRef, {
      ...prompt,
      userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      isDefault: true
    });
  }
  
  await batch.commit();
};

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
      
      // Create default prompts for new user
      try {
        await createDefaultPrompts(user.uid);
        console.log("Default prompts created");
      } catch (promptError) {
        console.error("Error creating default prompts:", promptError);
        // Don't throw - user creation should still succeed
      }
      
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
    
    // Initialize credits for existing users if missing
    if (!data.credits?.premiumCredits && data.credits?.premiumCredits !== 0) {
      const existingCredits = data.credits?.available || 0;
      await updateDoc(userRef, {
        'credits.premiumCredits': existingCredits,
        'credits.trialUsed': existingCredits < 100,
        updatedAt: serverTimestamp()
      });
      data.credits = {
        ...data.credits!,
        premiumCredits: existingCredits,
        trialUsed: existingCredits < 100
      };
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