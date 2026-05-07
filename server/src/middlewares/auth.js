const jwt = require('jsonwebtoken');
const { User } = require('../models');

async function authenticate(req, res, next) {
    // 从 Authorization 头提取 token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: '未提供认证令牌' });
    }

    const token = authHeader.split(' ')[1];

    try {
        // 验证并解析
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        // 查找用户（判断用户是否存在，可选项）
        const user = await User.findByPk(decoded.userId, {
            attributes: ['id', 'username', 'nickname', 'avatar']
        });
        if (!user) {
            return res.status(401).json({ error: '用户不存在' });
        }

        req.user = user;   // 将用户信息挂到请求上
        next();
    } catch (err) {
        return res.status(401).json({ error: '令牌无效或已过期' });
    }
}

module.exports = { authenticate };