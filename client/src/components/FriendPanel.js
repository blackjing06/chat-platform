import React, { useState, useEffect, useCallback } from 'react';
import api from '../api';
import { useSocket } from '../context/SocketContext';
import GroupTree from './friends/GroupTree';
import AddFriend from './friends/AddFriend';
import FriendRequests from './friends/FriendRequests';
import SentRequests from './friends/SentRequests';

function FriendPanel() {
  const [activeSection, setActiveSection] = useState('list'); // 'list' | 'add' | 'requests' | 'sent'
  const socket = useSocket();

  // 监听实时通知，用于更新列表
  const refreshFriends = useCallback(() => {
    // 触发 GroupTree 内部的重新加载，通过传递 refreshTrigger
  }, []);

  // 刷新触发器
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!socket) return;
    const handler = (notif) => {
      // 任何影响好友列表的通知都刷新
      if (['friend_request', 'friend_accepted', 'friend_deleted'].includes(notif.type)) {
        setRefreshKey(prev => prev + 1);
      }
    };
    socket.on('notification', handler);
    return () => socket.off('notification', handler);
  }, [socket]);

  return (
    <div className="friend-panel">
      <div className="friend-tabs">
        <button onClick={() => setActiveSection('list')} className={activeSection === 'list' ? 'active' : ''}>好友列表</button>
        <button onClick={() => setActiveSection('add')} className={activeSection === 'add' ? 'active' : ''}>添加好友</button>
        <button onClick={() => setActiveSection('requests')} className={activeSection === 'requests' ? 'active' : ''}>好友请求</button>
        <button onClick={() => setActiveSection('sent')} className={activeSection === 'sent' ? 'active' : ''}>已发送</button>
      </div>

      <div className="friend-content">
        {activeSection === 'list' && <GroupTree refreshKey={refreshKey} />}
        {activeSection === 'add' && <AddFriend />}
        {activeSection === 'requests' && <FriendRequests onRefresh={() => setRefreshKey(k => k + 1)} />}
        {activeSection === 'sent' && <SentRequests />}
      </div>
    </div>
  );
}

export default FriendPanel;