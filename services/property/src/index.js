/**
 * 物业服务 - 入口文件
 * 端口：3003
 */
const express = require('express');
const cors = require('cors');
const db = require('./config/database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3003;
const JWT_SECRET = process.env.JWT_SECRET || 'wuye-mgmt-secret-key-2024';
const path = require('path');

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 静态文件服务
app.use(express.static(path.join(__dirname, '..', 'public')));

// 首页路由
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: '未授权' });
    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.type !== 'property') return res.status(403).json({ error: '需要物业权限' });
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Token 无效' });
  }
};

// 物业登录
app.post('/api/login', async (req, res) => {
  try {
    const { phone, password } = req.body;
    const [rows] = await db.query('SELECT * FROM properties WHERE contact_phone = ? AND status = 1', [phone]);
    if (rows.length === 0) return res.status(401).json({ error: '物业账号不存在' });
    const property = rows[0];
    let valid = property.password_hash ? await bcrypt.compare(password, property.password_hash) : (password === phone.slice(-6));
    if (!valid) return res.status(401).json({ error: '密码错误' });
    const token = jwt.sign({ id: property.id, name: property.name, type: 'property' }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, property: { id: property.id, name: property.name, community_name: property.community_name } });
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// 物业信息
app.get('/api/info', authenticate, async (req, res) => {
  const [rows] = await db.query('SELECT id, name, community_name, contact_phone FROM properties WHERE id = ?', [req.user.id]);
  res.json({ property: rows[0] });
});

// 待审核抵扣申请
app.get('/api/deductions/pending', authenticate, async (req, res) => {
  const [rows] = await db.query('SELECT d.*, u.nickname, u.phone FROM property_deductions d LEFT JOIN users u ON d.user_id = u.id WHERE d.property_id = ? AND d.status = 0', [req.user.id]);
  res.json({ list: rows });
});

// 抵扣申请列表
app.get('/api/deductions', authenticate, async (req, res) => {
  const [rows] = await db.query('SELECT d.*, u.nickname FROM property_deductions d LEFT JOIN users u ON d.user_id = u.id WHERE d.property_id = ? ORDER BY d.created_at DESC LIMIT 100', [req.user.id]);
  res.json({ list: rows });
});

// 审核抵扣申请
app.post('/api/deductions/:id/audit', authenticate, async (req, res) => {
  const { status, audit_remark } = req.body;
  await db.query('UPDATE property_deductions SET status = ?, audit_remark = ?, audit_at = NOW() WHERE id = ? AND property_id = ?', [status, audit_remark, req.params.id, req.user.id]);
  if (status === 3) {
    const [d] = await db.query('SELECT user_id, points_used FROM property_deductions WHERE id = ?', [req.params.id]);
    if (d.length > 0) await db.query('UPDATE users SET available_points = available_points + ? WHERE id = ?', [d[0].points_used, d[0].user_id]);
  }
  res.json({ message: '审核完成' });
});

// 核销积分
app.post('/api/deductions/:id/verify', authenticate, async (req, res) => {
  const [d] = await db.query('SELECT * FROM property_deductions WHERE id = ? AND property_id = ? AND status = 1', [req.params.id, req.user.id]);
  if (d.length === 0) return res.status(404).json({ error: '申请不存在或未通过审核' });
  await db.query('UPDATE users SET available_points = available_points - ? WHERE id = ?', [d[0].points_used, d[0].user_id]);
  await db.query('INSERT INTO low_carbon_points (user_id, points, type, source_id, remark) VALUES (?, ?, 4, ?, "物业费抵扣")', [d[0].user_id, -d[0].points_used, req.params.id]);
  await db.query('UPDATE property_deductions SET status = 2, verified_at = NOW() WHERE id = ?', [req.params.id]);
  res.json({ message: '核销完成' });
});

// 结算统计
app.get('/api/settlement/stats', authenticate, async (req, res) => {
  const [rows] = await db.query('SELECT COUNT(*) as count, SUM(deduction_amount) as amount FROM property_deductions WHERE property_id = ? AND status = 2', [req.user.id]);
  res.json({ stats: rows[0] || { count: 0, amount: 0 } });
});

// 获取物业管辖的小区列表
app.get('/api/communities', authenticate, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT id, name, address, building_count, status FROM communities WHERE property_id = ? ORDER BY name', [req.user.id]);
    res.json({ list: rows });
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// 创建小区
app.post('/api/communities', authenticate, async (req, res) => {
  try {
    const { name, address, building_count } = req.body;
    if (!name) return res.status(400).json({ error: '小区名称不能为空' });
    const [result] = await db.query(
      'INSERT INTO communities (name, address, property_id, building_count) VALUES (?, ?, ?, ?)',
      [name, address || null, req.user.id, building_count || 0]
    );
    res.json({ message: '小区已创建', community_id: result.insertId });
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// 更新小区
app.post('/api/communities/:id', authenticate, async (req, res) => {
  try {
    const { name, address, building_count, status } = req.body;
    const [check] = await db.query('SELECT id FROM communities WHERE id = ? AND property_id = ?', [req.params.id, req.user.id]);
    if (check.length === 0) return res.status(404).json({ error: '小区不存在' });
    await db.query(
      'UPDATE communities SET name = ?, address = ?, building_count = ?, status = ? WHERE id = ?',
      [name, address, building_count, status !== undefined ? status : 1, req.params.id]
    );
    res.json({ message: '小区已更新' });
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// 删除小区
app.delete('/api/communities/:id', authenticate, async (req, res) => {
  try {
    const [check] = await db.query('SELECT id FROM communities WHERE id = ? AND property_id = ?', [req.params.id, req.user.id]);
    if (check.length === 0) return res.status(404).json({ error: '小区不存在' });
    await db.query('UPDATE communities SET status = 0 WHERE id = ?', [req.params.id]);
    res.json({ message: '小区已停用' });
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// ============ 楼栋管理 ============

// 获取小区下的楼栋列表
app.get('/api/communities/:communityId/buildings', authenticate, async (req, res) => {
  try {
    const { communityId } = req.params;
    const [check] = await db.query('SELECT id FROM communities WHERE id = ? AND property_id = ?', [communityId, req.user.id]);
    if (check.length === 0) return res.status(404).json({ error: '小区不存在或无权管理' });
    
    const [rows] = await db.query(
      'SELECT id, building_no, unit_count, floor_count, status FROM buildings WHERE community_id = ? ORDER BY building_no',
      [communityId]
    );
    res.json({ list: rows });
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// 创建楼栋
app.post('/api/communities/:communityId/buildings', authenticate, async (req, res) => {
  try {
    const { communityId } = req.params;
    const { building_no, unit_count, floor_count } = req.body;
    
    const [check] = await db.query('SELECT id FROM communities WHERE id = ? AND property_id = ?', [communityId, req.user.id]);
    if (check.length === 0) return res.status(404).json({ error: '小区不存在或无权管理' });
    
    if (!building_no) return res.status(400).json({ error: '栋号不能为空' });
    
    const [existing] = await db.query('SELECT id FROM buildings WHERE community_id = ? AND building_no = ?', [communityId, building_no]);
    if (existing.length > 0) return res.status(409).json({ error: '该栋号已存在' });
    
    const [result] = await db.query(
      'INSERT INTO buildings (community_id, building_no, unit_count, floor_count) VALUES (?, ?, ?, ?)',
      [communityId, building_no, unit_count || 0, floor_count || 0]
    );
    res.json({ message: '楼栋已创建', building_id: result.insertId });
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// ============ 房间管理 ============

// 获取楼栋下的房间列表
app.get('/api/buildings/:buildingId/rooms', authenticate, async (req, res) => {
  try {
    const { buildingId } = req.params;
    const [check] = await db.query('SELECT b.id FROM buildings b LEFT JOIN communities c ON b.community_id = c.id WHERE b.id = ? AND c.property_id = ?', [buildingId, req.user.id]);
    if (check.length === 0) return res.status(404).json({ error: '楼栋不存在或无权管理' });
    
    const [rows] = await db.query(
      'SELECT id, unit_no, room_no, floor, status FROM rooms WHERE building_id = ? ORDER BY unit_no, room_no',
      [buildingId]
    );
    res.json({ list: rows });
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// 批量创建房间
app.post('/api/buildings/:buildingId/rooms/batch', authenticate, async (req, res) => {
  try {
    const { buildingId } = req.params;
    const { rooms } = req.body; // [{unit_no, room_no, floor}, ...]
    
    const [check] = await db.query('SELECT b.id FROM buildings b LEFT JOIN communities c ON b.community_id = c.id WHERE b.id = ? AND c.property_id = ?', [buildingId, req.user.id]);
    if (check.length === 0) return res.status(404).json({ error: '楼栋不存在或无权管理' });
    
    if (!rooms || rooms.length === 0) return res.status(400).json({ error: '房间数据不能为空' });
    
    const values = rooms.map(r => [buildingId, r.unit_no, r.room_no, r.floor || null]);
    await db.query(
      'INSERT INTO rooms (building_id, unit_no, room_no, floor) VALUES ?',
      [values]
    );
    res.json({ message: `已创建 ${rooms.length} 个房间` });
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// 单个创建房间
app.post('/api/buildings/:buildingId/rooms', authenticate, async (req, res) => {
  try {
    const { buildingId } = req.params;
    const { unit_no, room_no, floor } = req.body;
    
    const [check] = await db.query('SELECT b.id FROM buildings b LEFT JOIN communities c ON b.community_id = c.id WHERE b.id = ? AND c.property_id = ?', [buildingId, req.user.id]);
    if (check.length === 0) return res.status(404).json({ error: '楼栋不存在或无权管理' });
    
    if (!unit_no || !room_no) return res.status(400).json({ error: '单元号和房号不能为空' });
    
    const [result] = await db.query(
      'INSERT INTO rooms (building_id, unit_no, room_no, floor) VALUES (?, ?, ?, ?)',
      [buildingId, unit_no, room_no, floor || null]
    );
    res.json({ message: '房间已创建', room_id: result.insertId });
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// 获取物业信息
app.get('/api/info', authenticate, async (req, res) => {
  const [rows] = await db.query('SELECT id, name, community_name, contact_phone, address FROM properties WHERE id = ?', [req.user.id]);
  res.json({ property: rows[0] });
});

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'property', port: PORT }));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║     物业服务已启动                                         ║
║     端口：${PORT}                                            ║
║     地址：http://localhost:${PORT}                           ║
╚═══════════════════════════════════════════════════════════╝
  `);
});

module.exports = app;
