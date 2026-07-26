// src/components/calls/IncomingCallModal.js
import React from 'react';
import { useCall } from '../../contexts/CallContext';
import './IncomingCallModal.css';

export default function IncomingCallModal() {
  const { callState, incomingCall, otherUser, acceptIncomingCall, rejectIncomingCall } = useCall();

  if (callState !== 'incoming-ringing' || !incomingCall) return null;

  return (
    <div className="incoming-call-overlay">
      <div className="incoming-call-card">
        {otherUser?.photoURL ? (
          <img src={otherUser.photoURL} alt="" className="incoming-call-avatar" />
        ) : (
          <div className="incoming-call-avatar-fallback">{otherUser?.displayName?.[0]?.toUpperCase() || '?'}</div>
        )}
        <h2>{otherUser?.displayName}</h2>
        <p>{incomingCall.type === 'video' ? 'Incoming video call…' : 'Incoming voice call…'}</p>

        <div className="incoming-call-actions">
          <button type="button" className="call-action-btn reject" onClick={rejectIncomingCall} title="Decline">
            ✕
          </button>
          <button type="button" className="call-action-btn accept" onClick={acceptIncomingCall} title="Accept">
            📞
          </button>
        </div>
      </div>
    </div>
  );
}