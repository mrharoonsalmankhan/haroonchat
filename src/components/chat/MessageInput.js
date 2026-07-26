// src/components/chat/MessageInput.js
import React, { useState, useRef, useEffect } from 'react';
import { useChat } from '../../contexts/ChatContext';
import MediaPreviewModal from '../media/MediaPreviewModal';
import VoiceRecorder from '../media/VoiceRecorder';

export default function MessageInput() {
  const { sendMessage, setTyping, replyTarget, setReplyTarget } = useChat();
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [showRecorder, setShowRecorder] = useState(false);

  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const docInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  useEffect(() => {
    return () => {
      clearTimeout(typingTimeoutRef.current);
      setTyping(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTextChange = (e) => {
    setText(e.target.value);
    setTyping(true);
    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => setTyping(false), 2000);
  };

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setText('');
    clearTimeout(typingTimeoutRef.current);
    setTyping(false);
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

  const handleFileChosen = (e) => {
    const file = e.target.files?.[0];
    if (file) setSelectedFile(file);
    e.target.value = '';
  };

  if (showRecorder) {
    return <VoiceRecorder onClose={() => setShowRecorder(false)} />;
  }

  return (
    <>
      {replyTarget && (
        <div className="reply-preview-bar">
          <div className="reply-preview-content">
            <span className="reply-preview-name">{replyTarget.senderName}</span>
            <span className="reply-preview-text">
              {replyTarget.type === 'text' ? replyTarget.text : `📎 ${replyTarget.type}`}
            </span>
          </div>
          <button type="button" className="icon-btn" onClick={() => setReplyTarget(null)}>
            ✕
          </button>
        </div>
      )}

      <div className="message-input-bar">
        <button type="button" className="icon-btn" title="Attach photo or video" onClick={() => fileInputRef.current?.click()}>
          📎
        </button>
        <button type="button" className="icon-btn" title="Attach document" onClick={() => docInputRef.current?.click()}>
          📄
        </button>
        <button type="button" className="icon-btn" title="Camera" onClick={() => cameraInputRef.current?.click()}>
          📷
        </button>

        <textarea
          ref={textareaRef}
          className="message-input"
          placeholder="Type a message"
          value={text}
          onChange={handleTextChange}
          onKeyDown={handleKeyDown}
          rows={1}
        />

        {text.trim() ? (
          <button type="button" className="send-btn" onClick={handleSend} disabled={sending}>
            ➤
          </button>
        ) : (
          <button type="button" className="icon-btn mic-btn" title="Record voice note" onClick={() => setShowRecorder(true)}>
            🎤
          </button>
        )}

        <input ref={fileInputRef} type="file" accept="image/*,video/*" style={{ display: 'none' }} onChange={handleFileChosen} />
        <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handleFileChosen} />
        <input
          ref={docInputRef}
          type="file"
          accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip"
          style={{ display: 'none' }}
          onChange={handleFileChosen}
        />
      </div>

      {selectedFile && <MediaPreviewModal file={selectedFile} onClose={() => setSelectedFile(null)} />}
    </>
  );
}