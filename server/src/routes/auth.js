/**
 * 认证路由
 */
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const router = express.Router();
const db = require('../config/database');
const { JWT_SECRET } = require('../middleware/auth');

// 管理员登录
router.post('/admin/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: '用户名和密码不能为空' });
    }

    const [rows] = await db.query(
      'SELECT * FROM admins WHERE username = ? AND status = 1',
      [username]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    const admin = rows[0];
    const valid = await bcrypt.compare(password, admin.password_hash);

    if (!valid) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    // 更新最后登录时间
    await db.query(
      'UPDATE admins SET last_login_at = NOW() WHERE id = ?',
      [admin.id]
    );

    // 生成 token
    const token = jwt.sign(
      { 
        id: admin.id, 
        username: admin.username,
        role: admin.role,
        type: 'admin'
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: admin.id,
        username: admin.username,
        real_name: admin.real_name,
        role: admin.role
      }
    });
  } catch (err) {
    console.error('Admin login error:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 用户登录（手机号 + 密码）
router.post('/user/login', async (req, res) => {
  try {
    const { phone, password } = req.body;
    
    if (!phone || !password) {
      return res.status(400).json({ error: '手机号和密码不能为空' });
    }

    const [rows] = await db.query(
      'SELECT * FROM users WHERE phone = ?',
      [phone]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: '用户不存在' });
    }

    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);

    if (!valid) {
      return res.status(401).json({ error: '密码错误' });
    }

    // 生成 token
    const token = jwt.sign(
      { 
        id: user.id, 
        phone: user.phone,
        type: 'user'
      },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        nickname: user.nickname,
        phone: user.phone,
        avatar_url: user.avatar_url,
        is_member: user.is_member,
        available_points: user.available_points
      }
    });
  } catch (err) {
    console.error('User login error:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 用户注册
router.post('/user/register', async (req, res) => {
  try {
    const { phone, password, nickname } = req.body;
    
    if (!phone || !password) {
      return res.status(400).json({ error: '手机号和密码不能为空' });
    }

    // 检查手机号是否已存在
    const [existing] = await db.query(
      'SELECT id FROM users WHERE phone = ?',
      [phone]
    );

    if (existing.length > 0) {
      return res.status(409).json({ error: '手机号已注册' });
    }

    const password_hash = await bcrypt.hash(password, 10);

    const [result] = await db.query(
      'INSERT INTO users (phone, password_hash, nickname) VALUES (?, ?, ?)',
      [phone, password_hash, nickname || `用户${phone.slice(-4)}`]
    );

    res.json({ 
      message: '注册成功',
      user_id: result.insertId
    });
  } catch (err) {
    console.error('User register error:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 商家登录
router.post('/merchant/login', async (req, res) => {
  try {
    const { phone, password } = req.body;
    
    // MVP 版本简化：使用管理员账号登录商家端
    // 实际项目应该有独立的商家账号体系
    
    res.status(400).json({ error: '商家登录功能开发中' });
  } catch (err) {
    console.error('Merchant login error:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;
