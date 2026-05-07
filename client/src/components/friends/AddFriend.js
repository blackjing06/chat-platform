import React, { useState } from 'react';
import api from '../../api';

function AddFriend() {
  const [keyword, setKeyword] = useState('');
  const [results, setResults] = useState([]);
  const [message, setMessage] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('');

  const handleSearch = async () => {
    // 用户接口后端
    try {
      const res = await api.get(`/users/search?keyword=${keyword}`);
      setResults(res.data);
    } catch (err) {
      alert('搜索失败');
    }
  };

  const handleSendRequest = async (friendId) => {
    try {
      // 获取默认分组或选中的分组
      const groupId = selectedGroup || (await api.get('/groups')).data[0]?.id;
      await api.post('/friends/request', {
        friend_id: friendId,
        group_id: groupId,
        message,
      });
      alert('请求已发送');
      setResults([]);
      setMessage('');
    } catch (err) {
      alert(err.response?.data?.error || '发送失败');
    }
  };

  return (
      <div>
          <input
              className="search-input"   
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="用户名 / 昵称"
          />
          <button className="btn btn-search" onClick={handleSearch}>搜索</button>
          <ul className="search-results">
              {results.map(user => (
                  <li key={user.id} className="friend-search-item">
                      <span>{user.nickname} (@{user.username})</span>
                      <button className="btn-add" onClick={() => handleSendRequest(user.id)}>添加</button>
                  </li>
              ))}
          </ul>
          {results.length > 0 && (
              <div className="verify-section">
                  <input
                      className="verify-input"
                      value={message}
                      onChange={e => setMessage(e.target.value)}
                      placeholder="验证信息（可选）"
                  />
                  
              </div>
          )}
      </div>
  );
}

export default AddFriend;