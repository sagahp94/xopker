import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, browserLocalPersistence, setPersistence } from 'firebase/auth';
import { getFirestore, enableIndexedDbPersistence, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  projectId: "quan-ly-bao-xop",
  appId: "1:1033397677052:web:d993826a54fc75c9086079",
  apiKey: "AIzaSyB-MgCTy-ggKEoY5Jvp-RsTDyrV6koF_R4",
  authDomain: "quan-ly-bao-xop.firebaseapp.com",
  storageBucket: "quan-ly-bao-xop.firebasestorage.app",
  messagingSenderId: "1033397677052",
};

export const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
setPersistence(auth, browserLocalPersistence).catch(console.error);

export const googleProvider = new GoogleAuthProvider();

export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({tabManager: persistentMultipleTabManager()})
}, "ai-studio-fd2d458d-e192-4e1a-b50c-331f914c7a7c");

export const storage = getStorage(app);
