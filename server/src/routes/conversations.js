const express = require('express');
const router = express.Router();
const chatService = require('../services/chatService');

// 获取或创建单聊
router.post('/private', async (req, res, next) => {
    try {
        const { user_id } = req.body;
        const conv = await chatService.getOrCreatePrivateConversation(req.user.id, user_id);
        res.json(conv);
    } catch (err) { next(err); }
});

// 创建群聊
router.post('/group', async (req, res, next) => {
    try {
        const { name, member_ids } = req.body;
        if (!member_ids || !Array.isArray(member_ids)) {
            return res.status(400).json({ error: 'member_ids 为必填数组' });
        }
        const result = await chatService.createGroupConversation(name, req.user.id, member_ids);
        res.status(201).json(result);
    } catch (err) { next(err); }
});

// 获取用户会话列表
router.get('/', async (req, res, next) => {
    try {
        const list = await chatService.getUserConversations(req.user.id);
        res.json(list);
    } catch (err) { next(err); }
});

router.get('/:id/search', async (req, res, next) => {
    try {
        const { keyword, before, limit } = req.query;
        if (!keyword) return res.status(400).json({ error: '关键字不能为空' });
        const messages = await chatService.searchMessages(
            req.params.id,
            keyword,
            limit || 20,
            before
        );
        res.json({ messages });
    } catch (err) {
        next(err);
    }
});

// 获取会话历史消息
router.get('/:id/messages', async (req, res, next) => {
    try {
        const { before, limit } = req.query;
        const messages = await chatService.getMessages(req.params.id, before, limit || 30);
        res.json({ messages });
    } catch (err) { next(err); }
});

// 标记已读
router.post('/:id/read', async (req, res, next) => {
    try {
        await chatService.markRead(req.user.id, req.params.id);
        res.json({ success: true });
    } catch (err) { next(err); }
});

router.delete('/:conversationId/messages/:messageId', async (req, res, next) => {
    try {
        await chatService.revokeMessage(
            req.params.conversationId,
            req.params.messageId,
            req.user.id
        );
        res.json({ success: true });
    } catch (err) {
        next(err);
    }
});
module.exports = router;