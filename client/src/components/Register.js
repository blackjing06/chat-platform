import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api';

function Register() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.post('/auth/register', { username, password, nickname });
      alert('注册成功，请登录');
      navigate('/login');
    } catch (err) {
  // 获取错误信息
  let errorMsg = '注册失败';
  if (err.response) {
    const data = err.response.data;
    if (typeof data === 'string') {
      errorMsg = data;
    } else if (data && typeof data === 'object') {
      // 常见的字段：error, message, msg, errors
      errorMsg = data.error || data.message || data.msg || JSON.stringify(data);
    }
  } else if (err.message) {
    errorMsg = err.message;
  }
  setError(errorMsg);
}
  };

  return (
    <div className="auth-container">
      <form className="auth-form" onSubmit={handleSubmit}>
        <h2>注册</h2>
        {error && <div className="error-message">{error}</div>}
        <input
          type="text"
          placeholder="用户名"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="密码"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <input
          type="text"
          placeholder="昵称"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          required
        />
        <button type="submit">注册</button>
        <div className="auth-link">
          已有账号？<Link to="/login">去登录</Link>
        </div>
      </form>
    </div>
  );
}

export default Register;