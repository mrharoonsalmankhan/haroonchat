// src/contexts/ChatContext.js
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useAuth } from './AuthContext';
import {
  subscribeToUserChats,
  subscribeToMessages,
  sendMessage as sendMessageService,
  markChatAsRead,
  getOrCreatePrivateChat,
} from '../services/chatService';

const ChatContext = createContext(undefined);

export function ChatProvider({ children }) {
  const { currentUser, userProfile } = useAuth();
  const [chats, setChats] = useState([]);
  const [chatsLoading, setChatsLoading] = useState(true);
  const [activeChatId, setActiveChatId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);

  // Subscribe to the user's chat list once logged in.
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

  // Subscribe to messages of whichever chat is currently open.
  useEffect(() => {
    if (!activeChatId) {
      setMessages([]);
      return undefined;
    }
    setMessagesLoading(true);
    const unsubscribe = subscribeToMessages(activeChatId, (msgs) => {
      setMessages(msgs);
      setMessagesLoading(false);
    });
    return unsubscribe;
  }, [activeChatId]);

  const openChat = useCallback(
    (chatId) => {
      setActiveChatId(chatId);
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
        { text: text.trim(), type: 'text' }
      );
    },
    [activeChatId, currentUser, userProfile, chats]
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
        { text, type, mediaUrl, mediaMeta }
      );
    },
    [activeChatId, currentUser, userProfile, chats]
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