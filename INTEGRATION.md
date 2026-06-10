# Website Statistics · 接入指南

> 面向个人站长：Hexo / Hugo / Jekyll / Typecho / WordPress / 纯静态博客。  
> **目标：一行代码不改，只在 footer 里贴一段 JS，就能在你自己的服务里看到"谁看了哪篇"。**

---

## 先搞懂几件事（不看会踩坑）

1. **不需要在前端查公网 IP。** 服务端能从 `X-Forwarded-For` / `X-Real-IP` / `CF-Connecting-IP` 里拿真实 IP，前端只需 `fetch` 一次即可。
2. **不需要 Cookie Banner。** 下面给的示例脚本**不设置任何 Cookie**，也不上报 UA。如果你所在地区法规只要求"有 Cookie 就提示"，那你完全可以不加。
3. **必须走 HTTPS。** 你的博客是 HTTPS，就不能请求 `http://stats.example.com`（浏览器会拦截）。给统计服务也套上一个反代 HTTPS（推荐 Caddy，一行配置就好）。
4. **建议把统计服务挂到自己的子域名，比如 `stats.yourdomain.com`。** 不要裸跑 `http://IP:8000`，HTTPS 反代只要一次。

---

## 通用前端接入（所有静态博客都适用）

贴到每个页面的 `<body>` 结束之前。放在 footer / 公共尾部模板里最省事。

```html
<script>
(function () {
  // ====== 只改这里 ======
  var STATS_SERVER = 'https://stats.yourdomain.com';
  // =======================

  function report() {
    try {
      var payload = {
        url:   window.location.href,
        path:  window.location.pathname,
        title: document.title,
        client_time: new Date().toISOString()
      };
      fetch(STATS_SERVER + '/api/statistics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true,          // 页面关掉也能尽量发出去
        mode: 'cors'
      });
    } catch (e) { /* 统计失败不影响用户读博客 */ }
  }

  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', report);
  else
    report();
})();
</script>
```

### 为什么长这样？

- `keepalive: true`：用户刷新 / 点走时，浏览器也尽量把请求发完。
- `title`：顺便把文章标题传进去，后台记录更直观。
- `try/catch`：统计服务挂了，**绝不能**影响博客加载。
- 没写任何 `document.cookie`。

---

## Hexo 接入

主题目录通常是 `themes/<主题名>/layout/`。最稳的方式是**改 footer 模板**。

### 方案 A：贴到主题模板的 footer 里

找到 `themes/<你的主题>/layout/_partial/footer.ejs`（有的主题叫 `after-footer.ejs`），把上面那段 `<script>` 贴到最后。

### 方案 B：用 Hexo 自带的 `injector`（最干净，更新主题不丢）

在博客根目录的 `scripts/` 里新建一个文件 `scripts/inject-stats.js`：

```js
hexo.extend.injector.register('body_end', `
<script>
(function(){
  var STATS_SERVER = 'https://stats.yourdomain.com';
  function report(){
    try{ fetch(STATS_SERVER+'/api/statistics',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:location.href,path:location.pathname,title:document.title,client_time:new Date().toISOString()}),keepalive:true}); }catch(e){}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',report);else report();
})();
</script>
`, 'default');
```

然后 `hexo clean && hexo g && hexo d` 即可。所有生成的页面尾部都会带上这段脚本。

---

## Hugo 接入

Hugo 用的是 Go 模板。把脚本贴到主题的 `footer` 或者自定义 `partial` 里。

### 方案 A：改主题 footer

在你的主题里找 `layouts/partials/footer.html` 或 `layouts/_default/baseof.html`，在 `</body>` 之前贴通用那段。

### 方案 B：不侵入主题，建一个自定义 `partial`

在博客根目录（**不是主题目录**）新建 `layouts/partials/stats.html`：

```html
<script>
(function(){
  var STATS_SERVER = 'https://stats.yourdomain.com';
  function report(){
    try{ fetch(STATS_SERVER+'/api/statistics',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:location.href,path:location.pathname,title:document.title,client_time:new Date().toISOString()}),keepalive:true}); }catch(e){}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',report);else report();
})();
</script>
```

然后在主题的某个 footer 模板里加一行（没有的话在 `baseof.html` 里的 `</body>` 之前加）：

```go-html-template
{{ partial "stats.html" . }}
```

这样即使主题更新，你的 `layouts/partials/stats.html` 也不会丢。

---

## Jekyll 接入

最简单：在 `_includes/` 新建 `stats.html`，内容是上面那段 `<script>`，然后在 `_layouts/default.html` 的 `</body>` 之前引入：

```html
{% include stats.html %}
```

如果你用了 minima / minimal-mistakes 这种主题，它们通常有 `footer.html` 这种 include，直接把脚本追加进去也行。

---

## Typecho 接入

Typecho 是 PHP 模板，最直接：

### 方案 A：改主题 `footer.php`

在主题目录（比如 `themes/default/`）里找 `footer.php`，在 `</body>` 之前贴脚本。

### 方案 B：用后台"设置 → 外观 → 自定义 HTML / CSS"（如果主题提供）

有的主题提供"页脚自定义代码"框，直接贴 `<script>... </script>`。

---

## WordPress 接入

三种常见方式：

1. **改主题 `footer.php`**：`wp-content/themes/<你的主题>/footer.php`，`</body>` 之前贴。
2. **子主题 footer**（推荐，升级主题不丢）：子主题里放一个 `footer.php`，覆盖父主题。
3. **自定义 HTML 小工具**：后台 → 外观 → 小工具 → 拖一个"自定义 HTML"到页脚区域，贴脚本。

> WordPress 自带有 `wp_footer` 钩子，高级用法可以写一个必须插件，把脚本挂到 `wp_footer` 上，但上面三种方式对 99% 的个人博客已经够用。

---

## 反代配置（Nginx / Caddy）

前面说了：**统计服务必须走 HTTPS**（否则 HTTPS 的博客会拦截 HTTP 请求）。你可以在你博客反代所在的服务器上再加一条。

### Caddy（推荐，最简单）

```caddyfile
stats.yourdomain.com {
    reverse_proxy 127.0.0.1:8000
}
```

Caddy 会自动申请 Let's Encrypt 证书。

### Nginx

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name stats.yourdomain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name stats.yourdomain.com;

    # 你自己的 SSL 配置，或者用 certbot
    # ssl_certificate     /etc/letsencrypt/live/stats.yourdomain.com/fullchain.pem;
    # ssl_certificate_key /etc/letsencrypt/live/stats.yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

**关键：这两行保证服务端拿到真实 IP，而不是 127.0.0.1：**

```
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
```

---

## 验证接入成功

1. 重新生成 / 部署博客。
2. 打开一篇文章，按 F12 → Network，看有没有一条 `POST` 请求到 `https://stats.yourdomain.com/api/statistics`，返回 `200`。
3. 登录 `https://stats.yourdomain.com/login`，看"访问记录"里是不是出现刚看的那篇文章的 URL。
4. （可选）把 `STATS_SERVER` 改成子域之后，你也可以改 `keys.json` 里的 `domainWhitelist`，只接受来自你自己博客域名的请求，防别人乱刷。

---

## 防乱刷：域名白名单

服务端读取 `keys.json` 里的 `domainWhitelist`，格式：

```json
{
  "domainWhitelist": [
    "yourdomain.com",
    "blog.anotherdomain.com"
  ]
}
```

- 精确匹配：如 `blog.anotherdomain.com`
- 子域名匹配：写 `yourdomain.com` 时，`blog.yourdomain.com`、`www.yourdomain.com` 都放行

白名单留空或不写 = 不校验，任何人都能调用 `/api/statistics`。

---

## 最佳实践总结

- ✅ 给统计服务套 HTTPS 子域名
- ✅ 脚本放在 `</body>` 之前，用 `keepalive: true`
- ✅ 不设置 Cookie，不上报 UA
- ✅ `try/catch` 包一层，失败不影响页面
- ✅ 开 `domainWhitelist`，只收你自己博客的请求
- ❌ 不要让脚本阻塞渲染
- ❌ 不要把统计挂在第三方 CDN（那样你又回到"数据在别人手上"的老路上了）

---

## API 速查（给需要二开的人）

| 方法 | 路径 | 说明 |
|---|---|---|
| `POST` | `/api/statistics` | 上报访问，body: `{url, path, title, client_time}` |
| `GET`  | `/api/getStatistics?page=1&pageSize=25` | 分页获取记录 |
| `GET`  | `/api/overview` | 概览数据 |
| `GET`  | `/api/getStats` | 图表数据 |
| `GET`  | `/api/query-ip?ip=x.x.x.x` | IP 归属地查询 |
| `DELETE` | `/api/statistics/:id` | 删除单条 |
| `POST` | `/api/statistics/batch-delete` | 批量删除 |

完整文档登录后访问 `/api-docs`。
