// src/services/chatService.js
// All Realtime Database read/write logic for chats and messages lives here.
// Components/hooks never touch `ref()`/`onValue()` directly for chat data —
// they call these functions instead, so the DB schema can change in one place.

import {
  ref,
  push,
  set,
  update,
  get,
  onValue,
  query,
  orderByChild,
  limitToLast,
  serverTimestamp,
} from 'firebase/database';
import { db } from '../config/firebase';

// Deterministic chat ID for 1-on-1 chats: sorted UIDs joined with an
// underscore. This means two users can never accidentally create two
// separate chat threads with each other.
function buildPrivateChatId(uidA, uidB) {
  return [uidA, uidB].sort().join('_');
}

/**
 * Finds an existing private chat between two users, or creates one.
 * Returns the chatId.
 */
export async function getOrCreatePrivateChat(currentUser, otherUser) {
  const chatId = buildPrivateChatId(currentUser.uid, otherUser.uid);
  const chatRef = ref(db, `chats/${chatId}`);
  const snapshot = await get(chatRef);

  if (!snapshot.exists()) {
    const now = serverTimestamp();
    await set(chatRef, {
      type: 'private',
      participants: {
        [currentUser.uid]: true,
        [otherUser.uid]: true,
      },
      createdAt: now,
      lastMessage: null,
    });

    // Each participant gets their own /userChats entry so the chat list
    // query is a single flat read per user, no joins needed.
    await update(ref(db), {
      [`userChats/${currentUser.uid}/${chatId}`]: {
        chatId,
        type: 'private',
        otherUserId: otherUser.uid,
        otherUserName: otherUser.displayName,
        otherUserPhoto: otherUser.photoURL || '',
        lastMessage: '',
        lastMessageTime: now,
        unreadCount: 0,
        pinned: false,
        archived: false,
        muted: false,
      },
      [`userChats/${otherUser.uid}/${chatId}`]: {
        chatId,
        type: 'private',
        otherUserId: currentUser.uid,
        otherUserName: currentUser.displayName,
        otherUserPhoto: currentUser.photoURL || '',
        lastMessage: '',
        lastMessageTime: now,
        unreadCount: 0,
        pinned: false,
        archived: false,
        muted: false,
      },
    });
  }

  return chatId;
}

/**
 * Subscribes to the current user's chat list (/userChats/{uid}).
 * Returns an unsubscribe function.
 */
export function subscribeToUserChats(uid, callback) {
  const userChatsRef = ref(db, `userChats/${uid}`);
  const unsubscribe = onValue(userChatsRef, (snapshot) => {
    if (!snapshot.exists()) {
      callback([]);
      return;
    }
    const data = snapshot.val();
    const chats = Object.values(data).sort((a, b) => {
      // Pinned chats first, then most-recent activity.
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return (b.lastMessageTime || 0) - (a.lastMessageTime || 0);
    });
    callback(chats);
  });
  return unsubscribe;
}

/**
 * Subscribes to the most recent N messages of a chat, ordered oldest-first
 * for rendering. limitToLast keeps this cheap even for long-running chats;
 * true infinite-scroll pagination (loading older messages on scroll-up)
 * gets added when we build that feature.
 */
export function subscribeToMessages(chatId, callback, messageLimit = 50) {
  const messagesRef = query(
    ref(db, `messages/${chatId}`),
    orderByChild('createdAt'),
    limitToLast(messageLimit)
  );
  const unsubscribe = onValue(messagesRef, (snapshot) => {
    if (!snapshot.exists()) {
      callback([]);
      return;
    }
    const data = snapshot.val();
    const messages = Object.entries(data)
      .map(([id, msg]) => ({ id, ...msg }))
      .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    callback(messages);
  });
  return unsubscribe;
}

/**
 * Sends a text message. Media messages (image/video/voice/doc) reuse this
 * same function with `type` and `mediaUrl` set — the media upload itself
 * happens beforehand via cloudinary.js, and only the resulting URL is
 * written here, per the architecture (RTDB stores metadata + URLs only).
 */
export async function sendMessage(chatId, sender, otherUserId, { text, type = 'text', mediaUrl = null, mediaMeta = null }) {
  const messagesRef = ref(db, `messages/${chatId}`);
  const newMessageRef = push(messagesRef);
  const now = serverTimestamp();

  const message = {
    senderId: sender.uid,
    senderName: sender.displayName,
    text: text || '',
    type, // 'text' | 'image' | 'video' | 'audio' | 'document'
    mediaUrl,
    mediaMeta, // { bytes, duration, width, height, fileName } — whatever applies
    createdAt: now,
    status: 'sent', // 'sent' -> 'delivered' -> 'seen'
  };

  const previewText =
    type === 'text' ? text : type === 'image' ? '📷 Photo' : type === 'video' ? '🎥 Video' : type === 'audio' ? '🎤 Voice message' : '📄 Document';

  await set(newMessageRef, message);

  await update(ref(db), {
    [`chats/${chatId}/lastMessage`]: {
      text: previewText,
      senderId: sender.uid,
      createdAt: now,
    },
    [`userChats/${sender.uid}/${chatId}/lastMessage`]: previewText,
    [`userChats/${sender.uid}/${chatId}/lastMessageTime`]: now,
    [`userChats/${otherUserId}/${chatId}/lastMessage`]: previewText,
    [`userChats/${otherUserId}/${chatId}/lastMessageTime`]: now,
    [`userChats/${otherUserId}/${chatId}/unreadCount`]: (await get(ref(db, `userChats/${otherUserId}/${chatId}/unreadCount`))).val() + 1 || 1,
  });

  return newMessageRef.key;
}

/** Marks a chat as read (resets unread counter) for the given user. */
export async function markChatAsRead(uid, chatId) {
  await update(ref(db, `userChats/${uid}/${chatId}`), { unreadCount: 0 });
}