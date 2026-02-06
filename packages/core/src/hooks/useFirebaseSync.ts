import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  FirebaseSignInMethod,
  FirebaseSyncService,
  FirebaseUser,
} from '../firebase';
import type { ProgressSnapshot } from '../types';

type UseFirebaseSyncOptions = {
  firebaseService: FirebaseSyncService;
  progressSnapshot: ProgressSnapshot;
  progressSaveDebounceMs: number;
  onRemoteProgress: (raw: unknown) => void;
  trackEvent: (name: string, params?: Record<string, unknown>) => void;
  signInMethod?: FirebaseSignInMethod;
  isOnline?: () => boolean;
};

const clearTimer = (ref: { current: ReturnType<typeof setTimeout> | null }) => {
  if (ref.current !== null) {
    clearTimeout(ref.current);
    ref.current = null;
  }
};

const getSignInMethodLabel = (method: FirebaseSignInMethod) => {
  switch (method) {
    case 'redirect':
      return 'google_redirect';
    case 'native':
      return 'google_native';
    default:
      return 'google_popup';
  }
};

/** Manages auth state and debounced progress sync for Firebase. */
export const useFirebaseSync = ({
  firebaseService,
  progressSnapshot,
  progressSaveDebounceMs,
  onRemoteProgress,
  trackEvent,
  signInMethod = 'popup',
  isOnline = () => true,
}: UseFirebaseSyncOptions) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [remoteLoaded, setRemoteLoaded] = useState(false);
  const saveProgressTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  useEffect(() => {
    const unsubscribe = firebaseService.onAuthStateChanged((nextUser) => {
      setUser(nextUser);
      setRemoteLoaded(false);
      setAuthReady(true);
    });
    return () => unsubscribe();
  }, [firebaseService]);

  const handleSignIn = useCallback(async () => {
    try {
      const method = await firebaseService.signIn(signInMethod);
      trackEvent('sign_in', { method: getSignInMethodLabel(method) });
    } catch (error) {
      console.error('Failed to sign in', error);
    }
  }, [firebaseService, signInMethod, trackEvent]);

  const handleSignOut = useCallback(async () => {
    try {
      await firebaseService.signOut();
      trackEvent('sign_out');
    } catch (error) {
      console.error('Failed to sign out', error);
    }
  }, [firebaseService, trackEvent]);

  useEffect(() => {
    if (!user) {
      return;
    }
    let isActive = true;
    firebaseService
      .getProgress(user.uid)
      .then((progress) => {
        if (!isActive) {
          return;
        }
        if (progress !== null) {
          onRemoteProgress(progress);
        }
      })
      .catch((error) => {
        if (!isOnline()) {
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
  }, [firebaseService, isOnline, onRemoteProgress, user]);

  useEffect(() => {
    if (!user || !remoteLoaded) {
      return;
    }
    clearTimer(saveProgressTimeoutRef);
    saveProgressTimeoutRef.current = setTimeout(() => {
      if (!isOnline()) {
        return;
      }
      void firebaseService
        .setProgress(user.uid, {
          ...progressSnapshot,
          updatedAt: Date.now(),
        })
        .catch((error) => {
          console.error('Failed to save progress', error);
        });
    }, progressSaveDebounceMs);
    return () => {
      clearTimer(saveProgressTimeoutRef);
    };
  }, [
    firebaseService,
    isOnline,
    progressSaveDebounceMs,
    progressSnapshot,
    remoteLoaded,
    user,
  ]);

  return {
    authReady,
    handleSignIn,
    handleSignOut,
    remoteLoaded,
    user,
  };
};
