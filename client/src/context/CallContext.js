import React, { createContext, useContext, useCallback, useEffect, useRef, useState } from 'react';
import { useSocket } from './SocketContext';
import { useAuth } from './AuthContext';

const CallContext = createContext(null);

const ICE_SERVERS = {
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

export function CallProvider({ children }) {
    const socket = useSocket();
    const { user } = useAuth();

    const [callState, setCallState] = useState('idle'); // idle | calling | ringing | connected | ended
    const [remoteStream, setRemoteStream] = useState(null);
    const [targetUserId, setTargetUserId] = useState(null);
    const [callerInfo, setCallerInfo] = useState(null); // { id, nickname, avatar }

    const pcRef = useRef(null);
    const localStreamRef = useRef(null);
    const pendingOfferRef = useRef(null);
    const hasEndedRef = useRef(false);

    const cleanup = useCallback(() => {
        if (pcRef.current) {
            pcRef.current.close();
            pcRef.current = null;
        }
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(t => t.stop());
            localStreamRef.current = null;
        }
        setRemoteStream(null);
        setCallerInfo(null);
        setTargetUserId(null);
        hasEndedRef.current = false;
        setCallState('idle');
    }, []);

    const hangup = useCallback(() => {
        if (hasEndedRef.current) return;
        hasEndedRef.current = true;
        if (socket && targetUserId) {
            socket.emit('call_hangup', { toUserId: targetUserId });
        }
        cleanup();
    }, [socket, targetUserId, cleanup]);

    const dismiss = useCallback(() => {
        setCallState('idle');
        cleanup();
    }, [cleanup]);

    const startCall = useCallback(async (toUserId) => {
        if (!socket || !toUserId) return;
        setTargetUserId(toUserId);
        setCallState('calling');
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            localStreamRef.current = stream;
            const pc = new RTCPeerConnection(ICE_SERVERS);
            pcRef.current = pc;
            stream.getTracks().forEach(track => pc.addTrack(track, stream));
            pc.ontrack = (event) => setRemoteStream(event.streams[0]);
            pc.onicecandidate = (event) => {
                if (event.candidate && toUserId) {
                    socket.emit('ice_candidate', { toUserId, candidate: event.candidate });
                }
            };
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            socket.emit('call_offer', { toUserId, offer: pc.localDescription });
        } catch (err) {
            console.error(err);
            cleanup();
        }
    }, [socket, cleanup]);

    const acceptCall = useCallback(async () => {
        if (!pendingOfferRef.current || !targetUserId || !socket) return;
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            localStreamRef.current = stream;
            const pc = new RTCPeerConnection(ICE_SERVERS);
            pcRef.current = pc;
            stream.getTracks().forEach(track => pc.addTrack(track, stream));
            pc.ontrack = (event) => setRemoteStream(event.streams[0]);
            pc.onicecandidate = (event) => {
                if (event.candidate && targetUserId) {
                    socket.emit('ice_candidate', { toUserId: targetUserId, candidate: event.candidate });
                }
            };
            await pc.setRemoteDescription(new RTCSessionDescription(pendingOfferRef.current));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            socket.emit('call_answer', { toUserId: targetUserId, answer: pc.localDescription });
            setCallState('connected');
            pendingOfferRef.current = null;
        } catch (err) {
            console.error(err);
            cleanup();
        }
    }, [socket, targetUserId, cleanup]);

    const rejectCall = useCallback(() => {
        if (socket && targetUserId) {
            socket.emit('call_hangup', { toUserId: targetUserId });
        }
        cleanup();
    }, [socket, targetUserId, cleanup]);

    // 监听全局呼叫事件
    useEffect(() => {
        if (!socket || !user) return;

        const handleIncoming = (data) => {
            setTargetUserId(data.from.id);
            setCallerInfo(data.from);
            pendingOfferRef.current = data.offer;
            setCallState('ringing');
        };

        const handleAccepted = async (data) => {
            if (pcRef.current) {
                await pcRef.current.setRemoteDescription(new RTCSessionDescription(data.answer));
                setCallState('connected');
            }
        };

        const handleIceCandidate = async (data) => {
            if (pcRef.current && data.candidate) {
                try { await pcRef.current.addIceCandidate(new RTCIceCandidate(data.candidate)); } catch (e) { }
            }
        };

        const handleCallEnded = () => {
            if (callState !== 'idle') cleanup();
        };

        socket.on('call_incoming', handleIncoming);
        socket.on('call_accepted', handleAccepted);
        socket.on('ice_candidate', handleIceCandidate);
        socket.on('call_ended', handleCallEnded);

        return () => {
            socket.off('call_incoming', handleIncoming);
            socket.off('call_accepted', handleAccepted);
            socket.off('ice_candidate', handleIceCandidate);
            socket.off('call_ended', handleCallEnded);
        };
    }, [socket, user, cleanup, callState]);

    return (
        <CallContext.Provider value={{ callState, callerInfo, remoteStream, startCall, acceptCall, rejectCall, hangup, dismiss }}>
            {children}
        </CallContext.Provider>
    );
}

export const useCall = () => useContext(CallContext);