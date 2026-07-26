// src/components/chat/ChatWindow.js
import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useChat } from '../../contexts/ChatContext';
import { useCall } from '../../contexts/CallContext';
import { blockUser, unblockUser, reportUser } from '../../services/userService';
import MessageBubble from './MessageBubble';
import MessageInput from './MessageInput';
import './ChatWindow.css';

export default function ChatWindow() {
  const { currentUser } = useAuth();
  const { activeChat, activeChatId, messages, messagesLoading, otherUserTyping, isUserBlocked } = useChat();
  const { startCall } = useCall();
  const bottomRef = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  useEffect(() => {
    setSearchOpen(false);
    setSearchQuery('');
    setMenuOpen(false);
  }, [activeChatId]);

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

  const otherUid = activeChat?.otherUserId;
  const blocked = otherUid ? isUserBlocked(otherUid) : false;

  const handleBlockToggle = () => {
    if (!otherUid) return;
    if (blocked) {
      unblockUser(currentUser.uid, otherUid);
    } else {
      blockUser(currentUser.uid, otherUid);
    }
    setMenuOpen(false);
  };

  const handleReport = () => {
    if (!otherUid) return;
    reportUser(currentUser.uid, otherUid, 'Reported from chat window');
    setMenuOpen(false);
    // eslint-disable-next-line no-alert
    alert('Thanks — this user has been reported to our team.');
  };

  const displayedMessages = searchQuery.trim()
    ? messages.filter((m) => m.text?.toLowerCase().includes(searchQuery.toLowerCase()))
    : messages;

  return (
    <main className="chat-window">
      <header className="chat-window-header">
        {activeChat?.otherUserPhoto ? (
          <img src={activeChat.otherUserPhoto} alt="" className="chat-window-avatar" />
        ) : (
          <div className="chat-window-avatar-fallback">{activeChat?.otherUserName?.[0]?.toUpperCase() || '?'}</div>
        )}
        <div className="chat-window-title">
          <div className="chat-window-name">{activeChat?.otherUserName}</div>
          {otherUserTyping && !blocked && <div className="chat-window-typing">typing…</div>}
        </div>
        <div className="chat-window-header-actions">
          <button
            type="button"
            className="icon-btn"
            title="Voice call"
            onClick={() => startCall({ uid: otherUid, displayName: activeChat?.otherUserName, photoURL: activeChat?.otherUserPhoto }, 'voice')}
          >
            📞
          </button>
          <button
            type="button"
            className="icon-btn"
            title="Video call"
            onClick={() => startCall({ uid: otherUid, displayName: activeChat?.otherUserName, photoURL: activeChat?.otherUserPhoto }, 'video')}
          >
            🎥
          </button>
          <button type="button" className="icon-btn" title="Search in chat" onClick={() => setSearchOpen((v) => !v)}>
            🔍
          </button>
          <button type="button" className="icon-btn" title="More" onClick={() => setMenuOpen((v) => !v)}>
            ⋮
          </button>
          {menuOpen && (
            <div className="chat-window-menu">
              <button type="button" onClick={handleBlockToggle}>
                {blocked ? 'Unblock user' : 'Block user'}
              </button>
              <button type="button" onClick={handleReport}>
                Report user
              </button>
            </div>
          )}
        </div>
      </header>

      {searchOpen && (
        <div className="chat-search-bar">
          <input
            type="text"
            autoFocus
            placeholder="Search in this chat…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <span className="chat-search-count">
            {searchQuery.trim() ? `${displayedMessages.length} match(es)` : ''}
          </span>
        </div>
      )}

      <div className="chat-window-messages">
        {messagesLoading && <div className="chat-window-loading">Loading messages…</div>}
        {!messagesLoading && displayedMessages.length === 0 && (
          <div className="chat-window-loading">
            {searchQuery.trim() ? 'No matching messages.' : 'No messages yet — say hello 👋'}
          </div>
        )}
        {displayedMessages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} isOwn={msg.senderId === currentUser.uid} />
        ))}
        <div ref={bottomRef} />
      </div>

      {blocked ? (
        <div className="chat-blocked-banner">
          You've blocked this user.{' '}
          <button type="button" className="text-btn" onClick={handleBlockToggle}>
            Unblock
          </button>{' '}
          to send messages.
        </div>
      ) : (
        <MessageInput />
      )}
    </main>
  );
}