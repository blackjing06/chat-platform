import React, { useEffect, useState } from 'react';
import api from '../api';

function InviteMemberModal({ groupId, onClose, onInvited }) {
    const [friends, setFriends] = useState([]);
    const [selectedIds, setSelectedIds] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        // 获取当前用户的所有好友
        api.get('/friends').then(res => {
            // res.data 是 Friendship 数组，包含 Target（好友用户信息）
            setFriends(res.data);
        }).catch(console.error);
    }, []);

    const toggleSelect = (userId) => {
        setSelectedIds(prev =>
            prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
        );
    };

    const handleInvite = async () => {
        if (selectedIds.length === 0) {
            alert('请至少选择一位好友');
            return;
        }
        setLoading(true);
        try {
            await api.post(`/group-admin/${groupId}/invite`, { invitee_ids: selectedIds });
            alert('邀请成功');
            onInvited && onInvited();
            onClose();
        } catch (err) {
            alert(err.response?.data?.error || '邀请失败');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-overlay">
            <div className="modal invite-modal">
                <h3>邀请新成员</h3>
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
                                <img src={friend.avatar || '/default-avatar.png'} className="avatar-small" alt="" />
                                <span>{friend.nickname || friend.username}</span>
                            </label>
                        );
                    })}
                    {friends.length === 0 && <p>暂无好友可邀请</p>}
                </div>
                <div className="modal-buttons">
                    <button onClick={onClose} disabled={loading}>取消</button>
                    <button onClick={handleInvite} disabled={loading || selectedIds.length === 0}>
                        {loading ? '邀请中...' : '邀请'}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default InviteMemberModal;