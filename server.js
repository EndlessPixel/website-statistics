const express = require('express');
const initSqlJs = require('sql.js');
const cors = require('cors');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const cookieParser = require('cookie-parser');
const https = require('https');

const app = express();
const PORT = 8000;

// 安全头部设置
app.use((req, res, next) => {
  // 防止XSS攻击
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  // Content Security Policy
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://cdn.tailwindcss.com; style-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com; img-src 'self' data:; font-src 'self';");
  next();
});

app.use(cors());
app.use(express.json({ limit: '10kb' })); // 限制请求体大小
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// XSS防护 - HTML实体转义函数
function escapeHtml(str) {
  if (typeof str !== 'string') return str;
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// IP信息缓存
const ipCache = new Map();
const CACHE_TTL = 86400000; // 24小时缓存

// 查询IP信息
async function fetchIpInfo(ip) {
  // 检查缓存
  const cached = ipCache.get(ip);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  // 调用 ip9.com.cn API
  return new Promise((resolve, reject) => {
    const url = `https://ip9.com.cn/get?ip=${encodeURIComponent(ip)}`;
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (result.ret === 200) {
            // 缓存结果
            ipCache.set(ip, {
              data: result.data,
              timestamp: Date.now()
            });
            resolve(result.data);
          } else {
            resolve(null);
          }
        } catch (e) {
          resolve(null);
        }
      });
    }).on('error', () => {
      resolve(null);
    });
  });
}

// 输入验证和清理函数
function sanitizeInput(str, maxLength = 500) {
  // 支持整数类型（用于时间戳）
  if (typeof str === 'number') {
    return str;
  }
  if (typeof str !== 'string') return '';
  // 移除危险字符，限制长度
  return str.substring(0, maxLength).replace(/[<>\"\'\\]/g, '');
}

// 验证IP地址格式
function isValidIp(ip) {
  if (!ip || typeof ip !== 'string') return false;
  // IPv4 或 IPv6 格式验证
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  const ipv6Regex = /^([0-9a-fA-F:]+)$/;
  return ipv4Regex.test(ip) || ipv6Regex.test(ip) || ip === '::1' || ip.startsWith('::ffff:');
}

// 验证URL格式
function isValidUrl(url) {
  if (!url || typeof url !== 'string') return false;
  // 简单的URL验证，防止注入
  return url.length <= 500 && !url.includes('<') && !url.includes('>');
}

// 验证路径格式
function isValidPath(path) {
  if (!path || typeof path !== 'string') return false;
  return path.length <= 1000 && !path.includes('<') && !path.includes('>');
}

// 验证时间格式 - 放宽验证，接受多种格式
function isValidTime(time) {
  if (!time || typeof time !== 'string') return false;
  // 接受多种时间格式
  return time.length <= 100 && !time.includes('<') && !time.includes('>');
}

function getSessionId(req) {
  return req.cookies.session_id;
}

function checkLogin(req) {
  const sessionId = getSessionId(req);
  return sessionId && sessions.has(sessionId);
}

const SECRET_KEY = crypto.randomBytes(16).toString('hex');

const DB_FILE = 'statistics.db';
let db;

const sessions = new Set();

async function initDatabase() {
  const SQL = await initSqlJs({
    locateFile: file => `node_modules/sql.js/dist/${file}`
  });
  
  if (fs.existsSync(DB_FILE)) {
    const data = fs.readFileSync(DB_FILE);
    db = new SQL.Database(new Uint8Array(data));
    console.log('数据库加载成功');
    // 确保所有表都存在
    createTable();
  } else {
    db = new SQL.Database();
    createTable();
    console.log('数据库创建成功');
  }
  
  setInterval(() => {
    const data = db.export();
    fs.writeFileSync(DB_FILE, Buffer.from(data));
  }, 5000);
}

function createTable() {
  const createStatisticsTable = `
    CREATE TABLE IF NOT EXISTS statistics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ip TEXT NOT NULL,
      url TEXT NOT NULL,
      path TEXT NOT NULL,
      client_time TEXT NOT NULL,
      server_time TEXT NOT NULL,
      statistics_time TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `;
  db.run(createStatisticsTable);
  
  const createLogsTable = `
    CREATE TABLE IF NOT EXISTS operation_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      operation_type TEXT NOT NULL,
      target_id INTEGER,
      session_id TEXT,
      ip TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `;
  db.run(createLogsTable);
}

function logOperation(operationType, targetId = null, sessionId = null, ip = null) {
  try {
    const stmt = db.prepare(`
      INSERT INTO operation_logs (operation_type, target_id, session_id, ip, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    const now = new Date().toISOString();
    stmt.bind([operationType, targetId || null, sessionId || null, ip || null, now]);
    stmt.step();
    stmt.free();
    
    // 输出到控制台
    const timeStr = new Date().toLocaleString('zh-CN');
    const targetStr = targetId ? ` [目标ID: ${targetId}]` : '';
    const sessionStr = sessionId ? ` [会话: ${sessionId.substring(0, 8)}...]` : '';
    console.log(`[${timeStr}] [${operationType}]${targetStr}${sessionStr} [IP: ${ip || 'unknown'}]`);
  } catch (err) {
    console.error('记录操作日志失败:', err.message);
  }
}

const rateLimit = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000;
const RATE_LIMIT_MAX = 100;

function checkRateLimit(ip) {
  const now = Date.now();
  const record = rateLimit.get(ip);
  
  if (!record) {
    rateLimit.set(ip, { count: 1, timestamp: now });
    return true;
  }
  
  if (now - record.timestamp > RATE_LIMIT_WINDOW) {
    rateLimit.set(ip, { count: 1, timestamp: now });
    return true;
  }
  
  if (record.count >= RATE_LIMIT_MAX) {
    return false;
  }
  
  record.count++;
  return true;
}

app.post('/api/statistics', (req, res) => {
  const { ip, url, path, client_time, server_time } = req.body;
  
  // 参数验证
  if (!ip || !url || !path || !client_time || !server_time) {
    return res.status(400).json({ 
      code: -1, 
      msg: '参数缺失，请提供 ip、url、path、client_time、server_time' 
    });
  }
  
  // 输入清理 - 防止XSS和SQL注入
  const sanitizedIp = sanitizeInput(ip, 50);
  const sanitizedUrl = sanitizeInput(url, 500);
  const sanitizedPath = sanitizeInput(path, 1000);
  const sanitizedClientTime = sanitizeInput(client_time, 50);
  const sanitizedServerTime = sanitizeInput(server_time, 50);
  
  // 格式验证
  if (!isValidIp(sanitizedIp)) {
    return res.status(400).json({ code: -1, msg: 'IP地址格式无效' });
  }
  if (!isValidUrl(sanitizedUrl)) {
    return res.status(400).json({ code: -1, msg: 'URL格式无效' });
  }
  if (!isValidPath(sanitizedPath)) {
    return res.status(400).json({ code: -1, msg: '路径格式无效' });
  }
  
  const clientIp = req.ip || req.connection.remoteAddress || 
                   (req.headers['x-forwarded-for'] || '').split(',')[0] || 'unknown';
  
  if (!checkRateLimit(clientIp)) {
    return res.status(429).json({ 
      code: -2, 
      msg: '请求过于频繁，请稍后再试' 
    });
  }
  
  const statisticsTime = new Date().toISOString();
  
  // 使用参数化查询防止SQL注入
  const insertSql = `
    INSERT INTO statistics (ip, url, path, client_time, server_time, statistics_time)
    VALUES (?, ?, ?, ?, ?, ?)
  `;
  
  try {
    db.run(insertSql, [sanitizedIp, sanitizedUrl, sanitizedPath, sanitizedClientTime, sanitizedServerTime, statisticsTime]);
    res.json({ code: 0, msg: 'success' });
  } catch (err) {
    console.error('插入数据失败:', err.message);
    return res.status(500).json({ code: -3, msg: '服务器内部错误' });
  }
});

app.get('/api/records', (req, res) => {
  const sessionId = getSessionId(req);
  const page = parseInt(req.query.page) || 1;
  const pageSize = parseInt(req.query.pageSize) || 25;
  
  if (!checkLogin(req)) {
    return res.json({ code: -1, msg: '未登录' });
  }
  
  if (pageSize < 1 || pageSize > 100) {
    return res.json({ code: -2, msg: '每页数量必须在1-100之间' });
  }
  
  try {
    const totalResults = db.exec('SELECT COUNT(*) FROM statistics');
    const total = totalResults.length > 0 ? totalResults[0].values[0][0] : 0;
    const offset = (page - 1) * pageSize;
    
    const results = db.exec(`SELECT * FROM statistics ORDER BY statistics_time DESC LIMIT ? OFFSET ?`, [pageSize, offset]);
    const rows = results.length > 0 ? results[0].values.map(row => ({
      id: row[0],
      ip: row[1],
      url: row[2],
      path: row[3],
      client_time: row[4],
      server_time: row[5],
      statistics_time: row[6]
    })) : [];
    
    res.json({ 
      code: 0, 
      data: { records: rows },
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize)
      }
    });
  } catch (err) {
    console.error('查询数据失败:', err.message);
    return res.status(500).json({ code: -3, msg: '查询失败' });
  }
});

app.get('/api/stats', (req, res) => {
  if (!checkLogin(req)) {
    return res.json({ code: -1, msg: '未登录' });
  }
  
  try {
    const ipResults = db.exec('SELECT ip, COUNT(*) as count FROM statistics GROUP BY ip ORDER BY count DESC LIMIT 10');
    const ipData = ipResults.length > 0 ? ipResults[0].values.map(row => ({
      name: row[0],
      value: row[1]
    })) : [];
    
    const hourResults = db.exec(`
      SELECT strftime('%H', statistics_time) as hour, COUNT(*) as count 
      FROM statistics 
      GROUP BY hour 
      ORDER BY hour
    `);
    const hourData = hourResults.length > 0 ? hourResults[0].values.map(row => ({
      hour: row[0],
      count: row[1]
    })) : [];
    
    const dateResults = db.exec(`
      SELECT strftime('%Y-%m-%d', statistics_time) as date, COUNT(*) as count 
      FROM statistics 
      GROUP BY date 
      ORDER BY date DESC LIMIT 30
    `);
    const dateData = dateResults.length > 0 ? dateResults[0].values.map(row => ({
      date: row[0],
      count: row[1]
    })).reverse() : [];
    
    res.json({ 
      code: 0, 
      data: {
        ipDistribution: ipData,
        hourDistribution: hourData,
        dateTrend: dateData
      }
    });
  } catch (err) {
    console.error('查询统计数据失败:', err.message);
    return res.status(500).json({ code: -2, msg: '查询失败' });
  }
});

app.get('/api/overview', (req, res) => {
  if (!checkLogin(req)) {
    return res.json({ code: -1, msg: '未登录' });
  }
  
  try {
    const totalResults = db.exec('SELECT COUNT(*) FROM statistics');
    const totalRecords = totalResults.length > 0 ? totalResults[0].values[0][0] : 0;
    
    const ipResults = db.exec('SELECT COUNT(DISTINCT ip) FROM statistics');
    const uniqueIps = ipResults.length > 0 ? ipResults[0].values[0][0] : 0;
    
    const urlResults = db.exec('SELECT COUNT(DISTINCT url) FROM statistics');
    const uniqueUrls = urlResults.length > 0 ? urlResults[0].values[0][0] : 0;
    
    const dateResults = db.exec('SELECT COUNT(DISTINCT strftime(\'%Y-%m-%d\', statistics_time)) FROM statistics');
    const activeDays = dateResults.length > 0 ? dateResults[0].values[0][0] : 0;
    
    const today = new Date().toISOString().split('T')[0];
    const todayStmt = db.prepare(`SELECT COUNT(*) as cnt FROM statistics WHERE strftime('%Y-%m-%d', statistics_time) = ?`);
    todayStmt.bind([today]);
    let todayCount = 0;
    if (todayStmt.step()) {
      const row = todayStmt.getAsObject();
      todayCount = row && row.cnt !== undefined ? row.cnt : 0;
    }
    todayStmt.free();
    
    const todayIpStmt = db.prepare(`SELECT COUNT(DISTINCT ip) as cnt FROM statistics WHERE strftime('%Y-%m-%d', statistics_time) = ?`);
    todayIpStmt.bind([today]);
    let todayIps = 0;
    if (todayIpStmt.step()) {
      const row = todayIpStmt.getAsObject();
      todayIps = row && row.cnt !== undefined ? row.cnt : 0;
    }
    todayIpStmt.free();
    
    res.json({ 
      code: 0, 
      data: {
        totalRecords,
        uniqueIps,
        uniqueUrls,
        activeDays,
        todayCount,
        todayIps
      }
    });
  } catch (err) {
    console.error('查询概览数据失败:', err.message);
    return res.status(500).json({ code: -2, msg: '查询失败' });
  }
});

// 重新编号统计记录
function renumberStatistics() {
  try {
    // 创建临时表
    db.run(`
      CREATE TABLE IF NOT EXISTS statistics_temp (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ip TEXT,
        url TEXT,
        path TEXT,
        client_time TEXT,
        server_time TEXT,
        statistics_time TEXT
      )
    `);
    
    // 复制数据到临时表（按原ID排序，新ID从1开始）
    const rows = db.exec('SELECT ip, url, path, client_time, server_time, statistics_time FROM statistics ORDER BY id');
    if (rows.length > 0 && rows[0].values.length > 0) {
      const insertStmt = db.prepare(`
        INSERT INTO statistics_temp (ip, url, path, client_time, server_time, statistics_time)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      for (const row of rows[0].values) {
        insertStmt.bind(row);
        insertStmt.step();
        insertStmt.reset();
      }
      insertStmt.free();
    }
    
    // 删除原表
    db.run('DROP TABLE statistics');
    
    // 重命名临时表
    db.run('ALTER TABLE statistics_temp RENAME TO statistics');
    
    // 重置序列
    db.run("DELETE FROM sqlite_sequence WHERE name='statistics'");
    
    console.log('记录重新编号完成');
  } catch (err) {
    console.error('重新编号失败:', err.message);
  }
}

app.delete('/api/statistics/:id', (req, res) => {
  const sessionId = getSessionId(req);
  const id = parseInt(req.params.id);
  const force = req.query.force === '1';
  const clientIp = req.ip || req.connection.remoteAddress;
  
  if (!checkLogin(req)) {
    return res.json({ code: -1, msg: '未登录' });
  }
  
  if (isNaN(id) || id <= 0) {
    return res.json({ code: -2, msg: '无效的记录ID' });
  }
  
  try {
    const stmt = db.prepare('DELETE FROM statistics WHERE id = ?');
    stmt.bind([id]);
    stmt.step();
    const changes = db.getRowsModified();
    stmt.free();
    
    if (changes > 0) {
      const operationType = force ? 'force_delete' : 'delete';
      logOperation(operationType, id, sessionId, clientIp);
      
      // 重新编号剩余记录
      renumberStatistics();
      
      res.json({ code: 0, msg: '删除成功' });
    } else {
      res.json({ code: -3, msg: '记录不存在' });
    }
  } catch (err) {
    console.error('删除记录失败:', err.message);
    return res.status(500).json({ code: -4, msg: '删除失败' });
  }
});

app.get('/login', (req, res) => {
  const key = req.query.key;
  const clientIp = req.ip || req.connection.remoteAddress;
  
  if (!key) {
    return res.sendFile(path.join(__dirname, 'public', 'login.html'));
  }
  
  if (key === SECRET_KEY) {
    const sessionId = crypto.randomBytes(16).toString('hex');
    sessions.add(sessionId);
    logOperation('login', null, sessionId, clientIp);
    res.cookie('session_id', sessionId, { httpOnly: true, secure: false });
    res.redirect('/overview');
  } else {
    // 记录登录失败日志
    logOperation('login_failed', null, null, clientIp);
    res.redirect('/login?err=1');
  }
});

// 根路径路由 - 根据登录状态跳转
app.get('/', (req, res) => {
  if (checkLogin(req)) {
    res.redirect('/overview');
  } else {
    res.redirect('/login');
  }
});

app.get('/overview', (req, res) => {
  if (!checkLogin(req)) {
    return res.redirect('/login');
  }
  
  res.sendFile(path.join(__dirname, 'public', 'overview.html'));
});

app.get('/charts', (req, res) => {
  if (!checkLogin(req)) {
    return res.redirect('/login');
  }
  
  res.sendFile(path.join(__dirname, 'public', 'charts.html'));
});

app.get('/records', (req, res) => {
  if (!checkLogin(req)) {
    return res.redirect('/login');
  }
  
  res.sendFile(path.join(__dirname, 'public', 'records.html'));
});

app.get('/logs', (req, res) => {
  if (!checkLogin(req)) {
    return res.redirect('/login');
  }
  
  res.sendFile(path.join(__dirname, 'public', 'logs.html'));
});

app.get('/api-docs', (req, res) => {
  if (!checkLogin(req)) {
    return res.redirect('/login');
  }
  
  res.sendFile(path.join(__dirname, 'public', 'api-docs.html'));
});

app.get('/repo', (req, res) => {
  if (!checkLogin(req)) {
    return res.redirect('/login');
  }
  
  res.sendFile(path.join(__dirname, 'public', 'repo.html'));
});

app.get('/version', (req, res) => {
  if (!checkLogin(req)) {
    return res.redirect('/login');
  }
  
  res.sendFile(path.join(__dirname, 'public', 'version.html'));
});

app.get('/logout', (req, res) => {
  const sessionId = getSessionId(req);
  const clientIp = req.ip || req.connection.remoteAddress;
  if (sessionId) {
    sessions.delete(sessionId);
    logOperation('logout', null, sessionId, clientIp);
  }
  res.clearCookie('session_id');
  res.redirect('/login');
});

app.post('/api/statistics/batch-delete', (req, res) => {
  const sessionId = getSessionId(req);
  const ids = req.body.ids;
  const force = req.body.force === true;
  const clientIp = req.ip || req.connection.remoteAddress;
  
  if (!checkLogin(req)) {
    return res.json({ code: -1, msg: '未登录' });
  }
  
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.json({ code: -2, msg: '请选择要删除的记录' });
  }
  
  try {
    // 将所有ID转换为数字并过滤有效值
    const validIds = ids.map(id => parseInt(id)).filter(id => !isNaN(id) && id > 0);
    if (validIds.length === 0) {
      return res.json({ code: -3, msg: '无效的记录ID' });
    }
    
    const placeholders = validIds.map(() => '?').join(',');
    const stmt = db.prepare(`DELETE FROM statistics WHERE id IN (${placeholders})`);
    stmt.bind(validIds);
    stmt.step();
    const changes = db.getRowsModified();
    stmt.free();
    
    if (changes > 0) {
      const operationType = force ? 'force_batch_delete' : 'batch_delete';
      logOperation(operationType, null, sessionId, clientIp);
      
      // 重新编号剩余记录
      renumberStatistics();
      
      res.json({ code: 0, msg: `成功删除 ${changes} 条记录` });
    } else {
      res.json({ code: -4, msg: '没有记录被删除' });
    }
  } catch (err) {
    console.error('批量删除失败:', err.message);
    return res.status(500).json({ code: -5, msg: '删除失败' });
  }
});

app.get('/api/logs', (req, res) => {
  if (!checkLogin(req)) {
    return res.json({ code: -1, msg: '未登录' });
  }
  
  const page = parseInt(req.query.page) || 1;
  const pageSize = parseInt(req.query.pageSize) || 25;
  const offset = (page - 1) * pageSize;
  
  try {
    // 获取总数
    const countResult = db.exec('SELECT COUNT(*) as total FROM operation_logs');
    const total = countResult.length > 0 ? countResult[0].values[0][0] : 0;
    const totalPages = Math.ceil(total / pageSize);
    
    // 获取分页数据
    const stmt = db.prepare(`
      SELECT id, operation_type, target_id, session_id, ip, created_at 
      FROM operation_logs 
      ORDER BY created_at DESC 
      LIMIT ? OFFSET ?
    `);
    stmt.bind([pageSize, offset]);
    
    const logs = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      // 生成消息文本
      let message = '';
      switch(row.operation_type) {
        case 'login': message = '管理员登录成功'; break;
        case 'logout': message = '管理员退出登录'; break;
        case 'delete': message = `删除记录 #${row.target_id}`; break;
        case 'force_delete': message = `强制删除记录 #${row.target_id}`; break;
        case 'batch_delete': message = `批量删除记录 (${row.target_id})`; break;
        case 'force_batch_delete': message = `强制批量删除记录 (${row.target_id})`; break;
        case 'login_failed': message = '登录失败'; break;
        default: message = row.operation_type;
      }
      logs.push({
        id: row.id,
        action: row.operation_type,
        target_id: row.target_id,
        session_id: row.session_id,
        ip: row.ip,
        message: message,
        created_at: row.created_at
      });
    }
    stmt.free();
    
    res.json({
      code: 0,
      data: { logs: logs },
      pagination: {
        page,
        pageSize,
        total,
        totalPages
      }
    });
  } catch (err) {
    console.error('查询日志失败:', err.message);
    return res.status(500).json({ code: -2, msg: '查询失败' });
  }
});

// IP查询接口
app.get('/api/query-ip', async (req, res) => {
  if (!checkLogin(req)) {
    return res.json({ code: -1, msg: '未登录' });
  }
  
  const ip = req.query.ip;
  
  if (!isValidIp(ip)) {
    return res.json({ code: -2, msg: '无效的IP地址' });
  }
  
  try {
    const ipInfo = await fetchIpInfo(ip);
    
    if (ipInfo) {
      res.json({ code: 0, data: ipInfo });
    } else {
      res.json({ code: -3, msg: '无法获取IP信息' });
    }
  } catch (err) {
    console.error('查询IP信息失败:', err.message);
    return res.status(500).json({ code: -4, msg: '查询失败' });
  }
});

// ======================== GitHub仓库信息接口 ========================
app.get('/api/repo', async (req, res) => {
  if (!checkLogin(req)) {
    return res.json({ code: -1, msg: '未登录' });
  }
  
  try {
    const repoOwner = 'EndlessPixel';
    const repoName = 'website-statistics';
    
    // 获取仓库基本信息
    const repoUrl = `https://api.github.com/repos/${repoOwner}/${repoName}`;
    const contributorsUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/contributors`;
    
    const [repoRes, contributorsRes] = await Promise.all([
      fetch(repoUrl, { headers: { 'User-Agent': 'WebsiteStatistics' } }),
      fetch(contributorsUrl, { headers: { 'User-Agent': 'WebsiteStatistics' } })
    ]);
    
    if (!repoRes.ok) {
      return res.json({ code: -2, msg: '无法连接 GitHub' });
    }
    
    const repoData = await repoRes.json();
    const contributorsData = contributorsRes.ok ? await contributorsRes.json() : [];
    
    res.json({
      code: 0,
      data: {
        stars: repoData.stargazers_count || 0,
        watchers: repoData.subscribers_count || 0,
        forks: repoData.forks_count || 0,
        contributors: contributorsData.slice(0, 12).map(c => ({
          login: c.login,
          avatar_url: c.avatar_url,
          contributions: c.contributions
        }))
      }
    });
  } catch (err) {
    console.error('获取仓库信息失败:', err.message);
    return res.json({ code: -2, msg: '无法连接 GitHub' });
  }
});

// ======================== Git版本信息接口 ========================
app.get('/api/version', async (req, res) => {
  if (!checkLogin(req)) {
    return res.json({ code: -1, msg: '未登录' });
  }
  
  const errors = [];
  
  // 检查 .git 目录
  const hasGitDir = fs.existsSync(path.join(__dirname, '.git'));
  if (!hasGitDir) {
    errors.push('项目根目录缺少 .git 文件夹');
  }
  
  // 检查 Git 命令
  let hasGitCmd = false;
  let localSha = null;
  let remoteSha = null;
  let hasRemote = false;
  
  try {
    const { execSync } = require('child_process');
    
    // 检查 git 命令
    execSync('git --version', { encoding: 'utf-8', stdio: 'pipe' });
    hasGitCmd = true;
    
    if (hasGitDir) {
      // 获取本地最新 commit
      try {
        localSha = execSync('git rev-parse HEAD', { encoding: 'utf-8', stdio: 'pipe' }).trim();
      } catch (e) {
        localSha = null;
      }
      
      // 获取远程仓库
      try {
        const remoteUrl = execSync('git remote get-url origin', { encoding: 'utf-8', stdio: 'pipe' }).trim();
        hasRemote = remoteUrl.length > 0;
      } catch (e) {
        hasRemote = false;
      }
      
      // 获取远程最新 commit
      if (hasRemote) {
        try {
          execSync('git fetch origin', { encoding: 'utf-8', stdio: 'pipe' });
          remoteSha = execSync('git rev-parse origin/main', { encoding: 'utf-8', stdio: 'pipe' }).trim();
        } catch (e) {
          try {
            remoteSha = execSync('git rev-parse origin/master', { encoding: 'utf-8', stdio: 'pipe' }).trim();
          } catch (e2) {
            remoteSha = null;
          }
        }
      }
    }
  } catch (err) {
    console.error('Git 命令执行失败:', err.message);
  }
  
  if (!hasGitCmd) {
    errors.push('系统未安装 Git 命令行工具');
  }
  if (!hasRemote) {
    errors.push('Git 远程仓库未配置');
  }
  
  if (errors.length > 0) {
    return res.json({
      code: -1,
      msg: '环境检查未通过',
      data: {
        env: { hasGitDir, hasGitCmd, hasRemote },
        errors
      }
    });
  }
  
  // 计算落后多少个提交
  let ahead = 0;
  if (localSha && remoteSha && localSha !== remoteSha) {
    try {
      const { execSync } = require('child_process');
      ahead = parseInt(execSync(`git rev-list --count ${remoteSha}..${localSha}`, { encoding: 'utf-8', stdio: 'pipe' }).trim()) || 0;
    } catch (e) {
      ahead = 0;
    }
  }
  
  res.json({
    code: 0,
    data: {
      localSha,
      remoteSha,
      ahead,
      env: { hasGitDir, hasGitCmd, hasRemote }
    }
  });
});

initDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(' /$$      /$$ /$$$$$$$$ /$$$$$$$   /$$$$$$  /$$$$$$ /$$$$$$$$ /$$$$$$$$')
    console.log('| $$  /$ | $$| $$_____/| $$__  $$ /$$__  $$|_  $$_/|__  $$__/| $$_____/')
    console.log('| $$ /$$$| $$| $$      | $$  \ $$| $$  \__/  | $$     | $$   | $$      ')
    console.log('| $$/$$ $$ $$| $$$$$   | $$$$$$$ |  $$$$$$   | $$     | $$   | $$$$$   ')
    console.log('| $$$$_  $$$$| $$__/   | $$__  $$ \____  $$  | $$     | $$   | $$__/   ')
    console.log('| $$$/ \  $$$| $$      | $$  \ $$ /$$  \ $$  | $$     | $$   | $$      ')
    console.log('| $$/   \  $$| $$$$$$$$| $$$$$$$/|  $$$$$$/ /$$$$$$   | $$   | $$$$$$$$')
    console.log('|__/     \__/|________/|_______/  \______/ |______/   |__/   |________/')
    console.log('')
    console.log('                    /$$$$$$  /$$$$$$$$  /$$$$$$  /$$$$$$$$ /$$$$$$  /$$$$$$  /$$$$$$$$ /$$$$$$  /$$$$$$   /$$$$$$ ')
    console.log('                   /$$__  $$|__  $$__/ /$$__  $$|__  $$__/|_  $$_/ /$$__  $$|__  $$__/|_  $$_/ /$$__  $$ /$$__  $$')
    console.log('                  | $$  \__/   | $$   | $$  \ $$   | $$     | $$  | $$  \__/   | $$     | $$  | $$  \__/| $$  \__/')
    console.log('                  |  $$$$$$    | $$   | $$$$$$$$   | $$     | $$  |  $$$$$$    | $$     | $$  | $$      |  $$$$$$ ')
    console.log('                   \____  $$   | $$   | $$__  $$   | $$     | $$   \____  $$   | $$     | $$  | $$       \____  $$')
    console.log('                   /$$  \ $$   | $$   | $$  | $$   | $$     | $$   /$$  \ $$   | $$     | $$  | $$    $$ /$$  \ $$')
    console.log('                  |  $$$$$$/   | $$   | $$  | $$   | $$    /$$$$$$|  $$$$$$/   | $$    /$$$$$$|  $$$$$$/|  $$$$$$/')
    console.log('                   \______/    |__/   |__/  |__/   |__/   |______/ \______/    |__/   |______/ \______/  \______/ ')
    console.log('')
    console.log('========================================');
    console.log('服务启动成功！');
    console.log('访问密钥（用于查看统计页面）:', SECRET_KEY);
    console.log('服务地址: http://localhost:' + PORT);
    console.log('接口地址: POST http://localhost:' + PORT + '/api/statistics');
    console.log('========================================');
  });
}).catch(err => {
  console.error('数据库初始化失败:', err.message);
});

process.on('exit', () => {
  if (db) {
    const data = db.export();
    fs.writeFileSync(DB_FILE, Buffer.from(data));
    console.log('数据库已保存');
  }
});