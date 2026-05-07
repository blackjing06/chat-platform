import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api';

function FriendItem({ friendship, groups, onMove, onDelete }) {
    const navigate = useNavigate();
    const friend = friendship.Target;
    const [showMenu, setShowMenu] = useState(false);
    console.log('FriendItem 接收到的 groups:', groups);

    const handleStartChat = async () => {
        try {
            const res = await api.post('/conversations/private', { user_id: friend.id });
            navigate(`/chat/conversation/${res.data.id}`);
        } catch (err) {
            alert('开启聊天失败');
        }
    };

    return (
        <li className="friend-item">
            <img
                src={friend.avatar || '/default-avatar.png'}
                alt=""
                className="avatar-small"
                onError={(e) => {
                    e.target.src = 'default-avatar.png';
                }}
            />
            <span className="friend-nickname">{friend.nickname}</span>
            <button className="btn-chat" onClick={handleStartChat}>发消息</button>
            <div className="menu-container">
                <button className="btn-menu" onClick={() => { console.log('▼ 按钮被点击，当前 showMenu:', showMenu); setShowMenu(!showMenu) }}>▼</button>
                {showMenu && (
                    <div className="context-menu">
                        <div className="menu-title">移动到：</div>
                        {
                            groups
                            .filter(g => g.id !== friendship.group_id)
                            .map(g => (
                                <button key={g.id} className="menu-item" onClick={() => {
                                    console.log('点击移动到分组:', g.name, '分组ID:', g.id, '好友关系ID:', friendship.id);
                                    onMove(friendship.id, g.id);
                                    setShowMenu(false);
                                }}>
                                    {g.name}
                                </button>
                            ))
                        }
                        <hr />
                        <button className="menu-item danger" onClick={() => {
                            console.log('点击删除好友，关系ID:', friendship.id);
                            onDelete(friendship.id);
                            setShowMenu(false);
                        }}>
                            删除好友
                        </button>
                    </div>
                )}

            </div>
        </li>
    );
}

export default FriendItem;