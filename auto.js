// auto.js - 使用自動化 Logging 的版本
// 重要：在開頭引入 logging.js，設定 OpenTelemetry Logs
const loggerProvider = require('./logging.js');

const express = require('express');
const { SeverityNumber } = require('@opentelemetry/api-logs');

const app = express();
const PORT = 3000;

// 取得 logger 實例（自動化版本：簡單使用，不添加額外屬性）
const logger = loggerProvider.getLogger('default');

// 建立一個簡單的 logger helper
// 在自動化版本中，只需要簡單地呼叫 info/warn/error 方法
const log = {
  info: (message) => {
    console.log(`[INFO] ${message}`);
    logger.emit({
      severityNumber: SeverityNumber.INFO,
      severityText: 'INFO',
      body: message,
    });
  },
  warn: (message) => {
    console.warn(`[WARN] ${message}`);
    logger.emit({
      severityNumber: SeverityNumber.WARN,
      severityText: 'WARN',
      body: message,
    });
  },
  error: (message) => {
    console.error(`[ERROR] ${message}`);
    logger.emit({
      severityNumber: SeverityNumber.ERROR,
      severityText: 'ERROR',
      body: message,
    });
  },
};

// 用於存儲用戶資料的記憶體資料庫
const users = new Map();
const sessions = new Map();

// Middleware
app.use(express.json());

// ===== API Endpoints =====

// POST /register - 使用者註冊
app.post('/register', (req, res) => {
  const { username, password } = req.body;

  // 基本驗證
  if (!username || !password) {
    log.error('註冊失敗：缺少帳號或密碼');
    return res.status(400).json({ error: '請提供帳號和密碼' });
  }

  if (users.has(username)) {
    log.error(`註冊失敗：帳號已存在 - ${username}`);
    return res.status(409).json({ error: '帳號已存在' });
  }

  // 儲存用戶
  users.set(username, { username, password });

  log.info(`用戶註冊成功: ${username}`);
  res.status(201).json({ message: '註冊成功', username });
});

// POST /login - 用戶登入驗證
app.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    log.error('登入失敗：缺少帳號或密碼');
    return res.status(400).json({ error: '請提供帳號和密碼' });
  }

  const user = users.get(username);
  if (!user || user.password !== password) {
    log.error(`登入失敗：帳號或密碼錯誤 - ${username}`);
    return res.status(401).json({ error: '帳號或密碼錯誤' });
  }

  // 建立 session
  const sessionId = generateSessionId();
  sessions.set(sessionId, username);

  log.info(`用戶登入成功: ${username}`);
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
    log.error('登出失敗：缺少 sessionId');
    return res.status(400).json({ error: '請提供 sessionId' });
  }

  const username = sessions.get(sessionId);
  if (!username) {
    log.error('登出失敗：Session 不存在或已過期');
    return res.status(404).json({ error: 'Session 不存在或已過期' });
  }

  sessions.delete(sessionId);
  log.info(`用戶登出: ${username}`);
  res.status(200).json({ message: '登出成功' });
});

// GET /users - 列出已註冊用戶清單
app.get('/users', (req, res) => {
  const userList = Array.from(users.values()).map(u => ({
    username: u.username
  }));

  log.info(`查詢用戶列表，共 ${userList.length} 位用戶`);
  res.status(200).json({
    count: userList.length,
    users: userList
  });
});

// GET /user - 列出目前已經登入的用戶
app.get('/user', (req, res) => {
  const { sessionId } = req.query;

  if (!sessionId) {
    log.error('查詢失敗：缺少 sessionId');
    return res.status(400).json({ error: '請提供 sessionId' });
  }

  const username = sessions.get(sessionId);
  if (!username) {
    log.error('查詢失敗：Session 不存在或已過期');
    return res.status(404).json({ error: 'Session 不存在或已過期' });
  }

  const user = users.get(username);
  log.info(`查詢當前用戶: ${username}`);
  res.status(200).json({
    username: user.username,
    sessionId
  });
});

// ===== Helper Functions =====

function generateSessionId() {
  return `sess_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

// ===== 啟動伺服器 =====

app.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`自動化 Logging 版本 (auto.js) 已啟動`);
  console.log(`伺服器運行於: http://localhost:${PORT}`);
  console.log(`========================================\n`);
  console.log(`提示：使用簡單的 log.info() / log.error() 方法`);
  console.log(`所有 logs 會**立即**透過 OTLP 發送到 Alloy → Loki\n`);
  console.log(`使用 SimpleLogRecordProcessor，每條 log 都會立即發送\n`);
});

// 優雅關閉
process.on('SIGINT', async () => {
  console.log('\n正在關閉...');
  try {
    await loggerProvider.shutdown();
    console.log('OpenTelemetry LoggerProvider 已關閉');
  } catch (error) {
    console.error('關閉失敗:', error);
  }
  process.exit(0);
});
