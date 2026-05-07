const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { User } = require('../models');

// GET /api/v1/users/me（已有）
router.get('/me', (req, res) => {
  res.json({ user: req.user });
});

// GET /api/v1/users/search?keyword=xxx
router.get('/search', async (req, res, next) => {
  try {
    const { keyword } = req.query;

    // 如果没有提供关键字，直接返回空数组
    if (!keyword || keyword.trim() === '') {
      return res.json([]);
    }

    const users = await User.findAll({
      where: {
        // 排除自己
        id: { [Op.ne]: req.user.id },
        // 用户名或昵称模糊匹配
        [Op.or]: [
          { username: { [Op.like]: `%${keyword}%` } },
          { nickname: { [Op.like]: `%${keyword}%` } },
        ],
      },
      attributes: ['id', 'username', 'nickname', 'avatar'],
      limit: 25, // 限制返回数量，防止性能问题
    });

    res.json(users);
  } catch (err) {
    next(err);
  }
});

module.exports = router;