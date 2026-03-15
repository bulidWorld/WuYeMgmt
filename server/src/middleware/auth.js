/**
 * 认证中间件
 */
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'wuye-mgmt-secret-key-2024';

// 验证 JWT token
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: '未授权，请登录' });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token 已过期' });
    }
    return res.status(401).json({ error: 'Token 无效' });
  }
};

// 管理员权限验证
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 1) {
    return res.status(403).json({ error: '需要管理员权限' });
  }
  next();
};

// 商家权限验证
const requireMerchant = (req, res, next) => {
  if (req.user.type !== 'merchant') {
    return res.status(403).json({ error: '需要商家权限' });
  }
  next();
};

// 物业权限验证
const requireProperty = (req, res, next) => {
  if (req.user.type !== 'property') {
    return res.status(403).json({ error: '需要物业权限' });
  }
  next();
};

module.exports = {
  authenticate,
  requireAdmin,
  requireMerchant,
  requireProperty,
  JWT_SECRET
};
