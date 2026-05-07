import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../api';
import { useSocket } from '../context/SocketContext';
import CreateGroupModal from './CreateGroupModal';

const getPreview = (conv) => {
    const lm = conv.last_message;
    if (!lm) return '';
    if (lm.message_type === 'image') return '[图片]';
    if (lm.message_type === 'audio') return '[语音]';
    // 文本消息截取前 25 个字符
    return (lm.content || '').substring(0, 25);
};
function Sidebar({ activeTab, setActiveTab }) {
    const navigate = useNavigate();
    const location = useLocation();
    const [conversations, setConversations] = useState([]);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const socket = useSocket();

    // 从路径中提取当前活跃的会话ID，例如 /chat/conversation/private_1_2
    const match = location.pathname.match(/\/chat\/conversation\/(.+)/);
    const activeConvId = match ? match[1] : null;

    const loadConversations = async () => {
        try {
            const res = await api.get('/conversations');
            console.log(res.data);
            const sorted = res.data.sort(
                (a, b) => new Date(b.updated_at) - new Date(a.updated_at)
            );
            setConversations(sorted);
        } catch (err) {
            console.error('加载会话列表失败', err);
        }
    };

    // 初次加载
    useEffect(() => {
        loadConversations();
    }, []);

    // 监听新消息，更新最后消息与未读数（当前活跃会话不增加未读）
    useEffect(() => {
        if (!socket) return;

        const handler = (msg) => {
            setConversations((prev) => {
                // 找到要更新的会话索引
                const targetIndex = prev.findIndex((c) => c.id === msg.conversation_id);
                if (targetIndex === -1) return prev;

                // 创建一个新的会话对象，更新最后消息和时间
                const updatedConv = {
                    ...prev[targetIndex],
                    last_message: {
                        message_id: msg.message_id,
                        sender_id: msg.sender.id,
                        message_type: msg.message_type,
                        content: msg.content,
                        created_at: msg.created_at,
                    },
                    unread_count: (msg.conversation_id === activeConvId) ? prev[targetIndex].unread_count : prev[targetIndex].unread_count + 1,
                    updated_at: msg.created_at,
                };

                // 将更新的会话放到数组最前面，其余保持不变（但移除旧的会话位置）
                const newConversations = [
                    updatedConv,
                    ...prev.slice(0, targetIndex),
                    ...prev.slice(targetIndex + 1)
                ];

                // 如果原本就在最前面（索引为0），就不需要重新排序
                if (targetIndex === 0) {
                    return newConversations; // 已置顶，只需更新最后消息
                }
                return newConversations;
            });
        };

        socket.on('new_message', handler);
        return () => socket.off('new_message', handler);
    }, [socket, activeConvId]);

    // 监听已读事件，清零对应会话未读数
    useEffect(() => {
        if (!socket) return;

        const handleRead = (data) => {
            setConversations((prev) =>
                prev.map((conv) => {
                    if (conv.id === data.conversation_id) {
                        return { ...conv, unread_count: 0 };
                    }
                    return conv;
                })
            );
        };

        socket.on('conversation_read', handleRead);
        return () => socket.off('conversation_read', handleRead);
    }, [socket]);

    useEffect(() => {
        if (!socket) return;
        const handleKicked = (data) => {
            setConversations(prev => prev.filter(c => c.id !== `group_${data.group_id}`));
            alert('你已被移出群聊');
        };
        socket.on('kicked_from_group', handleKicked);
        return () => socket.off('kicked_from_group', handleKicked);
    }, [socket]);

    useEffect(() => {
        if (!socket) return;

        const handleRevoke = (data) => {
            setConversations((prev) =>
                prev.map((c) => {
                    if (
                        c.id === data.conversation_id &&
                        c.last_message?.message_id === data.message_id
                    ) {
                        return {
                            ...c,
                            last_message: { ...c.last_message, content: '[消息已撤回]' },
                        };
                    }
                    return c;
                })
            );
        };

        socket.on('message_revoked', handleRevoke);
        return () => socket.off('message_revoked', handleRevoke);
    }, [socket]);

    // 监听新会话事件，动态添加会话到列表
    useEffect(() => {
        if (!socket) return;

        const handler = (convData) => {
            const currentUser = JSON.parse(localStorage.getItem('user'));
            const userId = currentUser?.id;

            const newConv = {
                id: convData.id,
                type: convData.type,
                name: convData.name || '未知',       
                avatar: convData.avatar || '',       
                last_message: convData.last_message,
                unread_count: convData.unread_count || 0,
                updated_at: convData.updated_at,
            };

            setConversations((prev) => {
                if (prev.find((c) => c.id === newConv.id)) return prev;
                return [newConv, ...prev].sort(
                    (a, b) => new Date(b.updated_at) - new Date(a.updated_at)
                );
            });
        };

        socket.on('new_conversation', handler);
        return () => socket.off('new_conversation', handler);
    }, [socket]);

    return (
        <aside className="sidebar">
            <div className="sidebar-tabs">
                <button
                    onClick={() => setActiveTab('chats')}
                    className={activeTab === 'chats' ? 'active' : ''}
                >
                    消息
                </button>
                <button
                    onClick={() => {
                        setActiveTab('friends');
                        navigate('/chat/friends');
                    }}
                    className={activeTab === 'friends' ? 'active' : ''}
                >
                    好友
                </button>
            </div>

            {activeTab === 'chats' && (
                <>
                    {/* 创建群聊按钮 */}
                    <div className="sidebar-create-group">
                        <button onClick={() => setShowCreateModal(true)}>+ 创建群聊</button>
                    </div>

                    <ul className="conversation-list">
                        {conversations.map((conv) => (
                            <li
                                key={conv.id}
                                className={conv.id === activeConvId ? 'active' : ''}
                                onClick={() => navigate(`/chat/conversation/${conv.id}`)}
                            >
                                <div className="conv-name">{conv.name}</div>
                                <div className="conv-last-msg">{getPreview(conv)}</div>
                                {conv.unread_count > 0 && <span className="badge">{conv.unread_count}</span>}
                            </li>
                        ))}
                    </ul>

                    {/* 创建群聊模态框 */}
                    {showCreateModal && (
                        <CreateGroupModal
                            onClose={() => setShowCreateModal(false)}
                            onCreated={() => setShowCreateModal(false)}
                        />
                    )}
                </>
            )}
        </aside>
    );
}

export default Sidebar;