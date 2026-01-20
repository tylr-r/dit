import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type Auth,
  type AuthProvider,
  type User,
} from 'firebase/auth';
import { get, ref, set, type Database } from 'firebase/database';
import { useCallback, useEffect, useRef, useState } from 'react';

type UseFirebaseSyncOptions = {
  auth: Auth;
  database: Database;
  googleProvider: AuthProvider;
  progressSnapshot: Record<string, unknown>;
  progressSaveDebounceMs: number;
  onRemoteProgress: (raw: unknown) => void;
  trackEvent: (name: string, params?: Record<string, unknown>) => void;
};

const clearTimer = (ref: { current: number | null }) => {
  if (ref.current !== null) {
    window.clearTimeout(ref.current);
    ref.current = null;
  }
};

export const useFirebaseSync = ({
  auth,
  database,
  googleProvider,
  progressSnapshot,
  progressSaveDebounceMs,
  onRemoteProgress,
  trackEvent,
}: UseFirebaseSyncOptions) => {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [remoteLoaded, setRemoteLoaded] = useState(false);
  const saveProgressTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setRemoteLoaded(false);
      setAuthReady(true);
    });
    return () => unsubscribe();
  }, [auth]);

  const handleSignIn = useCallback(async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      trackEvent('sign_in', { method: 'google_popup' });
    } catch (error) {
      const fallbackToRedirect =
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error.code === 'auth/popup-blocked' ||
          error.code === 'auth/operation-not-supported-in-this-environment');
      if (fallbackToRedirect) {
        trackEvent('sign_in', { method: 'google_redirect' });
        await signInWithRedirect(auth, googleProvider);
        return;
      }
      console.error('Failed to sign in', error);
    }
  }, [auth, googleProvider, trackEvent]);

  const handleSignOut = useCallback(async () => {
    try {
      await signOut(auth);
      trackEvent('sign_out');
    } catch (error) {
      console.error('Failed to sign out', error);
    }
  }, [auth, trackEvent]);

  useEffect(() => {
    if (!user) {
      return;
    }
    const progressRef = ref(database, `users/${user.uid}/progress`);
    let isActive = true;
    get(progressRef)
      .then((snapshot) => {
        if (!isActive) {
          return;
        }
        if (snapshot.exists()) {
          onRemoteProgress(snapshot.val());
        }
      })
      .catch((error) => {
        // Fail silently if offline - we'll use local data
        if (!navigator.onLine) {
          return;
        }
        console.error('Failed to load progress', error);
      })
      .finally(() => {
        if (isActive) {
          setRemoteLoaded(true);
        }
      });
    return () => {
      isActive = false;
    };
  }, [database, onRemoteProgress, user]);

  useEffect(() => {
    if (!user || !remoteLoaded) {
      return;
    }
    clearTimer(saveProgressTimeoutRef);
    saveProgressTimeoutRef.current = window.setTimeout(() => {
      // Skip save if offline - Firebase will queue it automatically when back online
      if (!navigator.onLine) {
        return;
      }

      const progressRef = ref(database, `users/${user.uid}/progress`);
      void set(progressRef, {
        ...progressSnapshot,
        updatedAt: Date.now(),
      }).catch((error) => {
        console.error('Failed to save progress', error);
      });
    }, progressSaveDebounceMs);
    return () => {
      clearTimer(saveProgressTimeoutRef);
    };
  }, [database, progressSaveDebounceMs, progressSnapshot, remoteLoaded, user]);

  return {
    authReady,
    handleSignIn,
    handleSignOut,
    remoteLoaded,
    user,
  };
};
