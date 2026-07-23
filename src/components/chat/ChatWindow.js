// src/components/chat/ChatWindow.js
import React, { useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useChat } from '../../contexts/ChatContext';
import MessageBubble from './MessageBubble';
import MessageInput from './MessageInput';
import './ChatWindow.css';

export default function ChatWindow() {
  const { currentUser } = useAuth();
  const { activeChat, activeChatId, messages, messagesLoading } = useChat();
  const bottomRef = useRef(null);

  // Auto-scroll to the newest message whenever the message list changes.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  if (!activeChatId) {
    return (
      <main className="chat-window empty-state">
        <div className="empty-state-content">
          <div className="empty-state-icon">💬</div>
          <h2>Select a chat to start messaging</h2>
          <p>Or click the ✏️ icon to start a new conversation.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="chat-window">
      <header className="chat-window-header">
        {activeChat?.otherUserPhoto ? (
          <img src={activeChat.otherUserPhoto} alt="" className="chat-window-avatar" />
        ) : (
          <div className="chat-window-avatar-fallback">
            {activeChat?.otherUserName?.[0]?.toUpperCase() || '?'}
          </div>
        )}
        <div>
          <div className="chat-window-name">{activeChat?.otherUserName}</div>
        </div>
      </header>

      <div className="chat-window-messages">
        {messagesLoading && <div className="chat-window-loading">Loading messages…</div>}

        {!messagesLoading && messages.length === 0 && (
          <div className="chat-window-loading">No messages yet — say hello 👋</div>
        )}

        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} isOwn={msg.senderId === currentUser.uid} />
        ))}
        <div ref={bottomRef} />
      </div>

      <MessageInput />
    </main>
  );
}