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

const pool = mysql.createPool(dbConfig);

(async () => {
  try {
    const conn = await pool.getConnection();
    console.log('✓ 数据库连接成功');
    conn.release();
  } catch (err) {
    console.error('✗ 数据库连接失败:', err.message);
  }
})();

module.exports = pool;
