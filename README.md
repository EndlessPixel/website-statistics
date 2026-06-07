# Website Statistics

一个基于 Node.js + Express + SQLite 的网页访问统计接口服务。

## 功能特性

- 📊 **访问统计** - 记录网页访问信息（IP、URL、路径、时间等）
- 📈 **数据可视化** - 饼图、柱状图、折线图展示统计数据
- 🔐 **安全认证** - 密钥登录验证
- 📝 **操作日志** - 记录登录、删除、退出等操作
- 🗑️ **记录管理** - 支持单条和批量删除记录
- 🌐 **IP查询** - 调用第三方API查询IP归属地信息
- 💾 **数据缓存** - IP信息24小时服务器端缓存
- 🎨 **主题切换** - 支持深色/浅色模式
- 📱 **响应式设计** - 适配移动端和桌面端

## 技术栈

- **后端**: Node.js + Express
- **数据库**: SQLite（单文件部署）
- **前端**: HTML5 + CSS3 + JavaScript
- **图表**: ECharts
- **安全**: SQL注入防护、XSS防护、请求频率限制

## 快速开始

### 安装依赖

```bash
npm install
```

### 启动服务

```bash
npm start
```

服务启动后会显示：

- 服务地址: `http://localhost:8000`
- 访问密钥（用于查看统计页面）

### 登录

访问登录页面：`http://localhost:8000/login`

在输入框中输入服务器控制台显示的密钥，点击登录。

## API接口

### 统计上报

**POST** `/api/statistics`

请求参数：

```json
{
  "ip": "192.168.1.1",
  "url": "https://example.com",
  "path": "/page",
  "client_time": "2024-01-01 12:00:00",
  "server_time": "2024-01-01 12:00:00"
}
```

响应：

```json
{
  "code": 0,
  "msg": "success"
}
```

### 获取统计数据

**GET** `/api/getStatistics?page=1&pageSize=25`

### 获取统计概览

**GET** `/api/overview`

### 获取图表数据

**GET** `/api/getStats`

### 查询IP信息

**GET** `/api/query-ip?ip=x.x.x.x`

### 删除记录

**DELETE** `/api/statistics/:id`

### 批量删除

**POST** `/api/statistics/batch-delete`

```json
{
  "ids": [1, 2, 3],
  "force": false
}
```

## 项目结构

```
website-statistics/
├── public/
│   ├── api-docs.html      # API文档页面
│   ├── charts.html        # 图表分析页面
│   ├── login.html         # 登录页面
│   ├── logs.html          # 操作日志页面
│   ├── overview.html      # 数据概览页面
│   ├── records.html       # 访问记录页面
│   └── style.css          # 全局样式
├── server.js              # 主服务文件
├── package.json           # 项目配置
├── statistics.db          # SQLite数据库文件（自动生成）
├── README.md              # 项目说明
└── LICENSE                # MIT许可证
```

## 许可证

MIT License - 2026 EndlessPixel Studio
