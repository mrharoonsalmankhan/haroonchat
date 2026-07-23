// src/services/userService.js
import { ref, get } from 'firebase/database';
import { db } from '../config/firebase';

/**
 * Fetches all users except the given uid. Fine at small/medium scale;
 * once the user base grows this gets replaced with a proper indexed
 * search (e.g. a denormalized /usernames index) rather than a full scan.
 */
export async function getAllUsersExcept(uid) {
  const usersRef = ref(db, 'users');
  const snapshot = await get(usersRef);
  if (!snapshot.exists()) return [];

  const data = snapshot.val();
  return Object.entries(data)
    .filter(([id]) => id !== uid)
    .map(([id, user]) => ({ uid: id, ...user }));
}