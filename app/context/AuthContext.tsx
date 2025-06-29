"use client";
import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { createUserProfile } from '../lib/database';
import { Loader2 } from 'lucide-react';

interface AuthContextType {
  user: User | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, loading: true });

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('AuthContext: Starting authentication check...');
    
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log('AuthContext: Auth state changed:', user ? 'User logged in' : 'No user');
      setUser(user);
      
      // Create user profile in Firestore if user just signed in
      if (user) {
        try {
          console.log('AuthContext: Creating user profile for:', user.uid);
          // Check for referral code in URL
          const urlParams = new URLSearchParams(window.location.search);
          const referralCode = urlParams.get('ref');
          
          await createUserProfile(user, referralCode || undefined);
          console.log('AuthContext: User profile created successfully');
          
          // Clear referral code from URL after processing
          if (referralCode) {
            urlParams.delete('ref');
            const newUrl = window.location.pathname + 
              (urlParams.toString() ? '?' + urlParams.toString() : '');
            window.history.replaceState({}, '', newUrl);
          }
        } catch (error) {
          console.error('AuthContext: Error creating user profile:', error);
        }
      }
      
      console.log('AuthContext: Setting loading to false');
      setLoading(false);
    }, (error) => {
      console.error('AuthContext: Firebase auth error:', error);
      setLoading(false);
    });

    // Set a timeout to stop loading after 3 seconds if Firebase doesn't respond
    const timeout = setTimeout(() => {
      console.log('AuthContext: Timeout reached, stopping loading');
      setLoading(false);
    }, 3000);

    return () => {
      console.log('AuthContext: Cleaning up auth listener');
      unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  if (loading) {
    console.log('AuthContext: Rendering loading spinner');
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="animate-spin h-12 w-12 text-primary-600" />
      </div>
    );
  }

  console.log('AuthContext: Rendering main app');
  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext); 