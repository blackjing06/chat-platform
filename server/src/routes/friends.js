const express = require('express');
const router = express.Router();
const friendService = require('../services/friendService');
const { Op } = require('sequelize');

// 发送好友请求 POST /api/v1/friends/request
router.post('/request', async (req, res, next) => {
    try {
        const { friend_id, group_id, message } = req.body;
        const result = await friendService.sendRequest(req.user.id, friend_id, group_id, message);
        res.status(201).json(result);
    } catch (err) {
        // 针对已知的业务错误，返回 400 或 409
        if (err.message.includes('已经是好友') ||
            err.message.includes('已发送') ||
            err.message.includes('用户不存在') ||
            err.message.includes('分组不存在') ||
            err.message.includes('已存在好友请求')) {
            return res.status(400).json({ error: err.message });
        }
        // 其他未知错误走全局处理
        next(err);
    }
});

// 重新发送验证 PUT /api/v1/friends/request/:id/resend
router.put('/request/:id/resend', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { message } = req.body;
    const result = await friendService.resendRequest(id, req.user.id, message);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// 接受请求 PUT /api/v1/friends/request/:id/accept
router.put('/request/:id/accept', async (req, res, next) => {
  try {
    const result = await friendService.acceptRequest(req.params.id, req.user.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// 拒绝请求 PUT /api/v1/friends/request/:id/reject
router.put('/request/:id/reject', async (req, res, next) => {
  try {
    const result = await friendService.rejectRequest(req.params.id, req.user.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// 删除好友 DELETE /api/v1/friends/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const result = await friendService.deleteFriend(req.params.id, req.user.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// 移动好友 PUT /api/v1/friends/:id/move
router.put('/:id/move', async (req, res, next) => {
  try {
    const { group_id } = req.body;
    const result = await friendService.moveFriend(req.params.id, req.user.id, group_id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// 获取好友列表 GET /api/v1/friends?group_id=xx
router.get('/', async (req, res, next) => {
  try {
    const { Friendship, User } = require('../models');
    const where = { user_id: req.user.id, status: 'accepted' };
    if (req.query.group_id) {
      where.group_id = req.query.group_id;
    }
    const friends = await Friendship.findAll({
      where,
      include: [
        {
          model: User,
          as: 'Target',       // friend_id
          attributes: ['id', 'username', 'nickname', 'avatar'],
        },
      ],
    });
    res.json(friends);
  } catch (err) {
    next(err);
  }
});

// 获取待处理请求（收到的和发出的）
router.get('/requests', async (req, res, next) => {
  try {
    const { Friendship, User } = require('../models');
    const received = await Friendship.findAll({
      where: { friend_id: req.user.id, status: 'pending' },
      include: [{ model: User, as: 'Requester', attributes: ['id', 'username', 'nickname', 'avatar'] }],
    });
      const sent = await Friendship.findAll({
          where: { user_id: req.user.id, status: { [Op.in]: ['pending', 'rejected'] } },
          include: [{ model: User, as: 'Target', attributes: ['id', 'username', 'nickname', 'avatar'] }],
      });
    res.json({ received, sent });
  } catch (err) {
    next(err);
  }
});

module.exports = router;