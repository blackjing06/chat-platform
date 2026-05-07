const { io } = require('socket.io-client');
const jwt = require('jsonwebtoken');
require('dotenv').config({ path: 'D:/project/chat-platform/server/.env' });

const SERVER_URL = 'http://localhost:3001';
const JWT_SECRET = process.env.JWT_SECRET;

// 测试 1：有效 token 连接
async function testValidToken() {
  const token = jwt.sign({ userId: 1 }, JWT_SECRET, { expiresIn: '1h' }); // 假设用户ID=1存在
  const socket = io(SERVER_URL, {
    auth: { token },
    transports: ['websocket']
  });

  return new Promise((resolve, reject) => {
    socket.on('connect', () => {
      console.log('✅ TC1 通过：有效 token 连接成功');
      socket.close();
      resolve();
    });
    socket.on('connect_error', (err) => {
      console.error('❌ TC1 失败：', err.message);
      socket.close();
      reject(err);
    });
  });
}

// 测试 2：缺失 token
async function testNoToken() {
  const socket = io(SERVER_URL, {
    auth: {},
    transports: ['websocket']
  });
  return new Promise((resolve, reject) => {
    socket.on('connect', () => {
      console.error('❌ TC2 失败：应拒绝连接');
      socket.close();
      reject(new Error('Connection should be rejected'));
    });
    socket.on('connect_error', (err) => {
      if (err.message.includes('未提供认证令牌')) {
        console.log('✅ TC2 通过：缺失 token 被拒绝');
        resolve();
      } else {
        console.error('❌ TC2 失败，错误信息不匹配:', err.message);
        reject(err);
      }
    });
  });
}

// 测试 3：无效 token（格式错误）
async function testInvalidToken() {
  const socket = io(SERVER_URL, {
    auth: { token: 'this.is.not.a.valid.jwt' },
    transports: ['websocket']
  });
  return new Promise((resolve, reject) => {
    socket.on('connect', () => {
      console.error('❌ TC3 失败：应拒绝连接');
      socket.close();
      reject();
    });
    socket.on('connect_error', (err) => {
      if (err.message.includes('令牌无效')) {
        console.log('✅ TC3 通过：无效 token 被拒绝');
        resolve();
      } else {
        console.error('❌ TC3 失败，错误信息:', err.message);
        reject(err);
      }
    });
  });
}

// 测试 4：过期 token
async function testExpiredToken() {
  const token = jwt.sign({ userId: 1 }, JWT_SECRET, { expiresIn: '0s' }); // 立即过期
  const socket = io(SERVER_URL, {
    auth: { token },
    transports: ['websocket']
  });
  return new Promise((resolve, reject) => {
    socket.on('connect_error', (err) => {
      if (err.message.includes('令牌无效') || err.message.includes('jwt expired')) {
        console.log('✅ TC4 通过：过期 token 被拒绝');
        resolve();
      } else {
        console.error('❌ TC4 失败，错误信息:', err.message);
        reject(err);
      }
    });
  });
}

// 测试 5：用户不存在
async function testUserNotExist() {
  const token = jwt.sign({ userId: 9999 }, JWT_SECRET, { expiresIn: '1h' }); // 数据库中无此ID
  const socket = io(SERVER_URL, {
    auth: { token },
    transports: ['websocket']
  });
  return new Promise((resolve, reject) => {
    socket.on('connect_error', (err) => {
      if (err.message.includes('用户不存在')) {
        console.log('✅ TC5 通过：不存在的用户被拒绝');
        resolve();
      } else {
        console.error('❌ TC5 失败，错误信息:', err.message);
        reject(err);
      }
    });
  });
}

// 依次运行
(async () => {
  try {
    await testValidToken();
    await testNoToken();
    await testInvalidToken();
    await testExpiredToken();
    await testUserNotExist();
    console.log('\n🎉 所有 Socket.IO 认证测试通过！');
  } catch (err) {
    console.error('\n⚠️ 测试未全部通过，请检查后端配置。');
  }
})();