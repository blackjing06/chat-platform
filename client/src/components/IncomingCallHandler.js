import React, { useEffect, useRef, useState } from 'react';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import VoiceCallUI from './VoiceCallUI';

const ICE_SERVERS = {
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

function IncomingCallHandler() {
    const socket = useSocket();
    const { user } = useAuth();
    const [callState, setCallState] = useState('idle');        // idle | ringing | connected | ended
    const [remoteStream, setRemoteStream] = useState(null);
    const [incomingCaller, setIncomingCaller] = useState(null); // { id, nickname, avatar }
    const pcRef = useRef(null);
    const localStreamRef = useRef(null);
    const hasEndedRef = useRef(false);

    // 清理资源
    const cleanup = () => {
        if (pcRef.current) {
            pcRef.current.close();
            pcRef.current = null;
        }
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(t => t.stop());
            localStreamRef.current = null;
        }
        setRemoteStream(null);
        setCallState('idle');
        hasEndedRef.current = false;
    };

    // 挂断或拒绝
    const hangup = () => {
        if (hasEndedRef.current) return;
        hasEndedRef.current = true;
        if (socket && incomingCaller) {
            socket.emit('call_hangup', { toUserId: incomingCaller.id });
        }
        cleanup();
        setCallState('ended');
        setIncomingCaller(null);
    };

    const dismiss = () => {
        setCallState('idle');
        setIncomingCaller(null);
        hasEndedRef.current = false;
    };

    // 接听
    const acceptCall = async () => {
        if (!incomingCaller || !socket) return;
        try {
            // 获取本地音频
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            localStreamRef.current = stream;

            const pc = new RTCPeerConnection(ICE_SERVERS);
            pcRef.current = pc;
            stream.getTracks().forEach(track => pc.addTrack(track, stream));

            pc.ontrack = (event) => {
                setRemoteStream(event.streams[0]);
            };

            pc.onicecandidate = (event) => {
                if (event.candidate) {
                    socket.emit('ice_candidate', {
                        toUserId: incomingCaller.id,
                        candidate: event.candidate,
                    });
                }
            };

            // 使用之前保存的 offer 设置远程描述
            if (window._pendingOffer) {
                await pc.setRemoteDescription(new RTCSessionDescription(window._pendingOffer));
                window._pendingOffer = null;
            } else {
                throw new Error('未收到通话邀请');
            }

            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);

            socket.emit('call_answer', {
                toUserId: incomingCaller.id,
                answer: pc.localDescription,
            });

            setCallState('connected');
        } catch (err) {
            console.error('接听失败', err);
            hangup();
        }
    };

    // 监听信令事件
    useEffect(() => {
        if (!socket) return;

        const handleIncoming = (data) => {
            // 如果已有通话在进行中，自动拒绝（可选）
            if (callState !== 'idle') {
                socket.emit('call_hangup', { toUserId: data.from.id });
                return;
            }
            // 保存 offer 到全局变量（供 acceptCall 使用）
            window._pendingOffer = data.offer;
            setIncomingCaller(data.from);
            setCallState('ringing');
        };

        const handleCallEnded = () => {
            if (callState !== 'idle') {
                cleanup();
                setCallState('ended');
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
        socket.on('call_ended', handleCallEnded);
        socket.on('ice_candidate', handleIceCandidate);

        return () => {
            socket.off('call_incoming', handleIncoming);
            socket.off('call_ended', handleCallEnded);
            socket.off('ice_candidate', handleIceCandidate);
        };
    }, [socket, callState]);

    // 如果正在与其他用户通话的 ChatWindow 中，不显示此全局接听面板
    // 简单判断：若当前 URL 包含与来电用户相关的会话，则交给 ChatWindow 处理
    useEffect(() => {
        if (callState === 'ringing' && incomingCaller) {
            const path = window.location.pathname;
            const match = path.match(/\/chat\/conversation\/private_(\d+)_(\d+)/);
            if (match) {
                const id1 = parseInt(match[1]);
                const id2 = parseInt(match[2]);
                if (id1 === incomingCaller.id || id2 === incomingCaller.id) {
                    // 当前正在与此人的聊天窗口，忽略全局接听
                    setCallState('idle');
                    setIncomingCaller(null);
                    window._pendingOffer = null;
                }
            }
        }
    }, [callState, incomingCaller]);

    return (
        <VoiceCallUI
            callState={callState}
            caller={incomingCaller || { nickname: '对方' }}
            onAccept={acceptCall}
            onReject={hangup}
            onHangup={hangup}
            onDismiss={dismiss}
            remoteStream={remoteStream}
        />
    );
}

export default IncomingCallHandler;