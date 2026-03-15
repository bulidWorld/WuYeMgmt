/**
 * 物业路由
 */
const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticate, requireProperty } = require('../middleware/auth');

// 物业登录
router.post('/login', async (req, res) => {
  try {
    const { phone, password } = req.body;
    
    if (!phone || !password) {
      return res.status(400).json({ error: '手机号和密码不能为空' });
    }

    const [rows] = await db.query(
      'SELECT * FROM properties WHERE contact_phone = ? AND status = 1',
      [phone]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: '物业账号不存在或已禁用' });
    }

    const property = rows[0];
    
    // MVP 版本：如果 password_hash 为空，使用明文密码对比
    let valid = false;
    if (property.password_hash) {
      const bcrypt = require('bcryptjs');
      valid = await bcrypt.compare(password, property.password_hash);
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
        id: property.id, 
        name: property.name,
        type: 'property'
      },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({
      token,
      property: {
        id: property.id,
        name: property.name,
        community_name: property.community_name,
        contact_name: property.contact_name,
        contact_phone: property.contact_phone
      }
    });
  } catch (err) {
    console.error('Property login error:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 获取物业信息
router.get('/info', authenticate, requireProperty, async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT id, name, community_name, contact_name, contact_phone, address, settlement_day FROM properties WHERE id = ?',
      [req.user.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: '物业不存在' });
    }
    res.json({ property: rows[0] });
  } catch (err) {
    console.error('Get property info error:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 更新物业信息
router.post('/info', authenticate, requireProperty, async (req, res) => {
  try {
    const { contact_name, contact_phone, address } = req.body;
    
    await db.query(
      `UPDATE properties SET contact_name = ?, contact_phone = ?, address = ?, updated_at = NOW()
       WHERE id = ?`,
      [contact_name, contact_phone, address, req.user.id]
    );

    res.json({ message: '信息已更新' });
  } catch (err) {
    console.error('Update property info error:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 获取待核销的抵扣申请
router.get('/deductions/pending', authenticate, requireProperty, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT d.*, u.nickname, u.phone, u.building_no, u.unit_no, u.room_no
       FROM property_deductions d
       LEFT JOIN users u ON d.user_id = u.id
       WHERE d.property_id = ? AND d.status = 0
       ORDER BY d.created_at DESC`,
      [req.user.id]
    );
    res.json({ list: rows });
  } catch (err) {
    console.error('Get pending deductions error:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 获取抵扣申请列表
router.get('/deductions', authenticate, requireProperty, async (req, res) => {
  try {
    const { status, keyword } = req.query;
    let sql = `SELECT d.*, u.nickname, u.phone 
               FROM property_deductions d
               LEFT JOIN users u ON d.user_id = u.id
               WHERE d.property_id = ?`;
    const params = [req.user.id];
    
    if (status !== undefined) {
      sql += ' AND d.status = ?';
      params.push(status);
    }
    if (keyword) {
      sql += ' AND (u.nickname LIKE ? OR u.phone LIKE ?)';
      params.push(`%${keyword}%`, `%${keyword}%`);
    }
    
    sql += ' ORDER BY d.created_at DESC LIMIT 100';
    
    const [rows] = await db.query(sql, params);
    res.json({ list: rows });
  } catch (err) {
    console.error('Get deductions error:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 审核抵扣申请
router.post('/deductions/:id/audit', authenticate, requireProperty, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, audit_remark } = req.body; // status: 1-通过 3-驳回
    
    // 验证申请属于当前物业
    const [check] = await db.query(
      'SELECT id, status FROM property_deductions WHERE id = ? AND property_id = ?',
      [id, req.user.id]
    );
    if (check.length === 0) {
      return res.status(404).json({ error: '申请不存在' });
    }
    if (check[0].status !== 0) {
      return res.status(400).json({ error: '申请已处理' });
    }

    await db.query(
      `UPDATE property_deductions SET status = ?, audit_remark = ?, audit_at = NOW(), audit_by = ?
       WHERE id = ?`,
      [status, audit_remark, req.user.id, id]
    );

    // 如果驳回，退还积分
    if (status === 3) {
      const [deduction] = await db.query('SELECT user_id, points_used FROM property_deductions WHERE id = ?', [id]);
      if (deduction.length > 0) {
        await db.query(
          'UPDATE users SET available_points = available_points + ? WHERE id = ?',
          [deduction[0].points_used, deduction[0].user_id]
        );
      }
    }

    res.json({ message: '审核完成' });
  } catch (err) {
    console.error('Audit deduction error:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 核销抵扣（确认使用积分）
router.post('/deductions/:id/verify', authenticate, requireProperty, async (req, res) => {
  try {
    const { id } = req.params;
    
    // 验证申请属于当前物业且已通过审核
    const [check] = await db.query(
      'SELECT * FROM property_deductions WHERE id = ? AND property_id = ? AND status = 1',
      [id, req.user.id]
    );
    if (check.length === 0) {
      return res.status(404).json({ error: '申请不存在或未通过审核' });
    }

    const deduction = check[0];

    // 扣除用户积分
    await db.query(
      'UPDATE users SET available_points = available_points - ? WHERE id = ?',
      [deduction.points_used, deduction.user_id]
    );

    // 记录积分消耗
    await db.query(
      `INSERT INTO low_carbon_points (user_id, points, type, source_type, source_id, balance_after, remark)
       VALUES (?, ?, 4, 1, ?, ?, '物业费抵扣')`,
      [deduction.user_id, -deduction.points_used, id, deduction.points_used]
    );

    // 更新抵扣状态为已核销
    await db.query(
      `UPDATE property_deductions SET status = 2, verified_at = NOW(), verified_by = ?
       WHERE id = ?`,
      [req.user.id, id]
    );

    res.json({ message: '核销完成' });
  } catch (err) {
    console.error('Verify deduction error:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 获取结算统计
router.get('/settlement/stats', authenticate, requireProperty, async (req, res) => {
  try {
    const { month } = req.query; // 格式：2024-01
    
    let dateCondition = '';
    const params = [req.user.id];
    
    if (month) {
      dateCondition = 'AND DATE_FORMAT(verified_at, "%Y-%m") = ?';
      params.push(month);
    }

    const [rows] = await db.query(
      `SELECT 
         COUNT(*) as total_count,
         SUM(deduction_amount) as total_amount,
         SUM(CASE WHEN settlement_status = 0 THEN deduction_amount ELSE 0 END) as pending_amount,
         SUM(CASE WHEN settlement_status = 1 THEN deduction_amount ELSE 0 END) as settled_amount
       FROM property_deductions
       WHERE property_id = ? AND status = 2 ${dateCondition}`,
      params
    );

    res.json({ stats: rows[0] || {
      total_count: 0,
      total_amount: 0,
      pending_amount: 0,
      settled_amount: 0
    }});
  } catch (err) {
    console.error('Get settlement stats error:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 获取待结算列表
router.get('/settlement/pending', authenticate, requireProperty, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT d.*, u.nickname, u.phone
       FROM property_deductions d
       LEFT JOIN users u ON d.user_id = u.id
       WHERE d.property_id = ? AND d.status = 2 AND d.settlement_status = 0
       ORDER BY d.verified_at`,
      [req.user.id]
    );
    res.json({ list: rows });
  } catch (err) {
    console.error('Get pending settlement error:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 确认结算
router.post('/settlement/:id/confirm', authenticate, requireProperty, async (req, res) => {
  try {
    const { id } = req.params;
    
    await db.query(
      `UPDATE property_deductions SET settlement_status = 1, settlement_at = NOW()
       WHERE id = ? AND property_id = ?`,
      [id, req.user.id]
    );

    res.json({ message: '结算已确认' });
  } catch (err) {
    console.error('Confirm settlement error:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 批量结算
router.post('/settlement/batch', authenticate, requireProperty, async (req, res) => {
  try {
    const { ids } = req.body; // 抵扣申请 ID 数组
    
    if (!ids || ids.length === 0) {
      return res.status(400).json({ error: '请选择要结算的记录' });
    }

    const placeholders = ids.map(() => '?').join(',');
    await db.query(
      `UPDATE property_deductions 
       SET settlement_status = 1, settlement_at = NOW()
       WHERE id IN (${placeholders}) AND property_id = ?`,
      [...ids, req.user.id]
    );

    res.json({ message: `已结算 ${ids.length} 条记录` });
  } catch (err) {
    console.error('Batch settlement error:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;
