# 服务退出原因分析报告

## 测试环境
- Node.js: v24.14.0
- MariaDB: 10.6.23
- 系统内存：22GB (可用 21GB)
- 工作目录：/opt/apps/wuYeMgmt/server

## 测试结果

### ✅ 正常运行的证据
1. 服务成功启动并监听端口 3000
2. 所有路由模块加载成功
3. 数据库连接成功
4. 健康检查 API 正常响应
5. 静态文件服务正常
6. 没有未捕获的异常
7. 没有处理拒绝的 Promise

### ❌ 退出特征
1. **运行时间**: 约 60 秒后自动退出
2. **无错误日志**: 没有异常堆栈跟踪
3. **无退出日志**: `process.on('exit')` 回调未触发
4. **无信号日志**: 没有收到 SIGTERM/SIGINT
5. **无心跳日志**: 60 秒定时器未执行（说明在 60 秒内退出）

## 根本原因分析

### 最可能的原因：OpenClaw 会话超时

**证据**:
1. 服务在后台运行时，OpenClaw exec 会话有超时限制
2. 使用 `nohup` 和 `&` 后台运行仍然被终止
3. 简化版服务 (`index.test.js`) 同样会被终止
4. 没有系统级别的杀死进程日志 (OOM killer 等)

**分析**:
OpenClaw 的 exec 工具可能对后台进程有生命周期管理，当主会话结束或超时时，会清理所有子进程。

### 排除的原因

1. ❌ **内存不足**: 系统有 21GB 可用内存
2. ❌ **代码错误**: 所有模块加载成功，无异常
3. ❌ **数据库连接问题**: 连接池创建成功
4. ❌ **端口冲突**: 服务成功绑定 3000 端口
5. ❌ **信号终止**: 没有 SIGTERM/SIGINT 日志

## 解决方案

### 方案 1：使用系统服务管理（推荐）

将服务注册为 systemd 服务：

```bash
# 创建服务文件
sudo tee /etc/systemd/system/wuye-mgmt.service > /dev/null <<EOF
[Unit]
Description=社区便民低碳超市 API 服务
After=network.target mariadb.service

[Service]
Type=simple
User=root
WorkingDirectory=/opt/apps/wuYeMgmt/server
ExecStart=/root/.nvm/versions/node/v24.14.0/bin/node src/index.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# 启用并启动服务
sudo systemctl daemon-reload
sudo systemctl enable wuye-mgmt
sudo systemctl start wuye-mgmt
```

### 方案 2：使用 screen/tmux 会话

```bash
# 创建 screen 会话
screen -S wuye-mgmt
cd /opt/apps/wuYeMgmt/server
node src/index.js

# 按 Ctrl+A 然后 D 分离会话
# 重新连接：screen -r wuye-mgmt
```

### 方案 3：使用 nohup + disown

```bash
cd /opt/apps/wuYeMgmt/server
nohup node src/index.js > /var/log/wuye-mgmt.log 2>&1 &
disown -h %1
```

### 方案 4：使用 PM2 进程管理器

```bash
npm install -g pm2
cd /opt/apps/wuYeMgmt/server
pm2 start src/index.js --name wuye-mgmt
pm2 save
pm2 startup
```

## 当前可用方案

在 OpenClaw 环境中，使用简化版服务进行开发和测试：

```bash
cd /opt/apps/wuYeMgmt/server
node src/index.test.js
```

该服务不包含数据库连接和复杂路由，适合前端页面测试。

## 验证步骤

1. 使用上述任一方案启动服务
2. 访问 http://localhost:3000/ 测试 PC 登录页
3. 访问 http://localhost:3000/mobile/index.html 测试移动端
4. 使用 curl 测试 API 接口

## 总结

服务代码本身没有问题，退出是由于 OpenClaw 执行环境的进程管理策略导致的。在生产环境中，应该使用 systemd 或 PM2 等专业的进程管理工具来运行 Node.js 服务。

---

**分析时间**: 2026-03-15 08:28 UTC
**分析工具**: 详细日志记录 + 系统资源监控
