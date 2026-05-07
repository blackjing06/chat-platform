import React, { useEffect, useState } from 'react';
import api from '../../api';
import FriendItem from './FriendItem';

function GroupTree({ refreshKey }) {
  const [groups, setGroups] = useState([]);
  const [newGroupName, setNewGroupName] = useState('');

  useEffect(() => {
    loadGroups();
  }, [refreshKey]);

  const loadGroups = async () => {
    try {
      const res = await api.get('/groups');
      const groupsData = res.data;
      // 获取每个分组下的好友
      const groupsWithFriends = await Promise.all(
        groupsData.map(async (group) => {
          const friendsRes = await api.get(`/friends?group_id=${group.id}`);
          return { ...group, friends: friendsRes.data };
        })
      );
      setGroups(groupsWithFriends);
    } catch (err) {
      console.error('加载分组失败', err);
    }
  };

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) return;
    try {
      await api.post('/groups', { name: newGroupName });
      setNewGroupName('');
      loadGroups();
    } catch (err) {
      alert(err.response?.data?.error || '创建失败');
    }
  };

  const handleDeleteGroup = async (groupId) => {
    if (!window.confirm('删除分组会将好友移到默认分组，确定？')) return;
    try {
      await api.delete(`/groups/${groupId}`);
      loadGroups();
    } catch (err) {
      alert(err.response?.data?.error || '删除失败');
    }
  };

  const handleRenameGroup = async (groupId, newName) => {
    const name = prompt('新分组名：');
    if (!name) return;
    try {
      await api.put(`/groups/${groupId}`, { name });
      loadGroups();
    } catch (err) {
      alert(err.response?.data?.error || '重命名失败');
    }
  };

  const handleMoveFriend = async (friendshipId, newGroupId) => {
    try {
      await api.put(`/friends/${friendshipId}/move`, { group_id: newGroupId });
      loadGroups();
    } catch (err) {
      alert('移动失败');
    }
  };

  const handleDeleteFriend = async (friendshipId) => {
    if (!window.confirm('确定删除该好友？')) return;
    try {
      await api.delete(`/friends/${friendshipId}`);
      loadGroups();
    } catch (err) {
      alert('删除失败');
    }
  };

  return (
    <div className="group-tree">
          <div className="create-group">
              <input
                  value={newGroupName}
                  onChange={e => setNewGroupName(e.target.value)}
                  placeholder="新分组名称"
              />
              <button className="btn-create-group" onClick={handleCreateGroup}>创建分组</button>
          </div>
      {groups.map(group => (
        <div key={group.id} className="group-block">
          <div className="group-header">
            <strong>{group.name}</strong>
            {group.name !== '我的好友' && (
              <span>
                <button onClick={() => handleRenameGroup(group.id)}>重命名</button>
                <button onClick={() => handleDeleteGroup(group.id)}>删除</button>
              </span>
            )}
          </div>
          <ul className="friend-list">
            {group.friends.map(f => (
              <FriendItem
                key={f.id}
                friendship={f}
                groups={groups}
                onMove={handleMoveFriend}
                onDelete={handleDeleteFriend}
              />
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

export default GroupTree;