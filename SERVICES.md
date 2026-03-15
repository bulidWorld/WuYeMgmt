# 社区便民低碳超市 - 多服务架构

## 服务架构

项目已重构为 4 个独立的微服务，每个服务负责一个角色，使用不同的端口。

## 端口分配

| 服务 | 端口 | 进程名 | 说明 |
|------|------|--------|------|
| **用户服务** | 3001 | wuye-user | 移动端 H5 + 用户 API |
| **商家服务** | 3002 | wuye-merchant | 商家管理后台 + API |
| **物业服务** | 3003 | wuye-property | 物业管理后台 + API |
| **管理服务** | 3004 | wuye-admin | 平台管理后台 + API |

## 访问地址

### 用户服务 (3001)
- 首页：http://localhost:3001/
- 移动端：http://localhost:3001/mobile/index.html
- API: http://localhost:3001/api/*
- 健康检查：http://localhost:3001/health

### 商家服务 (3002)
- API: http://localhost:3002/api/*
- 健康检查：http://localhost:3002/health

### 物业服务 (3003)
- API: http://localhost:3003/api/*
- 健康检查：http://localhost:3003/health

### 管理服务 (3004)
- API: http://localhost:3004/api/*
- 健康检查：http://localhost:3004/health

## API 接口

### 用户服务 (3001)
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/login | 用户登录 |
| POST | /api/register | 用户注册 |
| GET | /api/info | 用户信息（需认证） |
| GET | /api/products | 商品列表（需认证） |
| GET | /api/orders | 订单列表（需认证） |
| GET | /api/points | 积分明细（需认证） |

### 商家服务 (3002)
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/login | 商家登录 |
| POST | /api/register | 商家入驻申请 |
| GET | /api/info | 商家信息（需认证） |
| GET | /api/products | 商品列表（需认证） |
| POST | /api/products | 创建商品（需认证） |
| GET | /api/orders | 订单列表（需认证） |
| POST | /api/orders/:id/status | 更新订单状态（需认证） |
| GET | /api/stats | 数据统计（需认证） |

### 物业服务 (3003)
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/login | 物业登录 |
| GET | /api/info | 物业信息（需认证） |
| GET | /api/deductions/pending | 待审核抵扣申请（需认证） |
| GET | /api/deductions | 抵扣申请列表（需认证） |
| POST | /api/deductions/:id/audit | 审核申请（需认证） |
| POST | /api/deductions/:id/verify | 核销积分（需认证） |
| GET | /api/settlement/stats | 结算统计（需认证） |

### 管理服务 (3004)
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/login | 管理员登录 |
| GET | /api/info | 管理员信息（需认证） |
| GET | /api/stats | 平台统计（需认证） |
| GET | /api/merchants | 商家列表（需认证） |
| POST | /api/merchants/:id/audit | 审核商家（需认证） |
| GET | /api/categories | 商品分类（需认证） |
| POST | /api/categories | 创建分类（需认证） |
| GET | /api/config | 平台配置（需认证） |
| POST | /api/config | 更新配置（需认证） |

## 服务管理

### 查看所有服务状态
```bash
systemctl status wuye-user wuye-merchant wuye-property wuye-admin
```

### 重启单个服务
```bash
systemctl restart wuye-user
systemctl restart wuye-merchant
systemctl restart wuye-property
systemctl restart wuye-admin
```

### 查看服务日志
```bash
journalctl -u wuye-user -f
journalctl -u wuye-merchant -f
journalctl -u wuye-property -f
journalctl -u wuye-admin -f
```

### 停止服务
```bash
systemctl stop wuye-user wuye-merchant wuye-property wuye-admin
```

## 项目结构

```
/opt/apps/wuYeMgmt/
├── services/
│   ├── user/           # 用户服务 (3001)
│   │   ├── src/
│   │   │   ├── index.js
│   │   │   └── config/
│   │   └── package.json
│   ├── merchant/       # 商家服务 (3002)
│   ├── property/       # 物业服务 (3003)
│   └── admin/          # 管理服务 (3004)
├── server/             # 旧服务（已废弃）
└── user-miniprogram/   # 移动端 H5
```

## 默认账号

| 角色 | 登录地址 | 账号 | 密码 |
|------|---------|------|------|
| 管理员 | http://localhost:3004 | admin | admin123 |
| 用户 | http://localhost:3001 | 需注册 | - |
| 商家 | http://localhost:3002 | 需入驻 | - |
| 物业 | http://localhost:3003 | 需创建 | - |

## 技术栈

- **运行时**: Node.js v24.14.0
- **框架**: Express 4.18
- **数据库**: MariaDB 10.6
- **认证**: JWT
- **进程管理**: systemd

---

**更新时间**: 2026-03-15 09:16 UTC
