/**
 * 用户服务 - 入口文件
 * 端口：3001
 */
const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./config/database');

const app = express();
const PORT = process.env.PORT || 3201;

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 静态文件（移动端 H5）
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use(express.static(path.join(__dirname, '../../..', 'user-miniprogram')));

// 认证中间件
const JWT_SECRET = process.env.JWT_SECRET || 'wuye-mgmt-secret-key-2024';
const jwt = require('jsonwebtoken');

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: '未授权，请登录' });
    }
    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.type !== 'user') {
      return res.status(403).json({ error: '需要用户权限' });
    }
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token 无效或已过期' });
  }
};

// 页面路由
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../../..', 'user-miniprogram', 'index.html'));
});

// 认证接口
app.post('/api/login', async (req, res) => {
  try {
    const { phone, password } = req.body;
    if (!phone || !password) {
      return res.status(400).json({ error: '手机号和密码不能为空' });
    }
    const [rows] = await db.query('SELECT * FROM users WHERE phone = ?', [phone]);
    if (rows.length === 0) {
      return res.status(401).json({ error: '用户不存在' });
    }
    const user = rows[0];
    const valid = await require('bcryptjs').compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: '密码错误' });
    }
    const token = jwt.sign({ id: user.id, phone: user.phone, type: 'user' }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user: { id: user.id, nickname: user.nickname, phone: user.phone, available_points: user.available_points } });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 获取小区列表（只返回启用状态的小区）
app.get('/api/communities', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT c.id, c.name, c.address, p.name as property_name 
      FROM communities c 
      LEFT JOIN properties p ON c.property_id = p.id 
      WHERE c.status = 1 
      ORDER BY p.name, c.name
    `);
    res.json({ list: rows });
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// 获取小区下的楼栋列表
app.get('/api/communities/:communityId/buildings', async (req, res) => {
  try {
    const { communityId } = req.params;
    const [rows] = await db.query(
      'SELECT id, building_no, unit_count, floor_count FROM buildings WHERE community_id = ? AND status = 1 ORDER BY building_no',
      [communityId]
    );
    res.json({ list: rows });
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// 获取楼栋下的单元列表
app.get('/api/buildings/:buildingId/units', async (req, res) => {
  try {
    const { buildingId } = req.params;
    const [rows] = await db.query(
      'SELECT DISTINCT unit_no FROM rooms WHERE building_id = ? AND status = 1 ORDER BY unit_no',
      [buildingId]
    );
    res.json({ list: rows });
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// 获取单元下的房间列表
app.get('/api/buildings/:buildingId/rooms', async (req, res) => {
  try {
    const { buildingId } = req.params;
    const { unit_no } = req.query;
    let sql = 'SELECT unit_no, room_no, floor FROM rooms WHERE building_id = ? AND status = 1';
    const params = [buildingId];
    if (unit_no) {
      sql += ' AND unit_no = ?';
      params.push(unit_no);
    }
    sql += ' ORDER BY unit_no, room_no';
    const [rows] = await db.query(sql, params);
    res.json({ list: rows });
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

app.post('/api/register', async (req, res) => {
  try {
    const { phone, password, nickname, community_id, building_no, unit_no, room_no } = req.body;
    if (!phone || !password) {
      return res.status(400).json({ error: '手机号和密码不能为空' });
    }
    if (!community_id) {
      return res.status(400).json({ error: '请选择所在小区' });
    }
    const [existing] = await db.query('SELECT id FROM users WHERE phone = ?', [phone]);
    if (existing.length > 0) {
      return res.status(409).json({ error: '手机号已注册' });
    }
    const password_hash = await require('bcryptjs').hash(password, 10);
    const [result] = await db.query(
      'INSERT INTO users (phone, password_hash, nickname, community_id, building_no, unit_no, room_no) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [phone, password_hash, nickname || `用户${phone.slice(-4)}`, community_id, building_no || null, unit_no || null, room_no || null]
    );
    res.json({ message: '注册成功', user_id: result.insertId });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 用户信息
app.get('/api/info', authenticate, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT id, nickname, phone, avatar_url, available_points, is_member FROM users WHERE id = ?', [req.user.id]);
    res.json({ user: rows[0] });
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// 商品列表
app.get('/api/products', authenticate, async (req, res) => {
  try {
    const { category_id, is_low_carbon, keyword } = req.query;
    let sql = 'SELECT p.*, m.name as merchant_name FROM products p LEFT JOIN merchants m ON p.merchant_id = m.id WHERE p.status = 1';
    const params = [];
    if (category_id) { sql += ' AND p.category_id = ?'; params.push(category_id); }
    if (is_low_carbon) { sql += ' AND p.is_low_carbon = 1'; }
    if (keyword) { sql += ' AND p.name LIKE ?'; params.push(`%${keyword}%`); }
    sql += ' ORDER BY p.created_at DESC LIMIT 100';
    const [rows] = await db.query(sql, params);
    res.json({ list: rows });
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// 订单列表
// 创建订单（自动计算积分）
app.post('/api/orders', authenticate, async (req, res) => {
  const transaction = await db.getConnection();
  try {
    await transaction.beginTransaction();
    
    const { merchant_id, items, shipping_address, remark } = req.body;
    if (!merchant_id || !items || items.length === 0) {
      await transaction.rollback();
      return res.status(400).json({ error: '参数错误' });
    }
    
    let total_amount = 0;
    let total_points = 0;
    
    for (const item of items) {
      const [products] = await transaction.query(
        'SELECT id, price, stock, points_rate, is_low_carbon FROM products WHERE id = ?',
        [item.product_id]
      );
      if (products.length === 0) {
        await transaction.rollback();
        return res.status(400).json({ error: '商品不存在' });
      }
      if (products[0].stock < item.quantity) {
        await transaction.rollback();
        return res.status(400).json({ error: '商品库存不足' });
      }
      
      const product = products[0];
      const itemTotal = product.price * item.quantity;
      total_amount += itemTotal;
      
      // 积分 = 价格 × 积分率（来自分类）
      // 低碳商品额外奖励 50%
      let itemPoints = Math.floor(itemTotal * (product.points_rate || 1.0));
      if (product.is_low_carbon) {
        itemPoints = Math.floor(itemPoints * 1.5);
      }
      total_points += itemPoints;
      
      // 扣减库存
      await transaction.query('UPDATE products SET stock = stock - ? WHERE id = ?', [item.quantity, product.id]);
      
      // 插入订单项
      await transaction.query(
        'INSERT INTO order_items (order_id, product_id, quantity, price, points_earned) VALUES (?, ?, ?, ?, ?)',
        ['PLACEHOLDER', product.id, item.quantity, product.price, itemPoints]
      );
    }
    
    const order_no = 'ORD' + Date.now() + Math.random().toString(36).substr(2, 6).toUpperCase();
    const [orderResult] = await transaction.query(
      'INSERT INTO orders (order_no, user_id, merchant_id, total_amount, actual_amount, points_earned, shipping_address, remark, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)',
      [order_no, req.user.id, merchant_id, total_amount, total_amount, total_points, JSON.stringify(shipping_address || {}), remark]
    );
    
    // 更新订单项的 order_id
    await transaction.query(
      'UPDATE order_items SET order_id = ? WHERE order_id = "PLACEHOLDER" AND product_id IN (?)',
      [orderResult.insertId, items.map(i => i.product_id)]
    );
    
    await transaction.commit();
    res.json({ 
      message: '订单创建成功', 
      order_id: orderResult.insertId, 
      order_no,
      total_amount,
      total_points 
    });
  } catch (err) {
    await transaction.rollback();
    res.status(500).json({ error: '服务器错误：' + err.message });
  } finally {
    transaction.release();
  }
});

// 订单列表
app.get('/api/orders', authenticate, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC LIMIT 100', [req.user.id]);
    res.json({ list: rows });
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// 积分明细
app.get('/api/points', authenticate, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM low_carbon_points WHERE user_id = ? ORDER BY created_at DESC LIMIT 100', [req.user.id]);
    res.json({ list: rows });
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// 健康检查

// 商品分类（无需认证）
app.get('/api/categories', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT id, name, points_rate, low_carbon_tag FROM product_categories WHERE is_active = 1 ORDER BY sort_order');
    res.json({ list: rows });
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'user', port: PORT });
});

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║     用户服务已启动                                         ║
║     端口：${PORT}                                            ║
║     地址：http://localhost:${PORT}                           ║
║     移动端：http://localhost:${PORT}/                        ║
╚═══════════════════════════════════════════════════════════╝
  `);
});

module.exports = app;

// 购物车 - 获取购物车列表
app.get('/api/cart', authenticate, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT c.*, p.name, p.price, p.stock, p.images, m.name as merchant_name 
       FROM cart_items c 
       LEFT JOIN products p ON c.product_id = p.id 
       LEFT JOIN merchants m ON p.merchant_id = m.id 
       WHERE c.user_id = ? AND p.status = 1
       ORDER BY c.created_at DESC`,
      [req.user.id]
    );
    res.json({ list: rows || [] });
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// 购物车 - 添加商品
app.post('/api/cart', authenticate, async (req, res) => {
  try {
    const { product_id, quantity = 1 } = req.body;
    if (!product_id) return res.status(400).json({ error: '商品 ID 不能为空' });
    
    // 检查商品是否存在
    const [products] = await db.query('SELECT id, stock FROM products WHERE id = ?', [product_id]);
    if (products.length === 0) return res.status(404).json({ error: '商品不存在' });
    if (products[0].stock < quantity) return res.status(400).json({ error: '库存不足' });
    
    // 检查是否已在购物车
    const [existing] = await db.query('SELECT id, quantity FROM cart_items WHERE user_id = ? AND product_id = ?', [req.user.id, product_id]);
    
    if (existing.length > 0) {
      // 更新数量
      const newQty = existing[0].quantity + quantity;
      await db.query('UPDATE cart_items SET quantity = ?, updated_at = NOW() WHERE id = ?', [newQty, existing[0].id]);
    } else {
      // 新增
      await db.query('INSERT INTO cart_items (user_id, product_id, quantity) VALUES (?, ?, ?)', [req.user.id, product_id, quantity]);
    }
    
    res.json({ message: '已添加到购物车' });
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// 购物车 - 更新数量
app.post('/api/cart/:id', authenticate, async (req, res) => {
  try {
    const { quantity } = req.body;
    await db.query('UPDATE cart_items SET quantity = ? WHERE id = ? AND user_id = ?', [quantity, req.params.id, req.user.id]);
    res.json({ message: '已更新' });
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// 购物车 - 删除商品
app.delete('/api/cart/:id', authenticate, async (req, res) => {
  try {
    await db.query('DELETE FROM cart_items WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    res.json({ message: '已删除' });
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// 购物车 - 清空
app.delete('/api/cart', authenticate, async (req, res) => {
  try {
    await db.query('DELETE FROM cart_items WHERE user_id = ?', [req.user.id]);
    res.json({ message: '购物车已清空' });
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// 物业费抵扣申请
app.post('/api/deductions', authenticate, async (req, res) => {
  try {
    const { property_id, points_used, deduction_amount } = req.body;
    if (!property_id || !points_used || !deduction_amount) {
      return res.status(400).json({ error: '参数不完整' });
    }
    
    // 检查积分是否足够
    const [user] = await db.query('SELECT available_points FROM users WHERE id = ?', [req.user.id]);
    if (user[0].available_points < points_used) {
      return res.status(400).json({ error: '积分不足' });
    }
    
    // 创建抵扣申请
    const order_no = 'DED' + Date.now() + Math.random().toString(36).substr(2, 6).toUpperCase();
    const [result] = await db.query(
      `INSERT INTO property_deductions (order_no, user_id, property_id, points_used, deduction_amount, status, apply_at) 
       VALUES (?, ?, ?, ?, ?, 0, NOW())`,
      [order_no, req.user.id, property_id, points_used, deduction_amount]
    );
    
    res.json({ message: '抵扣申请已提交', deduction_id: result.insertId });
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// 我的抵扣申请列表
app.get('/api/deductions', authenticate, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT d.*, p.name as property_name, p.community_name 
       FROM property_deductions d 
       LEFT JOIN properties p ON d.property_id = p.id 
       WHERE d.user_id = ? 
       ORDER BY d.created_at DESC LIMIT 100`,
      [req.user.id]
    );
    res.json({ list: rows || [] });
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// 物业列表（用户选择）
app.get('/api/properties', authenticate, async (req, res) => {
  try {
    // 获取用户所在小区关联的物业
    const [user] = await db.query('SELECT community_id FROM users WHERE id = ?', [req.user.id]);
    if (user[0] && user[0].community_id) {
      const [rows] = await db.query(
        `SELECT DISTINCT p.id, p.name, p.community_name, p.contact_phone 
         FROM properties p 
         LEFT JOIN communities c ON p.id = c.property_id 
         WHERE c.id = ? OR p.status = 1 
         ORDER BY p.name`,
        [user[0].community_id]
      );
      res.json({ list: rows || [] });
    } else {
      const [rows] = await db.query('SELECT id, name, community_name, contact_phone FROM properties WHERE status = 1 ORDER BY name');
      res.json({ list: rows || [] });
    }
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// 会员套餐列表
app.get('/api/member/packages', authenticate, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM member_packages WHERE is_active = 1 ORDER BY price');
    res.json({ list: rows || [] });
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// 购买会员
app.post('/api/member/buy', authenticate, async (req, res) => {
  try {
    const { package_id } = req.body;
    const [packages] = await db.query('SELECT * FROM member_packages WHERE id = ? AND is_active = 1', [package_id]);
    if (packages.length === 0) return res.status(400).json({ error: '套餐不存在' });
    
    const pkg = packages[0];
    const now = new Date();
    const endAt = new Date(now.getTime() + pkg.duration_days * 24 * 60 * 60 * 1000);
    
    // 更新用户会员状态
    await db.query('UPDATE users SET is_member = 1, member_expire_at = ? WHERE id = ?', [endAt, req.user.id]);
    
    // 创建会员记录
    await db.query('INSERT INTO user_memberships (user_id, package_id, start_at, end_at, status) VALUES (?, ?, ?, ?, 1)', 
      [req.user.id, package_id, now, endAt]);
    
    res.json({ message: '会员开通成功', expire_at: endAt.toISOString() });
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});
