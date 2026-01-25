import { createFirebaseProgressService, type ProgressPayload, type ProgressSnapshot } from '@dit/core';
import type { User } from '@firebase/auth';
import { get, ref, set, type Database } from '@firebase/database';
import { useEffect, useMemo, useRef, useState } from 'react';

type UseFirebaseSyncOptions = {
  database: Database
  user: User | null
  progressSnapshot: ProgressSnapshot
  progressSaveDebounceMs: number
  onRemoteProgress: (raw: unknown) => void
}

type TimeoutHandle = ReturnType<typeof setTimeout>

const clearTimer = (ref: { current: TimeoutHandle | null }) => {
  if (ref.current !== null) {
    clearTimeout(ref.current);
    ref.current = null;
  }
};

/** Syncs signed-in progress with Firebase Realtime Database. */
export const useFirebaseSync = ({
  database,
  user,
  progressSnapshot,
  progressSaveDebounceMs,
  onRemoteProgress,
}: UseFirebaseSyncOptions) => {
  const [remoteLoaded, setRemoteLoaded] = useState(false);
  const saveTimeoutRef = useRef<TimeoutHandle | null>(null);

  const service = useMemo(() => {
    const adapter = {
      read: async (path: string) => {
        const snapshot = await get(ref(database, path));
        return snapshot.exists() ? snapshot.val() : null;
      },
      write: (path: string, payload: ProgressPayload) =>
        set(ref(database, path), payload),
    };
    return createFirebaseProgressService(adapter);
  }, [database]);

  useEffect(() => {
    setRemoteLoaded(false);
    if (!user) {
      return;
    }
    let isActive = true;
    service
      .load(user.uid)
      .then((data) => {
        if (!isActive || data === null || data === undefined) {
          return;
        }
        onRemoteProgress(data);
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
  }, [onRemoteProgress, service, user]);

  useEffect(() => {
    if (!user || !remoteLoaded) {
      return;
    }
    clearTimer(saveTimeoutRef);
    saveTimeoutRef.current = setTimeout(() => {
      void service.save(user.uid, progressSnapshot).catch((error) => {
        console.error('Failed to save progress', error);
      });
    }, progressSaveDebounceMs);

    return () => {
      clearTimer(saveTimeoutRef);
    };
  }, [progressSaveDebounceMs, progressSnapshot, remoteLoaded, service, user]);

  return { remoteLoaded };
};
