/**
 * 管理员路由
 */
const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticate, requireAdmin } = require('../middleware/auth');

// 获取管理员信息
router.get('/info', authenticate, async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT id, username, real_name, role, phone, last_login_at FROM admins WHERE id = ?',
      [req.user.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: '管理员不存在' });
    }
    res.json({ admin: rows[0] });
  } catch (err) {
    console.error('Get admin info error:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 获取管理员列表（仅超级管理员）
router.get('/list', authenticate, requireAdmin, async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT id, username, real_name, role, phone, status, created_at FROM admins ORDER BY id'
    );
    res.json({ list: rows });
  } catch (err) {
    console.error('Get admin list error:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 创建管理员
router.post('/create', authenticate, requireAdmin, async (req, res) => {
  try {
    const bcrypt = require('bcryptjs');
    const { username, password, real_name, role, phone } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: '用户名和密码不能为空' });
    }

    const [existing] = await db.query('SELECT id FROM admins WHERE username = ?', [username]);
    if (existing.length > 0) {
      return res.status(409).json({ error: '用户名已存在' });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const [result] = await db.query(
      'INSERT INTO admins (username, password_hash, real_name, role, phone) VALUES (?, ?, ?, ?, ?)',
      [username, password_hash, real_name, role, phone]
    );

    res.json({ message: '创建成功', admin_id: result.insertId });
  } catch (err) {
    console.error('Create admin error:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 平台配置 - 获取
router.get('/config', authenticate, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT config_key, config_value, config_type, description FROM platform_config');
    const config = {};
    rows.forEach(row => {
      let value = row.config_value;
      if (row.config_type === 2) value = Number(value);
      if (row.config_type === 4) value = value === 'true';
      config[row.config_key] = value;
    });
    res.json({ config });
  } catch (err) {
    console.error('Get config error:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 平台配置 - 更新
router.post('/config', authenticate, requireAdmin, async (req, res) => {
  try {
    const { config_key, config_value } = req.body;
    if (!config_key) {
      return res.status(400).json({ error: '配置键不能为空' });
    }
    await db.query(
      'INSERT INTO platform_config (config_key, config_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE config_value = ?',
      [config_key, config_value, config_value]
    );
    res.json({ message: '配置已更新' });
  } catch (err) {
    console.error('Update config error:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 数据统计
router.get('/stats', authenticate, async (req, res) => {
  try {
    const [orders] = await db.query('SELECT COUNT(*) as count, SUM(actual_amount) as amount FROM orders');
    const [users] = await db.query('SELECT COUNT(*) as count FROM users');
    const [merchants] = await db.query('SELECT COUNT(*) as count FROM merchants WHERE status = 1');
    const [points] = await db.query('SELECT SUM(available_points) as total FROM users');
    
    res.json({
      stats: {
        total_orders: orders[0].count || 0,
        total_revenue: orders[0].amount || 0,
        total_users: users[0].count || 0,
        active_merchants: merchants[0].count || 0,
        total_points: points[0].total || 0
      }
    });
  } catch (err) {
    console.error('Get stats error:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;
