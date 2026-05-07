const express = require('express');
const router = express.Router();
const { register, login } = require('../services/authService');

// POST /api/v1/auth/register
router.post('/register', async (req, res, next) => {
    try {
        const { username, password, nickname } = req.body;
        if (!username || !password || !nickname) {
            return res.status(400).json({ error: '缺少必要参数' });
        }
        const user = await register(username, password, nickname);
        res.status(201).json({ user });
    } catch (err) {
        // 处理重复用户名等错误
        if (err.message === '用户名已存在') {
            return res.status(409).json({ error: err.message });
        }
        next(err);
    }
});

// POST /api/v1/auth/login
router.post('/login', async (req, res, next) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(409).json({ error: '缺少用户名或密码' });
        }
        const result = await login(username, password);
        res.json(result);
    } catch (err) {
        if (err.message === '用户名或密码错误') {
            return res.status(409).json({ error: err.message });
        }
        next(err);
    }
});

module.exports = router;