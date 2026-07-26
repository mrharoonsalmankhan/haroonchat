// src/contexts/ChatContext.js
import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import {
  subscribeToUserChats,
  subscribeToMessages,
  sendMessage as sendMessageService,
  markChatAsRead,
  markMessageDelivered,
  markMessagesAsSeen,
  getOrCreatePrivateChat,
  setTypingStatus,
  subscribeToTyping,
  toggleMessageReaction,
  deleteMessageForMe,
  deleteMessageForEveryone,
  toggleChatFlag,
} from '../services/chatService';
import { toggleStarMessage as toggleStarMessageService } from '../services/userService';

const ChatContext = createContext(undefined);

export function ChatProvider({ children }) {
  const { currentUser, userProfile } = useAuth();
  const [chats, setChats] = useState([]);
  const [chatsLoading, setChatsLoading] = useState(true);
  const [activeChatId, setActiveChatId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [replyTarget, setReplyTarget] = useState(null);
  const [otherUserTyping, setOtherUserTyping] = useState(false);

  const deliveredMarkedRef = useRef(new Set()); // avoid re-marking the same messageId repeatedly

  // Chat list
  useEffect(() => {
    if (!currentUser?.uid) {
      setChats([]);
      setChatsLoading(false);
      return undefined;
    }
    setChatsLoading(true);
    const unsubscribe = subscribeToUserChats(currentUser.uid, (chatList) => {
      setChats(chatList);
      setChatsLoading(false);
    });
    return unsubscribe;
  }, [currentUser?.uid]);

  // Mark incoming messages 'delivered' the moment they show up in the chat
  // list — this works even if the chat isn't currently open, since it only
  // depends on /userChats, which every logged-in client is subscribed to.
  useEffect(() => {
    if (!currentUser?.uid) return;
    chats.forEach((chat) => {
      if (
        chat.lastMessageId &&
        chat.lastSenderId &&
        chat.lastSenderId !== currentUser.uid &&
        !deliveredMarkedRef.current.has(chat.lastMessageId)
      ) {
        deliveredMarkedRef.current.add(chat.lastMessageId);
        markMessageDelivered(chat.chatId, chat.lastMessageId).catch(() => {});
      }
    });
  }, [chats, currentUser?.uid]);

  // Messages of the open chat
  useEffect(() => {
    if (!activeChatId || !currentUser?.uid) {
      setMessages([]);
      return undefined;
    }
    setMessagesLoading(true);
    const unsubscribe = subscribeToMessages(activeChatId, currentUser.uid, (msgs) => {
      setMessages(msgs);
      setMessagesLoading(false);
    });
    return unsubscribe;
  }, [activeChatId, currentUser?.uid]);

  // Mark messages 'seen' whenever the open chat's message list changes
  useEffect(() => {
    if (!activeChatId || !currentUser?.uid || messages.length === 0) return;
    markMessagesAsSeen(activeChatId, currentUser.uid, messages).catch(() => {});
  }, [activeChatId, currentUser?.uid, messages]);

  // Typing indicator for the open chat
  useEffect(() => {
    const chat = chats.find((c) => c.chatId === activeChatId);
    if (!activeChatId || !chat?.otherUserId) {
      setOtherUserTyping(false);
      return undefined;
    }
    const unsubscribe = subscribeToTyping(activeChatId, chat.otherUserId, setOtherUserTyping);
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChatId, chats.find((c) => c.chatId === activeChatId)?.otherUserId]);

  const openChat = useCallback(
    (chatId) => {
      setActiveChatId(chatId);
      setReplyTarget(null);
      if (currentUser?.uid) {
        markChatAsRead(currentUser.uid, chatId).catch(() => {});
      }
    },
    [currentUser?.uid]
  );

  const startChatWithUser = useCallback(
    async (otherUser) => {
      if (!currentUser || !userProfile) return null;
      const chatId = await getOrCreatePrivateChat(
        { uid: currentUser.uid, displayName: userProfile.displayName, photoURL: userProfile.photoURL },
        otherUser
      );
      openChat(chatId);
      return chatId;
    },
    [currentUser, userProfile, openChat]
  );

  const sendMessage = useCallback(
    async (text) => {
      if (!activeChatId || !currentUser || !text?.trim()) return;
      const chat = chats.find((c) => c.chatId === activeChatId);
      if (!chat) return;
      await sendMessageService(
        activeChatId,
        { uid: currentUser.uid, displayName: userProfile?.displayName },
        chat.otherUserId,
        {
          text: text.trim(),
          type: 'text',
          replyTo: replyTarget
            ? { messageId: replyTarget.id, text: replyTarget.text || '', senderName: replyTarget.senderName, type: replyTarget.type }
            : null,
        }
      );
      setReplyTarget(null);
    },
    [activeChatId, currentUser, userProfile, chats, replyTarget]
  );

  const sendMediaMessage = useCallback(
    async ({ type, mediaUrl, mediaMeta, text = '' }) => {
      if (!activeChatId || !currentUser) return;
      const chat = chats.find((c) => c.chatId === activeChatId);
      if (!chat) return;
      await sendMessageService(
        activeChatId,
        { uid: currentUser.uid, displayName: userProfile?.displayName },
        chat.otherUserId,
        {
          text,
          type,
          mediaUrl,
          mediaMeta,
          replyTo: replyTarget
            ? { messageId: replyTarget.id, text: replyTarget.text || '', senderName: replyTarget.senderName, type: replyTarget.type }
            : null,
        }
      );
      setReplyTarget(null);
    },
    [activeChatId, currentUser, userProfile, chats, replyTarget]
  );

  const setTyping = useCallback(
    (isTyping) => {
      if (!activeChatId || !currentUser?.uid) return;
      setTypingStatus(activeChatId, currentUser.uid, isTyping);
    },
    [activeChatId, currentUser?.uid]
  );

  const reactToMessage = useCallback(
    (messageId, emoji) => {
      if (!activeChatId || !currentUser?.uid) return;
      toggleMessageReaction(activeChatId, messageId, currentUser.uid, emoji);
    },
    [activeChatId, currentUser?.uid]
  );

  const deleteForMe = useCallback(
    (messageId) => {
      if (!activeChatId || !currentUser?.uid) return;
      deleteMessageForMe(activeChatId, messageId, currentUser.uid);
    },
    [activeChatId, currentUser?.uid]
  );

  const deleteForEveryone = useCallback(
    (messageId) => {
      if (!activeChatId) return;
      deleteMessageForEveryone(activeChatId, messageId);
    },
    [activeChatId]
  );

  const toggleStar = useCallback(
    (messageId, isCurrentlyStarred) => {
      if (!activeChatId || !currentUser?.uid) return;
      toggleStarMessageService(currentUser.uid, activeChatId, messageId, isCurrentlyStarred);
    },
    [activeChatId, currentUser?.uid]
  );

  const toggleChatPin = useCallback(
    (chatId) => currentUser?.uid && toggleChatFlag(currentUser.uid, chatId, 'pinned'),
    [currentUser?.uid]
  );
  const toggleChatMute = useCallback(
    (chatId) => currentUser?.uid && toggleChatFlag(currentUser.uid, chatId, 'muted'),
    [currentUser?.uid]
  );
  const toggleChatArchive = useCallback(
    (chatId) => currentUser?.uid && toggleChatFlag(currentUser.uid, chatId, 'archived'),
    [currentUser?.uid]
  );

  const isUserBlocked = useCallback(
    (otherUid) => !!userProfile?.blockedUsers?.[otherUid],
    [userProfile?.blockedUsers]
  );

  const activeChat = chats.find((c) => c.chatId === activeChatId) || null;

  const value = {
    chats,
    chatsLoading,
    activeChatId,
    activeChat,
    messages,
    messagesLoading,
    openChat,
    startChatWithUser,
    sendMessage,
    sendMediaMessage,
    replyTarget,
    setReplyTarget,
    otherUserTyping,
    setTyping,
    reactToMessage,
    deleteForMe,
    deleteForEveryone,
    toggleStar,
    starredMessages: userProfile?.starredMessages || {},
    toggleChatPin,
    toggleChatMute,
    toggleChatArchive,
    isUserBlocked,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat() {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
}

export default ChatContext;