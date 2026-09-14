import React, { createContext, useContext, useEffect, useState } from 'react';
import { User as FirebaseUser, signInWithPopup, signOut as firebaseSignOut } from 'firebase/auth';
import { doc, getDoc, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { auth, db, googleProvider } from '../lib/firebase';
import { User, Role } from '../types';
import { useDemo } from './DemoContext';

interface AuthContextType {
  user: User | null;
  adminDisplayName: string;
  loading: boolean;
  signIn: () => Promise<void>;
  signInAsDemo: (role: 'Manager' | 'Staff') => void;
  signOut: () => Promise<void>;
  updateAdminDisplayName: (newName: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isDemoMode, enterDemoMode, exitDemoMode } = useDemo();
  const [user, setUser] = useState<User | null>(null);
  const [adminDisplayName, setAdminDisplayName] = useState<string>('Admin');
  const [loading, setLoading] = useState(true);

  // Listener for global settings to get adminDisplayName
  useEffect(() => {
    if (isDemoMode) return;
    const settingsRef = doc(db, 'settings', 'global');
    const unsubSettings = onSnapshot(settingsRef, (snap) => {
      if (snap.exists() && snap.data().adminDisplayName) {
        setAdminDisplayName(snap.data().adminDisplayName);
      }
    }, (err) => {
      console.warn("Global settings snapshot error:", err);
    });

    return () => unsubSettings();
  }, [isDemoMode]);

  useEffect(() => {
    if (isDemoMode) {
      setLoading(false);
      return;
    }

    let docUnsub: (() => void) | null = null;

    const authUnsub = auth.onAuthStateChanged(async (firebaseUser) => {
      if (docUnsub) {
        docUnsub();
        docUnsub = null;
      }

      try {
        if (firebaseUser) {
          const uid = firebaseUser.uid;
          const email = firebaseUser.email ? firebaseUser.email.trim().toLowerCase() : '';

          let uidDocRef = doc(db, 'users', uid);
          let userData: User | null = null;

          try {
            let uidDocSnap = await getDoc(uidDocRef);

            if (uidDocSnap.exists()) {
              userData = uidDocSnap.data() as User;
              
              // For existing user, check if we need to fill in missing photo or display name
              if (userData.isActive && (!userData.photoURL || !userData.displayName)) {
                const updatedData = {
                  ...userData,
                  displayName: userData.displayName || firebaseUser.displayName || '',
                  photoURL: userData.photoURL || firebaseUser.photoURL || '',
                };
                setDoc(uidDocRef, updatedData, { merge: true }).catch(() => {});
                userData = updatedData;
              }

              // Clean up leftover email-keyed document if present
              if (email && email !== uid && navigator.onLine) {
                const emailDocRef = doc(db, 'users', email);
                getDoc(emailDocRef)
                  .then(async (emailDocSnap) => {
                    if (emailDocSnap.exists()) {
                      await deleteDoc(emailDocRef);
                    }
                  })
                  .catch(() => {
                    // Silently ignore offline or non-existent document errors
                  });
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
                  deleteDoc(emailDocRef).catch(() => {});
                } else {
                  userData = emailData; // Keep it so we trigger the locked check below
                }
              }
            }
          } catch (fetchErr) {
            console.warn("AuthContext offline or fetch error, falling back to local firebaseUser:", fetchErr);
            userData = {
              uid: uid,
              email: email || '',
              displayName: firebaseUser.displayName || '',
              photoURL: firebaseUser.photoURL || '',
              role: 'Admin',
              isActive: true,
              createdAt: Date.now(),
            };
          }

          if (userData) {
            if (userData.isActive) {
              setUser(userData);
              // Setup real-time listener for user profile updates (e.g. displayName changes in User Settings)
              docUnsub = onSnapshot(uidDocRef, (snapshot) => {
                if (snapshot.exists()) {
                  const updated = snapshot.data() as User;
                  if (updated.isActive) {
                    setUser(updated);
                  }
                }
              }, (err) => {
                console.warn("User doc onSnapshot error:", err);
              });
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
              // Listen for changes on newly created user
              docUnsub = onSnapshot(uidDocRef, (snapshot) => {
                if (snapshot.exists()) {
                  const updated = snapshot.data() as User;
                  if (updated.isActive) {
                    setUser(updated);
                  }
                }
              });
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

    return () => {
      authUnsub();
      if (docUnsub) docUnsub();
    };
  }, [isDemoMode]);

  const signInAsDemo = (role: 'Manager' | 'Staff') => {
    enterDemoMode(role);
    const demoUserObj: User = {
      uid: role === 'Manager' ? 'demo-manager-uid' : 'demo-staff-uid',
      email: role === 'Manager' ? 'demomanager@xopker.com' : 'demostaff@xopker.com',
      displayName: role === 'Manager' ? 'Demo Quản Lý' : 'Demo Nhân Viên',
      photoURL: null,
      role: role,
      isActive: true,
      createdAt: Date.now(),
      isDemo: true,
    };
    setUser(demoUserObj);
  };

  const updateAdminDisplayName = async (newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    setAdminDisplayName(trimmed);
    if (isDemoMode) return;
    try {
      await setDoc(doc(db, 'settings', 'global'), { adminDisplayName: trimmed }, { merge: true });
      if (user?.uid && user.role === 'Admin') {
        await setDoc(doc(db, 'users', user.uid), { displayName: trimmed }, { merge: true });
      }
    } catch (e) {
      console.error("Failed updating admin display name:", e);
    }
  };

  const signIn = async () => {
    try {
      if (isDemoMode) {
        exitDemoMode();
      }
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error('Error signing in:', error);
      throw error;
    }
  };

  const signOut = async () => {
    if (user?.isDemo || isDemoMode) {
      exitDemoMode();
      setUser(null);
      return;
    }
    await firebaseSignOut(auth);
  };

  // Derived effective admin display name
  const effectiveAdminName = React.useMemo(() => {
    if (user?.role === 'Admin' && user?.displayName) {
      return user.displayName;
    }
    return adminDisplayName || user?.displayName || user?.email || 'Admin';
  }, [adminDisplayName, user]);

  return (
    <AuthContext.Provider value={{ user, adminDisplayName: effectiveAdminName, loading, signIn, signInAsDemo, signOut, updateAdminDisplayName }}>
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
