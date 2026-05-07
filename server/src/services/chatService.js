const { Op } = require('sequelize');
const {
    Conversation,
    Message,
    ConversationParticipant,
    User,
    Group,
    GroupMember,
} = require('../models');
const { getIO } = require('../socket');

async function searchMessages(conversationId, keyword, limit = 20, beforeId) {
    const where = {
        conversation_id: conversationId,
        message_type: 'text',
        content: { [Op.like]: `%${keyword}%` }
    };
    if (beforeId) {
        where.id = { [Op.lt]: beforeId };
    }
    const messages = await Message.findAll({
        where,
        order: [['id', 'DESC']],
        limit: Math.min(limit, 50),
        include: [{ model: User, as: 'Sender', attributes: ['id', 'nickname', 'avatar'] }]
    });
    return messages.reverse().map(msg => ({
        message_id: msg.id,
        conversation_id: msg.conversation_id,
        sender: msg.Sender ? {
            id: msg.Sender.id,
            nickname: msg.Sender.nickname,
            avatar: msg.Sender.avatar,
        } : null,
        message_type: msg.message_type,
        content: msg.content,
        created_at: msg.createdAt,
    }));
}

// 获取或创建单聊会话
async function getOrCreatePrivateConversation(userId1, userId2) {
    const sorted = [userId1, userId2].sort((a, b) => a - b);
    const convId = `private_${sorted[0]}_${sorted[1]}`;

    let conversation = await Conversation.findByPk(convId);
    if (!conversation) {
        conversation = await Conversation.create({
            id: convId,
            type: 'private',
            user1_id: sorted[0],
            user2_id: sorted[1],
        });

        await ConversationParticipant.bulkCreate([
            { user_id: sorted[0], conversation_id: convId, last_read_at: new Date() },
            { user_id: sorted[1], conversation_id: convId, last_read_at: new Date() },
        ]);

        // --------- 分别向双方推送，携带对方信息 ---------
        const io = getIO();
        const user1 = await User.findByPk(sorted[0], { attributes: ['nickname', 'avatar'] });
        const user2 = await User.findByPk(sorted[1], { attributes: ['nickname', 'avatar'] });

        const now = new Date();

        // 推送给用户1（显示用户2的名字）
        io.to(`user:${sorted[0]}`).emit('new_conversation', {
            id: convId,
            type: 'private',
            name: user2.nickname,    // 对方的名字
            avatar: user2.avatar,
            last_message: null,
            unread_count: 0,
            updated_at: now,
        });

        // 推送给用户2（显示用户1的名字）
        io.to(`user:${sorted[1]}`).emit('new_conversation', {
            id: convId,
            type: 'private',
            name: user1.nickname,
            avatar: user1.avatar,
            last_message: null,
            unread_count: 0,
            updated_at: now,
        });
    }

    return conversation;
}

// 创建群聊（包括群组、会话、添加成员）
async function createGroupConversation(name, ownerId, memberIds) {
    // 创建群组
    const group = await Group.create({ name, owner_id: ownerId });
    // 会话 ID = group_群ID
    const convId = `group_${group.id}`;
    const conversation = await Conversation.create({
        id: convId,
        type: 'group',
        group_id: group.id,
    });

    // 群主加入
    await GroupMember.create({ group_id: group.id, user_id: ownerId, role: 'owner' });
    await ConversationParticipant.create({ user_id: ownerId, conversation_id: convId });

    // 其他成员加入
    for (const uid of memberIds) {
        if (uid === ownerId) continue;
        await GroupMember.create({ group_id: group.id, user_id: uid, role: 'member' });
        await ConversationParticipant.create({ user_id: uid, conversation_id: convId });
    }

    // 通知所有成员新群创建，携带完整会话信息
    const io = getIO();
    const convData = {
        id: convId,
        type: 'group',
        name: group.name,                    // 群名称
        avatar: group.avatar || '',          // 群头像
        last_message: null,
        unread_count: 0,
        updated_at: conversation.createdAt,  // 使用驼峰访问 Sequelize 实例属性
    };

    for (const uid of [ownerId, ...memberIds]) {
        io.to(`user:${uid}`).emit('new_conversation', convData);
    }

    return { group, conversation };
}

// 发送消息
async function sendMessage(conversationId, senderId, messageType, content) {
    // 校验会话存在
    const conversation = await Conversation.findByPk(conversationId);
    if (!conversation) throw new Error('会话不存在');

    // 校验权限：单聊需是参与者，群聊需是群成员
    if (conversation.type === 'private') {
        if (conversation.user1_id !== senderId && conversation.user2_id !== senderId) {
            throw new Error('无权限');
        }
    } else {
        // 检查群成员

        const member = await GroupMember.findOne({
            where: { group_id: conversation.group_id, user_id: senderId },
        });
        if (!member) throw new Error('你不在群聊中');
    }

    // 对于 image/audio，验证 content 是否为合法 JSON 且包含 url
    if (['image', 'audio'].includes(messageType)) {
        try {
            const parsed = JSON.parse(content);
            if (!parsed.url) throw new Error('缺少 url');
            // 可进一步校验 url 是否为本站上传路径或合法 http(s) 路径
        } catch (e) {
            throw new Error('图片/语音消息的 content 必须为 JSON 格式且包含 url 字段');
        }
    }

    // 存储消息
    const message = await Message.create({
        conversation_id: conversationId,
        sender_id: senderId,
        message_type: messageType,
        content,
    });

    // 更新会话最后消息
    await conversation.update({
        last_message: {
            message_id: message.id,
            sender_id: senderId,
            message_type: messageType,
            content: message.content,
            created_at: message.createdAt,
        },
        updated_at: new Date(),
    });
    // 获取推送目标用户列表
    const participants = await ConversationParticipant.findAll({
        where: { conversation_id: conversationId },
    });
    const userIds = participants.map(p => p.user_id);

    // 组装推送数据（包含发送者昵称）
    const sender = await User.findByPk(senderId, { attributes: ['id', 'nickname', 'avatar'] });
    const pushData = {
        message_id: message.id,
        conversation_id: conversationId,
        sender: {
            id: sender.id,
            nickname: sender.nickname,
            avatar: sender.avatar,
        },
        message_type: messageType,
        content: message.content,
        status: message.status,
        created_at: message.createdAt,
    };

    // 向会话内所有在线用户推送（包括发送者自己，确保多端同步）
    const io = getIO();
    userIds.forEach(uid => {
        io.to(`user:${uid}`).emit('new_message', pushData);
    });

    return pushData;  // 返回完整消息数据，便于前端 ACK
}

// 分页拉取历史消息
async function getMessages(conversationId, beforeId, limit = 30) {
    const where = { conversation_id: conversationId };
    if (beforeId) {
        where.id = { [Op.lt]: beforeId };
    }
    const messages = await Message.findAll({
        where,
        order: [['id', 'DESC']],
        limit: Math.min(limit, 50),
        include: [{ model: User, as: 'Sender', attributes: ['id', 'nickname', 'avatar'] }],
    });

    // 转换为与 WebSocket 推送一致的格式
    return messages.reverse().map(msg => ({
        message_id: msg.id,
        conversation_id: msg.conversation_id,
        sender: msg.Sender ? {
            id: msg.Sender.id,
            nickname: msg.Sender.nickname,
            avatar: msg.Sender.avatar,
        } : null,   // 
        message_type: msg.message_type,
        content: msg.content,
        status: msg.status,
        created_at: msg.createdAt,
    }));
}

// 获取用户会话列表（按最后消息时间降序）
async function getUserConversations(userId) {
    // 查询所有参与的会话
    const participants = await ConversationParticipant.findAll({
        where: { user_id: userId },
        include: [{
            model: Conversation,
            required: true,
            attributes: ['id', 'type', 'group_id', 'user1_id', 'user2_id', 'last_message', 'updated_at']
        }],
    });

    // 手动排序
    const conversations = participants
        .map(p => p.Conversation)
        .filter(c => c !== null)
        .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));

    // 附加未读数、会话名称/头像
    const result = [];
    for (const conv of conversations) {
        const unreadCount = await getUnreadCount(userId, conv.id);
        let name = '';
        let avatar = '';
        if (conv.type === 'private') {
            const otherId = conv.user1_id === userId ? conv.user2_id : conv.user1_id;
            const otherUser = await User.findByPk(otherId, { attributes: ['nickname', 'avatar'] });
            name = otherUser?.nickname || '未知';
            avatar = otherUser?.avatar || '';
        } else {
            const group = await Group.findByPk(conv.group_id);
            name = group?.name || '群聊';
            avatar = group?.avatar || '';
        }
        result.push({
            id: conv.id,
            type: conv.type,
            name,
            avatar,
            last_message: conv.last_message,
            unread_count: unreadCount,
            updated_at: conv.updated_at,
        });
    }
    return result;
}

// 计算未读数（消息数 - 最后已读时间前的消息数）
async function getUnreadCount(userId, conversationId) {
    const participant = await ConversationParticipant.findOne({
        where: { user_id: userId, conversation_id: conversationId },
    });
    if (!participant) return 0;
    const count = await Message.count({
        where: {
            conversation_id: conversationId,
            created_at: { [Op.gt]: participant.last_read_at },
        },
    });
    return count;
}

// 更新已读时间
async function markRead(userId, conversationId) {
    await ConversationParticipant.update(
        { last_read_at: new Date() },
        { where: { user_id: userId, conversation_id: conversationId } }
    );

    // 推送已读事件给当前用户，通知侧边栏更新
    const io = getIO();
    io.to(`user:${userId}`).emit('conversation_read', {
        conversation_id: conversationId,
    });
}

async function revokeMessage(conversationId, messageId, userId) {
    const message = await Message.findByPk(messageId);
    if (!message) throw new Error('消息不存在');
    if (message.conversation_id !== conversationId) throw new Error('消息不属于该会话');
    if (message.sender_id !== userId) throw new Error('只能撤回自己发送的消息');
    if (message.status === 1) throw new Error('消息已被撤回');

    // 检查时间限制：2分钟
    const now = new Date();
    const msgTime = new Date(message.createdAt);
    const diffSeconds = (now - msgTime) / 1000;
    if (diffSeconds > 120) throw new Error('超过2分钟的消息无法撤回');

    // 更新状态为撤回
    message.status = 1;
    await message.save();

    // 获取发送者信息（用于推送）
    const sender = await User.findByPk(userId, { attributes: ['id', 'nickname'] });

    // 向会话内所有参与者推送撤回事件
    const io = getIO();
    const participants = await ConversationParticipant.findAll({
        where: { conversation_id: conversationId }
    });
    const userIds = participants.map(p => p.user_id);

    const payload = {
        message_id: message.id,
        conversation_id: conversationId,
        status: 1,
    };
    userIds.forEach(uid => {
        io.to(`user:${uid}`).emit('message_revoked', payload);
    });

    return { success: true };
}
module.exports = {
    getOrCreatePrivateConversation,
    createGroupConversation,
    sendMessage,
    getMessages,
    getUserConversations,
    markRead,
    searchMessages,
    revokeMessage
};