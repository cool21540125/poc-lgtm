// manual.js - 使用手動 Logging 的版本
// 在這個版本中，我們手動設定 LoggerProvider 並添加詳細的自定義屬性

const express = require('express');
const { LoggerProvider, BatchLogRecordProcessor } = require('@opentelemetry/sdk-logs');
const { OTLPLogExporter } = require('@opentelemetry/exporter-logs-otlp-http');
const { resourceFromAttributes } = require('@opentelemetry/resources');
const { ATTR_SERVICE_NAME } = require('@opentelemetry/semantic-conventions');
const { SeverityNumber } = require('@opentelemetry/api-logs');

const app = express();
const PORT = 3000; // 改回 3000 以便與 auto.js 對照

// ===== OpenTelemetry Logs 手動設定 =====

// 1. 設定 Resource (服務資訊)
const resource = resourceFromAttributes({
  [ATTR_SERVICE_NAME]: 'otel-demo-manual-logs',
  'environment': 'development',
  'version': '1.0.0',
});

// 2. 設定 OTLP Logs Exporter
const logExporter = new OTLPLogExporter({
  url: 'http://localhost:4318/v1/logs',
});

// 3. 建立 BatchLogRecordProcessor
const logRecordProcessor = new BatchLogRecordProcessor(logExporter);

// 4. 建立 LoggerProvider
const loggerProvider = new LoggerProvider({
  resource,
  logRecordProcessors: [logRecordProcessor],
});

console.log('OpenTelemetry Logs SDK 已啟動 (手動版本)');

// 5. 取得 Logger 實例
// 📌 重點：透過這個 logger 來手動發送 logs
const logger = loggerProvider.getLogger('manual-demo-logger', '1.0.0');

// 建立一個手動 logger helper
// 📌 在手動版本中，可以添加豐富的自定義屬性和結構化資訊
const log = {
  // 📌 INFO level log
  info: (message, attributes = {}) => {
    console.log(`[INFO] ${message}`, attributes);
    logger.emit({
      severityNumber: SeverityNumber.INFO,
      severityText: 'INFO',
      body: message,
      attributes: {
        ...attributes,
        'log.level': 'info',
        'timestamp': new Date().toISOString(),
      },
    });
  },

  // 📌 WARN level log
  warn: (message, attributes = {}) => {
    console.warn(`[WARN] ${message}`, attributes);
    logger.emit({
      severityNumber: SeverityNumber.WARN,
      severityText: 'WARN',
      body: message,
      attributes: {
        ...attributes,
        'log.level': 'warn',
        'timestamp': new Date().toISOString(),
      },
    });
  },

  // 📌 ERROR level log
  error: (message, attributes = {}) => {
    console.error(`[ERROR] ${message}`, attributes);
    logger.emit({
      severityNumber: SeverityNumber.ERROR,
      severityText: 'ERROR',
      body: message,
      attributes: {
        ...attributes,
        'log.level': 'error',
        'timestamp': new Date().toISOString(),
      },
    });
  },

  // 📌 DEBUG level log (示範更細緻的 log level)
  debug: (message, attributes = {}) => {
    console.debug(`[DEBUG] ${message}`, attributes);
    logger.emit({
      severityNumber: SeverityNumber.DEBUG,
      severityText: 'DEBUG',
      body: message,
      attributes: {
        ...attributes,
        'log.level': 'debug',
        'timestamp': new Date().toISOString(),
      },
    });
  },
};

// ===== 資料存儲 =====

const users = new Map();
const sessions = new Map();

// ===== Middleware =====

app.use(express.json());

// 📌 自定義 Middleware：為每個請求記錄 log
app.use((req, res, next) => {
  // 記錄 HTTP 請求資訊
  log.info(`收到 HTTP 請求`, {
    'http.method': req.method,
    'http.url': req.url,
    'http.target': req.path,
    'http.user_agent': req.get('user-agent') || 'unknown',
    'request.id': generateRequestId(),
  });

  // 在 request 物件中保存 request ID，方便後續使用
  req.requestId = generateRequestId();

  next();
});

// ===== API Endpoints =====

// POST /register - 使用者註冊
app.post('/register', (req, res) => {
  const { username, password } = req.body;

  // 📌 記錄開始處理註冊請求
  log.debug('開始處理註冊請求', {
    'user.username': username,
    'request.id': req.requestId,
  });

  // 基本驗證
  if (!username || !password) {
    // 📌 記錄驗證失敗，包含詳細的錯誤原因
    log.error('註冊失敗：缺少必要欄位', {
      'user.username': username || 'undefined',
      'error.type': 'validation_error',
      'error.field': !username ? 'username' : 'password',
      'request.id': req.requestId,
    });
    return res.status(400).json({ error: '請提供帳號和密碼' });
  }

  if (users.has(username)) {
    // 📌 記錄帳號重複錯誤
    log.error('註冊失敗：帳號已存在', {
      'user.username': username,
      'error.type': 'conflict',
      'users.count': users.size,
      'request.id': req.requestId,
    });
    return res.status(409).json({ error: '帳號已存在' });
  }

  // 儲存用戶
  users.set(username, { username, password });

  // 📌 記錄註冊成功，包含業務相關資訊
  log.info('用戶註冊成功', {
    'user.username': username,
    'user.action': 'register',
    'users.total_count': users.size,
    'request.id': req.requestId,
  });

  res.status(201).json({ message: '註冊成功', username });
});

// POST /login - 用戶登入驗證
app.post('/login', (req, res) => {
  const { username, password } = req.body;

  log.debug('開始處理登入請求', {
    'user.username': username,
    'request.id': req.requestId,
  });

  if (!username || !password) {
    log.error('登入失敗：缺少必要欄位', {
      'error.type': 'validation_error',
      'request.id': req.requestId,
    });
    return res.status(400).json({ error: '請提供帳號和密碼' });
  }

  const user = users.get(username);
  if (!user || user.password !== password) {
    // 📌 記錄登入失敗，區分是帳號不存在還是密碼錯誤
    log.error('登入失敗：帳號或密碼錯誤', {
      'user.username': username,
      'error.type': 'authentication_failed',
      'error.reason': !user ? 'user_not_found' : 'invalid_password',
      'request.id': req.requestId,
    });
    return res.status(401).json({ error: '帳號或密碼錯誤' });
  }

  // 建立 session
  const sessionId = generateSessionId();
  sessions.set(sessionId, username);

  // 📌 記錄登入成功，包含 session 資訊
  log.info('用戶登入成功', {
    'user.username': username,
    'user.action': 'login',
    'session.id': sessionId,
    'sessions.active_count': sessions.size,
    'request.id': req.requestId,
  });

  res.status(200).json({
    message: '登入成功',
    sessionId,
    username
  });
});

// POST /logout - 用戶登出
app.post('/logout', (req, res) => {
  const { sessionId } = req.body;

  if (!sessionId) {
    log.error('登出失敗：缺少 sessionId', {
      'error.type': 'validation_error',
      'request.id': req.requestId,
    });
    return res.status(400).json({ error: '請提供 sessionId' });
  }

  const username = sessions.get(sessionId);
  if (!username) {
    log.error('登出失敗：Session 不存在或已過期', {
      'session.id': sessionId,
      'error.type': 'session_not_found',
      'request.id': req.requestId,
    });
    return res.status(404).json({ error: 'Session 不存在或已過期' });
  }

  sessions.delete(sessionId);

  // 📌 記錄登出成功
  log.info('用戶登出成功', {
    'user.username': username,
    'user.action': 'logout',
    'session.id': sessionId,
    'sessions.remaining_count': sessions.size,
    'request.id': req.requestId,
  });

  res.status(200).json({ message: '登出成功' });
});

// GET /users - 列出已註冊用戶清單
app.get('/users', (req, res) => {
  const userList = Array.from(users.values()).map(u => ({
    username: u.username
  }));

  // 📌 記錄查詢操作
  log.info('查詢用戶列表', {
    'operation': 'list_users',
    'users.count': userList.length,
    'request.id': req.requestId,
  });

  res.status(200).json({
    count: userList.length,
    users: userList
  });
});

// GET /user - 列出目前已經登入的用戶
app.get('/user', (req, res) => {
  const { sessionId } = req.query;

  if (!sessionId) {
    log.error('查詢失敗：缺少 sessionId', {
      'error.type': 'validation_error',
      'request.id': req.requestId,
    });
    return res.status(400).json({ error: '請提供 sessionId' });
  }

  const username = sessions.get(sessionId);
  if (!username) {
    log.error('查詢失敗：Session 不存在或已過期', {
      'session.id': sessionId,
      'error.type': 'session_not_found',
      'request.id': req.requestId,
    });
    return res.status(404).json({ error: 'Session 不存在或已過期' });
  }

  const user = users.get(username);

  // 📌 記錄查詢成功
  log.info('查詢當前用戶成功', {
    'operation': 'get_current_user',
    'user.username': username,
    'session.id': sessionId,
    'request.id': req.requestId,
  });

  res.status(200).json({
    username: user.username,
    sessionId
  });
});

// ===== Helper Functions =====

function generateSessionId() {
  return `sess_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

function generateRequestId() {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// ===== 啟動伺服器 =====

app.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`手動 Logging 版本 (manual.js) 已啟動`);
  console.log(`伺服器運行於: http://localhost:${PORT}`);
  console.log(`========================================\n`);
  console.log(`📌 重點說明：`);
  console.log(`1. 使用 logger.emit() 發送 logs`);
  console.log(`2. 添加自定義屬性 (attributes) 來豐富 log 資訊`);
  console.log(`3. 使用不同的 severity levels (INFO, WARN, ERROR, DEBUG)`);
  console.log(`4. 記錄詳細的業務邏輯和錯誤資訊`);
  console.log(`5. 所有 logs 透過 OTLP 發送到 Alloy → Loki\n`);
});

// 定期 flush logs (每 5 秒)
setInterval(async () => {
  try {
    await loggerProvider.forceFlush();
  } catch (error) {
    console.error('Flush logs 失敗:', error);
  }
}, 5000);

// ===== 優雅關閉 =====

process.on('SIGTERM', async () => {
  console.log('\n正在關閉...');
  try {
    await loggerProvider.forceFlush();
    await loggerProvider.shutdown();
    console.log('OpenTelemetry LoggerProvider 已關閉');
  } catch (error) {
    console.error('關閉失敗:', error);
  }
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('\n正在關閉...');
  try {
    await loggerProvider.forceFlush();
    await loggerProvider.shutdown();
    console.log('OpenTelemetry LoggerProvider 已關閉');
  } catch (error) {
    console.error('關閉失敗:', error);
  }
  process.exit(0);
});

// ===== 📌 如何自定義要收集的 logs =====
//
// 在手動版本中，你有完全的控制權，可以決定要記錄什麼資訊：
//
// 1. **基本 Log 結構**
//    logger.emit({
//      severityNumber: SeverityNumber.INFO,  // 數字形式的嚴重程度
//      severityText: 'INFO',                 // 文字形式的嚴重程度
//      body: 'Log 訊息內容',                  // Log 的主要內容
//      attributes: { ... },                  // 自定義屬性
//    });
//
// 2. **添加自定義屬性 (Attributes)**
//    - 用於記錄結構化的資料，可以用來過濾和搜尋
//    attributes: {
//      'user.username': 'alice',
//      'user.action': 'login',
//      'error.type': 'validation_error',
//      'http.method': 'POST',
//      'request.id': 'req_123',
//      // 可以添加任何自定義的 key-value
//    }
//
// 3. **使用不同的 Severity Levels**
//    - DEBUG: 詳細的除錯資訊
//    - INFO: 一般的資訊性訊息
//    - WARN: 警告訊息
//    - ERROR: 錯誤訊息
//    - FATAL: 嚴重錯誤
//
// 4. **記錄業務邏輯資訊**
//    log.info('用戶註冊成功', {
//      'user.username': username,
//      'user.action': 'register',
//      'users.total_count': users.size,
//    });
//
// 5. **記錄錯誤和異常**
//    log.error('操作失敗', {
//      'error.type': 'database_error',
//      'error.message': error.message,
//      'error.stack': error.stack,
//      'operation': 'create_user',
//    });
//
// 範例：記錄資料庫操作
// log.info('開始資料庫查詢', {
//   'db.system': 'postgresql',
//   'db.statement': 'SELECT * FROM users WHERE id = $1',
//   'db.operation': 'select',
// });
//
// try {
//   const result = await db.query('SELECT * FROM users WHERE id = $1', [userId]);
//   log.info('資料庫查詢成功', {
//     'db.operation': 'select',
//     'db.rows_affected': result.length,
//   });
// } catch (error) {
//   log.error('資料庫查詢失敗', {
//     'db.operation': 'select',
//     'error.type': 'database_error',
//     'error.message': error.message,
//   });
// }
