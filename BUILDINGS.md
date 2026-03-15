# 小区楼栋房间管理文档

## 数据库表结构

### 1. communities (小区表)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INT | 主键 |
| name | VARCHAR(100) | 小区名称 |
| address | VARCHAR(255) | 小区地址 |
| property_id | INT | 所属物业 ID |
| status | TINYINT | 状态 |

### 2. buildings (楼栋表)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INT | 主键 |
| community_id | INT | 小区 ID (外键) |
| building_no | VARCHAR(20) | 栋号 (如 "1 栋") |
| unit_count | INT | 单元数 |
| floor_count | INT | 楼层数 |
| status | TINYINT | 状态 |

### 3. rooms (房间表)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INT | 主键 |
| building_id | INT | 楼栋 ID (外键) |
| unit_no | VARCHAR(10) | 单元号 (如 "1 单元") |
| room_no | VARCHAR(10) | 房号 (如 "101") |
| floor | INT | 楼层 |
| status | TINYINT | 状态 |

## 层级关系

```
物业公司 (properties)
└── 小区 (communities)
    └── 楼栋 (buildings)
        └── 房间 (rooms)
            ├── 单元号 (unit_no)
            └── 房号 (room_no)
```

## API 接口

### 用户服务 (3001 端口) - 查询接口

#### 获取小区列表
```
GET /api/communities
```

#### 获取小区下的楼栋
```
GET /api/communities/:communityId/buildings
```

#### 获取楼栋下的单元
```
GET /api/buildings/:buildingId/units
```

#### 获取房间列表
```
GET /api/buildings/:buildingId/rooms?unit_no=1 单元
```

### 物业服务 (3003 端口) - 管理接口

#### 获取管辖的小区
```
GET /api/communities
Authorization: Bearer <token>
```

#### 创建小区
```
POST /api/communities
Authorization: Bearer <token>
{
  "name": "小区名称",
  "address": "小区地址"
}
```

#### 获取小区下的楼栋
```
GET /api/communities/:communityId/buildings
Authorization: Bearer <token>
```

#### 创建楼栋
```
POST /api/communities/:communityId/buildings
Authorization: Bearer <token>
{
  "building_no": "5 栋",
  "unit_count": 2,
  "floor_count": 6
}
```

#### 获取楼栋下的房间
```
GET /api/buildings/:buildingId/rooms
Authorization: Bearer <token>
```

#### 批量创建房间
```
POST /api/buildings/:buildingId/rooms/batch
Authorization: Bearer <token>
{
  "rooms": [
    {"unit_no": "1 单元", "room_no": "401", "floor": 4},
    {"unit_no": "1 单元", "room_no": "402", "floor": 4}
  ]
}
```

#### 单个创建房间
```
POST /api/buildings/:buildingId/rooms
Authorization: Bearer <token>
{
  "unit_no": "1 单元",
  "room_no": "601",
  "floor": 6
}
```

## 示例数据

### 小区
| ID | 名称 | 物业 |
|----|------|------|
| 1 | 阳光花园 | 阳光物业 |
| 2 | 绿城小区 | 绿城物业 |
| 3 | 滨江家园 | 滨江物业 |

### 楼栋 (阳光花园)
| ID | 栋号 | 单元数 | 楼层数 |
|----|------|--------|--------|
| 1 | 1 栋 | 2 | 6 |
| 2 | 2 栋 | 2 | 6 |
| 3 | 3 栋 | 3 | 11 |

### 房间 (1 栋)
| 单元 | 房号 | 楼层 |
|------|------|------|
| 1 单元 | 101 | 1 |
| 1 单元 | 102 | 1 |
| 1 单元 | 201 | 2 |
| 1 单元 | 202 | 2 |
| 2 单元 | 103 | 1 |
| 2 单元 | 104 | 1 |

## 用户注册流程

```
1. 选择小区
   ↓
2. 选择楼栋
   ↓
3. 选择单元
   ↓
4. 选择房间
   ↓
5. 完成注册
```

## 测试用例

### 物业创建楼栋
```bash
TOKEN=$(curl -s -X POST http://localhost:3003/api/login \
  -H "Content-Type: application/json" \
  -d '{"phone":"13800138001","password":"123456"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")

# 创建楼栋
curl -X POST http://localhost:3003/api/communities/1/buildings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"building_no":"6 栋","unit_count":3,"floor_count":18}'
```

### 批量创建房间
```bash
curl -X POST http://localhost:3003/api/buildings/8/rooms/batch \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "rooms": [
      {"unit_no":"1 单元","room_no":"101","floor":1},
      {"unit_no":"1 单元","room_no":"102","floor":1},
      {"unit_no":"2 单元","room_no":"201","floor":2}
    ]
  }'
```

### 用户查询可用房间
```bash
# 查询小区楼栋
curl http://localhost:3001/api/communities/1/buildings

# 查询楼栋单元
curl http://localhost:3001/api/buildings/1/units

# 查询单元房间
curl "http://localhost:3001/api/buildings/1/rooms"
```

---

**更新时间**: 2026-03-15 10:35 UTC
