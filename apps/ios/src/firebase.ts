import { getAuth, getReactNativePersistence, initializeAuth, type Auth } from '@firebase/auth'
import { getApp, getApps, initializeApp } from '@firebase/app'
import { getDatabase } from '@firebase/database'
import AsyncStorage from '@react-native-async-storage/async-storage'

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.EXPO_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
}

let app
let auth: Auth

if (getApps().length === 0) {
  app = initializeApp(firebaseConfig)
} else {
  app = getApp()
}

try {
  // Attempt to initialize with persistence first
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  })
} catch {
  // If already initialized, get the existing instance
  // We check error code or message if possible, but usually any error here implies existing auth
  auth = getAuth(app)
}

export { auth }
export const database = getDatabase(app)
