const express = require('express');
const router = express.Router();
const friendService = require('../services/friendService');

// 获取所有分组
router.get('/', async (req, res, next) => {
  try {
    const { FriendGroup } = require('../models');
    const groups = await FriendGroup.findAll({
      where: { user_id: req.user.id },
      order: [['sort_order', 'ASC']],
    });
    res.json(groups);
  } catch (err) {
    next(err);
  }
});

// 创建分组
router.post('/', async (req, res, next) => {
  try {
    const { name } = req.body;
    const group = await friendService.createGroup(req.user.id, name);
    res.status(201).json(group);
  } catch (err) {
    next(err);
  }
});

// 重命名分组
router.put('/:id', async (req, res, next) => {
  try {
    const { name } = req.body;
    const group = await friendService.renameGroup(req.params.id, req.user.id, name);
    res.json(group);
  } catch (err) {
    next(err);
  }
});

// 删除分组
router.delete('/:id', async (req, res, next) => {
  try {
    const result = await friendService.deleteGroup(req.params.id, req.user.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;