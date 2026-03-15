/**
 * 商家路由
 */
const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticate, requireMerchant } = require('../middleware/auth');
const bcrypt = require('bcryptjs');

// 商家登录
router.post('/login', async (req, res) => {
  try {
    const { phone, password } = req.body;
    
    if (!phone || !password) {
      return res.status(400).json({ error: '手机号和密码不能为空' });
    }

    const [rows] = await db.query(
      'SELECT * FROM merchants WHERE contact_phone = ? AND status = 1',
      [phone]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: '商家不存在或已禁用' });
    }

    const merchant = rows[0];
    
    // MVP 版本：如果 password_hash 为空，使用明文密码对比
    let valid = false;
    if (merchant.password_hash) {
      valid = await bcrypt.compare(password, merchant.password_hash);
    } else {
      // 初始密码默认为手机号后 6 位
      valid = (password === phone.slice(-6));
    }

    if (!valid) {
      return res.status(401).json({ error: '密码错误' });
    }

    const jwt = require('jsonwebtoken');
    const { JWT_SECRET } = require('../middleware/auth');
    
    const token = jwt.sign(
      { 
        id: merchant.id, 
        name: merchant.name,
        type: 'merchant'
      },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({
      token,
      merchant: {
        id: merchant.id,
        name: merchant.name,
        contact_name: merchant.contact_name,
        contact_phone: merchant.contact_phone,
        address: merchant.address,
        status: merchant.status,
        audit_status: merchant.audit_status
      }
    });
  } catch (err) {
    console.error('Merchant login error:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 商家注册/入驻申请
router.post('/register', async (req, res) => {
  try {
    const { name, license_no, contact_name, contact_phone, address } = req.body;
    
    if (!name || !contact_phone) {
      return res.status(400).json({ error: '商家名称和联系电话不能为空' });
    }

    const [existing] = await db.query(
      'SELECT id FROM merchants WHERE contact_phone = ?',
      [contact_phone]
    );

    if (existing.length > 0) {
      return res.status(409).json({ error: '该手机号已注册' });
    }

    const [result] = await db.query(
      `INSERT INTO merchants (name, license_no, contact_name, contact_phone, address, audit_status) 
       VALUES (?, ?, ?, ?, ?, 0)`,
      [name, license_no, contact_name, contact_phone, address]
    );

    res.json({ 
      message: '入驻申请已提交，请等待审核',
      merchant_id: result.insertId
    });
  } catch (err) {
    console.error('Merchant register error:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 获取商家信息
router.get('/info', authenticate, requireMerchant, async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT id, name, license_no, contact_name, contact_phone, address, business_hours, description, logo_url, status, audit_status FROM merchants WHERE id = ?',
      [req.user.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: '商家不存在' });
    }
    res.json({ merchant: rows[0] });
  } catch (err) {
    console.error('Get merchant info error:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 更新商家信息
router.post('/info', authenticate, requireMerchant, async (req, res) => {
  try {
    const { contact_name, contact_phone, address, business_hours, description, logo_url } = req.body;
    
    await db.query(
      `UPDATE merchants SET contact_name = ?, contact_phone = ?, address = ?, 
        business_hours = ?, description = ?, logo_url = ?, updated_at = NOW()
       WHERE id = ?`,
      [contact_name, contact_phone, address, business_hours, description, logo_url, req.user.id]
    );

    res.json({ message: '信息已更新' });
  } catch (err) {
    console.error('Update merchant info error:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 获取商品列表
router.get('/products', authenticate, requireMerchant, async (req, res) => {
  try {
    const { status, keyword } = req.query;
    let sql = 'SELECT * FROM products WHERE merchant_id = ?';
    const params = [req.user.id];
    
    if (status !== undefined) {
      sql += ' AND status = ?';
      params.push(status);
    }
    if (keyword) {
      sql += ' AND name LIKE ?';
      params.push(`%${keyword}%`);
    }
    
    sql += ' ORDER BY created_at DESC';
    
    const [rows] = await db.query(sql, params);
    res.json({ list: rows });
  } catch (err) {
    console.error('Get products error:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 创建商品
router.post('/products', authenticate, requireMerchant, async (req, res) => {
  try {
    const { name, category_id, price, stock, description, images, low_carbon_tags, is_low_carbon } = req.body;
    
    if (!name || !category_id || !price) {
      return res.status(400).json({ error: '商品名称、分类和价格为必填项' });
    }

    const [result] = await db.query(
      `INSERT INTO products (merchant_id, category_id, name, price, stock, description, images, low_carbon_tags, is_low_carbon)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.user.id, category_id, name, price, stock || 0, description, JSON.stringify(images || []), 
       JSON.stringify(low_carbon_tags || []), is_low_carbon ? 1 : 0]
    );

    res.json({ message: '商品已创建', product_id: result.insertId });
  } catch (err) {
    console.error('Create product error:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 更新商品
router.post('/products/:id', authenticate, requireMerchant, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, price, stock, description, status } = req.body;
    
    // 验证商品属于当前商家
    const [check] = await db.query('SELECT id FROM products WHERE id = ? AND merchant_id = ?', [id, req.user.id]);
    if (check.length === 0) {
      return res.status(404).json({ error: '商品不存在' });
    }

    await db.query(
      `UPDATE products SET name = ?, price = ?, stock = ?, description = ?, status = ?, updated_at = NOW()
       WHERE id = ?`,
      [name, price, stock, description, status !== undefined ? status : 1, id]
    );

    res.json({ message: '商品已更新' });
  } catch (err) {
    console.error('Update product error:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 获取订单列表
router.get('/orders', authenticate, requireMerchant, async (req, res) => {
  try {
    const { status, order_type, keyword } = req.query;
    let sql = `SELECT o.*, u.nickname, u.phone 
               FROM orders o LEFT JOIN users u ON o.user_id = u.id 
               WHERE o.merchant_id = ?`;
    const params = [req.user.id];
    
    if (status !== undefined) {
      sql += ' AND o.status = ?';
      params.push(status);
    }
    if (order_type !== undefined) {
      sql += ' AND o.order_type = ?';
      params.push(order_type);
    }
    if (keyword) {
      sql += ' AND o.order_no LIKE ?';
      params.push(`%${keyword}%`);
    }
    
    sql += ' ORDER BY o.created_at DESC LIMIT 100';
    
    const [rows] = await db.query(sql, params);
    res.json({ list: rows });
  } catch (err) {
    console.error('Get orders error:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 更新订单状态
router.post('/orders/:id/status', authenticate, requireMerchant, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, tracking_no } = req.body;
    
    // 验证订单属于当前商家
    const [check] = await db.query('SELECT id FROM orders WHERE id = ? AND merchant_id = ?', [id, req.user.id]);
    if (check.length === 0) {
      return res.status(404).json({ error: '订单不存在' });
    }

    const updates = ['status = ?'];
    const params = [status];
    
    if (status === 2 && tracking_no) {
      updates.push('tracking_no = ?');
      params.push(tracking_no);
    }
    if (status === 4) {
      updates.push('completed_at = NOW()');
    }
    
    params.push(id);
    
    await db.query(
      `UPDATE orders SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`,
      params
    );

    res.json({ message: '订单状态已更新' });
  } catch (err) {
    console.error('Update order status error:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 获取商家数据统计
router.get('/stats', authenticate, requireMerchant, async (req, res) => {
  try {
    const [orders] = await db.query(
      'SELECT COUNT(*) as count, SUM(actual_amount) as amount FROM orders WHERE merchant_id = ? AND status >= 1',
      [req.user.id]
    );
    const [products] = await db.query(
      'SELECT COUNT(*) as count FROM products WHERE merchant_id = ? AND status = 1',
      [req.user.id]
    );
    const [today] = await db.query(
      'SELECT COUNT(*) as count, SUM(actual_amount) as amount FROM orders WHERE merchant_id = ? AND DATE(created_at) = CURDATE()',
      [req.user.id]
    );

    res.json({
      stats: {
        total_orders: orders[0].count || 0,
        total_revenue: orders[0].amount || 0,
        active_products: products[0].count || 0,
        today_orders: today[0].count || 0,
        today_revenue: today[0].amount || 0
      }
    });
  } catch (err) {
    console.error('Get stats error:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 获取素材库
router.get('/materials', authenticate, requireMerchant, async (req, res) => {
  try {
    const { category_id } = req.query;
    let sql = 'SELECT * FROM product_materials WHERE is_active = 1';
    const params = [];
    
    if (category_id) {
      sql += ' AND category_id = ?';
      params.push(category_id);
    }
    
    sql += ' ORDER BY usage_count DESC LIMIT 50';
    
    const [rows] = await db.query(sql, params);
    res.json({ list: rows });
  } catch (err) {
    console.error('Get materials error:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;
