// src/services/chatService.js
import {
  ref,
  push,
  set,
  update,
  get,
  onValue,
  onDisconnect,
  query,
  orderByChild,
  limitToLast,
  serverTimestamp,
  increment,
} from 'firebase/database';
import { db } from '../config/firebase';

function buildPrivateChatId(uidA, uidB) {
  return [uidA, uidB].sort().join('_');
}

export async function getOrCreatePrivateChat(currentUser, otherUser) {
  const chatId = buildPrivateChatId(currentUser.uid, otherUser.uid);
  const chatRef = ref(db, `chats/${chatId}`);
  const snapshot = await get(chatRef);

  if (!snapshot.exists()) {
    const now = serverTimestamp();
    await set(chatRef, {
      type: 'private',
      participants: { [currentUser.uid]: true, [otherUser.uid]: true },
      createdAt: now,
      lastMessage: null,
    });

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

export function subscribeToUserChats(uid, callback) {
  const userChatsRef = ref(db, `userChats/${uid}`);
  return onValue(userChatsRef, (snapshot) => {
    if (!snapshot.exists()) {
      callback([]);
      return;
    }
    const data = snapshot.val();
    const chats = Object.values(data).sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return (b.lastMessageTime || 0) - (a.lastMessageTime || 0);
    });
    callback(chats);
  });
}

/**
 * Subscribes to messages of a chat. Messages the current user has
 * "deleted for me" are filtered out client-side before reaching callback —
 * they still exist in the DB (deleted-for-me is per-viewer, not global).
 */
export function subscribeToMessages(chatId, currentUid, callback, messageLimit = 50) {
  const messagesRef = query(
    ref(db, `messages/${chatId}`),
    orderByChild('createdAt'),
    limitToLast(messageLimit)
  );
  return onValue(messagesRef, (snapshot) => {
    if (!snapshot.exists()) {
      callback([]);
      return;
    }
    const data = snapshot.val();
    const messages = Object.entries(data)
      .map(([id, msg]) => ({ id, ...msg }))
      .filter((msg) => !msg.deletedFor || !msg.deletedFor[currentUid])
      .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    callback(messages);
  });
}

export async function sendMessage(
  chatId,
  sender,
  otherUserId,
  { text, type = 'text', mediaUrl = null, mediaMeta = null, replyTo = null }
) {
  const messagesRef = ref(db, `messages/${chatId}`);
  const newMessageRef = push(messagesRef);
  const now = serverTimestamp();

  // RTDB throws on any `undefined` value anywhere in a written object —
  // strip undefined keys out of mediaMeta and replyTo before writing.
  const cleanMediaMeta = mediaMeta
    ? Object.fromEntries(Object.entries(mediaMeta).filter(([, v]) => v !== undefined))
    : null;
  const cleanReplyTo = replyTo
    ? Object.fromEntries(Object.entries(replyTo).filter(([, v]) => v !== undefined))
    : null;

  const message = {
    senderId: sender.uid,
    senderName: sender.displayName,
    text: text || '',
    type,
    mediaUrl,
    mediaMeta: cleanMediaMeta,
    replyTo: cleanReplyTo,
    createdAt: now,
    status: 'sent',
  };

  const previewText =
    type === 'text'
      ? text
      : type === 'image'
      ? '📷 Photo'
      : type === 'video'
      ? '🎥 Video'
      : type === 'audio'
      ? '🎤 Voice message'
      : '📄 Document';

  await set(newMessageRef, message);

  await update(ref(db), {
    [`chats/${chatId}/lastMessage`]: { text: previewText, senderId: sender.uid, createdAt: now },
    [`userChats/${sender.uid}/${chatId}/lastMessage`]: previewText,
    [`userChats/${sender.uid}/${chatId}/lastMessageTime`]: now,
    [`userChats/${sender.uid}/${chatId}/lastMessageId`]: newMessageRef.key,
    [`userChats/${sender.uid}/${chatId}/lastSenderId`]: sender.uid,
    [`userChats/${otherUserId}/${chatId}/lastMessage`]: previewText,
    [`userChats/${otherUserId}/${chatId}/lastMessageTime`]: now,
    [`userChats/${otherUserId}/${chatId}/lastMessageId`]: newMessageRef.key,
    [`userChats/${otherUserId}/${chatId}/lastSenderId`]: sender.uid,
    [`userChats/${otherUserId}/${chatId}/unreadCount`]: increment(1),
  });

  return newMessageRef.key;
}

export async function markChatAsRead(uid, chatId) {
  await update(ref(db, `userChats/${uid}/${chatId}`), { unreadCount: 0 });
}

/** Marks a single message 'delivered', but only if it's still 'sent' — never downgrades from 'seen'. */
export async function markMessageDelivered(chatId, messageId) {
  const statusRef = ref(db, `messages/${chatId}/${messageId}/status`);
  const snap = await get(statusRef);
  if (snap.val() === 'sent') {
    await update(ref(db, `messages/${chatId}/${messageId}`), { status: 'delivered' });
  }
}

/** Marks every message NOT sent by uid as 'seen', in one batched write. */
export async function markMessagesAsSeen(chatId, uid, messages) {
  const updates = {};
  messages.forEach((m) => {
    if (m.senderId !== uid && m.status !== 'seen') {
      updates[`messages/${chatId}/${m.id}/status`] = 'seen';
    }
  });
  if (Object.keys(updates).length > 0) {
    await update(ref(db), updates);
  }
}

export function setTypingStatus(chatId, uid, isTyping) {
  const typingRef = ref(db, `typing/${chatId}/${uid}`);
  set(typingRef, isTyping);
  if (isTyping) {
    onDisconnect(typingRef).set(false);
  }
}

export function subscribeToTyping(chatId, otherUserId, callback) {
  const typingRef = ref(db, `typing/${chatId}/${otherUserId}`);
  return onValue(typingRef, (snap) => callback(!!snap.val()));
}

export async function toggleMessageReaction(chatId, messageId, uid, emoji) {
  const reactionRef = ref(db, `messages/${chatId}/${messageId}/reactions/${uid}`);
  const snap = await get(reactionRef);
  await set(reactionRef, snap.val() === emoji ? null : emoji);
}

export async function deleteMessageForMe(chatId, messageId, uid) {
  await set(ref(db, `messages/${chatId}/${messageId}/deletedFor/${uid}`), true);
}

export async function deleteMessageForEveryone(chatId, messageId) {
  await update(ref(db, `messages/${chatId}/${messageId}`), {
    text: '',
    mediaUrl: null,
    mediaMeta: null,
    type: 'deleted',
    deletedForEveryone: true,
  });
}

/** Toggles a boolean flag ('pinned' | 'muted' | 'archived') on the caller's own chat-list entry. */
export async function toggleChatFlag(uid, chatId, field) {
  const flagRef = ref(db, `userChats/${uid}/${chatId}/${field}`);
  const snap = await get(flagRef);
  await set(flagRef, !snap.val());
}