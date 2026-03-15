# 用户注册功能文档

## 功能概述

用户注册必须提供手机号、密码，并**选择所在小区**（必填）。楼栋号、单元号、房间号为选填。

## 数据库变更

### 新增表：communities（小区表）
```sql
CREATE TABLE communities (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL COMMENT '小区名称',
    address VARCHAR(255) COMMENT '小区地址',
    property_id INT COMMENT '物业 ID',
    building_count INT DEFAULT 0 COMMENT '楼栋数',
    status TINYINT DEFAULT 1 COMMENT '状态：0-停用 1-启用'
);
```

### 示例数据
| ID | 小区名称 | 地址 |
|----|---------|------|
| 1 | 阳光花园 | 朝阳区阳光路 100 号 |
| 2 | 绿城小区 | 海淀区绿城街 88 号 |
| 3 | 滨江家园 | 天河区滨江路 66 号 |
| 4 | 锦绣花园 | 南山区锦绣路 99 号 |
| 5 | 幸福里 | 福田区幸福街 50 号 |

### users 表新增字段
- `community_id` - 小区 ID（必填）
- `building_no` - 楼栋号（选填）
- `unit_no` - 单元号（选填）
- `room_no` - 房间号（选填）

## API 接口

### 获取小区列表
```
GET http://localhost:3001/api/communities
```

**响应示例**:
```json
{
  "list": [
    {"id": 1, "name": "阳光花园", "address": "朝阳区阳光路 100 号"},
    {"id": 2, "name": "绿城小区", "address": "海淀区绿城街 88 号"}
  ]
}
```

### 用户注册
```
POST http://localhost:3001/api/register
Content-Type: application/json

{
  "phone": "13900139000",
  "password": "test123",
  "nickname": "测试用户",
  "community_id": 1,
  "building_no": "1 栋",
  "unit_no": "1 单元",
  "room_no": "101"
}
```

**必填参数**:
| 参数 | 类型 | 说明 |
|------|------|------|
| phone | string | 11 位手机号 |
| password | string | 至少 6 位密码 |
| community_id | int | 小区 ID（必填） |

**选填参数**:
| 参数 | 类型 | 说明 |
|------|------|------|
| nickname | string | 用户昵称 |
| building_no | string | 楼栋号 |
| unit_no | string | 单元号 |
| room_no | string | 房间号 |

**成功响应**:
```json
{"message": "注册成功", "user_id": 1}
```

**错误响应**:
```json
{"error": "请选择所在小区"}
{"error": "手机号已注册"}
{"error": "手机号和密码不能为空"}
```

## 前端页面

### PC 登录页 (3000 端口)
- 点击"立即注册"进入注册页面
- 小区选择为下拉框（必填）
- 楼栋/单元/房间为选填输入框

### 移动端 H5 (3001 端口)
- 点击"立即注册"弹出注册表单
- 小区选择为下拉框（必填，带*标记）
- 注册成功后自动跳转到登录页

## 注册流程

```
1. 用户输入手机号、密码
         ↓
2. 选择所在小区（必填）
         ↓
3. 填写楼栋/单元/房间（选填）
         ↓
4. 提交注册
         ↓
5. 验证手机号是否已存在
         ↓
6. 创建用户账号
         ↓
7. 注册成功，跳转登录
```

## 测试用例

### 成功注册
```bash
curl -X POST http://localhost:3001/api/register \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "13900139000",
    "password": "test123",
    "nickname": "测试用户",
    "community_id": 1,
    "building_no": "1 栋",
    "unit_no": "1 单元",
    "room_no": "101"
  }'
```

### 缺少小区（失败）
```bash
curl -X POST http://localhost:3001/api/register \
  -H "Content-Type: application/json" \
  -d '{"phone": "13900139000", "password": "test123"}'
# 返回：{"error": "请选择所在小区"}
```

### 手机号已存在（失败）
```bash
curl -X POST http://localhost:3001/api/register \
  -H "Content-Type: application/json" \
  -d '{"phone": "13900139000", "password": "test123", "community_id": 1}'
# 返回：{"error": "手机号已注册"}
```

## 管理小区数据

### 添加新小区
```sql
INSERT INTO communities (name, address, building_count) 
VALUES ('新小区名称', '小区地址', 10);
```

### 停用小区
```sql
UPDATE communities SET status = 0 WHERE id = 1;
```

### 修改小区信息
```sql
UPDATE communities SET address = '新地址' WHERE id = 1;
```

---

**更新时间**: 2026-03-15 09:48 UTC
