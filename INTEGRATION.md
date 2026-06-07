# 网站接入统计服务指南

本文档详细说明如何在您自己的网站中接入统计服务，实现访问数据上报。

## 接入方式

### 方式一：纯前端 JavaScript 接入（推荐）

在您的网站页面中添加以下 JavaScript 代码即可自动上报访问数据。

#### 基础示例

```html
<script>
// 统计服务地址（请替换为您的实际服务地址）
const STATS_SERVER = 'http://localhost:8000';

function reportStatistics() {
  // 获取用户IP（通过第三方服务）
  fetch('https://api.ipify.org?format=json')
    .then(response => response.json())
    .then(data => {
      const payload = {
        ip: data.ip,
        url: window.location.href,
        path: window.location.pathname,
        client_time: new Date().toISOString(),
        server_time: new Date().toISOString()
      };

      // 上报统计数据
      fetch(`${STATS_SERVER}/api/statistics`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })
      .then(response => response.json())
      .then(result => {
        console.log('统计上报成功:', result);
      })
      .catch(error => {
        console.error('统计上报失败:', error);
      });
    })
    .catch(error => {
      console.error('获取IP失败:', error);
    });
}

// 页面加载完成后执行上报
document.addEventListener('DOMContentLoaded', reportStatistics);
</script>
```

#### 简化版（无需获取公网IP）

如果您的服务器可以通过请求头获取客户端IP，可以省略IP获取步骤：

```html
<script>
const STATS_SERVER = 'http://localhost:8000';

function reportStatistics() {
  const payload = {
    ip: 'unknown', // 服务端会自动获取真实IP
    url: window.location.href,
    path: window.location.pathname,
    client_time: new Date().toISOString(),
    server_time: new Date().toISOString()
  };

  fetch(`${STATS_SERVER}/api/statistics`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload),
    mode: 'no-cors' // 如果存在跨域问题可以使用
  });
}

document.addEventListener('DOMContentLoaded', reportStatistics);
</script>
```

### 方式二：服务端接入

#### Node.js / Express 示例

```javascript
const axios = require('axios');

// 在路由中添加统计上报
app.use((req, res, next) => {
  const payload = {
    ip: req.ip || req.connection.remoteAddress,
    url: `${req.protocol}://${req.get('host')}${req.originalUrl}`,
    path: req.path,
    client_time: new Date().toISOString(),
    server_time: new Date().toISOString()
  };

  // 异步上报，不影响主流程
  axios.post('http://localhost:8000/api/statistics', payload)
    .catch(err => console.error('统计上报失败:', err));

  next();
});
```

#### Python / Flask 示例

```python
import requests
from datetime import datetime
from flask import request

@app.before_request
def report_statistics():
    payload = {
        'ip': request.remote_addr,
        'url': request.url,
        'path': request.path,
        'client_time': datetime.now().isoformat(),
        'server_time': datetime.now().isoformat()
    }
    
    try:
        requests.post('http://localhost:8000/api/statistics', json=payload)
    except Exception as e:
        print(f'统计上报失败: {e}')
```

#### PHP 示例

```php
<?php
function reportStatistics() {
    $payload = array(
        'ip' => $_SERVER['REMOTE_ADDR'],
        'url' => (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? "https" : "http") . "://$_SERVER[HTTP_HOST]$_SERVER[REQUEST_URI]",
        'path' => $_SERVER['REQUEST_URI'],
        'client_time' => date('c'),
        'server_time' => date('c')
    );

    $ch = curl_init('http://localhost:8000/api/statistics');
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
    curl_setopt($ch, CURLOPT_HTTPHEADER, array('Content-Type: application/json'));
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 5); // 设置超时时间，避免阻塞
    
    curl_exec($ch);
    curl_close($ch);
}

// 在页面开始时调用
reportStatistics();
?>
```

### 方式三：使用 img 标签（最简单）

适用于无法使用 JavaScript 的场景，或者作为备用方案。

```html
<!-- 在页面底部添加 -->
<img 
  src="http://localhost:8000/api/statistics?ip=unknown&url=YOUR_URL&path=YOUR_PATH&client_time=TIMESTAMP&server_time=TIMESTAMP" 
  style="display: none;"
  alt=""
/>
```

> **注意**：这种方式需要服务端支持 GET 请求，当前服务只支持 POST。如需使用 GET 方式，请修改 `server.js` 中的接口配置。

## 使用建议

### 1. 避免重复上报

为避免同一用户刷新页面时重复上报，可以使用 localStorage 做简单去重：

```javascript
function reportStatistics() {
  const lastReport = localStorage.getItem('lastReportTime');
  const now = Date.now();
  
  // 5分钟内不上报重复数据
  if (lastReport && now - parseInt(lastReport) < 5 * 60 * 1000) {
    return;
  }
  
  localStorage.setItem('lastReportTime', now.toString());
  
  // 执行上报逻辑...
}
```

### 2. 异步上报

建议使用 `fetch` 的 `keepalive` 选项，确保页面卸载时也能完成上报：

```javascript
fetch(`${STATS_SERVER}/api/statistics`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
  keepalive: true // 页面卸载时仍会发送请求
});
```

### 3. 错误处理

```javascript
fetch(`${STATS_SERVER}/api/statistics`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload)
})
.then(response => {
  if (!response.ok) {
    throw new Error('Network response was not ok');
  }
  return response.json();
})
.then(result => {
  if (result.code !== 0) {
    console.warn('统计上报返回错误:', result.msg);
  }
})
.catch(error => {
  // 上报失败不影响主业务
  console.error('统计上报失败:', error);
});
```

### 4. 批量上报（适用于SPA应用）

对于单页应用，可以收集多个页面访问后批量上报：

```javascript
class StatisticsReporter {
  constructor(serverUrl) {
    this.serverUrl = serverUrl;
    this.queue = [];
    this.timer = null;
  }

  report(pageInfo) {
    this.queue.push(pageInfo);
    
    // 每10条或10秒上报一次
    if (this.queue.length >= 10) {
      this.flush();
    } else if (!this.timer) {
      this.timer = setTimeout(() => this.flush(), 10000);
    }
  }

  flush() {
    if (this.queue.length === 0) return;
    
    // 批量上报逻辑（需要服务端支持）
    const payloads = [...this.queue];
    this.queue = [];
    clearTimeout(this.timer);
    this.timer = null;
    
    // 逐条上报（当前服务只支持单条）
    payloads.forEach(payload => {
      fetch(this.serverUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    });
  }
}

// 使用
const reporter = new StatisticsReporter('http://localhost:8000/api/statistics');

// 在路由切换时调用
reporter.report({
  ip: userIp,
  url: window.location.href,
  path: window.location.pathname,
  client_time: new Date().toISOString(),
  server_time: new Date().toISOString()
});
```

## 接入检查清单

- [ ] 确认统计服务已启动且可访问
- [ ] 替换示例中的服务地址为实际地址
- [ ] 确保服务端配置了正确的 CORS 策略
- [ ] 在测试环境验证上报是否正常
- [ ] 考虑添加上报失败的降级处理

## 常见问题

### Q: 跨域问题如何解决？

服务端已经配置了 CORS，通常不需要额外处理。如果仍有问题，可以：

1. 使用代理（推荐）
2. 设置 `mode: 'no-cors'`（只能发送请求，无法获取响应）
3. 在服务端添加您的域名到白名单

### Q: 如何获取真实客户端IP？

服务端会从以下位置获取IP：
- `req.ip`
- `req.connection.remoteAddress`
- `X-Forwarded-For` 请求头

如果您的网站使用了代理（如 Nginx），请确保正确传递客户端IP。

### Q: 是否会影响网站性能？

上报请求是异步的，不会阻塞页面加载。建议设置合理的超时时间（如5秒），避免因服务不可用导致长时间等待。

## 示例项目

以下是一个完整的 HTML 页面接入示例：

```html
<!DOCTYPE html>
<html>
<head>
  <title>我的网站</title>
</head>
<body>
  <h1>欢迎访问我的网站</h1>
  
  <script>
    (function() {
      const STATS_SERVER = 'http://localhost:8000';
      
      function getClientIp() {
        return new Promise((resolve) => {
          fetch('https://api.ipify.org?format=json')
            .then(response => response.json())
            .then(data => resolve(data.ip))
            .catch(() => resolve('unknown'));
        });
      }
      
      async function report() {
        const ip = await getClientIp();
        const payload = {
          ip: ip,
          url: window.location.href,
          path: window.location.pathname,
          client_time: new Date().toISOString(),
          server_time: new Date().toISOString()
        };
        
        try {
          const response = await fetch(`${STATS_SERVER}/api/statistics`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            keepalive: true
          });
          const result = await response.json();
          console.log('统计上报:', result.code === 0 ? '成功' : '失败');
        } catch (error) {
          console.log('统计上报失败（网络问题）');
        }
      }
      
      // 页面加载完成后上报
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', report);
      } else {
        report();
      }
    })();
  </script>
</body>
</html>
```

---

如有其他问题，请查看 [README.md](README.md) 或联系服务管理员。