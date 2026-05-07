import React, { useState } from 'react';
import { Routes, Route, Navigate, useParams } from 'react-router-dom'; // 确保引入 useParams
import Sidebar from './Sidebar';
import ChatWindow from './ChatWindow';
import FriendPanel from './FriendPanel';
import { useAuth } from '../context/AuthContext';
import IncomingCallHandler from './IncomingCallHandler';

// 包装器，从 URL 获取 id 并作为 key 传给 ChatWindow
function ChatWindowWrapper() {
    const { id } = useParams();
    return <ChatWindow key={id} conversationId={id} />;
}

function ChatLayout() {

    const { user, logout } = useAuth();
    const [activeTab, setActiveTab] = useState('chats');

    return (
        <div className="chat-layout">
            <header className="chat-header">
                <div className="header-left">
                    <h1>ChatApp</h1>
                </div>
                <div className="header-right">
                    <span>{user?.nickname}</span>
                    <button onClick={logout}>退出</button>
                </div>
            </header>

            <div className="chat-body">
                <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

                <main className="chat-main">
                    <Routes>
                        <Route path="/" element={
                            <div className="welcome-message">请选择一个对话或联系人</div>
                        } />
                        {/* 使用包装器，每次 id 变化都会创建全新 ChatWindow */}
                        <Route path="conversation/:id" element={<ChatWindowWrapper />} />
                        <Route path="friends" element={<FriendPanel />} />
                        <Route path="*" element={<Navigate to="/chat" />} />
                    </Routes>
                </main>
            </div>
            <IncomingCallHandler />

        </div>
    );
}

export default ChatLayout;