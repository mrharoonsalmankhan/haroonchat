// src/config/firebase.js
// Central Firebase initialization. Every other module (services, hooks, contexts)
// imports auth/db/googleProvider from here — never re-initializes the app.

import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  setPersistence,
  browserLocalPersistence,
} from 'firebase/auth';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.REACT_APP_FIREBASE_DATABASE_URL,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
};

// Fail loudly in dev if env vars are missing — this is the #1 cause of
// "works on my machine, breaks on Vercel" bugs with CRA env vars.
if (process.env.NODE_ENV === 'development') {
  const missing = Object.entries(firebaseConfig).filter(([, v]) => !v);
  if (missing.length > 0) {
    // eslint-disable-next-line no-console
    console.error(
      '[firebase.js] Missing environment variables:',
      missing.map(([k]) => k).join(', '),
      '\nMake sure you have a .env.local file at the project root (see .env.example).'
    );
  }
}

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getDatabase(app);
export const googleProvider = new GoogleAuthProvider();

// Always request account selection instead of silently reusing the last
// Google session — important for shared/public computers.
googleProvider.setCustomParameters({ prompt: 'select_account' });

// Persist auth across browser restarts (not just tab refreshes).
// We call this once at module load; AuthContext awaits app readiness
// via onAuthStateChanged regardless, so this is fire-and-forget.
setPersistence(auth, browserLocalPersistence).catch((error) => {
  // eslint-disable-next-line no-console
  console.error('[firebase.js] Failed to set auth persistence:', error);
});

export default app;