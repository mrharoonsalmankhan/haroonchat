// src/components/chat/ChatList.js
import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useChat } from '../../contexts/ChatContext';
import NewChatModal from './NewChatModal';
import './ChatList.css';

function formatTime(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  if (isToday) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export default function ChatList() {
  const { userProfile, signOut } = useAuth();
  const { chats, chatsLoading, activeChatId, openChat } = useChat();
  const [showNewChat, setShowNewChat] = useState(false);

  return (
    <aside className="chat-list-panel">
      <header className="chat-list-header">
        <div className="chat-list-user">
          {userProfile?.photoURL && (
            <img src={userProfile.photoURL} alt="" className="chat-list-avatar" />
          )}
          <span className="chat-list-username">{userProfile?.displayName}</span>
        </div>
        <div className="chat-list-actions">
          <button
            type="button"
            className="icon-btn"
            title="New chat"
            onClick={() => setShowNewChat(true)}
          >
            ✏️
          </button>
          <button type="button" className="icon-btn" title="Sign out" onClick={signOut}>
            ⎋
          </button>
        </div>
      </header>

      <div className="chat-list-body">
        {chatsLoading && (
          <div className="chat-list-empty">Loading chats…</div>
        )}

        {!chatsLoading && chats.length === 0 && (
          <div className="chat-list-empty">
            <p>No conversations yet.</p>
            <button type="button" className="primary-btn" onClick={() => setShowNewChat(true)}>
              Start a new chat
            </button>
          </div>
        )}

        {chats.map((chat) => (
          <button
            key={chat.chatId}
            type="button"
            className={`chat-list-item ${chat.chatId === activeChatId ? 'active' : ''}`}
            onClick={() => openChat(chat.chatId)}
          >
            <div className="chat-item-avatar-wrap">
              {chat.otherUserPhoto ? (
                <img src={chat.otherUserPhoto} alt="" className="chat-item-avatar" />
              ) : (
                <div className="chat-item-avatar-fallback">
                  {chat.otherUserName?.[0]?.toUpperCase() || '?'}
                </div>
              )}
            </div>
            <div className="chat-item-info">
              <div className="chat-item-top">
                <span className="chat-item-name">{chat.otherUserName}</span>
                <span className="chat-item-time">{formatTime(chat.lastMessageTime)}</span>
              </div>
              <div className="chat-item-bottom">
                <span className="chat-item-preview">{chat.lastMessage || 'Say hello 👋'}</span>
                {chat.unreadCount > 0 && (
                  <span className="chat-item-badge">{chat.unreadCount}</span>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>

      {showNewChat && <NewChatModal onClose={() => setShowNewChat(false)} />}
    </aside>
  );
}