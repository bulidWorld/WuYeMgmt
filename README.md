# 社区便民低碳生活超市 MVP

一个集社区超市、低碳积分、物业费抵扣于一体的综合性社区服务平台。

## 项目结构

```
wuYeMgmt/
├── README.md              # 项目说明
├── package.json           # 项目配置
├── docs/                  # 文档
│   └── 需求说明.md        # 需求文档
├── server/                # 后端 API (Node.js + Express)
├── admin/                 # 平台管理端 (Vue3 + Element Plus)
├── merchant/              # 商家端 (Vue3 + Vant)
├── user-miniprogram/      # 用户端 (微信小程序)
└── property/              # 物业端 (简化 H5)
```

## 技术栈

- **后端**: Node.js + Express + MySQL
- **管理端**: Vue3 + Element Plus + Vite
- **商家端**: Vue3 + Vant + Vite
- **用户端**: 微信小程序原生
- **物业端**: 简单 H5 页面

## 快速开始

### 1. 数据库初始化

```bash
mysql -u root -p < server/sql/init.sql
```

### 2. 启动后端服务

```bash
cd server
npm install
npm run dev
```

### 3. 启动管理端

```bash
cd admin
npm install
npm run dev
```

### 4. 启动商家端

```bash
cd merchant
npm install
npm run dev
```

## 核心功能

### 平台管理端
- 基础配置、商品管理、商家管理
- 会员管理、物业对接、订单管理
- 低碳规则设置、数据统计

### 商家端
- 店铺管理、商品上架
- 订单处理、数据查看

### 用户端（小程序）
- 商品浏览购买、订单管理
- 低碳积分、物业费抵扣

### 物业端
- 信息管理、核销结算

## 环境要求

- Node.js >= 18
- MySQL >= 8.0
- 微信开发者工具（小程序开发）

## License

MIT
