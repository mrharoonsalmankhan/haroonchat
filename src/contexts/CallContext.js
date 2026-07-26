// src/contexts/CallContext.js
import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from './AuthContext';
import {
  createCallId,
  initiateCall,
  subscribeToIncomingCalls,
  subscribeToCallStatus,
  acceptCall as acceptCallService,
  rejectCall as rejectCallService,
  markBusy,
  markMissed,
  cancelCall as cancelCallService,
  endCall as endCallService,
  writeOffer,
  writeAnswer,
  getOffer,
  subscribeToAnswer,
  pushIceCandidate,
  subscribeToNewIceCandidates,
  cleanupSignaling,
  logCallHistory,
} from '../services/callService';

const ICE_SERVERS = {
  iceServers: [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }],
};

const RING_TIMEOUT_MS = 45000;

const CallContext = createContext(undefined);

export function CallProvider({ children }) {
  const { currentUser, userProfile } = useAuth();

  // 'idle' | 'outgoing-ringing' | 'incoming-ringing' | 'connected' | 'ended'
  const [callState, setCallState] = useState('idle');
  const [callType, setCallType] = useState(null); // 'voice' | 'video'
  const [otherUser, setOtherUser] = useState(null); // { uid, displayName, photoURL }
  const [incomingCall, setIncomingCall] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [callDuration, setCallDuration] = useState(0);

  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(new MediaStream());
  const callIdRef = useRef(null);
  const roleRef = useRef(null); // 'caller' | 'callee'
  const unsubscribersRef = useRef([]);
  const ringTimeoutRef = useRef(null);
  const durationIntervalRef = useRef(null);
  const historyLoggedRef = useRef(false);
  const connectStartRef = useRef(null);
  const callStateRef = useRef('idle');

  useEffect(() => {
    callStateRef.current = callState;
  }, [callState]);

  const clearSubs = () => {
    unsubscribersRef.current.forEach((u) => u && u());
    unsubscribersRef.current = [];
  };

  const resetToIdle = useCallback(() => {
    clearTimeout(ringTimeoutRef.current);
    clearInterval(durationIntervalRef.current);
    clearSubs();
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    remoteStreamRef.current.getTracks().forEach((t) => remoteStreamRef.current.removeTrack(t));
    callIdRef.current = null;
    roleRef.current = null;
    historyLoggedRef.current = false;
    connectStartRef.current = null;
    setCallState('idle');
    setCallType(null);
    setOtherUser(null);
    setIsMuted(false);
    setIsCameraOff(false);
    setCallDuration(0);
  }, []);

  const buildPeerConnection = useCallback((callId, role) => {
    const pc = new RTCPeerConnection(ICE_SERVERS);
    pc.onicecandidate = (e) => {
      if (e.candidate) pushIceCandidate(callId, role, e.candidate);
    };
    pc.ontrack = (e) => {
      remoteStreamRef.current.addTrack(e.track);
    };
    return pc;
  }, []);

  const doLogHistory = useCallback((status) => {
    if (historyLoggedRef.current || !callIdRef.current || !currentUser || !otherUser) return;
    historyLoggedRef.current = true;
    const duration = connectStartRef.current ? Math.round((Date.now() - connectStartRef.current) / 1000) : 0;
    const isCaller = roleRef.current === 'caller';
    logCallHistory({
      callId: callIdRef.current,
      callerId: isCaller ? currentUser.uid : otherUser.uid,
      callerName: isCaller ? userProfile?.displayName : otherUser.displayName,
      callerPhoto: isCaller ? userProfile?.photoURL : otherUser.photoURL,
      calleeId: isCaller ? otherUser.uid : currentUser.uid,
      calleeName: isCaller ? otherUser.displayName : userProfile?.displayName,
      calleePhoto: isCaller ? otherUser.photoURL : userProfile?.photoURL,
      type: callType,
      status,
      duration,
    }).catch(() => {});
  }, [currentUser, otherUser, userProfile, callType]);

  const hangUp = useCallback(
    async (statusForHistory = 'ended') => {
      const callId = callIdRef.current;
      const role = roleRef.current;
      const wasConnected = callState === 'connected';
      doLogHistory(wasConnected ? 'completed' : statusForHistory);

      if (callId) {
        if (role === 'caller' && callState === 'outgoing-ringing') {
          await cancelCallService(callId, otherUser?.uid).catch(() => {});
        } else {
          await endCallService(callId).catch(() => {});
        }
        cleanupSignaling(callId).catch(() => {});
      }
      resetToIdle();
    },
    [callState, otherUser, doLogHistory, resetToIdle]
  );

  // Global listener for incoming calls — active any time the user is logged in.
  // IMPORTANT: this subscribes ONCE per login (deliberately not re-run when
  // callState changes) — re-subscribing on every state change was causing
  // Firebase to immediately re-deliver the current invite to the fresh
  // listener, which the old code (reading callState from a stale closure)
  // misread as "a second incoming call while already busy" and auto-rejected
  // its own call. We read live call state via a ref instead.
  useEffect(() => {
    if (!currentUser?.uid) return undefined;

    const unsubscribe = subscribeToIncomingCalls(currentUser.uid, (invite) => {
      if (!invite) {
        setIncomingCall((prev) => (prev ? null : prev));
        return;
      }
      if (callStateRef.current !== 'idle') {
        // Already busy — auto-decline as busy without showing UI.
        markBusy(invite.callId, currentUser.uid).catch(() => {});
        return;
      }
      setIncomingCall(invite);
      setCallState('incoming-ringing');
      setCallType(invite.type);
      setOtherUser({ uid: invite.callerId, displayName: invite.callerName, photoURL: invite.callerPhoto });
    });

    return unsubscribe;
  }, [currentUser?.uid]);

  const startCall = useCallback(
    async (targetUser, type) => {
      if (callState !== 'idle' || !currentUser) return;
      const callId = createCallId();
      callIdRef.current = callId;
      roleRef.current = 'caller';
      setCallType(type);
      setOtherUser(targetUser);
      setCallState('outgoing-ringing');

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: type === 'video' });
        localStreamRef.current = stream;

        const pc = buildPeerConnection(callId, 'caller');
        pcRef.current = pc;
        stream.getTracks().forEach((t) => pc.addTrack(t, stream));

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        await initiateCall(callId, {
          callerId: currentUser.uid,
          callerName: userProfile?.displayName,
          callerPhoto: userProfile?.photoURL,
          calleeId: targetUser.uid,
          calleeName: targetUser.displayName,
          calleePhoto: targetUser.photoURL,
          type,
        });
        await writeOffer(callId, offer);

        const unsubAnswer = subscribeToAnswer(callId, async (answer) => {
          if (answer && pc.currentRemoteDescription === null) {
            await pc.setRemoteDescription(new RTCSessionDescription(answer));
            clearTimeout(ringTimeoutRef.current);
            connectStartRef.current = Date.now();
            setCallState('connected');
            durationIntervalRef.current = setInterval(() => {
              setCallDuration((d) => d + 1);
            }, 1000);
          }
        });
        const unsubIce = subscribeToNewIceCandidates(callId, 'callee', (candidate) => {
          pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
        });
        const unsubStatus = subscribeToCallStatus(callId, (status) => {
          if (['rejected', 'busy', 'missed', 'ended', 'cancelled'].includes(status)) {
            if (callStateRef.current !== 'idle') {
              doLogHistory(status === 'ended' ? 'completed' : status);
              resetToIdle();
            }
          }
        });
        unsubscribersRef.current = [unsubAnswer, unsubIce, unsubStatus];

        ringTimeoutRef.current = setTimeout(() => {
          markMissed(callId, targetUser.uid).catch(() => {});
          doLogHistory('no-answer');
          resetToIdle();
        }, RING_TIMEOUT_MS);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[CallContext] Failed to start call:', err);
        resetToIdle();
      }
    },
    [callState, currentUser, userProfile, buildPeerConnection, doLogHistory, resetToIdle]
  );

  const acceptIncomingCall = useCallback(async () => {
    if (!incomingCall || !currentUser) return;
    const { callId } = incomingCall;
    callIdRef.current = callId;
    roleRef.current = 'callee';

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: incomingCall.type === 'video' });
      localStreamRef.current = stream;

      const pc = buildPeerConnection(callId, 'callee');
      pcRef.current = pc;
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));

      const offer = await getOffer(callId);
      if (!offer) throw new Error('Offer not found');
      await pc.setRemoteDescription(new RTCSessionDescription(offer));

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await writeAnswer(callId, answer);
      await acceptCallService(callId, currentUser.uid);

      const unsubIce = subscribeToNewIceCandidates(callId, 'caller', (candidate) => {
        pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
      });
      const unsubStatus = subscribeToCallStatus(callId, (status) => {
        if (status === 'ended' || status === 'cancelled') {
          doLogHistory('completed');
          resetToIdle();
        }
      });
      unsubscribersRef.current = [unsubIce, unsubStatus];

      connectStartRef.current = Date.now();
      setCallState('connected');
      setIncomingCall(null);
      durationIntervalRef.current = setInterval(() => setCallDuration((d) => d + 1), 1000);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[CallContext] Failed to accept call:', err);
      resetToIdle();
    }
  }, [incomingCall, currentUser, buildPeerConnection, doLogHistory, resetToIdle]);

  const rejectIncomingCall = useCallback(() => {
    if (!incomingCall || !currentUser) return;
    rejectCallService(incomingCall.callId, currentUser.uid).catch(() => {});
    setIncomingCall(null);
    resetToIdle();
  }, [incomingCall, currentUser, resetToIdle]);

  const toggleMute = useCallback(() => {
    if (!localStreamRef.current) return;
    const audioTrack = localStreamRef.current.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setIsMuted(!audioTrack.enabled);
    }
  }, []);

  const toggleCamera = useCallback(() => {
    if (!localStreamRef.current) return;
    const videoTrack = localStreamRef.current.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setIsCameraOff(!videoTrack.enabled);
    }
  }, []);

  useEffect(() => () => resetToIdle(), []); // eslint-disable-line react-hooks/exhaustive-deps

  const value = {
    callState,
    callType,
    otherUser,
    incomingCall,
    isMuted,
    isCameraOff,
    callDuration,
    localStreamRef,
    remoteStreamRef,
    startCall,
    acceptIncomingCall,
    rejectIncomingCall,
    hangUp,
    toggleMute,
    toggleCamera,
  };

  return <CallContext.Provider value={value}>{children}</CallContext.Provider>;
}

export function useCall() {
  const context = useContext(CallContext);
  if (context === undefined) {
    throw new Error('useCall must be used within a CallProvider');
  }
  return context;
}

export default CallContext;