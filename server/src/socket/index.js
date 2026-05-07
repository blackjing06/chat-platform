const socketIO = require('socket.io');
const jwt = require('jsonwebtoken');
const { User } = require('../models');

let io = null;

function init(server) {
    io = socketIO(server, {
        cors: {
            origin: '*', 
            methods: ['GET', 'POST']
        }
    });

    // 认证中间件：在客户端连接时验证 token
    io.use(async (socket, next) => {
        const token = socket.handshake.auth.token;
        if (!token) {
            return next(new Error('未提供认证令牌'));
        }
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const user = await User.findByPk(decoded.userId, {
                attributes: ['id', 'username', 'nickname', 'avatar']
            });
            if (!user) {
                return next(new Error('用户不存在'));
            }
            socket.user = user;
            next();
        } catch (err) {
            next(new Error('令牌无效'));
        }
    });

    io.on('connection', (socket) => {
        console.log(`✅ 用户 ${socket.user.nickname} 上线`);
        // 加入个人房间，方便定向推送
        socket.join(`user:${socket.user.id}`);
        const chatService = require('../services/chatService');

        socket.on('message', async (data) => {
            try {
                const { conversation_id, message_type, content } = data;
                const senderId = socket.user.id;

                // 调用服务发送消息
                const msgData = await chatService.sendMessage(
                    conversation_id,
                    senderId,
                    message_type || 'text',
                    content
                );

                // 回复 ACK 给发送者（携带服务端 ID 和时间）
                socket.emit('ack', {
                    localId: data.localId,
                    serverId: msgData.message_id,
                    created_at: msgData.created_at,
                });
            } catch (error) {
                socket.emit('error', { message: error.message });
            }
        });
        

        socket.on('disconnect', () => {
            console.log(`❌ 用户 ${socket.user.nickname} 离线`);
        });

        socket.on('revoke_message', async (data, ack) => {
            try {
                await chatService.revokeMessage(
                    data.conversation_id,
                    data.message_id,
                    socket.user.id
                );
                ack && ack({ success: true });
            } catch (err) {
                ack && ack({ error: err.message });
                socket.emit('error', { message: err.message });
            }
        });
        socket.on('kicked_from_group', (data) => {
            // 仅用于服务端推送，客户端监听
        });
        // 1. 发起通话：向目标用户转发通话邀请
        socket.on('call_offer', (data) => {
            const { toUserId, offer } = data;
            const fromUser = {
                id: socket.user.id,
                nickname: socket.user.nickname,
                avatar: socket.user.avatar,
            };
            // 向被叫用户发送邀请，附带发起者信息和 SDP offer
            io.to(`user:${toUserId}`).emit('call_incoming', {
                from: fromUser,
                offer,
            });
        });

        // 2. 被叫接受通话：将 answer 发送给发起方
        socket.on('call_answer', (data) => {
            const { toUserId, answer } = data;
            io.to(`user:${toUserId}`).emit('call_accepted', {
                answer,
                from: { id: socket.user.id, nickname: socket.user.nickname },
            });
        });

        // 3. ICE 候选交换
        socket.on('ice_candidate', (data) => {
            const { toUserId, candidate } = data;
            io.to(`user:${toUserId}`).emit('ice_candidate', {
                from: socket.user.id,
                candidate,
            });
        });

        // 4. 挂断/拒绝/通话结束
        socket.on('call_hangup', (data) => {
            const { toUserId } = data;
            io.to(`user:${toUserId}`).emit('call_ended', {
                from: socket.user.id,
            });
        });
    });




    return io;
}

function getIO() {
    if (!io) throw new Error('Socket.IO 未初始化');
    return io;
}

module.exports = { init, getIO };