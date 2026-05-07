import React, { useState, useEffect } from 'react';
import api from '../api';

function CreateGroupModal({ onClose, onCreated }) {
    const [name, setName] = useState('');
    const [friends, setFriends] = useState([]);
    const [selectedIds, setSelectedIds] = useState([]);
    const [loading, setLoading] = useState(false);

    // 获取好友列表
    useEffect(() => {
        api.get('/friends').then(res => {
            setFriends(res.data); // 假设返回数组，每项包含 Target 信息
        }).catch(console.error);
    }, []);

    const toggleSelect = (friendId) => {
        setSelectedIds(prev =>
            prev.includes(friendId) ? prev.filter(id => id !== friendId) : [...prev, friendId]
        );
    };

    const handleCreate = async () => {
        if (!name.trim()) return alert('请输入群名称');
        if (selectedIds.length === 0) return alert('请至少选择一位好友');
        setLoading(true);
        try {
            await api.post('/conversations/group', {
                name,
                member_ids: selectedIds,
            });
            onCreated?.();
            onClose();
        } catch (err) {
            alert(err.response?.data?.error || '创建失败');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-overlay">
            <div className="modal">
                <h3>创建群聊</h3>
                <input
                    type="text"
                    placeholder="群名称"
                    value={name}
                    onChange={e => setName(e.target.value)}
                />
                <div className="friend-select-list">
                    {friends.map(f => {
                        const friend = f.Target;
                        return (
                            <label key={friend.id} className="friend-checkbox">
                                <input
                                    type="checkbox"
                                    checked={selectedIds.includes(friend.id)}
                                    onChange={() => toggleSelect(friend.id)}
                                />
                                {friend.nickname || friend.username}
                            </label>
                        );
                    })}
                </div>
                <div className="modal-buttons">
                    <button onClick={onClose} disabled={loading}>取消</button>
                    <button onClick={handleCreate} disabled={loading}>
                        {loading ? '创建中...' : '创建'}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default CreateGroupModal;