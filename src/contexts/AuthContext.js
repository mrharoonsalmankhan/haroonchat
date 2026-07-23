// src/contexts/AuthContext.js
// Owns: Google auth state, first-login profile bootstrap, and presence
// (online/lastSeen) via Realtime Database onDisconnect hooks.
//
// Every other part of the app reads the current user via useAuth() — nothing
// else should call firebase/auth directly.

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from 'react';
import {
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
} from 'firebase/auth';
import {
  ref,
  get,
  set,
  update,
  onValue,
  onDisconnect,
  serverTimestamp,
} from 'firebase/database';
import { auth, db, googleProvider } from '../config/firebase';

const AuthContext = createContext(undefined);

// Default shape for a brand-new user. Kept as a single source of truth so
// nothing downstream has to guess which fields exist on a fresh profile.
function buildNewUserProfile(firebaseUser) {
  return {
    uid: firebaseUser.uid,
    displayName: firebaseUser.displayName || 'New User',
    email: firebaseUser.email || '',
    photoURL: firebaseUser.photoURL || '',
    about: 'Hey there! I am using this app.',
    createdAt: serverTimestamp(),
    online: true,
    lastSeen: serverTimestamp(),
    settings: {
      theme: 'dark',
      notifications: {
        messagePreview: true,
        sound: true,
      },
      privacy: {
        lastSeenVisibleTo: 'everyone', // 'everyone' | 'contacts' | 'nobody'
        photoVisibleTo: 'everyone',
        aboutVisibleTo: 'everyone',
        readReceipts: true,
      },
    },
    blockedUsers: {},
    pinnedChats: {},
    archivedChats: {},
    starredMessages: {},
  };
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null); // Firebase Auth user object
  const [userProfile, setUserProfile] = useState(null); // Our RTDB /users/{uid} record
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  // Creates the profile on first login, or fetches the existing one.
  // Returns the profile object either way.
  const ensureUserProfile = useCallback(async (firebaseUser) => {
    const userRef = ref(db, `users/${firebaseUser.uid}`);
    const snapshot = await get(userRef);

    if (!snapshot.exists()) {
      const newProfile = buildNewUserProfile(firebaseUser);
      await set(userRef, newProfile);

      // Index by lowercase display name so user search is case-insensitive
      // without needing a separate cloud function.
      const usernameKey = firebaseUser.uid; // keyed by uid; search scans users list (see userService, added later)
      return { ...newProfile, uid: usernameKey };
    }

    // Returning user — refresh photo/name in case they changed it on Google's
    // side, but never overwrite fields the user customized in-app (about, settings).
    const existing = snapshot.val();
    const updates = {};
    if (firebaseUser.displayName && firebaseUser.displayName !== existing.displayName) {
      updates.displayName = firebaseUser.displayName;
    }
    if (firebaseUser.photoURL && firebaseUser.photoURL !== existing.photoURL) {
      updates.photoURL = firebaseUser.photoURL;
    }
    if (Object.keys(updates).length > 0) {
      await update(userRef, updates);
    }

    return { ...existing, ...updates, uid: firebaseUser.uid };
  }, []);

  // Sets up the onDisconnect hook so Firebase itself (server-side) flips the
  // user to offline the moment their connection drops — covers closed tabs,
  // crashed browsers, lost network, etc. This is the ONLY reliable way to do
  // presence with Realtime Database; a client-side "beforeunload" handler is
  // not enough because it never fires on network loss or crashes.
  const setupPresence = useCallback((uid) => {
    const userStatusRef = ref(db, `users/${uid}`);
    const connectedRef = ref(db, '.info/connected');

    // .info/connected fires every time this client's socket connects to
    // Firebase's servers (initial load, and again after any reconnect).
    // We re-arm onDisconnect on every reconnect, not just once at login,
    // so presence stays accurate through network blips, sleep/wake, etc.
    const unsubscribe = onValue(connectedRef, (snapshot) => {
      if (snapshot.val() === false) return;

      onDisconnect(userStatusRef)
        .update({ online: false, lastSeen: serverTimestamp() })
        .then(() => {
          // Only mark online AFTER the onDisconnect hook is registered, so
          // there's never a window where the user is "online" server-side
          // without a disconnect handler armed.
          update(userStatusRef, { online: true, lastSeen: serverTimestamp() });
        });
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setAuthError(null);
      if (firebaseUser) {
        try {
          const profile = await ensureUserProfile(firebaseUser);
          setUserProfile(profile);
          setCurrentUser(firebaseUser);
          await setupPresence(firebaseUser.uid);
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error('[AuthContext] Failed to initialize user session:', error);
          setAuthError('Failed to load your profile. Please try signing in again.');
          setCurrentUser(null);
          setUserProfile(null);
        }
      } else {
        setCurrentUser(null);
        setUserProfile(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, [ensureUserProfile, setupPresence]);

  // Keep userProfile in sync with live DB changes made elsewhere (e.g. Settings
  // page updates). We attach this listener only once we have a uid.
  useEffect(() => {
    if (!currentUser?.uid) return undefined;

    const userRef = ref(db, `users/${currentUser.uid}`);
    const unsubscribe = onValue(userRef, (snapshot) => {
      if (snapshot.exists()) {
        setUserProfile({ ...snapshot.val(), uid: currentUser.uid });
      }
    });

    return () => unsubscribe();
  }, [currentUser?.uid]);

  const signInWithGoogle = useCallback(async () => {
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
      // onAuthStateChanged above handles profile creation + navigation state.
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('[AuthContext] Google sign-in failed:', error);
      if (error.code === 'auth/popup-closed-by-user') {
        // User cancelled — not a real error, don't show a scary message.
        return;
      }
      setAuthError('Sign-in failed. Please try again.');
      throw error;
    }
  }, []);

  const signOut = useCallback(async () => {
    if (currentUser?.uid) {
      try {
        const userRef = ref(db, `users/${currentUser.uid}`);
        await update(userRef, { online: false, lastSeen: serverTimestamp() });
      } catch (error) {
        // Non-fatal — proceed with sign-out even if this write fails.
        // eslint-disable-next-line no-console
        console.error('[AuthContext] Failed to update presence on sign-out:', error);
      }
    }
    await firebaseSignOut(auth);
  }, [currentUser]);

  const value = {
    currentUser,
    userProfile,
    loading,
    authError,
    signInWithGoogle,
    signOut,
    isAuthenticated: !!currentUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;