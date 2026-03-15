# 社区便民低碳超市 MVP 项目 - 当前状态

## 项目位置
`/opt/apps/wuYeMgmt`

## 已完成功能

### ✅ 数据库 (MariaDB 10.6)
- 服务状态：正常运行
- 数据库名：`wuye_mgmt`
- 表数量：15 张（14 张表 + 1 个视图）
- 初始化脚本：`server/sql/init.sql`

### ✅ 后端 API 框架
- Express 服务器配置完成
- 4 角色认证系统（管理员/用户/商家/物业）
- JWT Token 认证
- 静态文件服务

### ✅ 前端页面
1. **PC 登录页** (`server/public/login.html`)
   - 4 角色切换登录
   - 商家入驻申请
   - 用户登录后跳转移动端

2. **用户移动端 H5** (`user-miniprogram/index.html`)
   - 移动端适配界面
   - 用户登录/注册
   - 商品浏览
   - 个人中心
   - 底部导航栏

### ✅ API 路由
- `/api/auth/*` - 认证接口
- `/api/admin/*` - 管理员接口
- `/api/user/*` - 用户接口
- `/api/merchant/*` - 商家接口
- `/api/property/*` - 物业接口

## 访问地址

| 页面 | URL | 状态 |
|------|-----|------|
| PC 登录页 | http://localhost:3000/ | ✅ 正常 |
| 移动端 H5 | http://localhost:3000/mobile/index.html | ✅ 正常 |
| 健康检查 | http://localhost:3000/health | ✅ 正常 |
| API 接口 | http://localhost:3000/api/* | ⚠️ 需修复 |

## 已知问题

### ⚠️ 完整服务启动后自动退出

**现象**: 包含所有路由模块的完整服务 (`src/index.js`) 启动后几秒内自动退出，无错误日志。

**简化版服务** (`src/index.test.js`) 运行正常，证明：
- Node.js 环境正常
- 静态文件服务正常
- 基础路由正常

**可能原因**:
1. 某个路由模块的异步初始化导致进程退出
2. 数据库连接池在某些情况下的未处理异常
3. 模块依赖问题

**临时解决方案**: 使用简化版服务测试前端页面
```bash
cd /opt/apps/wuYeMgmt/server
node src/index.test.js
```

## 数据库配置

```
Host: localhost
Port: 3306
User: root
Password: (空)
Database: wuye_mgmt
```

## 默认账号

| 角色 | 账号 | 密码 |
|------|------|------|
| 管理员 | admin | admin123 |

## 项目结构

```
/opt/apps/wuYeMgmt/
├── PROJECT.md               # 项目说明
├── README.md                # 快速开始
├── server/                  # 后端服务
│   ├── src/
│   │   ├── index.js         # 完整服务（待修复）
│   │   ├── index.test.js    # 简化版服务（可用）
│   │   ├── index.simple.js  # 最小化测试
│   │   ├── config/
│   │   │   └── database.js  # 数据库配置
│   │   ├── middleware/
│   │   │   └── auth.js      # 认证中间件
│   │   └── routes/
│   │       ├── auth.js      # ✅ 认证路由
│   │       ├── admin.js     # ✅ 管理员路由
│   │       ├── user.js      # ✅ 用户路由
│   │       ├── merchant.js  # ✅ 商家路由
│   │       └── property.js  # ✅ 物业路由
│   ├── public/
│   │   └── login.html       # PC 登录页
│   └── package.json
├── user-miniprogram/
│   └── index.html           # 移动端 H5
├── admin/                   # 待开发
├── merchant/                # 待开发
└── property/                # 待开发
```

## 下一步

1. **修复完整服务**: 调试 `src/index.js` 自动退出问题
2. **测试 API 接口**: 确保所有 CRUD 操作正常
3. **完善移动端**: 添加订单、积分等完整功能
4. **开发管理后台**: Vue3 + Element Plus

## 开发团队

- 后端：Node.js + Express + MariaDB
- 前端：原生 H5（移动端适配）

---

**最后更新**: 2026-03-15 08:11 UTC
