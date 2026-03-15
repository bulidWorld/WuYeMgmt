/**
 * 管理服务 - 入口文件
 * 端口：3004
 */
const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./config/database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3004;
const JWT_SECRET = process.env.JWT_SECRET || 'wuye-mgmt-secret-key-2024';

// 静态文件服务
app.use(express.static(path.join(__dirname, '..', 'public')));

// 首页路由
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: '未授权' });
    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.type !== 'admin') return res.status(403).json({ error: '需要管理员权限' });
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Token 无效' });
  }
};

// 管理员登录
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const [rows] = await db.query('SELECT * FROM admins WHERE username = ? AND status = 1', [username]);
    if (rows.length === 0) return res.status(401).json({ error: '用户名或密码错误' });
    const admin = rows[0];
    const valid = await bcrypt.compare(password, admin.password_hash);
    if (!valid) return res.status(401).json({ error: '用户名或密码错误' });
    const token = jwt.sign({ id: admin.id, username: admin.username, role: admin.role, type: 'admin' }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ token, admin: { id: admin.id, username: admin.username, real_name: admin.real_name, role: admin.role } });
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// 管理员信息
app.get('/api/info', authenticate, async (req, res) => {
  const [rows] = await db.query('SELECT id, username, real_name, role FROM admins WHERE id = ?', [req.user.id]);
  res.json({ admin: rows[0] });
});

// 平台统计
app.get('/api/stats', authenticate, async (req, res) => {
  const [orders] = await db.query('SELECT COUNT(*) as count, SUM(actual_amount) as amount FROM orders');
  const [users] = await db.query('SELECT COUNT(*) as count FROM users');
  const [merchants] = await db.query('SELECT COUNT(*) as count FROM merchants WHERE status = 1');
  res.json({ stats: { total_orders: orders[0].count || 0, total_revenue: orders[0].amount || 0, total_users: users[0].count || 0, active_merchants: merchants[0].count || 0 } });
});

// 商家列表
app.get('/api/merchants', authenticate, async (req, res) => {
  const { audit_status } = req.query;
  let sql = 'SELECT id, name, contact_name, contact_phone, audit_status, status FROM merchants';
  if (audit_status !== undefined) sql += ` WHERE audit_status = ${audit_status}`;
  sql += ' ORDER BY created_at DESC LIMIT 100';
  const [rows] = await db.query(sql);
  res.json({ list: rows });
});

// 审核商家
app.post('/api/merchants/:id/audit', authenticate, async (req, res) => {
  const { audit_status, audit_remark } = req.body;
  await db.query('UPDATE merchants SET audit_status = ?, audit_remark = ?, status = ? WHERE id = ?', [audit_status, audit_remark, audit_status === 1 ? 1 : 0, req.params.id]);
  res.json({ message: '审核完成' });
});

// 商品分类
app.get('/api/categories', authenticate, async (req, res) => {
  const [rows] = await db.query('SELECT * FROM product_categories ORDER BY sort_order');
  res.json({ list: rows });
});

// 创建分类
app.post('/api/categories', authenticate, async (req, res) => {
  const { name, parent_id, sort_order } = req.body;
  const [result] = await db.query('INSERT INTO product_categories (name, parent_id, sort_order) VALUES (?, ?, ?)', [name, parent_id || 0, sort_order || 0]);
  res.json({ message: '分类已创建', category_id: result.insertId });
});

// 平台配置
app.get('/api/config', authenticate, async (req, res) => {
  const [rows] = await db.query('SELECT config_key, config_value FROM platform_config');
  const config = {};
  rows.forEach(r => config[r.config_key] = r.config_value);
  res.json({ config });
});

app.post('/api/config', authenticate, async (req, res) => {
  const { config_key, config_value } = req.body;
  await db.query('INSERT INTO platform_config (config_key, config_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE config_value = ?', [config_key, config_value]);
  res.json({ message: '配置已更新' });
});

// ============ 商品分类管理 ============

// 获取分类列表
app.get('/api/categories', authenticate, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM product_categories ORDER BY sort_order');
    res.json({ list: rows });
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// 创建分类
app.post('/api/categories', authenticate, async (req, res) => {
  try {
    const { name, parent_id, sort_order, points_rate, low_carbon_tag, description } = req.body;
    if (!name) return res.status(400).json({ error: '分类名称不能为空' });
    const [result] = await db.query(
      'INSERT INTO product_categories (name, parent_id, sort_order, points_rate, low_carbon_tag, description) VALUES (?, ?, ?, ?, ?, ?)',
      [name, parent_id || 0, sort_order || 0, points_rate || 1.0, low_carbon_tag || null, description || null]
    );
    res.json({ message: '分类已创建', category_id: result.insertId });
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// 更新分类（包括积分倍率）
app.post('/api/categories/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, sort_order, points_rate, low_carbon_tag, description, is_active } = req.body;
    await db.query(
      'UPDATE product_categories SET name = ?, sort_order = ?, points_rate = ?, low_carbon_tag = ?, description = ?, is_active = ? WHERE id = ?',
      [name, sort_order, points_rate, low_carbon_tag, description, is_active !== undefined ? is_active : 1, id]
    );
    res.json({ message: '分类已更新' });
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// 删除分类
app.delete('/api/categories/:id', authenticate, async (req, res) => {
  try {
    await db.query('UPDATE product_categories SET is_active = 0 WHERE id = ?', [req.params.id]);
    res.json({ message: '分类已停用' });
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'admin', port: PORT }));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║     管理服务已启动                                         ║
║     端口：${PORT}                                            ║
║     地址：http://localhost:${PORT}                           ║
╚═══════════════════════════════════════════════════════════╝
  `);
});

module.exports = app;

// 用户列表
app.get('/api/users', authenticate, async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT id, phone, nickname, community_id, available_points, is_member, created_at FROM users ORDER BY created_at DESC LIMIT 100'
    );
    res.json({ list: rows || [] });
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// 订单列表（管理员）
app.get('/api/orders', authenticate, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT o.*, u.nickname as user_name, m.name as merchant_name 
       FROM orders o 
       LEFT JOIN users u ON o.user_id = u.id 
       LEFT JOIN merchants m ON o.merchant_id = m.id 
       ORDER BY o.created_at DESC LIMIT 100`
    );
    res.json({ list: rows || [] });
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// 商家列表（管理员）
app.get('/api/merchants', authenticate, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM merchants ORDER BY created_at DESC');
    res.json({ list: rows || [] });
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// 物业列表（管理员）
app.get('/api/properties', authenticate, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM properties ORDER BY created_at DESC');
    res.json({ list: rows || [] });
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// 小区列表（管理员）
app.get('/api/communities', authenticate, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT c.*, p.name as property_name FROM communities c LEFT JOIN properties p ON c.property_id = p.id ORDER BY c.name');
    res.json({ list: rows || [] });
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// 创建小区
app.post('/api/communities', authenticate, async (req, res) => {
  try {
    const { name, address, property_id, building_count } = req.body;
    if (!name) return res.status(400).json({ error: '小区名称不能为空' });
    const [result] = await db.query(
      'INSERT INTO communities (name, address, property_id, building_count) VALUES (?, ?, ?, ?)',
      [name, address || null, property_id || null, building_count || 0]
    );
    res.json({ message: '小区已创建', community_id: result.insertId });
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// 更新分类
app.post('/api/categories/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, points_rate, low_carbon_tag, sort_order, description, is_active } = req.body;
    
    const fields = [];
    const values = [];
    
    if (name !== undefined) { fields.push('name = ?'); values.push(name); }
    if (points_rate !== undefined) { fields.push('points_rate = ?'); values.push(points_rate); }
    if (low_carbon_tag !== undefined) { fields.push('low_carbon_tag = ?'); values.push(low_carbon_tag); }
    if (sort_order !== undefined) { fields.push('sort_order = ?'); values.push(sort_order); }
    if (description !== undefined) { fields.push('description = ?'); values.push(description); }
    if (is_active !== undefined) { fields.push('is_active = ?'); values.push(is_active); }
    
    if (fields.length === 0) return res.status(400).json({ error: '没有要更新的字段' });
    
    values.push(id);
    await db.query(`UPDATE product_categories SET ${fields.join(', ')} WHERE id = ?`, values);
    
    res.json({ message: '分类已更新' });
  } catch (err) {
    res.status(500).json({ error: '服务器错误：' + err.message });
  }
});

// 删除分类
app.delete('/api/categories/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    await db.query('UPDATE product_categories SET is_active = 0 WHERE id = ?', [id]);
    res.json({ message: '分类已删除' });
  } catch (err) {
    res.status(500).json({ error: '服务器错误：' + err.message });
  }
});
