import {
  createFirebaseProgressService,
  type ProgressPayload,
  type ProgressSnapshot,
} from '@dit/core';
import type { User } from '@firebase/auth';
import { get, ref, set, type Database } from '@firebase/database';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type UseFirebaseSyncOptions = {
  database: Database
  user: User | null
  progressSnapshot: ProgressSnapshot
  progressUpdatedAt: number | null
  progressSaveDebounceMs: number
  onRemoteProgress: (raw: unknown) => void
}

type TimeoutHandle = ReturnType<typeof setTimeout>

const RETRY_DELAY_MS = 30000

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
  progressUpdatedAt,
  progressSaveDebounceMs,
  onRemoteProgress,
}: UseFirebaseSyncOptions) => {
  const [remoteLoaded, setRemoteLoaded] = useState(false);
  const saveTimeoutRef = useRef<TimeoutHandle | null>(null);
  const retryTimeoutRef = useRef<TimeoutHandle | null>(null);
  const pendingSnapshotRef = useRef<ProgressSnapshot | null>(null);
  const pendingUpdatedAtRef = useRef<number | null>(null);
  const attemptSaveRef = useRef<
    ((snapshot: ProgressSnapshot, updatedAt?: number) => void) | null
  >(null);

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

  const scheduleRetry = useCallback(() => {
    if (retryTimeoutRef.current !== null) {
      return;
    }
    retryTimeoutRef.current = setTimeout(() => {
      retryTimeoutRef.current = null;
      const pendingSnapshot = pendingSnapshotRef.current;
      if (!pendingSnapshot || !attemptSaveRef.current) {
        return;
      }
      attemptSaveRef.current(
        pendingSnapshot,
        pendingUpdatedAtRef.current ?? undefined,
      );
    }, RETRY_DELAY_MS);
  }, []);

  useEffect(() => {
    setRemoteLoaded(false);
    pendingSnapshotRef.current = null;
    pendingUpdatedAtRef.current = null;
    clearTimer(retryTimeoutRef);
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
    attemptSaveRef.current = (snapshot, updatedAt) => {
      if (!user || !remoteLoaded) {
        pendingSnapshotRef.current = snapshot;
        pendingUpdatedAtRef.current = updatedAt ?? null;
        return;
      }
      void service
        .save(user.uid, snapshot, updatedAt)
        .then(() => {
          pendingSnapshotRef.current = null;
          pendingUpdatedAtRef.current = null;
        })
        .catch((error) => {
          console.error('Failed to save progress', error);
          pendingSnapshotRef.current = snapshot;
          pendingUpdatedAtRef.current = updatedAt ?? null;
          scheduleRetry();
        });
    };
  }, [remoteLoaded, scheduleRetry, service, user]);

  useEffect(() => {
    if (!user || !remoteLoaded) {
      return;
    }
    clearTimer(saveTimeoutRef);
    saveTimeoutRef.current = setTimeout(() => {
      attemptSaveRef.current?.(
        progressSnapshot,
        progressUpdatedAt ?? undefined,
      );
    }, progressSaveDebounceMs);

    return () => {
      clearTimer(saveTimeoutRef);
    };
  }, [
    progressSaveDebounceMs,
    progressSnapshot,
    progressUpdatedAt,
    remoteLoaded,
    user,
  ]);

  useEffect(() => {
    if (!user || !remoteLoaded) {
      return;
    }
    if (!pendingSnapshotRef.current || !attemptSaveRef.current) {
      return;
    }
    attemptSaveRef.current(
      pendingSnapshotRef.current,
      pendingUpdatedAtRef.current ?? undefined,
    );
  }, [remoteLoaded, user]);

  useEffect(() => {
    return () => {
      clearTimer(retryTimeoutRef);
    };
  }, []);

  const saveNow = useCallback(
    (snapshot: ProgressSnapshot, updatedAt?: number) => {
      attemptSaveRef.current?.(snapshot, updatedAt);
    },
    [],
  );

  return { remoteLoaded, saveNow };
};
