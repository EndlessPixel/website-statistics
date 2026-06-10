# Website Statistics · 个人站长专属访问统计

> 🪶 **你只有一台小 VPS、只想跑博客、讨厌装 MySQL、害怕被第三方统计卖数据？** 那这套就是为你量身定做的。
>
> 单文件部署 · 零重型数据库 · 不到 100MB 内存占用 · 数据永远在你自己手里。

![展示图片](public/展示.png)

---

## 这东西解决我什么痛？

你是个独立站长，你一定在烦这些事：

| 你的烦恼 | 用了它之后 |
|---|---|
| 装个 MySQL / PostgreSQL 吃掉几百 MB 内存，小 VPS 要崩 | **SQLite 单文件**，没额外进程，部署就一个文件 |
| Google Analytics / 百度统计 / Umami（还要 Postgres）太胖了 | 镜像 < 200MB，Node 运行内存 < 100MB |
| 被 Cookie Banner 折腾、要填隐私政策、担心欧盟查岗 | **前端完全不设置 Cookie，不上报 UA，服务端只读 IP + URL** |
| 配置三天三夜，最后还被风控墙挡住登录 | 打开即用，密码只打印在你自己的控制台 |
| 数据寄人篱下，哪天平台关了就没了 | SQLite 文件在你的磁盘上，`scp` 一下就是完整备份 |
| 你有自己的小 VPS，想要**完全掌控** | 自建，MIT 开源，闭源也能自己改 |

如果你是下面这种人，**别犹豫，直接用**：

- 你在用 **Hexo / Hugo / Jekyll / Typecho / WordPress(静态化)** 跑博客
- 你只有 **1 核 512MB** 那种入门 VPS，预算低到抠门
- 你讨厌 `apt install mysql-server`
- 你需要知道"今天谁看了我哪篇文章"，但不想学一套重型 BI 系统
- 你对"隐私合规"有基本洁癖——不希望读者被第三方广告商跟踪

---

## 它做了什么

- 📊 **访问记录**：IP、URL、路径、时间戳、反向代理真实 IP（`X-Forwarded-For`/`X-Real-IP`/`CF-Connecting-IP` 全都认）
- 📈 **可视化**：饼图 / 柱状图 / 折线图，直接在浏览器里看
- 🪄 **轻量到离谱**：SQLite 单文件（在 `statistics.db`，自动创建）
- 🔐 **密钥登录**：默认生成一串随机 key，只打印在你服务器的控制台
- 📝 **操作日志**：登录、退出、删除操作都有痕迹
- 🗑️ **记录管理**：单条 / 批量删除
- 🌐 **IP 查询**：内置第三方 IP 归属地查询，服务端缓存 24 小时
- 🎨 **深色 / 浅色主题 + 响应式**：手机也能随时看
- 🐳 **一条命令起服务**：Docker 镜像现成的，`docker compose up -d` 完事

---

## 30 秒跑起来

### 方式一：Docker（推荐，个人小 VPS 首选）

```bash
git clone https://github.com/EndlessPixel/website-statistics.git
cd website-statistics
docker compose up -d --build
```

服务起来后：

```
访问地址   : http://你的VPSIP:8000/login
登录密钥   : 只在 `docker compose logs` 或 `docker logs website-stats` 里打印一次，记下来
```

**数据持久化**：SQLite 数据库与 `keys.json` 都在宿主机的 `./data/` 目录，重启、升级镜像都不会丢。

### 方式二：裸跑 Node.js（不想开 Docker 也行）

```bash
git clone https://github.com/EndlessPixel/website-statistics.git
cd website-statistics
npm install --omit=dev
npm start
```

同样，控制台会打印访问地址与登录密钥。

> **建议**：长期运行用 systemd / pm2，别直接在 SSH 里 `npm start`。

### 方式三：反代到你现有的域名

你已经有 Nginx / Caddy，加一条反代到 `127.0.0.1:8000` 即可，服务端会自动识别 `X-Forwarded-For`，**不会只拿到 127.0.0.1**。

**Caddy 示例**（最简单）：
```caddyfile
stats.yourdomain.com {
    reverse_proxy 127.0.0.1:8000
}
```

**Nginx 示例**：
```nginx
location / {
    proxy_pass http://127.0.0.1:8000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

---

## 把统计接到你的博客

详细接入示例见 **[INTEGRATION.md](INTEGRATION.md)**，下面是最省事的一条。

### Hexo / Hugo / Jekyll / 纯静态博客

在主题模板的 `footer`（或一个公共 footer 片段）里贴一段：

```html
<script>
(function(){
  var STATS_SERVER = 'https://stats.yourdomain.com'; // 换成你自己的
  function report() {
    try {
      fetch(STATS_SERVER + '/api/statistics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url:  window.location.href,
          path: window.location.pathname,
          client_time: new Date().toISOString()
        }),
        keepalive: true
      });
    } catch (e) { /* 统计失败绝不能影响读博客 */ }
  }
  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', report);
  else
    report();
})();
</script>
```

- **不需要**额外获取公网 IP——服务端会从请求头自动拿到真实 IP。
- **不需要** Cookie Banner——这段代码不写任何 Cookie。
- **不会阻塞渲染**——纯异步 + keepalive。

### Typecho / WordPress

Typecho 丢到 `footer.php`；WordPress 丢到 `footer.php` 或者"自定义 HTML 小工具"。代码同上。

---

## 项目目录

```
website-statistics/
├── public/               # 前端页面（登录/概览/记录/图表/日志/设置）
├── server.js             # 主服务
├── server.json           # 端口/IP 绑定
├── Dockerfile            # 多阶段构建镜像
├── docker-compose.yml    # 一键拉起
├── README.md
├── INTEGRATION.md        # 各框架接入指南
└── data/                 # SQLite 与 keys.json（Docker 自动映射，运行后生成）
```

---

## 技术栈（给想二开的人看）

- **后端**：Node.js + Express
- **数据库**：SQLite（sql.js，纯 JS，不用装 libsqlite3）
- **前端**：纯 HTML + CSS + JS，无构建步骤
- **图表**：ECharts
- **安全**：XSS / SQL 注入 / 频率限制 / 非 root 用户运行 / 健康检查

---

## 常见疑问

**Q：密码忘了怎么办？**  
A：停掉服务，删掉 `data/keys.json`，重启会生成新的，新密钥会在启动日志里再打印一次。

**Q：数据会上报给谁？**  
A：**谁也不给。** 除了你在设置里打开的"IP 归属地查询"，所有数据只落到本机 `statistics.db`。

**Q：支持多站点吗？**  
A：支持。一个服务可以被多个域名的博客共同调用，按 URL 区分即可。也可以在 `keys.json` 的 `domainWhitelist` 里限定只接受某些来源域名，防止被乱刷。

**Q：我的 VPS 只有 ARM 可以跑吗？**  
A：可以。Dockerfile 用的是 `node:20-alpine`，amd64/arm64 都有官方镜像。

**Q：会给我塞广告吗？**  
A：**不会，永远不会。** 你是站长，你懂那种被当商品的恶心——本项目 MIT，没有后门。

---

## 许可证

MIT License · 2026 EndlessPixel Studio
