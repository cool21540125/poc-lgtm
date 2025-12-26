// auto.js - 使用自動化 Logging 和 Tracing 的版本
// 重要：在開頭引入 tracing.js 和 logging.js，設定 OpenTelemetry
const tracerProvider = require('./tracing.js');  // 必須先引入 tracing（自動儀器化）
const loggerProvider = require('./logging.js');

const express = require('express');
const { SeverityNumber } = require('@opentelemetry/api-logs');
const { User, Session, testConnection, syncDatabase } = require('./models');

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

// Middleware
app.use(express.json());

// CORS middleware for frontend access
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// ===== API Endpoints =====

// POST /register - 使用者註冊
app.post('/register', async (req, res) => {
  const { username, password } = req.body;

  // 基本驗證
  if (!username || !password) {
    log.error('註冊失敗：缺少帳號或密碼');
    return res.status(400).json({ error: '請提供帳號和密碼' });
  }

  try {
    // 檢查用戶是否已存在
    const existingUser = await User.findOne({ where: { username } });
    if (existingUser) {
      log.error(`註冊失敗：帳號已存在 - ${username}`);
      return res.status(409).json({ error: '帳號已存在' });
    }

    // 創建新用戶
    const newUser = await User.create({ username, password });

    log.info(`用戶註冊成功: ${username}`);
    res.status(201).json({ message: '註冊成功', username: newUser.username });
  } catch (error) {
    log.error(`註冊失敗：數據庫錯誤 - ${error.message}`);
    res.status(500).json({ error: '註冊失敗，請稍後再試' });
  }
});

// POST /login - 用戶登入驗證
app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    log.error('登入失敗：缺少帳號或密碼');
    return res.status(400).json({ error: '請提供帳號和密碼' });
  }

  try {
    // 查找用戶
    const user = await User.findOne({ where: { username } });
    if (!user || user.password !== password) {
      log.error(`登入失敗：帳號或密碼錯誤 - ${username}`);
      return res.status(401).json({ error: '帳號或密碼錯誤' });
    }

    // 建立 session
    const sessionId = generateSessionId();
    await Session.create({
      sessionId,
      userId: user.id,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 小時後過期
    });

    log.info(`用戶登入成功: ${username}`);
    res.status(200).json({
      message: '登入成功',
      sessionId,
      username: user.username
    });
  } catch (error) {
    log.error(`登入失敗：數據庫錯誤 - ${error.message}`);
    res.status(500).json({ error: '登入失敗，請稍後再試' });
  }
});

// POST /logout - 用戶登出
app.post('/logout', async (req, res) => {
  const { sessionId } = req.body;

  if (!sessionId) {
    log.error('登出失敗：缺少 sessionId');
    return res.status(400).json({ error: '請提供 sessionId' });
  }

  try {
    // 查找 session
    const session = await Session.findOne({
      where: { sessionId },
      include: [{ model: User, as: 'user' }]
    });

    if (!session) {
      log.error('登出失敗：Session 不存在或已過期');
      return res.status(404).json({ error: 'Session 不存在或已過期' });
    }

    const username = session.user.username;

    // 刪除 session
    await Session.destroy({ where: { sessionId } });

    log.info(`用戶登出: ${username}`);
    res.status(200).json({ message: '登出成功' });
  } catch (error) {
    log.error(`登出失敗：數據庫錯誤 - ${error.message}`);
    res.status(500).json({ error: '登出失敗，請稍後再試' });
  }
});

// GET /users - 列出已註冊用戶清單
app.get('/users', async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: ['username', 'createdAt'],
      order: [['createdAt', 'DESC']]
    });

    const userList = users.map(u => ({
      username: u.username
    }));

    log.info(`查詢用戶列表，共 ${userList.length} 位用戶`);
    res.status(200).json({
      count: userList.length,
      users: userList
    });
  } catch (error) {
    log.error(`查詢用戶列表失敗：數據庫錯誤 - ${error.message}`);
    res.status(500).json({ error: '查詢失敗，請稍後再試' });
  }
});

// GET /user - 列出目前已經登入的用戶
app.get('/user', async (req, res) => {
  const { sessionId } = req.query;

  if (!sessionId) {
    log.error('查詢失敗：缺少 sessionId');
    return res.status(400).json({ error: '請提供 sessionId' });
  }

  try {
    // 查找 session 並關聯 user
    const session = await Session.findOne({
      where: { sessionId },
      include: [{ model: User, as: 'user' }]
    });

    if (!session) {
      log.error('查詢失敗：Session 不存在或已過期');
      return res.status(404).json({ error: 'Session 不存在或已過期' });
    }

    const username = session.user.username;
    log.info(`查詢當前用戶: ${username}`);
    res.status(200).json({
      username: username,
      sessionId
    });
  } catch (error) {
    log.error(`查詢用戶失敗：數據庫錯誤 - ${error.message}`);
    res.status(500).json({ error: '查詢失敗，請稍後再試' });
  }
});

// ===== Helper Functions =====

function generateSessionId() {
  return `sess_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

// ===== 啟動伺服器 =====

async function startServer() {
  try {
    // 測試數據庫連接
    console.log('[Database] Testing connection...');
    const connected = await testConnection();
    if (!connected) {
      console.error('[Database] Failed to connect. Please check your database configuration.');
      process.exit(1);
    }

    // 同步數據庫 models（開發環境使用 alter: true，生產環境建議使用 migration）
    console.log('[Database] Synchronizing models...');
    await syncDatabase({ alter: true });

    // 啟動 Express 服務器
    app.listen(PORT, () => {
      console.log(`\n========================================`);
      console.log(`自動化 Logging 版本 (auto.js) 已啟動`);
      console.log(`伺服器運行於: http://localhost:${PORT}`);
      console.log(`數據庫: MySQL (ob_poc)`);
      console.log(`========================================\n`);
      console.log(`提示：使用簡單的 log.info() / log.error() 方法`);
      console.log(`所有 logs 會**立即**透過 OTLP 發送到 Alloy → Loki\n`);
      console.log(`使用 SimpleLogRecordProcessor，每條 log 都會立即發送\n`);
    });
  } catch (error) {
    console.error('[Server] Failed to start:', error);
    process.exit(1);
  }
}

// 啟動伺服器
startServer();

// 優雅關閉
process.on('SIGINT', async () => {
  console.log('\n正在關閉...');
  try {
    await tracerProvider.shutdown();
    console.log('OpenTelemetry TracerProvider 已關閉');
    await loggerProvider.shutdown();
    console.log('OpenTelemetry LoggerProvider 已關閉');
  } catch (error) {
    console.error('關閉失敗:', error);
  }
  process.exit(0);
});
