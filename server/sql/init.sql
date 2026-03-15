-- 社区便民低碳生活超市 MVP 数据库初始化脚本
-- 使用 MariaDB 10.6+

-- 创建数据库
CREATE DATABASE IF NOT EXISTS wuye_mgmt DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE wuye_mgmt;

-- ============================================
-- 1. 用户表
-- ============================================
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL COMMENT '用户名',
    password_hash VARCHAR(255) NOT NULL COMMENT '密码哈希',
    phone VARCHAR(20) UNIQUE COMMENT '手机号',
    nickname VARCHAR(50) COMMENT '昵称',
    avatar_url VARCHAR(255) COMMENT '头像 URL',
    community_id INT COMMENT '绑定小区 ID',
    building_no VARCHAR(20) COMMENT '楼栋号',
    unit_no VARCHAR(10) COMMENT '单元号',
    room_no VARCHAR(10) COMMENT '房间号',
    total_points INT DEFAULT 0 COMMENT '累计低碳积分',
    available_points INT DEFAULT 0 COMMENT '可用积分',
    is_member TINYINT(1) DEFAULT 0 COMMENT '是否会员',
    member_expire_at DATETIME COMMENT '会员过期时间',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_phone (phone),
    INDEX idx_community (community_id)
) ENGINE=InnoDB COMMENT='用户表';

-- ============================================
-- 2. 商家表
-- ============================================
CREATE TABLE IF NOT EXISTS merchants (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL COMMENT '商家名称',
    license_no VARCHAR(50) COMMENT '营业执照号',
    contact_name VARCHAR(50) COMMENT '联系人',
    contact_phone VARCHAR(20) COMMENT '联系电话',
    address VARCHAR(255) COMMENT '门店地址',
    latitude DECIMAL(10, 8) COMMENT '纬度',
    longitude DECIMAL(11, 8) COMMENT '经度',
    logo_url VARCHAR(255) COMMENT '商家 Logo',
    description TEXT COMMENT '商家描述',
    business_hours VARCHAR(100) COMMENT '营业时间',
    status TINYINT DEFAULT 1 COMMENT '状态：0-禁用 1-正常 2-暂停',
    audit_status TINYINT DEFAULT 0 COMMENT '审核状态：0-待审核 1-通过 2-驳回',
    audit_remark VARCHAR(255) COMMENT '审核备注',
    profit_sharing_rate DECIMAL(5, 2) DEFAULT 5.00 COMMENT '让利比例 (%)',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_status (status),
    INDEX idx_audit (audit_status)
) ENGINE=InnoDB COMMENT='商家表';

-- ============================================
-- 3. 物业表
-- ============================================
CREATE TABLE IF NOT EXISTS properties (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL COMMENT '物业公司名称',
    community_name VARCHAR(100) COMMENT '小区名称',
    contact_name VARCHAR(50) COMMENT '联系人',
    contact_phone VARCHAR(20) COMMENT '联系电话',
    address VARCHAR(255) COMMENT '地址',
    status TINYINT DEFAULT 1 COMMENT '状态：0-终止 1-合作',
    deduction_rate DECIMAL(5, 2) DEFAULT 1.00 COMMENT '抵扣手续费率 (%)',
    settlement_day INT DEFAULT 25 COMMENT '结算日（每月几号）',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_status (status)
) ENGINE=InnoDB COMMENT='物业表';

-- ============================================
-- 4. 管理员表
-- ============================================
CREATE TABLE IF NOT EXISTS admins (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL COMMENT '用户名',
    password_hash VARCHAR(255) NOT NULL COMMENT '密码哈希',
    real_name VARCHAR(50) COMMENT '真实姓名',
    phone VARCHAR(20) COMMENT '手机号',
    role TINYINT DEFAULT 1 COMMENT '角色：1-超级管理员 2-商品管理员 3-商家管理员 4-会员管理员 5-物业对接员',
    permissions JSON COMMENT '权限配置',
    status TINYINT DEFAULT 1 COMMENT '状态：0-禁用 1-正常',
    last_login_at DATETIME COMMENT '最后登录时间',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_username (username),
    INDEX idx_role (role)
) ENGINE=InnoDB COMMENT='管理员表';

-- ============================================
-- 5. 商品分类表
-- ============================================
CREATE TABLE IF NOT EXISTS product_categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL COMMENT '分类名称',
    parent_id INT DEFAULT 0 COMMENT '父分类 ID',
    icon_url VARCHAR(255) COMMENT '图标 URL',
    sort_order INT DEFAULT 0 COMMENT '排序',
    low_carbon_tag VARCHAR(50) COMMENT '低碳标签',
    is_active TINYINT(1) DEFAULT 1 COMMENT '是否启用',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_parent (parent_id),
    INDEX idx_sort (sort_order)
) ENGINE=InnoDB COMMENT='商品分类表';

-- ============================================
-- 6. 商品素材库表
-- ============================================
CREATE TABLE IF NOT EXISTS product_materials (
    id INT AUTO_INCREMENT PRIMARY KEY,
    category_id INT NOT NULL COMMENT '分类 ID',
    name VARCHAR(100) NOT NULL COMMENT '商品名称',
    description TEXT COMMENT '商品描述',
    images JSON COMMENT '图片 URLs',
    spec_template VARCHAR(255) COMMENT '规格模板',
    low_carbon_tags JSON COMMENT '低碳标签',
    usage_count INT DEFAULT 0 COMMENT '调用次数',
    is_active TINYINT(1) DEFAULT 1 COMMENT '是否启用',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_category (category_id)
) ENGINE=InnoDB COMMENT='商品素材库表';

-- ============================================
-- 7. 商品表
-- ============================================
CREATE TABLE IF NOT EXISTS products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    merchant_id INT NOT NULL COMMENT '商家 ID',
    category_id INT NOT NULL COMMENT '分类 ID',
    material_id INT COMMENT '素材库 ID',
    name VARCHAR(100) NOT NULL COMMENT '商品名称',
    description TEXT COMMENT '商品描述',
    images JSON COMMENT '图片 URLs',
    price DECIMAL(10, 2) NOT NULL COMMENT '售价',
    original_price DECIMAL(10, 2) COMMENT '原价',
    stock INT DEFAULT 0 COMMENT '库存',
    unit VARCHAR(20) DEFAULT '件' COMMENT '单位',
    profit_sharing_rate DECIMAL(5, 2) COMMENT '让利比例 (%)',
    low_carbon_tags JSON COMMENT '低碳标签',
    is_low_carbon TINYINT(1) DEFAULT 0 COMMENT '是否低碳商品',
    points_rate DECIMAL(5, 2) DEFAULT 1.00 COMMENT '积分倍率',
    status TINYINT DEFAULT 1 COMMENT '状态：0-下架 1-上架',
    sales_count INT DEFAULT 0 COMMENT '销量',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_merchant (merchant_id),
    INDEX idx_category (category_id),
    INDEX idx_status (status),
    INDEX idx_low_carbon (is_low_carbon)
) ENGINE=InnoDB COMMENT='商品表';

-- ============================================
-- 8. 订单表
-- ============================================
CREATE TABLE IF NOT EXISTS orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_no VARCHAR(32) UNIQUE NOT NULL COMMENT '订单号',
    user_id INT NOT NULL COMMENT '用户 ID',
    merchant_id INT NOT NULL COMMENT '商家 ID',
    order_type TINYINT DEFAULT 1 COMMENT '订单类型：1-快递发货 2-到店核销 3-线下付款',
    total_amount DECIMAL(10, 2) NOT NULL COMMENT '订单总额',
    discount_amount DECIMAL(10, 2) DEFAULT 0 COMMENT '优惠金额',
    freight_amount DECIMAL(10, 2) DEFAULT 0 COMMENT '运费',
    actual_amount DECIMAL(10, 2) NOT NULL COMMENT '实付金额',
    points_earned INT DEFAULT 0 COMMENT '获得积分',
    profit_sharing_amount DECIMAL(10, 2) DEFAULT 0 COMMENT '让利金额',
    status TINYINT DEFAULT 0 COMMENT '状态：0-待付款 1-已付款 2-已发货 3-已核销 4-已完成 5-已取消',
    payment_method TINYINT COMMENT '支付方式：1-微信 2-支付宝 3-线下',
    paid_at DATETIME COMMENT '支付时间',
    shipping_address JSON COMMENT '收货地址',
    tracking_no VARCHAR(50) COMMENT '快递单号',
    verification_code VARCHAR(20) COMMENT '核销码',
    verified_at DATETIME COMMENT '核销时间',
    completed_at DATETIME COMMENT '完成时间',
    remark VARCHAR(255) COMMENT '备注',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user (user_id),
    INDEX idx_merchant (merchant_id),
    INDEX idx_order_no (order_no),
    INDEX idx_status (status),
    INDEX idx_created (created_at)
) ENGINE=InnoDB COMMENT='订单表';

-- ============================================
-- 9. 订单项表
-- ============================================
CREATE TABLE IF NOT EXISTS order_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL COMMENT '订单 ID',
    product_id INT NOT NULL COMMENT '商品 ID',
    product_name VARCHAR(100) NOT NULL COMMENT '商品名称',
    product_image VARCHAR(255) COMMENT '商品图片',
    price DECIMAL(10, 2) NOT NULL COMMENT '单价',
    quantity INT NOT NULL COMMENT '数量',
    total_amount DECIMAL(10, 2) NOT NULL COMMENT '小计',
    points_earned INT DEFAULT 0 COMMENT '获得积分',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_order (order_id),
    INDEX idx_product (product_id)
) ENGINE=InnoDB COMMENT='订单项表';

-- ============================================
-- 10. 会员套餐表
-- ============================================
CREATE TABLE IF NOT EXISTS member_packages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL COMMENT '套餐名称',
    duration_days INT NOT NULL COMMENT '有效期（天）',
    price DECIMAL(10, 2) NOT NULL COMMENT '价格',
    discount_rate DECIMAL(5, 2) DEFAULT 0 COMMENT '购物折扣 (%)',
    points_bonus_rate DECIMAL(5, 2) DEFAULT 0 COMMENT '积分加成 (%)',
    description TEXT COMMENT '套餐说明',
    is_active TINYINT(1) DEFAULT 1 COMMENT '是否启用',
    sales_count INT DEFAULT 0 COMMENT '销量',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_active (is_active)
) ENGINE=InnoDB COMMENT='会员套餐表';

-- ============================================
-- 11. 用户会员表
-- ============================================
CREATE TABLE IF NOT EXISTS user_memberships (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL COMMENT '用户 ID',
    package_id INT NOT NULL COMMENT '套餐 ID',
    order_no VARCHAR(32) UNIQUE COMMENT '订单号',
    start_at DATETIME NOT NULL COMMENT '生效时间',
    end_at DATETIME NOT NULL COMMENT '过期时间',
    status TINYINT DEFAULT 1 COMMENT '状态：0-过期 1-有效',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user (user_id),
    INDEX idx_status (status)
) ENGINE=InnoDB COMMENT='用户会员表';

-- ============================================
-- 12. 低碳积分表
-- ============================================
CREATE TABLE IF NOT EXISTS low_carbon_points (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL COMMENT '用户 ID',
    points INT NOT NULL COMMENT '积分数量',
    type TINYINT NOT NULL COMMENT '类型：1-消费获得 2-低碳商品奖励 3-会员奖励 4-抵扣消耗 5-过期清零',
    source_type TINYINT COMMENT '来源类型：1-订单 2-活动 3-手动调整',
    source_id INT COMMENT '来源 ID（订单 ID 等）',
    balance_after INT COMMENT '操作后余额',
    remark VARCHAR(255) COMMENT '备注',
    expires_at DATETIME COMMENT '过期时间',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user (user_id),
    INDEX idx_type (type),
    INDEX idx_created (created_at)
) ENGINE=InnoDB COMMENT='低碳积分明细表';

-- ============================================
-- 13. 物业费抵扣表
-- ============================================
CREATE TABLE IF NOT EXISTS property_deductions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL COMMENT '用户 ID',
    property_id INT NOT NULL COMMENT '物业 ID',
    order_no VARCHAR(32) UNIQUE COMMENT '申请单号',
    points_used INT NOT NULL COMMENT '使用积分',
    deduction_amount DECIMAL(10, 2) NOT NULL COMMENT '抵扣金额',
    status TINYINT DEFAULT 0 COMMENT '状态：0-待审核 1-已通过 2-已核销 3-已驳回',
    apply_at DATETIME COMMENT '申请时间',
    audit_at DATETIME COMMENT '审核时间',
    audit_by INT COMMENT '审核人 ID',
    audit_remark VARCHAR(255) COMMENT '审核备注',
    verified_at DATETIME COMMENT '核销时间',
    verified_by INT COMMENT '核销人 ID',
    settlement_status TINYINT DEFAULT 0 COMMENT '结算状态：0-待结算 1-已结算',
    settlement_at DATETIME COMMENT '结算时间',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user (user_id),
    INDEX idx_property (property_id),
    INDEX idx_status (status)
) ENGINE=InnoDB COMMENT='物业费抵扣表';

-- ============================================
-- 14. 平台配置表
-- ============================================
CREATE TABLE IF NOT EXISTS platform_config (
    id INT AUTO_INCREMENT PRIMARY KEY,
    config_key VARCHAR(50) UNIQUE NOT NULL COMMENT '配置键',
    config_value TEXT COMMENT '配置值',
    config_type TINYINT DEFAULT 1 COMMENT '类型：1-字符串 2-数字 3-JSON 4-布尔',
    description VARCHAR(255) COMMENT '配置说明',
    is_mvp TINYINT(1) DEFAULT 1 COMMENT '是否 MVP 功能',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_key (config_key)
) ENGINE=InnoDB COMMENT='平台配置表';

-- ============================================
-- 初始化基础数据
-- ============================================

-- 插入默认管理员 (密码：admin123)
INSERT INTO admins (username, password_hash, real_name, role, status) VALUES
('admin', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', '系统管理员', 1, 1);

-- 插入商品分类
INSERT INTO product_categories (name, parent_id, sort_order, is_active) VALUES
('粮油调味', 0, 1, 1),
('洗漱护理', 0, 2, 1),
('家居日用', 0, 3, 1),
('生鲜果蔬', 0, 4, 1),
('休闲食品', 0, 5, 1),
('酒水饮料', 0, 6, 1);

-- 插入会员套餐
INSERT INTO member_packages (name, duration_days, price, discount_rate, points_bonus_rate, description, is_active) VALUES
('体验会员', 1, 0.99, 5.00, 10.00, '1 天体验会员，享受 95 折和 10% 积分加成', 1),
('月度会员', 30, 9.90, 10.00, 20.00, '30 天会员，享受 9 折和 20% 积分加成', 1),
('年度会员', 365, 99.00, 15.00, 50.00, '365 天会员，享受 85 折和 50% 积分加成', 1);

-- 插入平台配置
INSERT INTO platform_config (config_key, config_value, config_type, description, is_mvp) VALUES
('platform_name', '社区便民低碳超市', 1, '平台名称', 1),
('points_rate', '1', 2, '基础积分比例 (1 元=1 分)', 1),
('low_carbon_bonus_rate', '0.5', 2, '低碳商品额外积分比例', 1),
('min_profit_sharing', '3', 2, '最低让利比例 (%)', 1),
('max_profit_sharing', '15', 2, '最高让利比例 (%)', 1),
('freight_threshold', '59', 2, '满额免运费门槛', 1);

-- ============================================
-- 视图：订单统计
-- ============================================
CREATE OR REPLACE VIEW v_order_stats AS
SELECT 
    merchant_id,
    COUNT(*) as total_orders,
    SUM(actual_amount) as total_revenue,
    SUM(profit_sharing_amount) as total_profit_sharing,
    SUM(points_earned) as total_points
FROM orders
WHERE status >= 1
GROUP BY merchant_id;

-- ============================================
-- 完成提示
-- ============================================
SELECT '数据库初始化完成！' as message;
