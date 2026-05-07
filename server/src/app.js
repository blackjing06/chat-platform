require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const { sequelize } = require('./config/database');

// 导入模型关联（确保所有模型注册）
require('./models');

// 导入认证中间件和路由
const { authenticate } = require('./middlewares/auth');
const authRouter = require('./routes/auth');

// 创建 Express 应用
const app = express();

// --------------------- 基础中间件 ---------------------
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --------------------- 静态文件服务 ---------------------
// 上传目录（图片、语音文件）
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads'), {
    setHeaders(res, filePath) {
        if (filePath.endsWith('.webm')) {
            res.setHeader('Content-Type', 'audio/webm');
        }
    }
}));
// 聊天记录导出目录
//app.use('/exports', express.static(path.join(__dirname, '..', 'exports')));
app.use('/api/v1', require('./routes/export'));

// --------------------- 公开路由 ---------------------
// 健康检查
app.get('/api/v1/health', async (req, res) => {
    try {
        await sequelize.authenticate();
        res.json({ status: 'ok', db: 'connected' });
    } catch (error) {
        res.status(500).json({ status: 'error', db: 'disconnected', message: error.message });
    }
});

// 认证相关路由（注册、登录）
app.use('/api/v1/auth', authRouter);

// --------------------- 受保护路由 ---------------------
// 
app.use('/api/v1/friends', authenticate, require('./routes/friends'));
app.use('/api/v1/groups', authenticate, require('./routes/groups'));
app.use('/api/v1/users', authenticate, require('./routes/users'));

app.use('/api/v1/conversations', authenticate, require('./routes/conversations'));
app.use('/api/v1/upload', authenticate, require('./routes/upload'));
app.use('/api/v1/group-admin', authenticate, require('./routes/groupManage'));

// ...

// 测试路由：获取当前用户信息
app.get('/api/v1/users/me', authenticate, (req, res) => {
    res.json({ user: req.user });
});

// --------------------- 请求格式错误 ---------------------

app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ error: '请求格式错误，请检查 JSON' });
  }
  next(err);
});

// --------------------- 404 处理 ---------------------
app.use((req, res) => {
    res.status(404).json({ error: '接口不存在' });
});

// --------------------- 全局错误处理 ---------------------
app.use((err, req, res, next) => {
    console.error('服务器错误:', err.stack);
    res.status(500).json({ error: '服务器内部错误' });
});

// --------------------- 启动服务器 ---------------------
const PORT = process.env.PORT || 3001;

async function startServer() {
    try {
        // 数据库同步（开发阶段使用 alter: true 自动更新表结构）
        await sequelize.sync({ alter: true });
        console.log('✅ 数据库已同步');

        // 创建 HTTP 服务器
        const server = http.createServer(app);

        // 初始化 Socket.IO（预先做好认证逻辑）
        const socketModule = require('./socket');
        socketModule.init(server);

        // 启动监听
        server.listen(PORT, () => {
            console.log(`🚀 服务器运行在 http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error('启动失败:', error);
        process.exit(1);
    }
}

startServer();