/**
 * 社区便民低碳超市 - 后端 API 服务
 * MVP 版本
 */

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

// 加载环境变量
dotenv.config();

// 导入路由
const adminRoutes = require('./routes/admin');
const merchantRoutes = require('./routes/merchant');
const userRoutes = require('./routes/user');
const propertyRoutes = require('./routes/property');
const authRoutes = require('./routes/auth');

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 静态文件服务
const publicPath = path.join(__dirname, '..', 'public');
const mobilePath = path.join(__dirname, '..', '..', 'user-miniprogram');

app.use(express.static(publicPath));
app.use('/mobile', express.static(mobilePath));

// 页面路由
app.get('/', (req, res) => {
  res.sendFile(path.join(publicPath, 'login.html'));
});

app.get('/mobile', (req, res) => {
  res.sendFile(path.join(mobilePath, 'index.html'));
});

// API 路由
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/merchant', merchantRoutes);
app.use('/api/user', userRoutes);
app.use('/api/property', propertyRoutes);

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404 处理
app.use((req, res) => {
  res.status(404).json({ error: '接口不存在' });
});

// 错误处理
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || '服务器内部错误'
  });
});

// 启动服务
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║     社区便民低碳超市 - API 服务已启动                      ║
║                                                           ║
║     监听端口：${PORT}                                       ║
║     环境：${process.env.NODE_ENV || 'development'}                          ║
║     数据库：MariaDB                                       ║
║                                                           ║
║     访问地址：                                            ║
║     - PC 登录页：http://localhost:${PORT}/                  ║
║     - 移动端 H5: http://localhost:${PORT}/mobile             ║
║     - API: http://localhost:${PORT}/api                     ║
╚═══════════════════════════════════════════════════════════╝
  `);
});

// 错误处理
server.on('error', (err) => {
  console.error('Server error:', err);
});

// 保持进程运行
process.on('SIGTERM', () => {
  console.log('收到 SIGTERM，关闭服务...');
  server.close(() => process.exit(0));
});

process.on('SIGINT', () => {
  console.log('收到 SIGINT，关闭服务...');
  server.close(() => process.exit(0));
});

// 全局错误捕获
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

module.exports = app;
