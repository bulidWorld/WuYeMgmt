/**
 * 社区便民低碳超市 - 后端 API 服务
 * 调试版本 - 添加详细日志
 */

console.log('[' + new Date().toISOString() + '] 开始加载 index.js');
console.log('Node.js 版本:', process.version);
console.log('工作目录:', process.cwd());

const express = require('express');
console.log('[' + new Date().toISOString() + '] ✓ express 加载成功');

const cors = require('cors');
console.log('[' + new Date().toISOString() + '] ✓ cors 加载成功');

const dotenv = require('dotenv');
console.log('[' + new Date().toISOString() + '] ✓ dotenv 加载成功');

const path = require('path');
console.log('[' + new Date().toISOString() + '] ✓ path 加载成功');

// 加载环境变量
dotenv.config();
console.log('[' + new Date().toISOString() + '] ✓ 环境变量已加载');
console.log('  PORT:', process.env.PORT || 3000);
console.log('  NODE_ENV:', process.env.NODE_ENV || 'development');
console.log('  DB_HOST:', process.env.DB_HOST || 'localhost');
console.log('  DB_USER:', process.env.DB_USER || 'root');
console.log('  DB_NAME:', process.env.DB_NAME || 'wuye_mgmt');

// 全局错误捕获 - 必须在最前面
process.on('uncaughtException', (err, origin) => {
  console.error('[' + new Date().toISOString() + '] ❌ Uncaught Exception:', err.message);
  console.error('  Stack:', err.stack);
  console.error('  Origin:', origin);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[' + new Date().toISOString() + '] ❌ Unhandled Rejection at:', promise);
  console.error('  Reason:', reason);
  if (reason && reason.stack) {
    console.error('  Stack:', reason.stack);
  }
});

process.on('exit', (code) => {
  console.log('[' + new Date().toISOString() + '] 🚪 进程退出，退出码:', code);
});

process.on('SIGTERM', () => {
  console.log('[' + new Date().toISOString() + '] 📶 收到 SIGTERM 信号');
});

process.on('SIGINT', () => {
  console.log('[' + new Date().toISOString() + '] 📶 收到 SIGINT 信号');
});

console.log('[' + new Date().toISOString() + '] 开始导入路由模块...');

// 导入路由 - 逐个测试
try {
  console.log('[' + new Date().toISOString() + ']   导入 auth 路由...');
  const authRoutes = require('./routes/auth');
  console.log('[' + new Date().toISOString() + ']   ✓ auth 路由加载成功');
} catch (err) {
  console.error('[' + new Date().toISOString() + ']   ❌ auth 路由加载失败:', err.message);
  throw err;
}

try {
  console.log('[' + new Date().toISOString() + ']   导入 admin 路由...');
  const adminRoutes = require('./routes/admin');
  console.log('[' + new Date().toISOString() + ']   ✓ admin 路由加载成功');
} catch (err) {
  console.error('[' + new Date().toISOString() + ']   ❌ admin 路由加载失败:', err.message);
  throw err;
}

try {
  console.log('[' + new Date().toISOString() + ']   导入 merchant 路由...');
  const merchantRoutes = require('./routes/merchant');
  console.log('[' + new Date().toISOString() + ']   ✓ merchant 路由加载成功');
} catch (err) {
  console.error('[' + new Date().toISOString() + ']   ❌ merchant 路由加载失败:', err.message);
  throw err;
}

try {
  console.log('[' + new Date().toISOString() + ']   导入 user 路由...');
  const userRoutes = require('./routes/user');
  console.log('[' + new Date().toISOString() + ']   ✓ user 路由加载成功');
} catch (err) {
  console.error('[' + new Date().toISOString() + ']   ❌ user 路由加载失败:', err.message);
  throw err;
}

try {
  console.log('[' + new Date().toISOString() + ']   导入 property 路由...');
  const propertyRoutes = require('./routes/property');
  console.log('[' + new Date().toISOString() + ']   ✓ property 路由加载成功');
} catch (err) {
  console.error('[' + new Date().toISOString() + ']   ❌ property 路由加载失败:', err.message);
  throw err;
}

console.log('[' + new Date().toISOString() + '] ✓ 所有路由模块加载成功');

// 导入数据库 - 这可能会触发异步连接
console.log('[' + new Date().toISOString() + '] 开始导入数据库配置...');
try {
  const db = require('./config/database');
  console.log('[' + new Date().toISOString() + '] ✓ 数据库配置加载成功');
  console.log('[' + new Date().toISOString() + ']   数据库连接池对象:', db ? '存在' : '不存在');
} catch (err) {
  console.error('[' + new Date().toISOString() + '] ❌ 数据库配置加载失败:', err.message);
  throw err;
}

const app = express();
const PORT = process.env.PORT || 3000;

console.log('[' + new Date().toISOString() + '] ✓ Express 应用创建成功');

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
console.log('[' + new Date().toISOString() + '] ✓ 中间件已配置');

// 静态文件服务
const publicPath = path.join(__dirname, '..', 'public');
const mobilePath = path.join(__dirname, '..', '..', 'user-miniprogram');
console.log('[' + new Date().toISOString() + '] 静态文件路径:');
console.log('  publicPath:', publicPath);
console.log('  mobilePath:', mobilePath);

app.use(express.static(publicPath));
app.use('/mobile', express.static(mobilePath));
console.log('[' + new Date().toISOString() + '] ✓ 静态文件服务已配置');

// 页面路由
app.get('/', (req, res) => {
  console.log('[' + new Date().toISOString() + '] 📄 请求：GET /');
  const filePath = path.join(publicPath, 'login.html');
  console.log('[' + new Date().toISOString() + ']   发送文件:', filePath);
  res.sendFile(filePath);
});

app.get('/mobile', (req, res) => {
  console.log('[' + new Date().toISOString() + '] 📄 请求：GET /mobile');
  const filePath = path.join(mobilePath, 'index.html');
  console.log('[' + new Date().toISOString() + ']   发送文件:', filePath);
  res.sendFile(filePath);
});

// API 路由
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const merchantRoutes = require('./routes/merchant');
const userRoutes = require('./routes/user');
const propertyRoutes = require('./routes/property');

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/merchant', merchantRoutes);
app.use('/api/user', userRoutes);
app.use('/api/property', propertyRoutes);
console.log('[' + new Date().toISOString() + '] ✓ API 路由已配置');

// 健康检查
app.get('/health', (req, res) => {
  console.log('[' + new Date().toISOString() + '] 💚 健康检查请求');
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404 处理
app.use((req, res) => {
  console.log('[' + new Date().toISOString() + '] ❓ 404:', req.method, req.path);
  res.status(404).json({ error: '接口不存在' });
});

// 错误处理
app.use((err, req, res, next) => {
  console.error('[' + new Date().toISOString() + '] ❌ 路由错误:', err);
  res.status(err.status || 500).json({
    error: err.message || '服务器内部错误'
  });
});

console.log('[' + new Date().toISOString() + '] 开始启动服务器...');
console.log('[' + new Date().toISOString() + ']   端口:', PORT);
console.log('[' + new Date().toISOString() + ']   主机：0.0.0.0');

// 启动服务
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log('[' + new Date().toISOString() + '] ✅ 服务器启动成功！');
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

// 服务器错误处理
server.on('error', (err) => {
  console.error('[' + new Date().toISOString() + '] ❌ 服务器错误:', err);
});

server.on('close', () => {
  console.log('[' + new Date().toISOString() + '] 🚪 服务器关闭');
});

console.log('[' + new Date().toISOString() + '] 📌 服务器监听中...');
console.log('[' + new Date().toISOString() + '] 📌 进程 PID:', process.pid);

// 保持进程运行的定时器（防止某些情况下自动退出）
setInterval(() => {
  console.log('[' + new Date().toISOString() + '] 💓 心跳 - 服务运行正常');
}, 60000);

module.exports = app;
