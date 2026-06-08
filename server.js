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

// 密钥配置文件路径
const KEYS_FILE = path.join(__dirname, 'keys.json');

// 备份相关配置
const BACKUP_DIR = path.join(__dirname, 'backups');
const MAX_BACKUPS = 25;

// 确保备份目录存在
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

// 创建备份
function createBackup(reason = 'manual') {
  return new Promise((resolve) => {
    const timestamp = Date.now();
    const backupName = `backup_${timestamp}_${reason}.json`;
    const backupPath = path.join(BACKUP_DIR, backupName);
    
    db.all('SELECT * FROM statistics ORDER BY id DESC', [], (err, records) => {
      if (err) {
        console.error('创建备份失败:', err.message);
        resolve(false);
        return;
      }
      
      const backupData = {
        timestamp,
        reason,
        count: records.length,
        records
      };
      
      fs.writeFile(backupPath, JSON.stringify(backupData, null, 2), (err) => {
        if (err) {
          console.error('保存备份失败:', err.message);
          resolve(false);
          return;
        }
        
        console.log(`备份创建成功: ${backupName}`);
        cleanupOldBackups();
        resolve(true);
      });
    });
  });
}

// 清理旧备份（保留最新的MAX_BACKUPS个）
function cleanupOldBackups() {
  fs.readdir(BACKUP_DIR, (err, files) => {
    if (err) {
      console.error('读取备份目录失败:', err.message);
      return;
    }
    
    const backupFiles = files
      .filter(f => f.startsWith('backup_') && f.endsWith('.json'))
      .sort((a, b) => {
        const timestampA = parseInt(a.split('_')[1]);
        const timestampB = parseInt(b.split('_')[1]);
        return timestampB - timestampA;
      });
    
    if (backupFiles.length > MAX_BACKUPS) {
      const filesToDelete = backupFiles.slice(MAX_BACKUPS);
      filesToDelete.forEach(file => {
        fs.unlink(path.join(BACKUP_DIR, file), (err) => {
          if (err) {
            console.error('删除旧备份失败:', err.message);
          } else {
            console.log(`清理旧备份: ${file}`);
          }
        });
      });
    }
  });
}

// 获取备份列表
function getBackupList() {
  return new Promise((resolve) => {
    fs.readdir(BACKUP_DIR, (err, files) => {
      if (err) {
        console.error('读取备份目录失败:', err.message);
        resolve([]);
        return;
      }
      
      const backups = files
        .filter(f => f.startsWith('backup_') && f.endsWith('.json'))
        .map(f => {
          const parts = f.split('_');
          const timestamp = parseInt(parts[1]);
          const reason = parts[2]?.replace('.json', '') || 'manual';
          return {
            filename: f,
            timestamp,
            reason,
            date: new Date(timestamp).toLocaleString('zh-CN')
          };
        })
        .sort((a, b) => b.timestamp - a.timestamp);
      
      resolve(backups);
    });
  });
}

// 读取备份内容
function readBackup(filename) {
  return new Promise((resolve) => {
    const backupPath = path.join(BACKUP_DIR, filename);
    fs.readFile(backupPath, 'utf8', (err, data) => {
      if (err) {
        console.error('读取备份失败:', err.message);
        resolve(null);
        return;
      }
      
      try {
        const backupData = JSON.parse(data);
        resolve(backupData);
      } catch (e) {
        console.error('解析备份文件失败:', e.message);
        resolve(null);
      }
    });
  });
}

// 回滚到备份
async function rollbackToBackup(filename) {
  const backupData = await readBackup(filename);
  if (!backupData) {
    return { success: false, message: '无法读取备份文件' };
  }
  
  return new Promise((resolve) => {
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');
      
      // 删除当前所有记录
      db.run('DELETE FROM statistics', (err) => {
        if (err) {
          db.run('ROLLBACK');
          resolve({ success: false, message: '删除现有记录失败' });
          return;
        }
        
        // 插入备份记录
        if (backupData.records.length === 0) {
          db.run('COMMIT', () => {
            resolve({ success: true, message: '回滚成功，数据库已清空', count: 0 });
          });
          return;
        }
        
        const stmt = db.prepare('INSERT INTO statistics (ip, url, path, client_time, server_time, statistics_time, session_id, extra_info) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
        let completed = 0;
        
        backupData.records.forEach(record => {
          stmt.run(
            record.ip,
            record.url,
            record.path,
            record.client_time,
            record.server_time,
            record.statistics_time,
            record.session_id,
            record.extra_info,
            () => {
              completed++;
              if (completed === backupData.records.length) {
                stmt.finalize(() => {
                  db.run('COMMIT', () => {
                    console.log(`回滚到备份: ${filename}`);
                    resolve({ 
                      success: true, 
                      message: `回滚成功，恢复了 ${backupData.records.length} 条记录`,
                      count: backupData.records.length
                    });
                  });
                });
              }
            }
          );
        });
      });
    });
  });
}

// 加载密钥配置
function loadKeys() {
  try {
    if (fs.existsSync(KEYS_FILE)) {
      const data = fs.readFileSync(KEYS_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('加载密钥配置失败:', err.message);
  }
  // 返回默认配置
  return {
    uapis: { apiKey: '', enabled: false },
    ip9: { apiKey: '', enabled: false },
    github: { accessToken: '', enabled: false }
  };
}

// 保存密钥配置
function saveKeys(keys) {
  try {
    fs.writeFileSync(KEYS_FILE, JSON.stringify(keys, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('保存密钥配置失败:', err.message);
    return false;
  }
}

// 初始化密钥配置文件（如果不存在）
if (!fs.existsSync(KEYS_FILE)) {
  saveKeys({
    uapis: { apiKey: '', enabled: false },
    ip9: { apiKey: '', enabled: false },
    github: { accessToken: '', enabled: false }
  });
}

// 全局密钥配置
let apiKeys = loadKeys();

// 安全头部设置
app.use((req, res, next) => {
  // 防止XSS攻击
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  // Content Security Policy
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://cdn.tailwindcss.com; style-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com; img-src 'self' data: https://avatars.githubusercontent.com; font-src 'self'; connect-src 'self' https://api.github.com https://uapis.cn https://ip9.com.cn https://vip-84514370.ip9.com.cn;");
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

// 查询IP信息（双通道：ip9为主，uapis为备用）
async function fetchIpInfo(ip) {
  // 检查缓存
  const cached = ipCache.get(ip);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  // 尝试 ip9.com.cn（主通道）
  let result = await fetchIp9Info(ip);
  if (result) {
    return result;
  }

  // ip9 失败，尝试 uapis.cn（备用通道）
  // uapis 支持无 key 调用，无需强制启用
  result = await fetchUapisInfo(ip);
  if (result) {
    return result;
  }

  return null;
}

// ip9.com.cn 查询
async function fetchIp9Info(ip) {
  return new Promise((resolve) => {
    let url;
    if (apiKeys.ip9.enabled && apiKeys.ip9.key) {
      url = `https://vip-84514370.ip9.com.cn/get?token=${encodeURIComponent(apiKeys.ip9.key)}&ip=${encodeURIComponent(ip)}`;
    } else {
      url = `https://ip9.com.cn/get?ip=${encodeURIComponent(ip)}`;
    }
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (result.ret === 200) {
            ipCache.set(ip, { data: result.data, timestamp: Date.now() });
            resolve(result.data);
          } else {
            resolve(null);
          }
        } catch (e) {
          resolve(null);
        }
      });
    }).on('error', () => resolve(null));
  });
}

// uapis.cn 查询（备用通道）
async function fetchUapisInfo(ip) {
  return new Promise((resolve) => {
    const url = `https://uapis.cn/api/v1/network/ipinfo?ip=${encodeURIComponent(ip)}&source=commercial`;
    const options = {
      hostname: 'uapis.cn',
      path: `/api/v1/network/ipinfo?ip=${encodeURIComponent(ip)}&source=commercial`,
      method: 'GET',
      headers: {}
    };

    if (apiKeys.uapis.key) {
      options.headers['Authorization'] = `Bearer ${apiKeys.uapis.key}`;
    }

    const req = https.get(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (result.code === 200 && result.data) {
            // 统一数据格式
            const normalized = {
              ip: result.data.ip,
              country: result.data.country || result.data.country_name,
              province: result.data.province || result.data.region,
              city: result.data.city,
              isp: result.data.isp || result.data.operator,
              info: result.data.info || `${result.data.country || ''} ${result.data.province || ''} ${result.data.city || ''} ${result.data.isp || ''}`.trim(),
              source: 'uapis'
            };
            ipCache.set(ip, { data: normalized, timestamp: Date.now() });
            resolve(normalized);
          } else {
            resolve(null);
          }
        } catch (e) {
          resolve(null);
        }
      });
    });
    req.on('error', () => resolve(null));
    req.end();
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

app.delete('/api/statistics/:id', async (req, res) => {
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
    // 删除前创建备份
    await createBackup('single_delete');
    
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

app.get('/settings', (req, res) => {
  if (!checkLogin(req)) {
    return res.redirect('/login');
  }
  
  res.sendFile(path.join(__dirname, 'public', 'settings.html'));
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

app.post('/api/statistics/batch-delete', async (req, res) => {
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
    // 删除前创建备份
    await createBackup('batch_delete');
    
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

// 备份管理接口

// 获取备份列表
app.get('/api/backups', async (req, res) => {
  if (!checkLogin(req)) {
    return res.json({ code: -1, msg: '未登录' });
  }
  
  try {
    const backups = await getBackupList();
    res.json({ code: 0, data: backups });
  } catch (err) {
    console.error('获取备份列表失败:', err.message);
    return res.status(500).json({ code: -2, msg: '获取失败' });
  }
});

// 读取备份内容
app.get('/api/backups/:filename', async (req, res) => {
  if (!checkLogin(req)) {
    return res.json({ code: -1, msg: '未登录' });
  }
  
  const filename = req.params.filename;
  
  // 安全检查：防止路径遍历
  if (!filename.startsWith('backup_') || !filename.endsWith('.json')) {
    return res.json({ code: -2, msg: '无效的备份文件名' });
  }
  
  try {
    const backupData = await readBackup(filename);
    if (backupData) {
      res.json({ code: 0, data: backupData });
    } else {
      res.json({ code: -3, msg: '备份文件不存在或无法读取' });
    }
  } catch (err) {
    console.error('读取备份失败:', err.message);
    return res.status(500).json({ code: -4, msg: '读取失败' });
  }
});

// 回滚到备份
app.post('/api/backups/:filename/rollback', async (req, res) => {
  if (!checkLogin(req)) {
    return res.json({ code: -1, msg: '未登录' });
  }
  
  const filename = req.params.filename;
  
  // 安全检查：防止路径遍历
  if (!filename.startsWith('backup_') || !filename.endsWith('.json')) {
    return res.json({ code: -2, msg: '无效的备份文件名' });
  }
  
  try {
    // 回滚前先创建当前状态的备份（以防回滚错误）
    await createBackup('pre_rollback');
    
    const result = await rollbackToBackup(filename);
    if (result.success) {
      res.json({ code: 0, msg: result.message, count: result.count });
    } else {
      res.json({ code: -3, msg: result.message });
    }
  } catch (err) {
    console.error('回滚失败:', err.message);
    return res.status(500).json({ code: -4, msg: '回滚失败' });
  }
});

// 手动创建备份
app.post('/api/backups/create', async (req, res) => {
  if (!checkLogin(req)) {
    return res.json({ code: -1, msg: '未登录' });
  }
  
  const reason = req.body.reason || 'manual';
  
  try {
    const success = await createBackup(reason);
    if (success) {
      res.json({ code: 0, msg: '备份创建成功' });
    } else {
      res.json({ code: -2, msg: '备份创建失败' });
    }
  } catch (err) {
    console.error('创建备份失败:', err.message);
    return res.status(500).json({ code: -3, msg: '创建失败' });
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
  const api = req.query.api; // 可选：ip9 或 uapis
  
  if (!isValidIp(ip)) {
    return res.json({ code: -2, msg: '无效的IP地址' });
  }
  
  try {
    let ipInfo;
    
    if (api === 'uapis') {
      // 强制使用 uapis（支持无 key 调用）
      ipInfo = await fetchUapisInfo(ip);
    } else {
      // 默认使用 ip9
      ipInfo = await fetchIp9Info(ip);
    }
    
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
  const gitDirPath = path.join(__dirname, '.git');
  const hasGitDir = fs.existsSync(gitDirPath);
  console.log(`[DEBUG] .git directory check: path=${gitDirPath}, exists=${hasGitDir}`);
  if (!hasGitDir) {
    errors.push('项目根目录缺少 .git 文件夹');
  }
  
  // 检查 Git 命令
  let hasGitCmd = false;
  let localSha = null;
  let remoteSha = null;
  let hasRemote = false;
  let gitError = '';
  
  try {
    const { execSync } = require('child_process');
    
    // 检查 git 命令
    const gitVersion = execSync('git --version', { encoding: 'utf-8', stdio: 'pipe' }).trim();
    hasGitCmd = true;
    console.log(`[DEBUG] Git command available: ${gitVersion}`);
    
    if (hasGitDir) {
      // 获取本地最新 commit
      try {
        localSha = execSync('git rev-parse HEAD', { encoding: 'utf-8', stdio: 'pipe', cwd: __dirname }).trim();
        console.log(`[DEBUG] Local SHA: ${localSha}`);
      } catch (e) {
        localSha = null;
        gitError += `获取本地SHA失败: ${e.message}; `;
        console.error(`[DEBUG] 获取本地SHA失败: ${e.message}`);
      }
      
      // 获取远程仓库
      try {
        const remoteUrl = execSync('git remote get-url origin', { encoding: 'utf-8', stdio: 'pipe', cwd: __dirname }).trim();
        hasRemote = remoteUrl.length > 0;
        console.log(`[DEBUG] Remote URL: ${remoteUrl}, hasRemote=${hasRemote}`);
      } catch (e) {
        hasRemote = false;
        gitError += `获取远程仓库失败: ${e.message}; `;
        console.error(`[DEBUG] 获取远程仓库失败: ${e.message}`);
      }
      
      // 获取远程最新 commit
      if (hasRemote) {
        try {
          execSync('git fetch origin', { encoding: 'utf-8', stdio: 'pipe', cwd: __dirname });
          remoteSha = execSync('git rev-parse origin/main', { encoding: 'utf-8', stdio: 'pipe', cwd: __dirname }).trim();
        } catch (e) {
          try {
            remoteSha = execSync('git rev-parse origin/master', { encoding: 'utf-8', stdio: 'pipe', cwd: __dirname }).trim();
          } catch (e2) {
            remoteSha = null;
            gitError += `获取远程SHA失败: ${e2.message}; `;
            console.error(`[DEBUG] 获取远程SHA失败: ${e2.message}`);
          }
        }
      }
    }
  } catch (err) {
    console.error('Git 命令执行失败:', err.message);
    gitError = err.message;
  }
  
  if (!hasGitCmd) {
    errors.push('系统未安装 Git 命令行工具');
  }
  if (!hasRemote) {
    errors.push('Git 远程仓库未配置');
  }
  
  // 始终返回环境信息，即使有错误
  const result = {
    env: { hasGitDir, hasGitCmd, hasRemote },
    debug: { gitDirPath, gitError }
  };
  
  if (errors.length > 0) {
    return res.json({
      code: -1,
      msg: '环境检查未通过',
      data: { ...result, errors }
    });
  }
  
  // 计算落后多少个提交
  let ahead = 0;
  if (localSha && remoteSha && localSha !== remoteSha) {
    try {
      const { execSync } = require('child_process');
      ahead = parseInt(execSync(`git rev-list --count ${remoteSha}..${localSha}`, { encoding: 'utf-8', stdio: 'pipe', cwd: __dirname }).trim()) || 0;
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

// ======================== 密钥配置 API ========================

app.get('/api/keys', (req, res) => {
  if (!checkLogin(req)) {
    return res.json({ code: -1, msg: '未登录' });
  }

  res.json({
    code: 0,
    data: {
      uapis: {
        apiKey: apiKeys.uapis.apiKey ? '******' : '',
        enabled: apiKeys.uapis.enabled
      },
      ip9: {
        apiKey: apiKeys.ip9.apiKey ? '******' : '',
        enabled: apiKeys.ip9.enabled
      },
      github: {
        accessToken: apiKeys.github.accessToken ? '******' : '',
        enabled: apiKeys.github.enabled
      }
    }
  });
});

app.post('/api/keys', (req, res) => {
  if (!checkLogin(req)) {
    return res.json({ code: -1, msg: '未登录' });
  }

  const { uapis, ip9, github } = req.body;

  // 更新密钥配置
  if (uapis !== undefined) {
    if (typeof uapis.enabled === 'boolean') {
      apiKeys.uapis.enabled = uapis.enabled;
    }
    if (typeof uapis.apiKey === 'string') {
      apiKeys.uapis.apiKey = uapis.apiKey.trim();
    }
  }

  if (ip9 !== undefined) {
    if (typeof ip9.enabled === 'boolean') {
      apiKeys.ip9.enabled = ip9.enabled;
    }
    if (typeof ip9.apiKey === 'string') {
      apiKeys.ip9.apiKey = ip9.apiKey.trim();
    }
  }

  if (github !== undefined) {
    if (typeof github.enabled === 'boolean') {
      apiKeys.github.enabled = github.enabled;
    }
    if (typeof github.accessToken === 'string') {
      apiKeys.github.accessToken = github.accessToken.trim();
    }
  }

  if (saveKeys(apiKeys)) {
    logOperation('settings_update', null, sessionId, clientIp);
    res.json({ code: 0, msg: '配置保存成功' });
  } else {
    res.json({ code: -1, msg: '保存失败' });
  }
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