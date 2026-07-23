// src/components/chat/MessageBubble.js
import React from 'react';

function formatTime(timestamp) {
  if (!timestamp) return '';
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function MessageBubble({ message, isOwn }) {
  return (
    <div className={`message-row ${isOwn ? 'own' : 'other'}`}>
      <div className={`message-bubble ${isOwn ? 'own' : 'other'}`}>
        {message.type === 'text' && <p className="message-text">{message.text}</p>}

        {message.type === 'image' && (
          <img src={message.mediaUrl} alt="" className="message-media message-image" />
        )}

        {message.type === 'video' && (
          <video src={message.mediaUrl} controls className="message-media" />
        )}

        {message.type === 'audio' && (
          <audio src={message.mediaUrl} controls className="message-audio" />
        )}

        {message.type === 'document' && (
          <a
            href={message.mediaUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="message-document"
          >
            📄 {message.mediaMeta?.fileName || 'Document'}
          </a>
        )}

        <span className="message-time">
          {formatTime(message.createdAt)}
          {isOwn && (
            <span className={`message-status ${message.status}`}>
              {message.status === 'seen' ? ' ✓✓' : message.status === 'delivered' ? ' ✓✓' : ' ✓'}
            </span>
          )}
        </span>
      </div>
    </div>
  );
}