import React from 'react';
import { useAuth } from '../context/AuthContext';

function VoiceCallUI({ callState, caller, onAccept, onReject, onHangup, onDismiss, remoteStream }) {
    const { user } = useAuth();

    if (callState === 'idle') return null;

    return (
        <div className="voice-call-overlay">
            <div className="voice-call-card">
                {callState === 'calling' && (
                    <div>
                        <p>正在呼叫 {caller?.nickname || '对方'}...</p>
                        <button onClick={onHangup}>取消</button>
                    </div>
                )}
                {callState === 'ringing' && (
                    <div>
                        <p>{caller?.nickname || '对方'} 邀请你语音通话</p>
                        <button onClick={onAccept}>接听</button>
                        <button onClick={onReject}>拒绝</button>
                    </div>
                )}
                {callState === 'connected' && (
                    <div>
                        <p>通话中 ...</p>
                        <button onClick={onHangup}>挂断</button>
                        {/* 播放远端音频：使用 audio 元素 */}
                        {remoteStream && <audio ref={(el) => { if (el) el.srcObject = remoteStream; }} autoPlay />}
                    </div>
                )}
                {callState === 'ended' && (
                    <div>
                        <p>通话已结束</p>
                        <button onClick={onDismiss}>关闭</button>   {/* 改为 onDismiss */}
                    </div>
                )}
            </div>
        </div>
    );
}

export default VoiceCallUI;