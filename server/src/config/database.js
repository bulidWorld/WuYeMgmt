/**
 * 数据库配置
 */
const mysql = require('mysql2/promise');

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'wuye_mgmt',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

// 创建连接池
const pool = mysql.createPool(dbConfig);

// 异步测试连接（不阻塞模块加载）
(async () => {
  try {
    const connection = await pool.getConnection();
    console.log('✓ 数据库连接成功');
    connection.release();
  } catch (err) {
    console.error('✗ 数据库连接失败:', err.message);
  }
})();

module.exports = pool;
