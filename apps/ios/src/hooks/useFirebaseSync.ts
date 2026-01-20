import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  FirebaseSignInMethod,
  FirebaseSyncService,
  FirebaseUser,
  ProgressSnapshot,
} from '@dit/core';

type UseFirebaseSyncOptions = {
  firebaseService: FirebaseSyncService;
  progressSnapshot: ProgressSnapshot;
  progressSaveDebounceMs: number;
  onRemoteProgress: (raw: unknown) => void;
  trackEvent: (name: string, params?: Record<string, unknown>) => void;
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

export const useFirebaseSync = ({
  firebaseService,
  progressSnapshot,
  progressSaveDebounceMs,
  onRemoteProgress,
  trackEvent,
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
      const method = await firebaseService.signIn('native');
      trackEvent('sign_in', { method: getSignInMethodLabel(method) });
    } catch (error) {
      console.error('Failed to sign in', error);
    }
  }, [firebaseService, trackEvent]);

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
  }, [firebaseService, onRemoteProgress, user]);

  useEffect(() => {
    if (!user || !remoteLoaded) {
      return;
    }
    clearTimer(saveProgressTimeoutRef);
    saveProgressTimeoutRef.current = setTimeout(() => {
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
  }, [firebaseService, progressSaveDebounceMs, progressSnapshot, remoteLoaded, user]);

  return {
    authReady,
    handleSignIn,
    handleSignOut,
    remoteLoaded,
    user,
  };
};
