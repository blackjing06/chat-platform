import React, { useEffect, useState } from 'react';
import api from '../../api';

function SentRequests() {
  const [sent, setSent] = useState([]);

  const load = async () => {
    const res = await api.get('/friends/requests');
    setSent(res.data.sent);
  };

  useEffect(() => { load(); }, []);

  const handleResend = async (id) => {
    const message = prompt('重新输入验证信息（可选）');
    await api.put(`/friends/request/${id}/resend`, { message });
    load();
  };

  return (
    <div>
      {sent.length === 0 ? <p>没有已发送的请求</p> : sent.map(req => (
          <div className="sent-request-item" key={req.id}>
              发给 <strong>{req.Target?.nickname}</strong>
              <span className="request-status">（状态: {req.status}）</span>
              {req.status === 'rejected' && (
                  <button className="btn-resend" onClick={() => handleResend(req.id)}>重新发送</button>
              )}
          </div>
      ))}
    </div>
  );
}

export default SentRequests;
