import type { ProgressSnapshot } from './types';

export type FirebaseUser = {
  uid: string;
  displayName?: string | null;
  email?: string | null;
  photoURL?: string | null;
};

export type FirebaseSignInMethod = 'popup' | 'redirect' | 'native';

export type FirebaseSyncService = {
  onAuthStateChanged: (listener: (user: FirebaseUser | null) => void) => () => void;
  signIn: (method?: FirebaseSignInMethod) => Promise<FirebaseSignInMethod>;
  signOut: () => Promise<void>;
  getProgress: (userId: string) => Promise<unknown | null>;
  setProgress: (
    userId: string,
    progress: ProgressSnapshot & { updatedAt: number },
  ) => Promise<void>;
};
