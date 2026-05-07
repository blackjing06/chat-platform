require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { sequelize } = require('./config/database');

const app = express();

// ---- 基础中间件 ----
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ---- 静态文件服务（图片、语音、导出文件） ----
app.use('/uploads', express.static(path.join(__dirname, '..', process.env.UPLOAD_DIR)));
app.use('/exports', express.static(path.join(__dirname, '..', process.env.EXPORT_DIR)));

// ---- 挂载路由占位 ----
const apiRouter = express.Router();
app.use('/api/v1', apiRouter);

// 健康检查（稍后添加具体逻辑）
apiRouter.get('/health', async (req, res) => {
  try {
    await sequelize.authenticate();
    res.json({ status: 'ok', db: 'connected' });
  } catch (error) {
    res.status(500).json({ status: 'error', db: 'disconnected', message: error.message });
  }
});

// ---- 400 错误处理 ----
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// ---- 全局错误处理 ----
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

// ---- 启动服务器并同步数据库 ----
const PORT = process.env.PORT || 3001;

async function startServer() {
  try {
    // 同步所有模型到数据库（开发阶段使用 alter: true）
    await sequelize.sync({ alter: true });
    console.log('✅ Database synchronized');

    // 如果你想在服务器启动时才导入 socket 模块，可延迟导入
    const server = require('http').createServer(app);
    // 预留 Socket.IO，后续阶段启用
    // const io = require('./socket').init(server);
    
    server.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Unable to start server:', error);
  }
}

startServer();