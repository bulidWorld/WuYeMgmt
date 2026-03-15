# 社区便民低碳超市 MVP 项目

## 项目概述

整合社区商业、低碳生活、物业管理的综合性平台。用户购物获得低碳积分，积分可抵扣物业费。

**项目位置**: `/opt/apps/wuYeMgmt`

## 技术栈

- **后端**: Node.js + Express + MariaDB
- **前端**: 
  - PC 管理端（待开发）
  - 商家端（待开发）
  - 用户移动端 H5（已完成）
  - 物业端（待开发）

## 访问地址

| 端 | 地址 | 说明 |
|---|---|---|
| PC 登录页 | http://localhost:3000/ | 支持 4 角色登录 |
| 用户移动端 | http://localhost:3000/mobile | 适配手机端的 H5 页面 |
| API 服务 | http://localhost:3000/api/* | RESTful API |
| 健康检查 | http://localhost:3000/health | 服务状态 |

## 角色与账号

### 4 个独立角色

| 角色 | 登录接口 | 默认账号 |
|------|---------|---------|
| 管理员 | `POST /api/auth/admin/login` | admin / admin123 |
| 用户 | `POST /api/auth/user/login` | 需注册 |
| 商家 | `POST /api/auth/merchant/login` | 需入驻申请 |
| 物业 | `POST /api/auth/property/login` | 需创建 |

## 数据库

- **类型**: MariaDB 10.6
- **库名**: `wuye_mgmt`
- **表数量**: 14 张表 + 1 个视图

### 核心数据表

- `users` - 用户表
- `merchants` - 商家表
- `properties` - 物业表
- `admins` - 管理员表
- `products` - 商品表
- `orders` - 订单表
- `low_carbon_points` - 低碳积分表
- `property_deductions` - 物业费抵扣表

## API 接口

### 认证接口
- `POST /api/auth/admin/login` - 管理员登录
- `POST /api/auth/user/login` - 用户登录
- `POST /api/auth/user/register` - 用户注册
- `POST /api/auth/merchant/login` - 商家登录
- `POST /api/auth/merchant/register` - 商家入驻申请
- `POST /api/auth/property/login` - 物业登录

### 管理员接口
- `GET /api/admin/info` - 获取管理员信息
- `GET /api/admin/stats` - 平台数据统计
- `GET /api/admin/config` - 平台配置
- `POST /api/admin/config` - 更新配置

### 用户接口（移动端）
- `GET /api/user/info` - 用户信息
- `GET /api/user/products` - 商品列表
- `POST /api/user/orders` - 创建订单
- `GET /api/user/orders` - 订单列表
- `GET /api/user/points` - 积分明细
- `GET /api/user/member/packages` - 会员套餐
- `POST /api/user/member/buy` - 购买会员

### 商家接口
- `GET /api/merchant/info` - 商家信息
- `GET /api/merchant/products` - 商品列表
- `POST /api/merchant/products` - 创建商品
- `GET /api/merchant/orders` - 订单列表
- `POST /api/merchant/orders/:id/status` - 更新订单状态
- `GET /api/merchant/materials` - 素材库

### 物业接口
- `GET /api/property/info` - 物业信息
- `GET /api/property/deductions` - 抵扣申请列表
- `POST /api/property/deductions/:id/audit` - 审核申请
- `POST /api/property/deductions/:id/verify` - 核销积分
- `GET /api/property/settlement/stats` - 结算统计

## 启动服务

```bash
cd /opt/apps/wuYeMgmt/server
npm start
```

服务端口：`3000`

## 项目结构

```
/opt/apps/wuYeMgmt/
├── README.md                  # 项目说明
├── package.json               # 项目配置
├── docs/
│   └── 需求说明.md            # 需求文档
├── server/                    # 后端服务
│   ├── src/
│   │   ├── index.js           # 入口文件
│   │   ├── config/
│   │   │   └── database.js    # 数据库配置
│   │   ├── middleware/
│   │   │   └── auth.js        # 认证中间件
│   │   ├── routes/
│   │   │   ├── auth.js        # 认证路由
│   │   │   ├── admin.js       # 管理员路由
│   │   │   ├── user.js        # 用户路由
│   │   │   ├── merchant.js    # 商家路由
│   │   │   └── property.js    # 物业路由
│   │   └── sql/
│   │       └── init.sql       # 数据库初始化脚本
│   ├── public/
│   │   └── login.html         # PC 登录页
│   ├── package.json
│   └── .env                   # 环境配置
├── user-miniprogram/          # 用户移动端 H5
│   └── index.html             # 移动端首页
├── admin/                     # 管理端（待开发）
├── merchant/                  # 商家端（待开发）
└── property/                  # 物业端（待开发）
```

## 核心功能

### MVP 已完成
- ✅ 数据库设计与初始化
- ✅ 4 角色认证系统
- ✅ 后端 API 框架
- ✅ 用户移动端 H5 界面
- ✅ 商品浏览
- ✅ 订单创建
- ✅ 积分体系
- ✅ 物业费抵扣流程

### 待开发
- [ ] 管理端后台
- [ ] 商家端后台
- [ ] 物业端后台
- [ ] 支付集成
- [ ] 快递接口
- [ ] 消息通知

## 开发团队

- **后端**: Express + MariaDB
- **前端**: 原生 H5（移动端）
- **部署**: 本地开发环境

---

**最后更新**: 2026-03-15
