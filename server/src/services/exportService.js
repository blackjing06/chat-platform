const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { Conversation, Message, User, Group } = require('../models');
const { Op } = require('sequelize');

const EXPORT_DIR = path.join(__dirname, '..', '..', 'exports');
// 令牌存储：key = filename, value = { conversationId, userId, expiresAt }
const downloadTokens = new Map();

// 确保目录存在
(async () => {
    try { await fs.mkdir(EXPORT_DIR, { recursive: true }); } catch { }
})();

async function exportConversation(conversationId, userId, options = {}) {
    const { format = 'json', start_time, end_time } = options;

    // 查询消息（最多 10000 条）
    const where = { conversation_id: conversationId };
    if (start_time || end_time) {
        where.created_at = {};
        if (start_time) where.created_at[Op.gte] = new Date(start_time);
        if (end_time) where.created_at[Op.lte] = new Date(end_time);
    }
    const messages = await Message.findAll({
        where,
        order: [['id', 'ASC']],
        include: [{ model: User, as: 'Sender', attributes: ['id', 'nickname'] }],
        limit: 10000,
    });

    if (messages.length === 0) throw new Error('没有可导出的消息');

    // 生成文件名（使用 UUID 避免敏感信息）
    const token = uuidv4();
    const filename = `export_${token}.${format}`;
    const filepath = path.join(EXPORT_DIR, filename);

    // 获取会话信息
    const conv = await Conversation.findByPk(conversationId);
    let chatName = '';
    if (conv.type === 'private') {
        const otherId = conv.user1_id === userId ? conv.user2_id : conv.user1_id;
        const otherUser = await User.findByPk(otherId, { attributes: ['nickname'] });
        chatName = otherUser?.nickname || '好友';
    } else {
        const group = await Group.findByPk(conv.group_id, { attributes: ['name'] });
        chatName = group?.name || '群聊';
    }

    if (format === 'json') {
        const data = {
            chat: chatName,
            exported_by: userId,
            exported_at: new Date().toISOString(),
            messages: messages.map(m => ({
                sender: m.Sender ? m.Sender.nickname : '未知',
                type: m.message_type,
                content: m.content,
                time: m.createdAt,
            })),
        };
        await fs.writeFile(filepath, JSON.stringify(data, null, 2), 'utf8');
    } else { // txt
        let text = `与 ${chatName} 的聊天记录\n导出时间：${new Date().toLocaleString()}\n\n`;
        for (const m of messages) {
            const time = new Date(m.createdAt).toLocaleString();
            const sender = m.Sender ? m.Sender.nickname : '未知';
            let content = m.content;
            if (m.message_type === 'image') {
                try { const p = JSON.parse(m.content); content = `[图片] ${p.url}`; } catch { content = '[图片]'; }
            } else if (m.message_type === 'audio') {
                try { const p = JSON.parse(m.content); content = `[音频] ${p.url}`; } catch { content = '[音频]'; }
            }
            text += `[${time}] ${sender}: ${content}\n`;
        }
        await fs.writeFile(filepath, text, 'utf8');
    }

    // 记录令牌，1小时后过期
    downloadTokens.set(filename, {
        conversationId,
        userId,
        expiresAt: Date.now() + 3600000,
    });

    return {
        filename,
        url: `/download/exports/${filename}`,
    };
}

function getTokenRecord(filename) {
    const rec = downloadTokens.get(filename);
    if (rec && rec.expiresAt > Date.now()) return rec;
    if (rec) downloadTokens.delete(filename); // 清理过期
    return null;
}

// 定时清理过期文件和令牌（每30分钟）
setInterval(async () => {
    const now = Date.now();
    for (const [filename, rec] of downloadTokens.entries()) {
        if (rec.expiresAt < now) {
            downloadTokens.delete(filename);
            try {
                await fs.unlink(path.join(EXPORT_DIR, filename));
            } catch { }
        }
    }
}, 1800000);

module.exports = {
    exportConversation,
    getTokenRecord,
};