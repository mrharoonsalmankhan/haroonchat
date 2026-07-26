// src/components/media/VoiceRecorder.js
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useChat } from '../../contexts/ChatContext';
import { useMediaUpload } from '../../hooks/useMediaUpload';
import './VoiceRecorder.css';

function formatDuration(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function VoiceRecorder({ onClose }) {
  const { sendMediaMessage } = useChat();
  const { upload, progress } = useMediaUpload();

  const [phase, setPhase] = useState('recording'); // 'recording' | 'preview' | 'sending'
  const [duration, setDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [error, setError] = useState(null);

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const timerRef = useRef(null);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    let cancelled = false;

    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const recorder = new MediaRecorder(stream);
        mediaRecorderRef.current = recorder;
        chunksRef.current = [];

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunksRef.current.push(e.data);
        };
        recorder.onstop = () => {
          const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
          setAudioBlob(blob);
          setAudioUrl(URL.createObjectURL(blob));
        };

        recorder.start();
        timerRef.current = setInterval(() => {
          setDuration((d) => d + 1);
        }, 1000);
      })
      .catch(() => {
        if (!cancelled) setError('Microphone access denied. Check your browser permissions.');
      });

    return () => {
      cancelled = true;
      clearInterval(timerRef.current);
      if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      stopStream();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleStop = () => {
    clearInterval(timerRef.current);
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    stopStream();
    setPhase('preview');
  };

  const handleCancel = () => {
    clearInterval(timerRef.current);
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    stopStream();
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    onClose();
  };

  const handleSend = async () => {
    if (!audioBlob) return;
    setPhase('sending');
    try {
      const file = new File([audioBlob], `voice-${Date.now()}.webm`, { type: 'audio/webm' });
      const result = await upload(file, 'chat_media/voice_notes');
      await sendMediaMessage({
        type: 'audio',
        mediaUrl: result.url,
        mediaMeta: { duration, bytes: result.bytes },
      });
      onClose();
    } catch (err) {
      setError('Failed to send voice note. Please try again.');
      setPhase('preview');
    }
  };

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

  if (phase === 'recording') {
    return (
      <div className="voice-recorder-bar">
        <button type="button" className="icon-btn" onClick={handleCancel} title="Cancel">
          🗑️
        </button>
        <div className="recording-indicator">
          <span className="recording-dot" />
          <span className="recording-time">{formatDuration(duration)}</span>
        </div>
        <button type="button" className="send-btn" onClick={handleStop} title="Stop recording">
          ■
        </button>
      </div>
    );
  }

  return (
    <div className="voice-recorder-bar">
      <button type="button" className="icon-btn" onClick={handleCancel} title="Discard" disabled={phase === 'sending'}>
        🗑️
      </button>
      <audio src={audioUrl} controls className="voice-preview-player" />
      <span className="recording-time">{formatDuration(duration)}</span>
      <button
        type="button"
        className="send-btn"
        onClick={handleSend}
        disabled={phase === 'sending'}
      >
        {phase === 'sending' ? `${progress}%` : '➤'}
      </button>
    </div>
  );
}