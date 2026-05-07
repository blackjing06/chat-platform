import React from 'react';
import { useCall } from '../context/CallContext';
import VoiceCallUI from './VoiceCallUI';

function GlobalVoiceCall() {
    const { callState, callerInfo, remoteStream, acceptCall, rejectCall, hangup, dismiss } = useCall();

    if (callState === 'idle') return null;

    return (
        <VoiceCallUI
            callState={callState}
            caller={callerInfo}
            onAccept={acceptCall}
            onReject={rejectCall}
            onHangup={hangup}
            onDismiss={dismiss}
            remoteStream={remoteStream}
        />
    );
}

export default GlobalVoiceCall;