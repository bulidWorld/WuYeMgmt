/**
 * 用户路由
 */
const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticate } = require('../middleware/auth');

// 获取用户信息
router.get('/info', authenticate, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT id, nickname, phone, avatar_url, community_id, building_no, unit_no, room_no,
              total_points, available_points, is_member, member_expire_at
       FROM users WHERE id = ?`,
      [req.user.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }
    res.json({ user: rows[0] });
  } catch (err) {
    console.error('Get user info error:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 更新用户信息
router.post('/info', authenticate, async (req, res) => {
  try {
    const { nickname, avatar_url, community_id, building_no, unit_no, room_no } = req.body;
    
    await db.query(
      `UPDATE users SET nickname = ?, avatar_url = ?, community_id = ?, 
        building_no = ?, unit_no = ?, room_no = ?, updated_at = NOW()
       WHERE id = ?`,
      [nickname, avatar_url, community_id, building_no, unit_no, room_no, req.user.id]
    );

    res.json({ message: '信息已更新' });
  } catch (err) {
    console.error('Update user info error:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 获取商品列表
router.get('/products', authenticate, async (req, res) => {
  try {
    const { category_id, merchant_id, is_low_carbon, keyword, sort } = req.query;
    let sql = `SELECT p.*, m.name as merchant_name, m.address as merchant_address,
                      c.name as category_name
               FROM products p 
               LEFT JOIN merchants m ON p.merchant_id = m.id
               LEFT JOIN product_categories c ON p.category_id = c.id
               WHERE p.status = 1`;
    const params = [];
    
    if (category_id) {
      sql += ' AND p.category_id = ?';
      params.push(category_id);
    }
    if (merchant_id) {
      sql += ' AND p.merchant_id = ?';
      params.push(merchant_id);
    }
    if (is_low_carbon) {
      sql += ' AND p.is_low_carbon = 1';
    }
    if (keyword) {
      sql += ' AND p.name LIKE ?';
      params.push(`%${keyword}%`);
    }
    
    if (sort === 'sales') {
      sql += ' ORDER BY p.sales_count DESC';
    } else if (sort === 'price_asc') {
      sql += ' ORDER BY p.price ASC';
    } else if (sort === 'price_desc') {
      sql += ' ORDER BY p.price DESC';
    } else {
      sql += ' ORDER BY p.created_at DESC';
    }
    
    sql += ' LIMIT 100';
    
    const [rows] = await db.query(sql, params);
    res.json({ list: rows });
  } catch (err) {
    console.error('Get products error:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 获取商品详情
router.get('/products/:id', authenticate, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT p.*, m.name as merchant_name, m.contact_phone as merchant_phone
       FROM products p LEFT JOIN merchants m ON p.merchant_id = m.id
       WHERE p.id = ? AND p.status = 1`,
      [req.params.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: '商品不存在' });
    }
    res.json({ product: rows[0] });
  } catch (err) {
    console.error('Get product error:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 创建订单
router.post('/orders', authenticate, async (req, res) => {
  const transaction = await db.getConnection();
  try {
    await transaction.beginTransaction();
    
    const { merchant_id, order_type, items, shipping_address, remark } = req.body;
    
    if (!merchant_id || !items || items.length === 0) {
      return res.status(400).json({ error: '参数错误' });
    }

    // 计算订单总额
    let total_amount = 0;
    let total_points = 0;
    
    for (const item of items) {
      const [products] = await transaction.query(
        'SELECT price, stock, is_low_carbon, points_rate FROM products WHERE id = ?',
        [item.product_id]
      );
      if (products.length === 0) {
        await transaction.rollback();
        return res.status(400).json({ error: `商品 ${item.product_id} 不存在` });
      }
      if (products[0].stock < item.quantity) {
        await transaction.rollback();
        return res.status(400).json({ error: `商品 ${item.product_id} 库存不足` });
      }
      total_amount += products[0].price * item.quantity;
      // 计算积分：基础 1 元 1 分，低碳商品额外 50%
      const itemPoints = Math.floor(products[0].price * item.quantity * (products[0].points_rate || 1));
      total_points += products[0].is_low_carbon ? Math.floor(itemPoints * 1.5) : itemPoints;
    }

    // 生成订单号
    const order_no = 'ORD' + Date.now() + Math.random().toString(36).substr(2, 6).toUpperCase();
    
    // 生成核销码（到店核销订单）
    const verification_code = order_type === 2 ? 
      'V' + Math.random().toString(36).substr(2, 8).toUpperCase() : null;

    // 插入订单
    const [orderResult] = await transaction.query(
      `INSERT INTO orders (order_no, user_id, merchant_id, order_type, total_amount, actual_amount, 
                          points_earned, shipping_address, verification_code, remark, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [order_no, req.user.id, merchant_id, order_type, total_amount, total_amount, 
       total_points, JSON.stringify(shipping_address || {}), verification_code, remark]
    );

    const order_id = orderResult.insertId;

    // 插入订单项
    for (const item of items) {
      const [products] = await transaction.query(
        'SELECT name, price, images FROM products WHERE id = ?',
        [item.product_id]
      );
      const product = products[0];
      
      await transaction.query(
        `INSERT INTO order_items (order_id, product_id, product_name, product_image, price, quantity, total_amount)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [order_id, item.product_id, product.name, product.images ? JSON.parse(product.images)[0] : null,
         product.price, item.quantity, product.price * item.quantity]
      );

      // 扣减库存
      await transaction.query(
        'UPDATE products SET stock = stock - ? WHERE id = ?',
        [item.quantity, item.product_id]
      );
    }

    await transaction.commit();

    res.json({ 
      message: '订单创建成功',
      order: {
        id: order_id,
        order_no,
        verification_code
      }
    });
  } catch (err) {
    await transaction.rollback();
    console.error('Create order error:', err);
    res.status(500).json({ error: '服务器错误' });
  } finally {
    transaction.release();
  }
});

// 获取订单列表
router.get('/orders', authenticate, async (req, res) => {
  try {
    const { status } = req.query;
    let sql = `SELECT o.*, m.name as merchant_name, m.contact_phone as merchant_phone
               FROM orders o LEFT JOIN merchants m ON o.merchant_id = m.id
               WHERE o.user_id = ?`;
    const params = [req.user.id];
    
    if (status !== undefined) {
      sql += ' AND o.status = ?';
      params.push(status);
    }
    
    sql += ' ORDER BY o.created_at DESC LIMIT 100';
    
    const [rows] = await db.query(sql, params);
    res.json({ list: rows });
  } catch (err) {
    console.error('Get orders error:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 获取订单详情
router.get('/orders/:id', authenticate, async (req, res) => {
  try {
    const [orders] = await db.query(
      `SELECT o.*, m.name as merchant_name, m.address as merchant_address
       FROM orders o LEFT JOIN merchants m ON o.merchant_id = m.id
       WHERE o.id = ? AND o.user_id = ?`,
      [req.params.id, req.user.id]
    );
    if (orders.length === 0) {
      return res.status(404).json({ error: '订单不存在' });
    }

    const [items] = await db.query(
      'SELECT * FROM order_items WHERE order_id = ?',
      [req.params.id]
    );

    res.json({ 
      order: orders[0],
      items
    });
  } catch (err) {
    console.error('Get order error:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 确认收货
router.post('/orders/:id/confirm', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    
    // 验证订单属于当前用户
    const [check] = await db.query('SELECT id, status FROM orders WHERE id = ? AND user_id = ?', [id, req.user.id]);
    if (check.length === 0) {
      return res.status(404).json({ error: '订单不存在' });
    }
    if (check[0].status !== 2 && check[0].status !== 3) {
      return res.status(400).json({ error: '订单状态不允许确认收货' });
    }

    await db.query(
      `UPDATE orders SET status = 4, completed_at = NOW() WHERE id = ?`,
      [id]
    );

    // 发放积分
    const [order] = await db.query('SELECT points_earned FROM orders WHERE id = ?', [id]);
    if (order[0].points_earned > 0) {
      await db.query(
        'UPDATE users SET available_points = available_points + ?, total_points = total_points + ? WHERE id = ?',
        [order[0].points_earned, order[0].points_earned, req.user.id]
      );
      await db.query(
        `INSERT INTO low_carbon_points (user_id, points, type, source_type, source_id, balance_after, remark)
         VALUES (?, ?, 1, 1, ?, ?, '订单完成奖励')`,
        [req.user.id, order[0].points_earned, id, order[0].points_earned]
      );
    }

    res.json({ message: '已确认收货' });
  } catch (err) {
    console.error('Confirm order error:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 获取积分明细
router.get('/points', authenticate, async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM low_carbon_points WHERE user_id = ? ORDER BY created_at DESC LIMIT 100',
      [req.user.id]
    );
    res.json({ list: rows });
  } catch (err) {
    console.error('Get points error:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 获取会员套餐
router.get('/member/packages', authenticate, async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM member_packages WHERE is_active = 1 ORDER BY price'
    );
    res.json({ list: rows });
  } catch (err) {
    console.error('Get packages error:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 购买会员
router.post('/member/buy', authenticate, async (req, res) => {
  try {
    const { package_id } = req.body;
    
    const [packages] = await db.query('SELECT * FROM member_packages WHERE id = ? AND is_active = 1', [package_id]);
    if (packages.length === 0) {
      return res.status(400).json({ error: '套餐不存在' });
    }
    
    const pkg = packages[0];
    const now = new Date();
    const endAt = new Date(now.getTime() + pkg.duration_days * 24 * 60 * 60 * 1000);

    // MVP 版本：简化处理，直接开通会员
    await db.query(
      `UPDATE users SET is_member = 1, member_expire_at = ? WHERE id = ?`,
      [endAt, req.user.id]
    );

    await db.query(
      `INSERT INTO user_memberships (user_id, package_id, start_at, end_at, status)
       VALUES (?, ?, ?, ?, 1)`,
      [req.user.id, package_id, now, endAt]
    );

    res.json({ message: '会员开通成功', expire_at: endAt });
  } catch (err) {
    console.error('Buy member error:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 获取分类列表
router.get('/categories', authenticate, async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM product_categories WHERE is_active = 1 ORDER BY sort_order'
    );
    res.json({ list: rows });
  } catch (err) {
    console.error('Get categories error:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 获取商家列表
router.get('/merchants', authenticate, async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT id, name, address, contact_phone, logo_url, description FROM merchants WHERE status = 1'
    );
    res.json({ list: rows });
  } catch (err) {
    console.error('Get merchants error:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;
