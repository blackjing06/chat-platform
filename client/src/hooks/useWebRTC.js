import { useEffect, useRef, useState, useCallback } from 'react';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';

const ICE_SERVERS = {
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

export function useWebRTC(targetUserId) {
    const socket = useSocket();
    const { user } = useAuth();
    const [callState, setCallState] = useState('idle');
    const [remoteStream, setRemoteStream] = useState(null);
    const pcRef = useRef(null);
    const localStreamRef = useRef(null);
    const pendingOfferRef = useRef(null);
    const hasEndedRef = useRef(false);

    const getLocalStream = useCallback(async () => {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        localStreamRef.current = stream;
        return stream;
    }, []);

    const createPeerConnection = useCallback((stream) => {
        const pc = new RTCPeerConnection(ICE_SERVERS);
        pcRef.current = pc;

        stream.getTracks().forEach(track => pc.addTrack(track, stream));

        pc.ontrack = (event) => {
            setRemoteStream(event.streams[0]);
        };

        pc.onicecandidate = (event) => {
            if (event.candidate && targetUserId) {
                socket.emit('ice_candidate', {
                    toUserId: targetUserId,
                    candidate: event.candidate,
                });
            }
        };

        return pc;
    }, [socket, targetUserId]);

    const startCall = useCallback(async () => {
        if (!targetUserId || !socket) return;
        setCallState('calling');
        const stream = await getLocalStream();
        const pc = createPeerConnection(stream);

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        socket.emit('call_offer', {
            toUserId: targetUserId,
            offer: pc.localDescription,
        });
    }, [targetUserId, socket, getLocalStream, createPeerConnection]);

    const acceptCall = useCallback(async () => {
        if (!pendingOfferRef.current || !targetUserId || !socket) return;
        const stream = await getLocalStream();
        const pc = createPeerConnection(stream);

        await pc.setRemoteDescription(new RTCSessionDescription(pendingOfferRef.current));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        socket.emit('call_answer', {
            toUserId: targetUserId,
            answer: pc.localDescription,
        });
        setCallState('connected');
        pendingOfferRef.current = null;
    }, [targetUserId, socket, getLocalStream, createPeerConnection]);

    const hangup = useCallback(() => {
        if (hasEndedRef.current) return;
        hasEndedRef.current = true;

        if (pcRef.current) {
            pcRef.current.close();
            pcRef.current = null;
        }
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => track.stop());
            localStreamRef.current = null;
        }
        setRemoteStream(null);
        setCallState('ended');
        if (socket && targetUserId) {
            socket.emit('call_hangup', { toUserId: targetUserId });
        }
    }, [socket, targetUserId]);

    const rejectCall = useCallback(() => {
        if (socket && targetUserId) {
            socket.emit('call_hangup', { toUserId: targetUserId });
        }
        setCallState('idle');
        pendingOfferRef.current = null;
    }, [socket, targetUserId]);

    const dismiss = useCallback(() => {
        setCallState('idle');
        hasEndedRef.current = false;
    }, []);

    // 处理对方挂断
    const handleCallEnded = useCallback(() => {
        if (hasEndedRef.current) return;
        hangup();
    }, [hangup]);

    // 监听信令事件
    useEffect(() => {
        if (!socket || !targetUserId) return;

        const handleIncoming = (data) => {
            setCallState('ringing');
            pendingOfferRef.current = data.offer;
        };

        const handleAccepted = async (data) => {
            if (pcRef.current && data.answer) {
                await pcRef.current.setRemoteDescription(new RTCSessionDescription(data.answer));
                setCallState('connected');
            }
        };

        const handleIceCandidate = async (data) => {
            if (pcRef.current && data.candidate) {
                try {
                    await pcRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
                } catch (e) { }
            }
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
    }, [socket, targetUserId, handleCallEnded]);

    return {
        callState,
        remoteStream,
        localStream: localStreamRef.current,
        startCall,
        acceptCall,
        rejectCall,
        hangup,
        dismiss,
    };
}