const { initializeApp } = require('firebase/app');
const { getFirestore, collection, query, where, getDocs, addDoc, doc, getDoc } = require('firebase/firestore');

// Your Firebase config
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

const piratePrompt = {
  name: "🏴‍☠️ Pirate Thread",
  instructions: `Transform any content into an engaging pirate-themed thread! Perfect for making serious topics fun and memorable.\n\nStructure:\n- Post 1: Hook with pirate language\n- Posts 2-4: Main content with pirate metaphors\n- Posts 5-6: Action items as treasure hunts\n- Final post: Call to action with pirate flair\n\nExample: \"Ahoy mateys! I've discovered a treasure map that'll lead ye to [topic]... 🏴‍☠️\"\n\nTips:\n- Use pirate vocabulary (ahoy, matey, treasure, etc.)\n- Turn problems into 'storms' or 'sea monsters'\n- Make solutions into 'treasure maps' or 'navigational tools'\n- Keep it fun but informative`,
  settings: {
    charLimit: 280,
    numPosts: 8,
    useEmojis: true,
    useHashtags: false,
    useNumbering: true,
    addCallToAction: true,
    tone: "pirate",
    style: "engaging"
  },
  isDefault: true,
  category: "fun"
};

async function addPiratePromptToExistingUsers() {
  try {
    console.log('Starting migration to add pirate prompt to existing users...');
    
    // Get all users
    const usersRef = collection(db, 'users');
    const usersSnapshot = await getDocs(usersRef);
    
    let addedCount = 0;
    let skippedCount = 0;
    
    for (const userDoc of usersSnapshot.docs) {
      const userId = userDoc.id;
      console.log(`Processing user: ${userId}`);
      
      // Check if user already has the pirate prompt
      const promptsRef = collection(db, 'users', userId, 'prompts');
      const piratePromptQuery = query(promptsRef, where('name', '==', '🏴‍☠️ Pirate Thread'));
      const existingPrompt = await getDocs(piratePromptQuery);
      
      if (existingPrompt.empty) {
        // Add the pirate prompt
        await addDoc(promptsRef, {
          ...piratePrompt,
          userId: userId,
          createdAt: new Date(),
          updatedAt: new Date()
        });
        console.log(`✅ Added pirate prompt to user: ${userId}`);
        addedCount++;
      } else {
        console.log(`⏭️  User ${userId} already has pirate prompt, skipping...`);
        skippedCount++;
      }
    }
    
    console.log(`\n🎉 Migration completed!`);
    console.log(`✅ Added pirate prompt to ${addedCount} users`);
    console.log(`⏭️  Skipped ${skippedCount} users (already had pirate prompt)`);
    
  } catch (error) {
    console.error('Error during migration:', error);
  }
}

// Run the migration
addPiratePromptToExistingUsers(); 