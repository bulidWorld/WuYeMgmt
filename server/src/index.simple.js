/**
 * 社区便民低碳超市 - 后端 API 服务
 * 简化版本用于调试
 */

const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// 静态文件 - __dirname 是 src 目录
const publicPath = path.join(__dirname, '..', 'public');
const mobilePath = path.join(__dirname, '..', '..', 'user-miniprogram');

app.use(express.static(publicPath));
app.use('/mobile', express.static(mobilePath));

// 路由
app.get('/', (req, res) => {
  res.sendFile(path.join(publicPath, 'login.html'));
});

app.get('/mobile', (req, res) => {
  res.sendFile(path.join(mobilePath, 'index.html'));
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
