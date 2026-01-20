import { initializeApp } from 'firebase/app';
import {
  GoogleAuthProvider,
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut,
} from 'firebase/auth';
import { get, getDatabase, goOffline, goOnline, ref, set } from 'firebase/database';
import type { FirebaseSignInMethod, FirebaseSyncService } from '@dit/core';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const database = getDatabase(app);
const googleProvider = new GoogleAuthProvider();

const isPopupFallbackError = (error: unknown) =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  (error.code === 'auth/popup-blocked' ||
    error.code === 'auth/operation-not-supported-in-this-environment');

const signInWithPopupFlow = async () => {
  try {
    await signInWithPopup(auth, googleProvider);
    return 'popup' as const;
  } catch (error) {
    if (isPopupFallbackError(error)) {
      await signInWithRedirect(auth, googleProvider);
      return 'redirect' as const;
    }
    throw error;
  }
};

const signInWithRedirectFlow = async () => {
  await signInWithRedirect(auth, googleProvider);
  return 'redirect' as const;
};

export const firebaseService: FirebaseSyncService = {
  onAuthStateChanged: (listener) =>
    onAuthStateChanged(auth, (user) =>
      listener(
        user
          ? {
              uid: user.uid,
              displayName: user.displayName,
              email: user.email,
              photoURL: user.photoURL,
            }
          : null,
      ),
    ),
  signIn: (method: FirebaseSignInMethod = 'popup') => {
    if (method === 'redirect') {
      return signInWithRedirectFlow();
    }
    return signInWithPopupFlow();
  },
  signOut: () => signOut(auth),
  getProgress: async (userId: string) => {
    const progressRef = ref(database, `users/${userId}/progress`);
    const snapshot = await get(progressRef);
    return snapshot.exists() ? snapshot.val() : null;
  },
  setProgress: async (userId, progress) => {
    const progressRef = ref(database, `users/${userId}/progress`);
    await set(progressRef, progress);
  },
};

// Monitor connection status and sync with Firebase
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    goOnline(database);
  });

  window.addEventListener('offline', () => {
    goOffline(database);
  });

  // Set initial state
  if (!navigator.onLine) {
    goOffline(database);
  }
}
