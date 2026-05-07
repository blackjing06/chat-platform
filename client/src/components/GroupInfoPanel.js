import React, { useEffect, useState } from 'react';
import api from '../api';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import InviteMemberModal from './InviteMemberModal';

function GroupInfoPanel({ groupId, onClose }) {
    const { user } = useAuth();
    const socket = useSocket();
    const [members, setMembers] = useState([]);
    const [groupName, setGroupName] = useState('');
    const [announcement, setAnnouncement] = useState('');
    const [editName, setEditName] = useState(false);
    const [editAnn, setEditAnn] = useState(false);
    const [loading, setLoading] = useState(false);
    const [showInviteModal, setShowInviteModal] = useState(false);

    const loadData = async () => {
        try {
            const [membersRes, groupInfoRes] = await Promise.all([
                api.get(`/group-admin/${groupId}/members`),
                api.get(`/group-admin/${groupId}/info`),   // 使用新接口
            ]);
            setMembers(membersRes.data);
            const groupInfo = groupInfoRes.data;
            setGroupName(groupInfo.name);
            setAnnouncement(groupInfo.announcement || '');
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => { loadData(); }, [groupId]);

    // 监听群更新
    useEffect(() => {
        if (!socket) return;
        const handler = (data) => {
            if (data.group_id === groupId) {
                setGroupName(data.group.name);
                setAnnouncement(data.group.announcement);
                // 重新拉取成员
                loadData();
            }
        };
        socket.on('group_updated', handler);
        return () => socket.off('group_updated', handler);
    }, [socket, groupId]);

    const currentRole = members.find(m => Number(m.user_id) === Number(user.id))?.role;
    const handleKick = async (userId) => {
        if (!window.confirm('确定移除此成员？')) return;
        try {
            await api.delete(`/group-admin/${groupId}/members/${userId}`);
            setMembers(prev => prev.filter(m => m.user_id !== userId));
        } catch (err) { alert(err.response?.data?.error); }
    };

    const handleToggleAdmin = async (userId, isAdmin) => {
        try {
            await api.put(`/group-admin/${groupId}/admin/${userId}`, { isAdmin });
            loadData();
        } catch (err) { alert(err.response?.data?.error); }
    };

    const handleInviteSuccess = () => {
        loadData(); // 邀请成功后刷新成员列表
    };

    const handleTransfer = async (newOwnerId) => {
        if (!window.confirm('确认转让群主？你将变为管理员。')) return;
        try {
            await api.put(`/group-admin/${groupId}/transfer/${newOwnerId}`)
;
            loadData();
            onClose(); // 转让后关闭面板或刷新
        } catch (err) { alert(err.response?.data?.error); }
    };

    const handleUpdateName = async () => {
        try {
            await api.put(`/group-admin/${groupId}/name`, { name: groupName });
            setEditName(false);
        } catch (err) { alert(err.response?.data?.error); }
    };

    const handleUpdateAnn = async () => {
        try {
            await api.put(`/group-admin/${groupId}/announcement`, { announcement });
            setEditAnn(false);
        } catch (err) { alert(err.response?.data?.error); }
    };

    const handleLeave = async () => {
        if (!window.confirm('确定退出群聊？')) return;
        try {
            await api.post(`/group-admin/${groupId}/leave`);
            onClose(); // 关闭面板
            // 侧边栏会自动通过 kicked_from_group 事件移除该会话
        } catch (err) {
            alert(err.response?.data?.error || '退出失败');
        }
    };

    return (
        <div className="modal-overlay">
            <div className="modal group-info-modal">
                <div className="modal-header">
                    <h3>群信息</h3>
                    <button className="close-btn" onClick={onClose}>×</button>
                </div>

                <div className="group-info-section">
                    <label>群名称</label>
                    {editName ? (
                        <div className="edit-field">
                            <input value={groupName} onChange={e => setGroupName(e.target.value)} />
                            <button className="btn-save" onClick={handleUpdateName}>保存</button>
                        </div>
                    ) : (
                        <div className="info-row" onClick={() => currentRole !== 'member' && setEditName(true)}>
                            <span>{groupName}</span>
                            {currentRole !== 'member' && <span className="edit-icon">✏️</span>}
                        </div>
                    )}
                </div>

                <div className="group-info-section">
                    <label>群公告</label>
                    {editAnn ? (
                        <div className="edit-field">
                            <textarea value={announcement} onChange={e => setAnnouncement(e.target.value)} rows="2" />
                            <button className="btn-save" onClick={handleUpdateAnn}>保存</button>
                        </div>
                    ) : (
                        <div className="info-row" onClick={() => currentRole !== 'member' && setEditAnn(true)}>
                            <span>{announcement || '(暂无公告)'}</span>
                            {currentRole !== 'member' && <span className="edit-icon">✏️</span>}
                        </div>
                    )}
                </div>
                <div className="group-info-section">
                    {currentRole !== 'owner' ? (
                        <button onClick={handleLeave} className="btn-icon btn-kick" >退出群聊</button>
                    ) : (
                        <p className="hint-text">群主无法直接退出，请先转让群主</p>
                    )}
                </div>
                <div className="member-section">
                    <h4>成员列表 ({members.length})</h4>
                    <button onClick={() => setShowInviteModal(true)} className="btn-icon btn-transfer">+ 邀请</button>
                    <ul className="member-list">
                        {members.map(m => (
                            <li key={m.user_id} className="member-item">
                                <img src={m.User?.avatar || '/default-avatar.png'} className="avatar-small" alt="头像" />
                                <div className="member-info">
                                    <span className="member-name">{m.User?.nickname}</span>
                                    <span className={`role-badge role-${m.role}`}>
                                        {m.role === 'owner' ? '群主' : m.role === 'admin' ? '管理员' : '成员'}
                                    </span>
                                </div>
                                <div className="member-actions">
                                    {((currentRole === 'owner' && m.role !== 'owner' && Number(m.user_id) !== Number(user.id)) ||
                                        (currentRole === 'admin' && m.role === 'member')) && (
                                            <button className="btn-icon btn-kick" onClick={() => handleKick(m.user_id)}>移出</button>
                                        )}
                                    {currentRole === 'owner' && m.role === 'member' && (
                                        <button className="btn-icon btn-make-admin" onClick={() => handleToggleAdmin(m.user_id, true)}>升管理</button>
                                    )}
                                    {currentRole === 'owner' && m.role === 'admin' && (
                                        <button className="btn-icon btn-demote" onClick={() => handleToggleAdmin(m.user_id, false)}>降级</button>
                                    )}
                                    {currentRole === 'owner' && m.role !== 'owner' && (
                                        <button className="btn-icon btn-transfer" onClick={() => handleTransfer(m.user_id)}>转让</button>
                                    )}
                                </div>
                            </li>
                        ))}
                        {showInviteModal && (
                            <InviteMemberModal
                                groupId={groupId}
                                onClose={() => setShowInviteModal(false)}
                                onInvited={handleInviteSuccess}
                            />
                        )}
                    </ul>

                </div>
            </div>
        </div>
    );
}

export default GroupInfoPanel;