// src/components/media/VoiceRecorder.js
import React, { useEffect, useRef, useState } from 'react';
import { useVoiceRecorder } from '../../hooks/useVoiceRecorder';
import { useMediaUpload } from '../../hooks/useMediaUpload';
import { useChat } from '../../contexts/ChatContext';
import './VoiceRecorder.css';

function formatDuration(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function VoiceRecorder({ onClose }) {
  const { activeChatId, sendMediaMessage } = useChat();
  const {
    isRecording,
    isPaused,
    duration,
    audioBlob,
    error,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    cancelRecording,
  } = useVoiceRecorder();
  const { uploadFile, progress, status } = useMediaUpload();
  const [playbackUrl, setPlaybackUrl] = useState(null);
  const startedRef = useRef(false);

  // Start recording the moment this component mounts (user already clicked
  // the mic button to get here).
  useEffect(() => {
    if (!startedRef.current) {
      startedRef.current = true;
      startRecording();
    }
  }, [startRecording]);

  useEffect(() => {
    if (audioBlob) {
      const url = URL.createObjectURL(audioBlob);
      setPlaybackUrl(url);
      return () => URL.revokeObjectURL(url);
    }
    return undefined;
  }, [audioBlob]);

  const handleCancel = () => {
    cancelRecording();
    onClose();
  };

  const handleStop = () => {
    stopRecording();
  };

  const handleSend = async () => {
    if (!audioBlob) return;
    const file = new File([audioBlob], `voice-note-${Date.now()}.webm`, { type: audioBlob.type });
    try {
      const result = await uploadFile(file, `chats/${activeChatId}`);
      await sendMediaMessage({
        type: 'audio',
        mediaUrl: result.url,
        mediaMeta: { ...result.meta, duration },
      });
      onClose();
    } catch {
      // upload error is visible via the `error` state from useMediaUpload if needed
    }
  };

  const isUploading = status === 'uploading' || status === 'compressing';

  if (error) {
    return (
      <div className="voice-recorder-bar error">
        <span>{error}</span>
        <button type="button" className="icon-btn" onClick={onClose}>
          ✕
        </button>
      </div>
    );
  }

  // Post-recording: show playback + send controls.
  if (audioBlob && !isRecording) {
    return (
      <div className="voice-recorder-bar">
        <button type="button" className="icon-btn" onClick={handleCancel} disabled={isUploading}>
          🗑️
        </button>
        <audio src={playbackUrl} controls className="voice-playback" />
        <span className="voice-duration">{formatDuration(duration)}</span>
        {isUploading ? (
          <div className="voice-upload-progress">{status === 'compressing' ? '…' : `${progress}%`}</div>
        ) : (
          <button type="button" className="send-btn" onClick={handleSend}>
            ➤
          </button>
        )}
      </div>
    );
  }

  // Actively recording.
  return (
    <div className="voice-recorder-bar recording">
      <button type="button" className="icon-btn" onClick={handleCancel} title="Cancel">
        🗑️
      </button>

      <div className="voice-waveform" aria-hidden="true">
        {Array.from({ length: 24 }).map((_, i) => (
          <span
            key={i}
            className={`voice-bar ${isPaused ? 'paused' : ''}`}
            style={{ animationDelay: `${i * 0.05}s` }}
          />
        ))}
      </div>

      <span className="voice-duration recording-dot">
        <span className="dot" /> {formatDuration(duration)}
      </span>

      {isPaused ? (
        <button type="button" className="icon-btn" onClick={resumeRecording} title="Resume">
          ▶️
        </button>
      ) : (
        <button type="button" className="icon-btn" onClick={pauseRecording} title="Pause">
          ⏸️
        </button>
      )}

      <button type="button" className="send-btn" onClick={handleStop} title="Stop recording">
        ✓
      </button>
    </div>
  );
}