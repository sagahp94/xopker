import React, { createContext, useContext, useEffect, useState } from 'react';
import { User as FirebaseUser, signInWithPopup, signOut as firebaseSignOut } from 'firebase/auth';
import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { auth, db, googleProvider } from '../lib/firebase';
import { User, Role } from '../types';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
      try {
        if (firebaseUser) {
          const uid = firebaseUser.uid;
          const email = firebaseUser.email ? firebaseUser.email.trim().toLowerCase() : '';

          let uidDocRef = doc(db, 'users', uid);
          let uidDocSnap = await getDoc(uidDocRef);

          let userData: User | null = null;

          if (uidDocSnap.exists()) {
            userData = uidDocSnap.data() as User;
            
            // For existing user, check if we need to fill in missing photo or display name
            if (userData.isActive && (!userData.photoURL || !userData.displayName)) {
              const updatedData = {
                ...userData,
                displayName: userData.displayName || firebaseUser.displayName || '',
                photoURL: userData.photoURL || firebaseUser.photoURL || '',
              };
              await setDoc(uidDocRef, updatedData, { merge: true });
              userData = updatedData;
            }

            // Clean up leftover email-keyed document if present
            if (email && email !== uid) {
              const emailDocRef = doc(db, 'users', email);
              try {
                const emailDocSnap = await getDoc(emailDocRef);
                if (emailDocSnap.exists()) {
                  await deleteDoc(emailDocRef);
                }
              } catch (e) {
                console.error("Error deleting old email-keyed user document:", e);
              }
            }
          } else if (email) {
            // Check if there is an email-keyed document (pre-approved user)
            const emailDocRef = doc(db, 'users', email);
            const emailDocSnap = await getDoc(emailDocRef);

            if (emailDocSnap.exists()) {
              const emailData = emailDocSnap.data() as User;
              if (emailData.isActive) {
                // Migrate this user to be keyed by uid
                userData = {
                  ...emailData,
                  uid: uid,
                  displayName: firebaseUser.displayName || emailData.displayName || '',
                  photoURL: firebaseUser.photoURL || emailData.photoURL || '',
                };

                // Write the migrated user document keyed by uid
                await setDoc(uidDocRef, userData);

                // Delete the old email-keyed pre-approved document to avoid duplication
                try {
                  await deleteDoc(emailDocRef);
                } catch (e) {
                  console.error("Error deleting old pre-approved document:", e);
                }
              } else {
                userData = emailData; // Keep it so we trigger the locked check below
              }
            }
          }

          if (userData) {
            if (userData.isActive) {
              setUser(userData);
            } else {
              setUser(null);
              await firebaseSignOut(auth);
              alert("Tài khoản của bạn đã bị khóa. Vui lòng liên hệ Admin.");
            }
          } else {
            // Check if any users exist in the collection at all
            const { collection, getDocs, query, limit } = await import('firebase/firestore');
            const usersQuery = query(collection(db, 'users'), limit(1));
            const usersSnap = await getDocs(usersQuery);

            if (usersSnap.empty) {
              // First user becomes admin, keyed by uid
              const newUser: User = {
                uid: uid,
                email: email || '',
                displayName: firebaseUser.displayName || '',
                photoURL: firebaseUser.photoURL || '',
                role: 'Admin',
                isActive: true,
                createdAt: Date.now(),
              };
              await setDoc(uidDocRef, newUser);
              setUser(newUser);
            } else {
              setUser(null);
              await firebaseSignOut(auth);
              alert("Tài khoản của bạn chưa được cấp phép. Vui lòng liên hệ Admin.");
            }
          }
        } else {
          setUser(null);
        }
      } catch (error) {
        console.error('Error in auth state change:', error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const signIn = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error('Error signing in:', error);
      throw error;
    }
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
