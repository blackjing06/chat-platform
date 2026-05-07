import React, { useEffect, useState } from 'react';
import api from '../../api';

function FriendRequests({ onRefresh }) {
  const [requests, setRequests] = useState([]);

  useEffect(() => {
    api.get('/friends/requests').then(res => setRequests(res.data.received));
  }, []);

  const handleAccept = async (id) => {
    await api.put(`/friends/request/${id}/accept`);
    onRefresh && onRefresh();
    // 重新加载
    setRequests(prev => prev.filter(r => r.id !== id));
  };

  const handleReject = async (id) => {
    await api.put(`/friends/request/${id}/reject`);
    onRefresh && onRefresh();
    setRequests(prev => prev.filter(r => r.id !== id));
  };

  return (
    <div>
      {requests.length === 0 ? <p>无待处理请求</p> : requests.map(req => (
          <div className="request-card" key={req.id}>
              <strong>{req.Requester?.nickname}</strong> 请求加为好友
              <p className="request-message">{req.request_message}</p>
              <div className="request-actions">
                  <button className="btn-accept" onClick={() => handleAccept(req.id)}>同意</button>
                  <button className="btn-reject" onClick={() => handleReject(req.id)}>拒绝</button>
              </div>
          </div>
      ))}
    </div>
  );
}
export default FriendRequests;
