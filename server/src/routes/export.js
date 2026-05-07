const express = require('express');
const router = express.Router();
const path = require('path');
const { authenticate } = require('../middlewares/auth');
const exportService = require('../services/exportService');
const { ConversationParticipant } = require('../models');

// 导出接口
router.post('/conversations/:id/export', authenticate, async (req, res, next) => {
    try {
        const { format, start_time, end_time } = req.body;
        const result = await exportService.exportConversation(
            req.params.id,
            req.user.id,
            { format: format || 'json', start_time, end_time }
        );
        res.json(result);
    } catch (err) {
        next(err);
    }
});

// 下载接口（鉴权）
router.get('/download/exports/:filename', authenticate, async (req, res, next) => {
    try {
        const filename = req.params.filename;
        const record = exportService.getTokenRecord(filename);
        if (!record) return res.status(404).json({ error: '文件不存在或已过期' });

        // 检查是否为导出者本人或会话参与者
        if (record.userId !== req.user.id) {
            const isParticipant = await ConversationParticipant.findOne({
                where: { user_id: req.user.id, conversation_id: record.conversationId }
            });
            if (!isParticipant) return res.status(403).json({ error: '无权下载' });
        }

        const filepath = path.join(__dirname, '..', '..', 'exports', filename);
        res.download(filepath, filename);
    } catch (err) {
        next(err);
    }
});

module.exports = router;