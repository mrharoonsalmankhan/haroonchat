// src/components/calls/CallScreen.js
import React, { useEffect, useRef } from 'react';
import { useCall } from '../../contexts/CallContext';
import './CallScreen.css';

function formatDuration(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function CallScreen() {
  const {
    callState,
    callType,
    otherUser,
    isMuted,
    isCameraOff,
    callDuration,
    localStreamRef,
    remoteStreamRef,
    hangUp,
    toggleMute,
    toggleCamera,
  } = useCall();

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);

  const isActive = callState === 'outgoing-ringing' || callState === 'connected';
  const isVideo = callType === 'video';

  useEffect(() => {
    if (!isActive) return;
    if (localVideoRef.current && localStreamRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
    }
    if (isVideo && remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStreamRef.current;
    }
    if (!isVideo && remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = remoteStreamRef.current;
    }
  }, [isActive, isVideo, localStreamRef, remoteStreamRef, callState]);

  if (!isActive) return null;

  return (
    <div className="call-screen">
      {isVideo && callState === 'connected' && (
        <video ref={remoteVideoRef} autoPlay playsInline className="call-remote-video" />
      )}
      {!isVideo && <audio ref={remoteAudioRef} autoPlay />}

      {(!isVideo || callState !== 'connected') && (
        <div className="call-center-info">
          {otherUser?.photoURL ? (
            <img src={otherUser.photoURL} alt="" className="call-avatar" />
          ) : (
            <div className="call-avatar-fallback">{otherUser?.displayName?.[0]?.toUpperCase() || '?'}</div>
          )}
          <h2>{otherUser?.displayName}</h2>
          <p className="call-status-text">
            {callState === 'outgoing-ringing' ? 'Ringing…' : formatDuration(callDuration)}
          </p>
        </div>
      )}

      {isVideo && callState === 'connected' && (
        <div className="call-duration-badge">{formatDuration(callDuration)}</div>
      )}

      {isVideo && (
        <video
          ref={localVideoRef}
          autoPlay
          playsInline
          muted
          className={`call-local-video ${isCameraOff ? 'hidden' : ''}`}
        />
      )}

      <div className="call-controls">
        <button type="button" className={`call-control-btn ${isMuted ? 'active' : ''}`} onClick={toggleMute} title="Mute">
          {isMuted ? '🔇' : '🎤'}
        </button>
        {isVideo && (
          <button
            type="button"
            className={`call-control-btn ${isCameraOff ? 'active' : ''}`}
            onClick={toggleCamera}
            title="Camera"
          >
            {isCameraOff ? '📷' : '🎥'}
          </button>
        )}
        <button type="button" className="call-control-btn end-call" onClick={() => hangUp()} title="End call">
          ☎
        </button>
      </div>
    </div>
  );
}