# 安全文档

本文档描述了网站统计服务的安全设计、已实现的安全措施以及建议的安全配置。

## 一、安全架构

### 1.1 整体安全设计

```
┌─────────────────────────────────────────────────────────────────┐
│                        安全防护层                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐    │
│  │  输入验证    │  │  SQL注入防护 │  │    XSS防护         │    │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘    │
└─────────┼────────────────┼─────────────────────┼───────────────┘
          │                │                     │
          ▼                ▼                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                        业务逻辑层                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐    │
│  │  会话管理    │  │  权限控制    │  │    请求频率限制     │    │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘    │
└─────────┼────────────────┼─────────────────────┼───────────────┘
          │                │                     │
          ▼                ▼                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                        数据存储层                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐    │
│  │  SQLite加密 │  │  操作日志    │  │    数据备份策略     │    │
│  └─────────────┘  └─────────────┘  └─────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 安全原则

- **最小权限原则**：用户只能访问其权限范围内的资源
- **纵深防御**：多层安全措施，防止单点失效
- **输入验证**：所有外部输入必须经过验证和清理
- **安全日志**：记录所有关键操作，便于审计
- **加密传输**：敏感数据传输使用HTTPS

---

## 二、已实现的安全措施

### 2.1 输入验证与清理

**SQL注入防护**
- 使用参数化查询（Prepared Statements）
- 禁止拼接SQL字符串
- 代码位置：`server.js` 第278-284行

**XSS防护**
- HTML实体转义函数
- 安全头部设置（X-XSS-Protection）
- 代码位置：`server.js` 第30-38行

**输入清理函数**
```javascript
function sanitizeInput(str, maxLength = 500) {
  if (typeof str === 'number') return str;
  if (typeof str !== 'string') return '';
  return str.substring(0, maxLength).replace(/[<>"'\\]/g, '');
}
```

### 2.2 安全响应头部

服务端已配置以下安全头部：

| 头部 | 值 | 作用 |
|------|-----|------|
| X-Content-Type-Options | nosniff | 防止MIME类型嗅探 |
| X-Frame-Options | DENY | 防止点击劫持 |
| X-XSS-Protection | 1; mode=block | 启用XSS防护 |
| Content-Security-Policy | default-src 'self' | 限制资源加载源 |

代码位置：`server.js` 第14-21行

### 2.3 请求频率限制

- 时间窗口：60秒
- 最大请求数：100次/分钟/IP
- 代码位置：`server.js` 第210-234行

### 2.4 认证与会话管理

- Cookie-based会话管理
- HttpOnly标志（防止JS访问）
- 随机生成的会话ID
- 代码位置：`server.js` 第531-535行

### 2.5 操作日志记录

记录以下操作：
- 登录成功/失败
- 记录删除（普通/强制）
- 批量删除（普通/强制）
- 退出登录

日志包含：
- 操作类型
- 目标ID
- 会话ID
- 客户端IP
- 时间戳

代码位置：`server.js` 第189-208行

---

## 三、安全最佳实践

### 3.1 部署建议

**使用HTTPS**

在生产环境中必须使用HTTPS：

```nginx
server {
    listen 443 ssl;
    server_name your-domain.com;
    
    ssl_certificate /path/to/certificate.crt;
    ssl_certificate_key /path/to/private.key;
    
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    
    location / {
        proxy_pass http://localhost:8000;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

**反向代理配置**

使用Nginx作为反向代理，隐藏真实服务器地址：

```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 3.2 安全配置

**环境变量配置**

建议使用环境变量管理敏感配置：

```bash
# .env 文件
PORT=8000
NODE_ENV=production
SECRET_KEY=your-secret-key-here
ALLOWED_ORIGINS=https://your-domain.com
```

**安全的密钥管理**

```javascript
// 生产环境应从环境变量获取密钥
const SECRET_KEY = process.env.SECRET_KEY || crypto.randomBytes(16).toString('hex');
```

### 3.3 数据库安全

**SQLite安全配置**

虽然SQLite是文件型数据库，但仍需注意：

1. 限制数据库文件权限
```bash
chmod 600 statistics.db
chown www-data:www-data statistics.db
```

2. 定期备份
```bash
# 每天凌晨2点备份
0 2 * * * cp /path/to/statistics.db /path/to/backup/statistics_$(date +%Y%m%d).db
```

### 3.4 访问控制

**IP白名单**

如果服务仅对内网开放，可以配置IP白名单：

```javascript
const ALLOWED_IPS = ['192.168.1.0/24', '10.0.0.0/8'];

app.use((req, res, next) => {
  const clientIp = req.ip || req.connection.remoteAddress;
  
  if (!isIpAllowed(clientIp)) {
    return res.status(403).json({ code: -1, msg: 'IP地址不允许访问' });
  }
  
  next();
});
```

**密钥轮换**

定期更换登录密钥：

```javascript
// 生成新密钥
const newKey = crypto.randomBytes(16).toString('hex');
console.log('新密钥:', newKey);
```

---

## 四、潜在安全风险

### 4.1 风险清单

| 风险类型 | 风险等级 | 描述 | 缓解措施 |
|----------|----------|------|----------|
| SQL注入 | 高 | 恶意SQL语句注入 | 参数化查询 |
| XSS攻击 | 高 | 跨站脚本攻击 | 输入清理、安全头部 |
| CSRF攻击 | 中 | 跨站请求伪造 | 验证请求来源 |
| 会话劫持 | 中 | 窃取会话ID | HttpOnly Cookie、HTTPS |
| 拒绝服务 | 中 | 请求频率过高 | 频率限制 |
| 信息泄露 | 低 | 错误信息暴露 | 统一错误响应 |

### 4.2 安全检查清单

- [ ] 所有用户输入是否经过验证？
- [ ] 是否使用参数化查询？
- [ ] 是否启用HTTPS？
- [ ] 是否配置安全响应头部？
- [ ] 是否有请求频率限制？
- [ ] 是否记录操作日志？
- [ ] 是否定期备份数据库？
- [ ] 是否定期更换密钥？

---

## 五、应急响应

### 5.1 安全事件处理流程

1. **发现事件** → 监控告警或用户报告
2. **确认事件** → 验证事件真实性
3. **隔离影响** → 暂停服务或限制访问
4. **调查根源** → 分析日志，定位问题
5. **修复漏洞** → 修复代码或配置
6. **恢复服务** → 逐步恢复正常运行
7. **报告总结** → 记录事件，总结经验

### 5.2 紧急联系信息

- 安全负责人：[负责人姓名]
- 联系邮箱：[安全邮箱]
- 紧急电话：[紧急联系方式]

---

## 六、安全更新与维护

### 6.1 定期安全检查

| 检查项 | 频率 | 负责人 |
|--------|------|--------|
| 依赖漏洞扫描 | 每周 | 开发人员 |
| 日志审计 | 每月 | 运维人员 |
| 密钥轮换 | 每季度 | 安全负责人 |
| 渗透测试 | 每半年 | 安全团队 |

### 6.2 依赖更新策略

```bash
# 定期检查依赖漏洞
npm audit

# 更新所有依赖
npm update

# 更新特定依赖
npm update express sql.js
```

---

## 七、附录

### 7.1 安全相关代码位置

| 功能 | 文件 | 行号 |
|------|------|------|
| 输入验证 | server.js | 84-92 |
| XSS防护 | server.js | 30-38 |
| 安全头部 | server.js | 14-21 |
| 频率限制 | server.js | 210-234 |
| 会话管理 | server.js | 531-535 |
| 操作日志 | server.js | 189-208 |

### 7.2 参考链接

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Express Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)
- [SQLite Security](https://www.sqlite.org/security.html)

---

**文档版本**: v1.0  
**创建日期**: 2026年  
**版权**: EndlessPixel Studio