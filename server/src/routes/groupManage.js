const express = require('express');
const router = express.Router();
const groupService = require('../services/groupService');

// 所有接口都需要群成员权限
router.get('/:groupId/members', async (req, res, next) => {
    try {
        const members = await groupService.getMembers(req.params.groupId);
        res.json(members);
    } catch (err) { next(err); }
});

router.put('/:groupId/name', async (req, res, next) => {
    try {
        await groupService.updateGroupName(req.params.groupId, req.user.id, req.body.name);
        res.json({ success: true });
    } catch (err) { next(err); }
});

router.put('/:groupId/announcement', async (req, res, next) => {
    try {
        await groupService.updateAnnouncement(req.params.groupId, req.user.id, req.body.announcement);
        res.json({ success: true });
    } catch (err) { next(err); }
});

router.delete('/:groupId/members/:userId', async (req, res, next) => {
    try {
        await groupService.removeMember(req.params.groupId, req.user.id, parseInt(req.params.userId));
        res.json({ success: true });
    } catch (err) { next(err); }
});

router.put('/:groupId/admin/:userId', async (req, res, next) => {
    try {
        await groupService.setAdmin(req.params.groupId, req.user.id, parseInt(req.params.userId), req.body.isAdmin);
        res.json({ success: true });
    } catch (err) { next(err); }
});

router.put('/:groupId/transfer/:newOwnerId', async (req, res, next) => {
    try {
        await groupService.transferOwner(req.params.groupId, req.user.id, parseInt(req.params.newOwnerId));
        res.json({ success: true });
    } catch (err) { next(err); }
});

// 退出群聊
router.post('/:groupId/leave', async (req, res, next) => {
    try {
        await groupService.leaveGroup(req.params.groupId, req.user.id);
        res.json({ success: true });
    } catch (err) {
        next(err);
    }
});

router.get('/:groupId/info', async (req, res, next) => {
    try {
        const info = await groupService.getGroupInfo(req.params.groupId);
        res.json(info);
    } catch (err) { next(err); }
});

// 邀请成员
router.post('/:groupId/invite', async (req, res, next) => {
    try {
        const { invitee_ids } = req.body;
        if (!invitee_ids || !Array.isArray(invitee_ids) || invitee_ids.length === 0) {
            return res.status(400).json({ error: '请选择要邀请的用户' });
        }
        const result = await groupService.inviteMembers(
            req.params.groupId,
            req.user.id,
            invitee_ids
        );
        res.json(result);
    } catch (err) {
        // 业务错误返回 400，其他错误继续传递给全局错误处理
        if (err.message === '所选用户均已在该群中' || err.message === '你不在群中，无法邀请') {
            return res.status(400).json({ error: err.message });
        }
        next(err);
    }
});
module.exports = router;