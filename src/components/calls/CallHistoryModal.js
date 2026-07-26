// src/components/calls/CallHistoryModal.js
import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useCall } from '../../contexts/CallContext';
import { subscribeToCallHistory } from '../../services/callService';
import './CallHistoryModal.css';

function formatTime(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  if (isToday) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function formatDuration(seconds) {
  if (!seconds) return '';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const STATUS_LABEL = {
  completed: '',
  missed: 'Missed',
  'no-answer': 'No answer',
  rejected: 'Declined',
  busy: 'Busy',
  cancelled: 'Cancelled',
};

export default function CallHistoryModal({ onClose }) {
  const { currentUser } = useAuth();
  const { startCall } = useCall();
  const [history, setHistory] = useState([]);

  useEffect(() => {
    const unsubscribe = subscribeToCallHistory(currentUser.uid, setHistory);
    return unsubscribe;
  }, [currentUser.uid]);

  const handleCallBack = (entry, type) => {
    startCall({ uid: entry.otherUserId, displayName: entry.otherUserName, photoURL: entry.otherUserPhoto }, type);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="call-history-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Calls</h3>
          <button type="button" className="icon-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="call-history-list">
          {history.length === 0 && <div className="modal-empty">No call history yet.</div>}
          {history.map((entry) => {
            const missed = entry.status !== 'completed' && entry.direction === 'incoming';
            return (
              <div className="call-history-item" key={`${entry.callId}_${entry.timestamp}`}>
                {entry.otherUserPhoto ? (
                  <img src={entry.otherUserPhoto} alt="" className="call-history-avatar" />
                ) : (
                  <div className="call-history-avatar-fallback">{entry.otherUserName?.[0]?.toUpperCase() || '?'}</div>
                )}
                <div className="call-history-info">
                  <span className={`call-history-name ${missed ? 'missed' : ''}`}>{entry.otherUserName}</span>
                  <span className="call-history-meta">
                    {entry.direction === 'outgoing' ? '↗ ' : '↙ '}
                    {STATUS_LABEL[entry.status] || ''} {formatDuration(entry.duration)} · {formatTime(entry.timestamp)}
                  </span>
                </div>
                <button type="button" className="call-history-btn" onClick={() => handleCallBack(entry, 'voice')} title="Voice call">
                  📞
                </button>
                <button type="button" className="call-history-btn" onClick={() => handleCallBack(entry, 'video')} title="Video call">
                  🎥
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}