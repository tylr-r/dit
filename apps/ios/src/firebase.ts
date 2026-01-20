import { useCallback, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import {
  GoogleAuthProvider,
  getAuth,
  onAuthStateChanged,
  signInWithCredential,
  signOut,
} from 'firebase/auth';
import { get, getDatabase, ref, set } from 'firebase/database';
import type { FirebaseSignInMethod, FirebaseSyncService } from '@dit/core';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';

WebBrowser.maybeCompleteAuthSession();

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? '',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? '',
  databaseURL: process.env.EXPO_PUBLIC_FIREBASE_DATABASE_URL ?? '',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? '',
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ?? '',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '',
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID ?? '',
};

const missingFirebaseKeys = Object.entries(firebaseConfig)
  .filter(([, value]) => !value)
  .map(([key]) => key);

if (__DEV__ && missingFirebaseKeys.length > 0) {
  console.warn(
    `Missing Expo Firebase env vars: ${missingFirebaseKeys.join(', ')}`,
  );
}

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const database = getDatabase(app);
const googleProvider = new GoogleAuthProvider();

type FirebaseServiceState = {
  firebaseService: FirebaseSyncService;
  isAuthRequestReady: boolean;
};

export const useFirebaseService = (): FirebaseServiceState => {
  const [request, promptAsync] = Google.useAuthRequest({
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    expoClientId: process.env.EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID,
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  });

  const signIn = useCallback(
    async (_method: FirebaseSignInMethod = 'native') => {
      if (!request) {
        throw new Error('Google auth request not ready.');
      }
      if (
        !process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID &&
        !process.env.EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID &&
        !process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID
      ) {
        throw new Error('Missing Google OAuth client IDs for Expo AuthSession.');
      }
      const result = await promptAsync({
        useProxy: Boolean(process.env.EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID),
      });
      if (result.type !== 'success' || !result.authentication?.idToken) {
        throw new Error('Google sign-in was cancelled or failed.');
      }
      const credential = GoogleAuthProvider.credential(
        result.authentication.idToken,
        result.authentication.accessToken ?? undefined,
      );
      await signInWithCredential(auth, credential);
      return 'native' as const;
    },
    [promptAsync, request],
  );

  const firebaseService = useMemo<FirebaseSyncService>(
    () => ({
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
      signIn,
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
    }),
    [signIn],
  );

  return {
    firebaseService,
    isAuthRequestReady: Boolean(request),
  };
};
