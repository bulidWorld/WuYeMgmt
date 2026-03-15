/**
 * 商家服务 - 入口文件
 * 端口：3002
 */
const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./config/database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3202;
const JWT_SECRET = process.env.JWT_SECRET || 'wuye-mgmt-secret-key-2024';

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 静态文件服务
app.use(express.static(path.join(__dirname, '..', 'public')));

// 首页路由
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// 认证中间件
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: '未授权，请登录' });
    }
    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.type !== 'merchant') {
      return res.status(403).json({ error: '需要商家权限' });
    }
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token 无效或已过期' });
  }
};

// 商家登录
app.post('/api/login', async (req, res) => {
  try {
    const { phone, password } = req.body;
    const [rows] = await db.query('SELECT * FROM merchants WHERE contact_phone = ? AND status = 1', [phone]);
    if (rows.length === 0) return res.status(401).json({ error: '商家不存在或已禁用' });
    const merchant = rows[0];
    let valid = merchant.password_hash ? await bcrypt.compare(password, merchant.password_hash) : (password === phone.slice(-6));
    if (!valid) return res.status(401).json({ error: '密码错误' });
    const token = jwt.sign({ id: merchant.id, name: merchant.name, type: 'merchant' }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, merchant: { id: merchant.id, name: merchant.name, contact_phone: merchant.contact_phone, audit_status: merchant.audit_status } });
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// 商家入驻
app.post('/api/register', async (req, res) => {
  try {
    const { name, license_no, contact_name, contact_phone, address } = req.body;
    if (!name || !contact_phone) return res.status(400).json({ error: '商家名称和联系电话不能为空' });
    const [existing] = await db.query('SELECT id FROM merchants WHERE contact_phone = ?', [contact_phone]);
    if (existing.length > 0) return res.status(409).json({ error: '该手机号已注册' });
    const [result] = await db.query('INSERT INTO merchants (name, license_no, contact_name, contact_phone, address, audit_status) VALUES (?, ?, ?, ?, ?, 0)', [name, license_no, contact_name, contact_phone, address]);
    res.json({ message: '入驻申请已提交', merchant_id: result.insertId });
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// 商家信息
app.get('/api/info', authenticate, async (req, res) => {
  const [rows] = await db.query('SELECT id, name, contact_name, contact_phone, address, audit_status FROM merchants WHERE id = ?', [req.user.id]);
  res.json({ merchant: rows[0] });
});

// 商品列表
app.get('/api/products', authenticate, async (req, res) => {
  const [rows] = await db.query('SELECT * FROM products WHERE merchant_id = ? ORDER BY created_at DESC', [req.user.id]);
  res.json({ list: rows });
});

// 创建商品
app.post('/api/products', authenticate, async (req, res) => {
  try {
    const { name, category_id, price, stock, description, is_low_carbon, images } = req.body;
    if (!name || !category_id || !price) return res.status(400).json({ error: '商品名称、分类和价格为必填项' });
    
    // 获取分类的积分倍率
    const [categories] = await db.query('SELECT points_rate FROM product_categories WHERE id = ?', [category_id]);
    const points_rate = categories.length > 0 ? categories[0].points_rate : 1.0;
    
    const [result] = await db.query(
      'INSERT INTO products (merchant_id, category_id, name, price, stock, description, is_low_carbon, points_rate, images) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [req.user.id, category_id, name, price, stock || 0, description, is_low_carbon ? 1 : 0, points_rate, JSON.stringify(images || [])]
    );
    res.json({ message: '商品已创建', product_id: result.insertId, points_rate: points_rate });
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// 订单列表
app.get('/api/orders', authenticate, async (req, res) => {
  const [rows] = await db.query('SELECT o.*, u.nickname, u.phone FROM orders o LEFT JOIN users u ON o.user_id = u.id WHERE o.merchant_id = ? ORDER BY o.created_at DESC LIMIT 100', [req.user.id]);
  res.json({ list: rows });
});

// 更新订单状态
app.post('/api/orders/:id/status', authenticate, async (req, res) => {
  const { status, tracking_no } = req.body;
  const updates = ['status = ?'];
  const params = [status];
  if (tracking_no) { updates.push('tracking_no = ?'); params.push(tracking_no); }
  params.push(req.params.id);
  await db.query(`UPDATE orders SET ${updates.join(', ')} WHERE merchant_id = ? AND id = ?`, [...params, req.user.id, req.params.id]);
  res.json({ message: '订单状态已更新' });
});

// 数据统计
app.get('/api/stats', authenticate, async (req, res) => {
  const [orders] = await db.query('SELECT COUNT(*) as count, SUM(actual_amount) as amount FROM orders WHERE merchant_id = ? AND status >= 1', [req.user.id]);
  const [products] = await db.query('SELECT COUNT(*) as count FROM products WHERE merchant_id = ? AND status = 1', [req.user.id]);
  res.json({ stats: { total_orders: orders[0].count || 0, total_revenue: orders[0].amount || 0, active_products: products[0].count || 0 } });
});

// 编辑商品
app.post('/api/products/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, category_id, price, stock, description, is_low_carbon, status } = req.body;
    
    // 验证商品属于当前商家
    const [check] = await db.query('SELECT id FROM products WHERE id = ? AND merchant_id = ?', [id, req.user.id]);
    if (check.length === 0) {
      return res.status(404).json({ error: '商品不存在或无权修改' });
    }
    
    // 获取分类的积分倍率
    const [categories] = await db.query('SELECT points_rate FROM product_categories WHERE id = ?', [category_id]);
    const points_rate = categories.length > 0 ? categories[0].points_rate : 1.0;
    
    await db.query(
      `UPDATE products SET name = ?, category_id = ?, price = ?, stock = ?, 
        description = ?, is_low_carbon = ?, points_rate = ?, status = ?, updated_at = NOW()
       WHERE id = ?`,
      [name, category_id, price, stock, description, is_low_carbon ? 1 : 0, points_rate, status !== undefined ? status : 1, id]
    );
    
    res.json({ message: '商品已更新', points_rate: points_rate });
  } catch (err) {
    res.status(500).json({ error: '服务器错误：' + err.message });
  }
});

// 删除商品
app.delete('/api/products/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const [check] = await db.query('SELECT id FROM products WHERE id = ? AND merchant_id = ?', [id, req.user.id]);
    if (check.length === 0) {
      return res.status(404).json({ error: '商品不存在或无权删除' });
    }
    await db.query('UPDATE products SET status = 0 WHERE id = ?', [id]);
    res.json({ message: '商品已下架' });
  } catch (err) {
    res.status(500).json({ error: '服务器错误：' + err.message });
  }
});

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'merchant', port: PORT }));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║     商家服务已启动                                         ║
║     端口：${PORT}                                            ║
║     地址：http://localhost:${PORT}                           ║
╚═══════════════════════════════════════════════════════════╝
  `);
});

module.exports = app;

// 商品分类 API（从数据库读取）
app.get('/api/categories', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT id, name, points_rate, low_carbon_tag FROM product_categories WHERE is_active = 1 ORDER BY sort_order');
    res.json({ list: rows });
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// 订单详情
app.get('/api/orders/:id', authenticate, async (req, res) => {
  try {
    const [orders] = await db.query(
      `SELECT o.*, u.nickname, u.phone, u.building_no, u.unit_no, u.room_no 
       FROM orders o 
       LEFT JOIN users u ON o.user_id = u.id 
       WHERE o.id = ? AND o.merchant_id = ?`,
      [req.params.id, req.user.id]
    );
    if (orders.length === 0) return res.status(404).json({ error: '订单不存在' });
    
    const [items] = await db.query('SELECT * FROM order_items WHERE order_id = ?', [req.params.id]);
    
    res.json({ order: orders[0], items: items || [] });
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// 发货
app.post('/api/orders/:id/ship', authenticate, async (req, res) => {
  try {
    const { tracking_no } = req.body;
    await db.query(
      'UPDATE orders SET status = 2, tracking_no = ?, shipped_at = NOW() WHERE id = ? AND merchant_id = ?',
      [tracking_no, req.params.id, req.user.id]
    );
    res.json({ message: '已发货' });
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});
