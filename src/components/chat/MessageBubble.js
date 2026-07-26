// src/components/chat/MessageBubble.js
import React, { useState } from 'react';
import { useChat } from '../../contexts/ChatContext';

const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

function formatTime(timestamp) {
  if (!timestamp) return '';
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function MessageBubble({ message, isOwn }) {
  const { reactToMessage, deleteForMe, deleteForEveryone, toggleStar, starredMessages, setReplyTarget, activeChatId } = useChat();
  const [menuOpen, setMenuOpen] = useState(false);
  const [showReactions, setShowReactions] = useState(false);

  const isDeleted = message.type === 'deleted';
  const isStarred = !!starredMessages[`${activeChatId}_${message.id}`];
  const reactions = message.reactions ? Object.values(message.reactions) : [];
  const reactionCounts = reactions.reduce((acc, emoji) => {
    acc[emoji] = (acc[emoji] || 0) + 1;
    return acc;
  }, {});

  const closeMenus = () => {
    setMenuOpen(false);
    setShowReactions(false);
  };

  const handleReply = () => {
    setReplyTarget(message);
    closeMenus();
  };

  const handleCopy = () => {
    if (message.text) navigator.clipboard.writeText(message.text);
    closeMenus();
  };

  const handleStar = () => {
    toggleStar(message.id, isStarred);
    closeMenus();
  };

  const handleDeleteForMe = () => {
    deleteForMe(message.id);
    closeMenus();
  };

  const handleDeleteForEveryone = () => {
    deleteForEveryone(message.id);
    closeMenus();
  };

  const handleReact = (emoji) => {
    reactToMessage(message.id, emoji);
    closeMenus();
  };

  if (isDeleted) {
    return (
      <div className={`message-row ${isOwn ? 'own' : 'other'}`}>
        <div className={`message-bubble deleted ${isOwn ? 'own' : 'other'}`}>
          <p className="message-text deleted-text">🚫 This message was deleted</p>
          <span className="message-time">{formatTime(message.createdAt)}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`message-row ${isOwn ? 'own' : 'other'}`} onMouseLeave={closeMenus}>
      <div className={`message-bubble ${isOwn ? 'own' : 'other'}`}>
        <button type="button" className="bubble-menu-trigger" onClick={() => setMenuOpen((v) => !v)}>
          ⌄
        </button>

        {menuOpen && (
          <div className="bubble-menu">
            <button type="button" onClick={() => setShowReactions((v) => !v)}>😊 React</button>
            <button type="button" onClick={handleReply}>↩ Reply</button>
            {message.type === 'text' && <button type="button" onClick={handleCopy}>📋 Copy</button>}
            <button type="button" onClick={handleStar}>{isStarred ? '★ Unstar' : '☆ Star'}</button>
            <button type="button" onClick={handleDeleteForMe}>🗑 Delete for me</button>
            {isOwn && <button type="button" onClick={handleDeleteForEveryone}>🗑 Delete for everyone</button>}
          </div>
        )}

        {showReactions && (
          <div className="quick-reactions">
            {QUICK_REACTIONS.map((emoji) => (
              <button key={emoji} type="button" onClick={() => handleReact(emoji)}>
                {emoji}
              </button>
            ))}
          </div>
        )}

        {message.replyTo && (
          <div className="reply-quote">
            <span className="reply-quote-name">{message.replyTo.senderName}</span>
            <span className="reply-quote-text">
              {message.replyTo.type === 'text' ? message.replyTo.text : `📎 ${message.replyTo.type}`}
            </span>
          </div>
        )}

        {message.type === 'text' && <p className="message-text">{message.text}</p>}
        {message.type === 'image' && <img src={message.mediaUrl} alt="" className="message-media message-image" />}
        {message.type === 'video' && <video src={message.mediaUrl} controls className="message-media" />}
        {message.type === 'audio' && <audio src={message.mediaUrl} controls className="message-audio" />}
        {message.type === 'document' && (
          <a href={message.mediaUrl} target="_blank" rel="noopener noreferrer" className="message-document">
            📄 {message.mediaMeta?.fileName || 'Document'}
          </a>
        )}
        {message.text && message.type !== 'text' && <p className="message-caption">{message.text}</p>}

        {Object.keys(reactionCounts).length > 0 && (
          <div className="message-reactions">
            {Object.entries(reactionCounts).map(([emoji, count]) => (
              <span key={emoji} className="reaction-pill">
                {emoji} {count > 1 ? count : ''}
              </span>
            ))}
          </div>
        )}

        <span className="message-time">
          {formatTime(message.createdAt)}
          {isOwn && (
            <span className={`message-status ${message.status}`} title={message.status}>
              {message.status === 'seen' ? ' ✓✓' : message.status === 'delivered' ? ' ✓✓' : ' ✓'}
            </span>
          )}
        </span>
      </div>
    </div>
  );
}