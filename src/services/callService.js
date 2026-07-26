// src/services/callService.js
// Firebase is used ONLY as a signaling channel here — it never sees or
// relays actual audio/video. Once two peers exchange offer/answer/ICE
// candidates through this data, media flows directly between browsers.

import {
  ref,
  push,
  set,
  update,
  remove,
  get,
  onValue,
  onChildAdded,
  serverTimestamp,
} from 'firebase/database';
import { db } from '../config/firebase';

export function createCallId() {
  return push(ref(db, 'calls')).key;
}

export async function initiateCall(callId, { callerId, callerName, callerPhoto, calleeId, calleeName, calleePhoto, type }) {
  const now = serverTimestamp();
  await set(ref(db, `calls/${callId}`), {
    callerId,
    calleeId,
    callerName,
    calleeName,
    type, // 'voice' | 'video'
    status: 'ringing',
    startedAt: now,
  });
  await set(ref(db, `callInvites/${calleeId}/${callId}`), {
    callId,
    callerId,
    callerName,
    callerPhoto: callerPhoto || '',
    type,
    createdAt: now,
  });
}

/** Fires with the newest pending invite for this user, or null if none. */
export function subscribeToIncomingCalls(uid, callback) {
  return onValue(ref(db, `callInvites/${uid}`), (snap) => {
    if (!snap.exists()) {
      callback(null);
      return;
    }
    const invites = Object.values(snap.val()).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    callback(invites[0] || null);
  });
}

export function subscribeToCallStatus(callId, callback) {
  return onValue(ref(db, `calls/${callId}/status`), (snap) => callback(snap.val()));
}

export async function acceptCall(callId, calleeId) {
  await update(ref(db, `calls/${callId}`), { status: 'accepted', answeredAt: serverTimestamp() });
  await remove(ref(db, `callInvites/${calleeId}/${callId}`));
}

export async function rejectCall(callId, calleeId) {
  await update(ref(db, `calls/${callId}`), { status: 'rejected', endedAt: serverTimestamp() });
  await remove(ref(db, `callInvites/${calleeId}/${callId}`));
}

export async function markBusy(callId, calleeId) {
  await update(ref(db, `calls/${callId}`), { status: 'busy', endedAt: serverTimestamp() });
  await remove(ref(db, `callInvites/${calleeId}/${callId}`));
}

export async function markMissed(callId, calleeId) {
  await update(ref(db, `calls/${callId}`), { status: 'missed', endedAt: serverTimestamp() });
  await remove(ref(db, `callInvites/${calleeId}/${callId}`)).catch(() => {});
}

export async function cancelCall(callId, calleeId) {
  await update(ref(db, `calls/${callId}`), { status: 'cancelled', endedAt: serverTimestamp() });
  await remove(ref(db, `callInvites/${calleeId}/${callId}`)).catch(() => {});
}

export async function endCall(callId) {
  await update(ref(db, `calls/${callId}`), { status: 'ended', endedAt: serverTimestamp() }).catch(() => {});
}

export async function writeOffer(callId, offer) {
  await set(ref(db, `callSignaling/${callId}/offer`), { sdp: offer.sdp, type: offer.type });
}

export async function writeAnswer(callId, answer) {
  await set(ref(db, `callSignaling/${callId}/answer`), { sdp: answer.sdp, type: answer.type });
}

export async function getOffer(callId) {
  const snap = await get(ref(db, `callSignaling/${callId}/offer`));
  return snap.val();
}

export function subscribeToAnswer(callId, callback) {
  return onValue(ref(db, `callSignaling/${callId}/answer`), (snap) => callback(snap.val()));
}

export async function pushIceCandidate(callId, role, candidate) {
  await push(ref(db, `callSignaling/${callId}/${role}Candidates`), candidate.toJSON());
}

/** Fires once per NEW candidate as it arrives (not the whole list each time). */
export function subscribeToNewIceCandidates(callId, role, callback) {
  return onChildAdded(ref(db, `callSignaling/${callId}/${role}Candidates`), (snap) => callback(snap.val()));
}

export async function cleanupSignaling(callId) {
  await remove(ref(db, `callSignaling/${callId}`)).catch(() => {});
}

export async function logCallHistory({ callId, callerId, callerName, callerPhoto, calleeId, calleeName, calleePhoto, type, status, duration }) {
  const now = serverTimestamp();
  await update(ref(db), {
    [`userCalls/${callerId}/${callId}`]: {
      callId,
      otherUserId: calleeId,
      otherUserName: calleeName,
      otherUserPhoto: calleePhoto || '',
      type,
      status,
      duration: duration || 0,
      direction: 'outgoing',
      timestamp: now,
    },
    [`userCalls/${calleeId}/${callId}`]: {
      callId,
      otherUserId: callerId,
      otherUserName: callerName,
      otherUserPhoto: callerPhoto || '',
      type,
      status,
      duration: duration || 0,
      direction: 'incoming',
      timestamp: now,
    },
  });
}

export function subscribeToCallHistory(uid, callback) {
  return onValue(ref(db, `userCalls/${uid}`), (snap) => {
    if (!snap.exists()) {
      callback([]);
      return;
    }
    const list = Object.values(snap.val()).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    callback(list);
  });
}