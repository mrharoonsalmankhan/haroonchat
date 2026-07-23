// src/components/chat/MessageInput.js
import React, { useState, useRef } from 'react';
import { useChat } from '../../contexts/ChatContext';

export default function MessageInput() {
  const { sendMessage } = useChat();
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const textareaRef = useRef(null);

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setText('');
    try {
      await sendMessage(trimmed);
    } finally {
      setSending(false);
      textareaRef.current?.focus();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="message-input-bar">
      {/* Media/emoji/voice-note buttons plug in here in a later step */}
      <textarea
        ref={textareaRef}
        className="message-input"
        placeholder="Type a message"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        rows={1}
      />
      <button
        type="button"
        className="send-btn"
        onClick={handleSend}
        disabled={!text.trim() || sending}
      >
        ➤
      </button>
    </div>
  );
}