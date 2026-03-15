/**
 * 最小化测试服务
 */
const express = require('express');
const path = require('path');

const app = express();

const publicPath = path.join(__dirname, '..', 'public');
const mobilePath = path.join(__dirname, '..', '..', 'user-miniprogram');

app.use(express.static(publicPath));
app.use('/mobile', express.static(mobilePath));

app.get('/', (req, res) => res.sendFile(path.join(publicPath, 'login.html')));
app.get('/mobile', (req, res) => res.sendFile(path.join(mobilePath, 'index.html')));
app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.listen(3000, () => console.log('Test server on 3000'));
