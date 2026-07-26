// src/components/chat/ChatList.js
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useChat } from '../../contexts/ChatContext';
import NewChatModal from './NewChatModal';
import CallHistoryModal from '../calls/CallHistoryModal';
import './ChatList.css';

function formatTime(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  if (isToday) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export default function ChatList() {
  const navigate = useNavigate();
  const { userProfile, signOut } = useAuth();
  const { chats, chatsLoading, activeChatId, openChat, toggleChatPin, toggleChatMute, toggleChatArchive } = useChat();
  const [showNewChat, setShowNewChat] = useState(false);
  const [showCallHistory, setShowCallHistory] = useState(false);
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [menuChatId, setMenuChatId] = useState(null);

  const visibleChats = chats
    .filter((c) => (showArchived ? c.archived : !c.archived))
    .filter((c) => c.otherUserName?.toLowerCase().includes(search.toLowerCase()));

  const archivedCount = chats.filter((c) => c.archived).length;

  return (
    <aside className="chat-list-panel">
      <header className="chat-list-header">
        <div className="chat-list-user">
          {userProfile?.photoURL && <img src={userProfile.photoURL} alt="" className="chat-list-avatar" />}
          <span className="chat-list-username">{userProfile?.displayName}</span>
        </div>
        <div className="chat-list-actions">
          <button type="button" className="icon-btn" title="Calls" onClick={() => setShowCallHistory(true)}>
            📞
          </button>
          <button type="button" className="icon-btn" title="Settings" onClick={() => navigate('/settings')}>
            ⚙️
          </button>
          <button type="button" className="icon-btn" title="New chat" onClick={() => setShowNewChat(true)}>
            ✏️
          </button>
          <button type="button" className="icon-btn" title="Sign out" onClick={signOut}>
            ⎋
          </button>
        </div>
      </header>

      <div className="chat-list-search">
        <input
          type="text"
          placeholder="Search chats…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {showArchived && (
        <div className="chat-list-archived-banner">
          <span>Archived Chats</span>
          <button type="button" className="text-btn" onClick={() => setShowArchived(false)}>
            Back
          </button>
        </div>
      )}

      <div className="chat-list-body" onClick={() => setMenuChatId(null)}>
        {chatsLoading && <div className="chat-list-empty">Loading chats…</div>}

        {!chatsLoading && visibleChats.length === 0 && (
          <div className="chat-list-empty">
            {showArchived ? (
              <p>No archived chats.</p>
            ) : (
              <>
                <p>No conversations yet.</p>
                <button type="button" className="primary-btn" onClick={() => setShowNewChat(true)}>
                  Start a new chat
                </button>
              </>
            )}
          </div>
        )}

        {visibleChats.map((chat) => (
          <div key={chat.chatId} className="chat-list-item-wrap">
            <button
              type="button"
              className={`chat-list-item ${chat.chatId === activeChatId ? 'active' : ''}`}
              onClick={() => openChat(chat.chatId)}
            >
              <div className="chat-item-avatar-wrap">
                {chat.otherUserPhoto ? (
                  <img src={chat.otherUserPhoto} alt="" className="chat-item-avatar" />
                ) : (
                  <div className="chat-item-avatar-fallback">{chat.otherUserName?.[0]?.toUpperCase() || '?'}</div>
                )}
              </div>
              <div className="chat-item-info">
                <div className="chat-item-top">
                  <span className="chat-item-name">
                    {chat.pinned && '📌 '}
                    {chat.otherUserName}
                  </span>
                  <span className="chat-item-time">{formatTime(chat.lastMessageTime)}</span>
                </div>
                <div className="chat-item-bottom">
                  <span className="chat-item-preview">
                    {chat.muted && '🔇 '}
                    {chat.lastMessage || 'Say hello 👋'}
                  </span>
                  {chat.unreadCount > 0 && <span className="chat-item-badge">{chat.unreadCount}</span>}
                </div>
              </div>
            </button>
            <button
              type="button"
              className="chat-item-menu-trigger"
              onClick={(e) => {
                e.stopPropagation();
                setMenuChatId(menuChatId === chat.chatId ? null : chat.chatId);
              }}
            >
              ⋮
            </button>
            {menuChatId === chat.chatId && (
              <div className="chat-item-menu" onClick={(e) => e.stopPropagation()}>
                <button type="button" onClick={() => { toggleChatPin(chat.chatId); setMenuChatId(null); }}>
                  {chat.pinned ? 'Unpin' : 'Pin'} chat
                </button>
                <button type="button" onClick={() => { toggleChatMute(chat.chatId); setMenuChatId(null); }}>
                  {chat.muted ? 'Unmute' : 'Mute'} chat
                </button>
                <button type="button" onClick={() => { toggleChatArchive(chat.chatId); setMenuChatId(null); }}>
                  {chat.archived ? 'Unarchive' : 'Archive'} chat
                </button>
              </div>
            )}
          </div>
        ))}

        {!showArchived && archivedCount > 0 && (
          <button type="button" className="chat-list-archived-link" onClick={() => setShowArchived(true)}>
            📁 Archived ({archivedCount})
          </button>
        )}
      </div>

      {showNewChat && <NewChatModal onClose={() => setShowNewChat(false)} />}
      {showCallHistory && <CallHistoryModal onClose={() => setShowCallHistory(false)} />}
    </aside>
  );
}