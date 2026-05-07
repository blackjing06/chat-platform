import React, { useEffect, useState, useRef } from 'react';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import api from '../api';
import { uploadFile } from '../uploadService';
import { useWebRTC } from '../hooks/useWebRTC';
import VoiceCallUI from './VoiceCallUI';
import EmojiPicker from 'emoji-picker-react';
import GroupInfoPanel from './GroupInfoPanel';


function ChatWindow({ conversationId }) {
    const { user } = useAuth();
    const socket = useSocket();
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const bottomRef = useRef(null);
    const fileInputRef = useRef(null);
    const [recording, setRecording] = useState(false);
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);
    const [searchKeyword, setSearchKeyword] = useState('');
    const [searchResults, setSearchResults] = useState(null); // null=正常模式，数组=搜索结果
    const [searchLoading, setSearchLoading] = useState(false);
    const [contextMenu, setContextMenu] = useState(null); // { message_id, x, y }
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [showStickerPanel, setShowStickerPanel] = useState(false);
    const STICKERS = [
        { id: 1, url: '/sticker1.png' },
        { id: 2, url: '/sticker2.png' },

    ];
    const [showGroupPanel, setShowGroupPanel] = useState(false);
    const handleEmojiSelect = (emojiData) => {
        setInput((prev) => prev + emojiData.emoji);
        setShowEmojiPicker(false);
    };
    const sendSticker = (stickerUrl) => {
        if (!socket) return;
        const msgContent = JSON.stringify({ url: stickerUrl });
        socket.emit('message', {
            conversation_id: conversationId,
            message_type: 'image',      // 复用图片消息类型
            content: msgContent,
        });
        setShowStickerPanel(false);
    };
    const getOtherUserId = (convId, myId) => {
        const parts = convId.split('_');
        if (parts.length === 3 && parts[0] === 'private') {
            const id1 = parseInt(parts[1], 10);
            const id2 = parseInt(parts[2], 10);
            return id1 === myId ? id2 : id1;
        }
        return null;
    };
    const handleContextMenu = (e, msg) => {
        e.preventDefault();
        if (msg.sender?.id !== user.id) return;       // 只能撤回自己的
        if (msg.status === 1) return;                 // 已撤回
        const msgTime = new Date(msg.created_at).getTime();
        const now = Date.now();
        if (now - msgTime > 120 * 1000) return;       // 超过2分钟

        setContextMenu({ message_id: msg.message_id || msg.id, x: e.clientX, y: e.clientY });
    };

    const closeContextMenu = () => setContextMenu(null);
    const otherUserId = getOtherUserId(conversationId, user.id);
    const {
        callState,
        remoteStream,
        startCall,
        acceptCall,
        rejectCall,
        hangup,
        dismiss,
    } = useWebRTC(otherUserId);
    const callerInfo = { nickname: /* 从会话列表中获取或从 store 获取，暂时用 '对方' */ '对方' };
    const [showMembers, setShowMembers] = useState(false);


    // 初次加载最新消息
    useEffect(() => {
        setMessages([]);
        setHasMore(true);
        fetchMessages();
        api.post(`/conversations/${conversationId}/read`).catch(console.error);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [conversationId]);

    const handleRevoke = async () => {
        if (!contextMenu) return;
        try {
            await api.delete(`/conversations/${conversationId}/messages/${contextMenu.message_id}`);
            closeContextMenu();
            // 通过 WebSocket 事件自动更新界面
        } catch (err) {
            alert(err.response?.data?.error || '撤回失败');
        }
    };

    const fetchMessages = async (beforeId) => {
        if (loading || !hasMore) return;
        setLoading(true);
        try {
            const res = await api.get(`/conversations/${conversationId}/messages`, {
                params: { before: beforeId, limit: 20 },
            });
            const newMsgs = res.data.messages || [];
            if (newMsgs.length < 20) setHasMore(false);

            setMessages((prev) => {
                const existingIds = new Set(prev.map((m) => m.message_id || m.id));
                const filtered = newMsgs.filter((m) => !existingIds.has(m.message_id || m.id));
                return [...filtered, ...prev];
            });
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = async (e) => {
        e.preventDefault();

        if (!searchKeyword.trim()) return;
        setSearchLoading(true);
        try {
            const res = await api.get(`/conversations/${conversationId}/search`, {
                params: { keyword: searchKeyword, limit: 30 }
            });
            console.log(res.data.messages);
            setSearchResults(res.data.messages);
        } catch (err) {
            alert('搜索失败');
        } finally {
            setSearchLoading(false);
        }
    };
    const exportFilteredMessages = (format, messages) => {
        if (messages.length === 0) {
            alert('当前没有可导出的消息');
            return;
        }
        let content = '';
        let filename = '';
        const now = new Date().toLocaleString();
        const chatName = '搜索导出';

        if (format === 'json') {
            const data = {
                chat: chatName,
                exported_at: new Date().toISOString(),
                messages: messages.map(msg => ({
                    sender: msg.sender?.nickname || '未知',
                    type: msg.message_type,
                    content: msg.content,
                    time: msg.created_at,
                })),
            };
            content = JSON.stringify(data, null, 2);
            filename = `search_export_${Date.now()}.json`;
        } else { // txt
            let text = `聊天记录（搜索结果）\n导出时间：${now}\n\n`;
            for (const msg of messages) {
                const time = msg.created_at ? new Date(msg.created_at).toLocaleString() : '未知时间';
                const sender = msg.sender?.nickname || '未知';
                let msgContent = msg.content;
                if (msg.message_type === 'image') {
                    try { const p = JSON.parse(msg.content); msgContent = `[图片] ${p.url}`; } catch { msgContent = '[图片]'; }
                } else if (msg.message_type === 'audio') {
                    try { const p = JSON.parse(msg.content); msgContent = `[音频] ${p.url}`; } catch { msgContent = '[音频]'; }
                } else if (msg.status === 1) {
                    msgContent = '[消息已撤回]';
                }
                text += `[${time}] ${sender}: ${msgContent}\n`;
            }
            content = text;
            filename = `search_export_${Date.now()}.txt`;
        }

        const blob = new Blob([content], { type: format === 'json' ? 'application/json' : 'text/plain' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
    };
    const handleExport = async (format) => {
        // 如果当前处于搜索模式，导出过滤后的消息
        if (searchResults !== null) {
            exportFilteredMessages(format, searchResults);
            return;
        }

        // 否则导出全部消息逻辑
        try {
            const res = await api.post(`/conversations/${conversationId}/export`, { format });
            const { filename, url } = res.data;
            const fileRes = await api.get(url, { responseType: 'blob' });
            const blobUrl = window.URL.createObjectURL(new Blob([fileRes.data]));
            const link = document.createElement('a');
            link.href = blobUrl;
            link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(blobUrl);
        } catch (err) {
            alert('导出失败：' + (err.response?.data?.error || err.message));
        }
    };

    const clearSearch = () => {
        setSearchKeyword('');
        setSearchResults(null);
    };

    // 监听新消息
    useEffect(() => {
        if (!socket) return;
        const handler = (msg) => {
            if (msg.conversation_id === conversationId) {
                setMessages((prev) => {
                    // 去重：若已存在相同 message_id 的消息则忽略
                    if (prev.some((m) => (m.message_id || m.id) === (msg.message_id || msg.id))) {
                        return prev;
                    }
                    return [...prev, msg];
                });
                api.post(`/conversations/${conversationId}/read`).catch(console.error);
            }
        };
        socket.on('new_message', handler);
        return () => socket.off('new_message', handler);
    }, [socket, conversationId]);

    useEffect(() => {
        if (!socket) return;
        const handleRevoke = (data) => {
            if (data.conversation_id === conversationId) {
                setMessages(prev =>
                    prev.map(m => {
                        if ((m.message_id || m.id) === data.message_id) {
                            return { ...m, status: 1 };
                        }
                        return m;
                    })
                );
            }
        };
        socket.on('message_revoked', handleRevoke);
        return () => socket.off('message_revoked', handleRevoke);
    }, [socket, conversationId]);

    // 自动滚动到底部
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // 发送文本消息
    const sendMessage = () => {
        if (!socket || !input.trim()) return;
        socket.emit('message', {
            conversation_id: conversationId,
            message_type: 'text',
            content: input,
        });
        setInput('');
    };

    // 处理图片选择
    const handleImageSelect = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
            const data = await uploadFile(file);
            const msgContent = JSON.stringify({ url: data.url });
            socket.emit('message', {
                conversation_id: conversationId,
                message_type: 'image',
                content: msgContent,
            });
        } catch (err) {
            console.error('图片上传失败', err);
            alert('图片上传失败');
        }
        e.target.value = ''; // 清空，以便再次选择同一文件
    };

    // 开始录音
    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (e) => {

                if (e.data.size > 0) audioChunksRef.current.push(e.data);
            };

            mediaRecorder.onstop = async () => {

                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });

                const audioFile = new File([audioBlob], `audio_${Date.now()}.webm`, {
                    type: 'audio/webm',
                });
                try {
                    const data = await uploadFile(audioFile);

                    const msgContent = JSON.stringify({ url: data.url });
                    socket.emit('message', {
                        conversation_id: conversationId,
                        message_type: 'audio',
                        content: msgContent,
                    });
                } catch (err) {
                    console.error('语音上传失败', err);
                    alert('语音发送失败');
                }
                // 关闭麦克风
                stream.getTracks().forEach((track) => track.stop());
                setRecording(false);
            };

            mediaRecorder.start();
            setRecording(true);
        } catch (err) {
            console.error('无法获取麦克风', err);
            alert('无法访问麦克风');
        }
    };

    // 停止录音
    const stopRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
        }
    };

    // 上滑加载更多
    const handleScroll = (e) => {
        if (e.target.scrollTop === 0 && hasMore && !loading) {
            const firstMessageId = messages.length > 0 ? messages[0].message_id || messages[0].id : undefined;
            fetchMessages(firstMessageId);
        }
    };

    // 根据消息类型渲染内容
    const renderContent = (msg) => {
        if (msg.status === 1) {
            return <span style={{ color: '#999', fontStyle: 'italic' }}>消息已撤回</span>;
        }
        if (msg.message_type === 'text') {
            return <span>{msg.content}</span>;
        }
        if (msg.message_type === 'image') {
            let url = '';
            try {
                const parsed = JSON.parse(msg.content);
                url = parsed.url;
            } catch {
                url = msg.content; // 容错
            }
            return (
                <img
                    src={url}
                    alt="图片"
                    style={{ maxWidth: '200px', borderRadius: '8px', cursor: 'pointer' }}
                    onClick={() => window.open(url, '_blank')}
                />
            );
        }
        if (msg.message_type === 'audio') {
            let url = '';
            try {
                const parsed = JSON.parse(msg.content);
                url = parsed.url;
            } catch {
                url = msg.content;
            }
            return (
                <audio controls src={url} style={{ maxWidth: '250px' }}>
                    <source src={url} type="audio/webm" />
                    您的浏览器不支持音频播放
                </audio>
            );
        }
        // 其他未知类型，尝试显示原始内容
        return <span>{msg.content}</span>;
    };

    return (
        <div className="chat-window">
            {/* 搜索和导出工具栏 */}
            <div className="chat-toolbar">
                <form onSubmit={handleSearch} className="search-form">
                    <input
                        type="text"
                        placeholder="搜索消息..."
                        value={searchKeyword}
                        onChange={(e) => setSearchKeyword(e.target.value)}
                    />
                    <button type="submit" className="btn-search-submit">搜索</button>  
                    {searchResults !== null && <button type="button" className="btn-search-submit"  onClick={clearSearch}>清除</button>}
                </form>
                <div className="export-buttons">
                    <button onClick={() => handleExport('txt')}>导出TXT</button>
                    <button onClick={() => handleExport('json')}>导出JSON</button>
                </div>
            </div>
            {conversationId.startsWith('private_') && (
                <div className="voice-call-btn">
                    <button className="btn-voice-call" onClick={startCall} disabled={callState !== 'idle'}>
                        📞 语音通话
                    </button>
                </div>
            )}
            {conversationId.startsWith('group_') && (
                <div className="voice-call-btn">
                    <button className="btn-voice-call"  onClick={() => setShowGroupPanel(true)}>👥 管理</button>
                </div>

            )}
            <div className="message-list" onScroll={handleScroll}>
                {searchLoading && <div className="loading">搜索中...</div>}

                {/* 搜索模式：searchResults 不为 null 表示已执行搜索 */}
                {searchResults !== null ? (
                    searchResults.length === 0 ? (
                        <div className="empty-search">未找到相关消息</div>
                    ) : (
                        searchResults.map((msg, i) => (
                            <div
                                key={msg.message_id || i}
                                className={`message-item ${msg.sender?.id === user.id ? 'my-message' : ''}`} onContextMenu={(e) => handleContextMenu(e, msg)}
                            >
                                <strong>{msg.sender?.nickname || '未知'}:</strong>
                                {renderContent(msg)}
                            </div>
                        ))
                    )
                ) : (
                    /* 正常模式：显示所有消息，支持上滑加载更多 */
                    <>
                        {loading && <div className="loading">加载中...</div>}
                        {messages.map((msg, i) => (
                            <div
                                key={msg.message_id || msg.id || i}
                                className={`message-item ${msg.sender?.id === user.id ? 'my-message' : ''}`}
                                onContextMenu={(e) => handleContextMenu(e, msg)}   // 

                            >
                                <strong>{msg.sender?.nickname || msg.sender_id}:</strong>
                                {renderContent(msg)}
                            </div>
                        ))}
                    </>
                )}

                <div ref={bottomRef} />
            </div>
            <div className="message-input">
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                    placeholder="输入消息..."
                />
                <button onClick={sendMessage}>发送</button>
                {/* 表情按钮 */}
                <button onClick={() => { setShowEmojiPicker(!showEmojiPicker); setShowStickerPanel(false); }} title="表情">
                    😀
                </button>

                {/* 贴图按钮 */}
                <button onClick={() => { setShowStickerPanel(!showStickerPanel); setShowEmojiPicker(false); }} title="贴图">
                    🧩
                </button>
                <button onClick={() => fileInputRef.current.click()} title="发送图片">
                    📷
                </button>
                <input
                    type="file"
                    ref={fileInputRef}
                    style={{ display: 'none' }}
                    accept="image/*"
                    onChange={handleImageSelect}
                />
                {recording ? (
                    <button onClick={stopRecording} title="停止录音">
                        ⏹️ 停止
                    </button>
                ) : (
                    <button onClick={startRecording} title="发送语音">
                        🎤
                    </button>
                )}
            </div>
            {/* 通话悬浮卡片 */}
            <VoiceCallUI
                callState={callState}
                caller={callerInfo}
                onAccept={acceptCall}
                onReject={rejectCall}
                onHangup={hangup}
                onDismiss={dismiss}
                remoteStream={remoteStream}
            />

            {contextMenu && (
                <div className="context-menu-overlay" onClick={closeContextMenu}>
                    <ul
                        className="context-menu"
                        onClick={(e) => e.stopPropagation()}
                        style={{ position: 'fixed', top: contextMenu.y, left: contextMenu.x }}
                    >
                        <li className="context-menu-item revoke" onClick={handleRevoke}>撤回</li>
                        <li className="context-menu-item" onClick={closeContextMenu}>取消</li>
                    </ul>
                </div>
            )}
            {showEmojiPicker && (
                <div style={{ position: 'absolute', bottom: '60px', right: '20px', zIndex: 10 }}>
                    <EmojiPicker onEmojiClick={handleEmojiSelect} />
                </div>
            )}

            {/* 贴图面板 */}
            {showStickerPanel && (
                <div className="sticker-panel">
                    {STICKERS.map((sticker) => (
                        <img
                            key={sticker.id}
                            src={sticker.url}
                            alt="sticker"
                            style={{ width: 60, height: 60, cursor: 'pointer', margin: '4px' }}
                            onClick={() => sendSticker(sticker.url)}
                        />
                    ))}
                </div>
            )}
            {showGroupPanel && (
                <GroupInfoPanel
                    groupId={parseInt(conversationId.split('_')[1])}
                    onClose={() => setShowGroupPanel(false)}
                />
            )}
        </div>
    );
}

export default ChatWindow;