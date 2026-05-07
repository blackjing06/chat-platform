const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User, FriendGroup } = require('../models');

const SALT_ROUNDS = 10;
const JWT_EXPIRES_IN = '7d';

// 注册
async function register(username, password, nickname) {
    // 检查用户名是否已存在
    const existing = await User.findOne({ where: { username } });
    if (existing) {
        throw new Error('用户名已存在');
    }

    // 哈希密码
    const password_hash = await bcrypt.hash(password, SALT_ROUNDS);

    // 创建用户
    const user = await User.create({ username, password_hash, nickname });

    // 创建默认好友分组“我的好友”
    await FriendGroup.create({
        user_id: user.id,
        name: '我的好友',
        sort_order: 0,
    });

    // 返回用户信息（不含密码）
    return {
        id: user.id,
        username: user.username,
        nickname: user.nickname,
        avatar: user.avatar,
    };
}

// 登录
async function login(username, password) {
    // 查找用户
    const user = await User.findOne({ where: { username } });
    if (!user) {
        throw new Error('用户名或密码错误');
    }

    // 验证密码
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
        throw new Error('用户名或密码错误');
    }

    // 签发 JWT，payload 中存 userId
    const token = jwt.sign(
        { userId: user.id },
        process.env.JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
    );

    return {
        token,
        user: {
            id: user.id,
            username: user.username,
            nickname: user.nickname,
            avatar: user.avatar,
        },
    };
}

module.exports = { register, login };