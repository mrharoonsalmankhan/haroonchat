// src/services/userService.js
import { ref, get, set, update, push, serverTimestamp } from 'firebase/database';
import { db } from '../config/firebase';

export async function getAllUsersExcept(uid) {
  const usersRef = ref(db, 'users');
  const snapshot = await get(usersRef);
  if (!snapshot.exists()) return [];
  const data = snapshot.val();
  return Object.entries(data)
    .filter(([id]) => id !== uid)
    .map(([id, user]) => ({ uid: id, ...user }));
}

export async function toggleStarMessage(uid, chatId, messageId, isCurrentlyStarred) {
  const starRef = ref(db, `users/${uid}/starredMessages/${chatId}_${messageId}`);
  await set(starRef, isCurrentlyStarred ? null : true);
}

export async function updateProfile(uid, updates) {
  await update(ref(db, `users/${uid}`), updates);
}

export async function updatePrivacySettings(uid, updates) {
  await update(ref(db, `users/${uid}/settings/privacy`), updates);
}

export async function updateNotificationSettings(uid, updates) {
  await update(ref(db, `users/${uid}/settings/notifications`), updates);
}

export async function blockUser(uid, blockedUid) {
  await set(ref(db, `users/${uid}/blockedUsers/${blockedUid}`), true);
}

export async function unblockUser(uid, blockedUid) {
  await set(ref(db, `users/${uid}/blockedUsers/${blockedUid}`), null);
}

export async function reportUser(reporterId, reportedUserId, reason) {
  const reportsRef = ref(db, 'reports');
  const newReportRef = push(reportsRef);
  await set(newReportRef, {
    reporterId,
    reportedUserId,
    reason: reason || '',
    createdAt: serverTimestamp(),
  });
}