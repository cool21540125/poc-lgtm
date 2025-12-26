// ===== OpenTelemetry Tracing Setup =====
const { NodeTracerProvider } = require('@opentelemetry/sdk-trace-node');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');
const { BatchSpanProcessor } = require('@opentelemetry/sdk-trace-node');
const { trace, SpanStatusCode } = require('@opentelemetry/api');

// ===== OpenTelemetry Logging Setup =====
const { LoggerProvider, SimpleLogRecordProcessor } = require('@opentelemetry/sdk-logs');
const { OTLPLogExporter } = require('@opentelemetry/exporter-logs-otlp-http');
const { resourceFromAttributes } = require('@opentelemetry/resources');
const { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } = require('@opentelemetry/semantic-conventions');
const { logs, SeverityNumber } = require('@opentelemetry/api-logs');

// Resource 定義（Tracing 和 Logging 共用）
const resource = resourceFromAttributes({
  [ATTR_SERVICE_NAME]: 'tony_manual',
  [ATTR_SERVICE_VERSION]: '0.1.0',
});

// ===== Tracing Provider =====
const tracerProvider = new NodeTracerProvider({
  resource: resource,
  spanProcessors: [new BatchSpanProcessor(new OTLPTraceExporter({
    url: 'http://localhost:4318/v1/traces',
  }))]
});
// tracerProvider.addSpanProcessor(new BatchSpanProcessor(new OTLPTraceExporter({
//   url: 'http://localhost:4318/v1/traces',
// })));
tracerProvider.register();
const tracer = trace.getTracer('tony_manual', '0.1.0');

// ===== Logging Provider =====
const loggerProvider = new LoggerProvider({
  resource: resource,
  processors: [new SimpleLogRecordProcessor(new OTLPLogExporter({
    url: 'http://localhost:4318/v1/logs',
  }))],
});
logs.setGlobalLoggerProvider(loggerProvider);
const logger = loggerProvider.getLogger('log001', '0.1.0');

// ===== Otel Log Wrapper =====
const log = {
  debug: (message, attributes = {}) => {
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
  info: (message, attributes = {}) => {
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
  error: (message, attributes = {}) => {
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
  }
};

// ===== Database Models =====
const { User, Session, testConnection, syncDatabase } = require('./models');

// ===== App =====
const express = require('express');
const app = express();
const PORT = 3000;

// ===== Middleware =====
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

// ===== API =====

app.post('/register', async (req, res) => {
  // 手動創建 Span：註冊操作
  const span = tracer.startSpan('user.register', {
    attributes: {
      'operation.type': 'user_registration',
      'http.method': 'POST',
      'http.route': '/register',
    }
  });

  const { username, password } = req.body;

  // 添加用戶名到 span 屬性
  if (username) {
    span.setAttribute('user.username', username);
  }

  if (!username || !password) {
    span.setAttribute('error.type', 'validation_error');
    span.setAttribute('error.field', !username ? 'username' : 'password');
    span.setStatus({ code: SpanStatusCode.ERROR, message: '缺少必要欄位' });

    log.error('註冊失敗：缺少必要欄位', {
      'user.username': username || 'undefined',
      'error.type': 'validation_error',
      'error.field': !username ? 'username' : 'password',
      'request.id': req.requestId,
    });

    span.end();
    return res.status(400).json({ error: '請提供帳號和密碼' });
  }

  try {
    // 檢查用戶是否已存在
    const existingUser = await User.findOne({ where: { username } });
    const totalUsers = await User.count();

    if (existingUser) {
      span.setAttribute('error.type', 'conflict');
      span.setAttribute('users.count', totalUsers);
      span.setStatus({ code: SpanStatusCode.ERROR, message: '帳號已存在' });

      log.error('註冊失敗：帳號已存在', {
        'user.username': username,
        'error.type': 'conflict',
        'users.count': totalUsers,
        'request.id': req.requestId,
      });

      span.end();
      return res.status(409).json({ error: '帳號已存在' });
    }

    // 創建新用戶
    const newUser = await User.create({ username, password });
    const newTotalUsers = await User.count();

    span.setAttribute('user.action', 'register');
    span.setAttribute('users.total_count', newTotalUsers);
    span.setStatus({ code: SpanStatusCode.OK });

    log.info('註冊成功', {
      'user.username': username,
      'user.action': 'register',
      'users.total_count': newTotalUsers,
      'request.id': req.requestId,
    })

    span.end();
    res.status(201).json({ message: '註冊成功', username: newUser.username });
  } catch (error) {
    span.setAttribute('error.type', 'database_error');
    span.setAttribute('error.message', error.message);
    span.setStatus({ code: SpanStatusCode.ERROR, message: '數據庫錯誤' });

    log.error('註冊失敗：數據庫錯誤', {
      'user.username': username,
      'error.type': 'database_error',
      'error.message': error.message,
      'request.id': req.requestId,
    });

    span.end();
    res.status(500).json({ error: '註冊失敗，請稍後再試' });
  }
});

app.post('/login', async (req, res) => {
  // 手動創建 Span：登入操作
  const span = tracer.startSpan('user.login', {
    attributes: {
      'operation.type': 'user_authentication',
      'http.method': 'POST',
      'http.route': '/login',
    }
  });

  const { username, password } = req.body;

  if (username) {
    span.setAttribute('user.username', username);
  }

  log.info('開始處理登入請求', {
    'user.username': username,
    'request.id': req.requestId,
  });

  if (!username || !password) {
    span.setAttribute('error.type', 'validation_error');
    span.setStatus({ code: SpanStatusCode.ERROR, message: '缺少必要欄位' });

    log.error('登入失敗：缺少必要欄位', {
      'error.type': 'validation_error',
      'request.id': req.requestId,
    });

    span.end();
    return res.status(400).json({ error: '請提供帳號和密碼' });
  }

  try {
    // 查找用戶
    const user = await User.findOne({ where: { username } });
    if (!user || user.password !== password) {
      span.setAttribute('error.type', 'authentication_failed');
      span.setAttribute('error.reason', !user ? 'user_not_found' : 'invalid_password');
      span.setStatus({ code: SpanStatusCode.ERROR, message: '帳號或密碼錯誤' });

      log.error('登入失敗：帳號或密碼錯誤', {
        'user.username': username,
        'error.type': 'authentication_failed',
        'error.reason': !user ? 'user_not_found' : 'invalid_password',
        'request.id': req.requestId,
      });

      span.end();
      return res.status(401).json({ error: '帳號或密碼錯誤' });
    }

    // 建立 session
    const sessionId = generateSessionId();
    await Session.create({
      sessionId,
      userId: user.id,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 小時後過期
    });

    const activeSessions = await Session.count();

    span.setAttribute('user.action', 'login');
    span.setAttribute('session.id', sessionId);
    span.setAttribute('sessions.active_count', activeSessions);
    span.setStatus({ code: SpanStatusCode.OK });

    log.info(`${username} - 用戶登入成功`);

    span.end();
    res.status(200).json({
      message: '登入成功',
      sessionId,
      username: user.username
    });
  } catch (error) {
    span.setAttribute('error.type', 'database_error');
    span.setAttribute('error.message', error.message);
    span.setStatus({ code: SpanStatusCode.ERROR, message: '數據庫錯誤' });

    log.error('登入失敗：數據庫錯誤', {
      'user.username': username,
      'error.type': 'database_error',
      'error.message': error.message,
      'request.id': req.requestId,
    });

    span.end();
    res.status(500).json({ error: '登入失敗，請稍後再試' });
  }
});

app.post('/logout', async (req, res) => {
  // 手動創建 Span：登出操作
  const span = tracer.startSpan('user.logout', {
    attributes: {
      'operation.type': 'user_logout',
      'http.method': 'POST',
      'http.route': '/logout',
    }
  });

  const { sessionId } = req.body;

  if (sessionId) {
    span.setAttribute('session.id', sessionId);
  }

  if (!sessionId) {
    span.setAttribute('error.type', 'validation_error');
    span.setStatus({ code: SpanStatusCode.ERROR, message: '缺少 sessionId' });

    log.error('登出失敗：缺少 sessionId', {
      'error.type': 'validation_error',
      'request.id': req.requestId,
    });

    span.end();
    return res.status(400).json({ error: '請提供 sessionId' });
  }

  try {
    // 查找 session
    const session = await Session.findOne({
      where: { sessionId },
      include: [{ model: User, as: 'user' }]
    });

    if (!session) {
      span.setAttribute('error.type', 'session_not_found');
      span.setStatus({ code: SpanStatusCode.ERROR, message: 'Session 不存在或已過期' });

      log.error('登出失敗：Session 不存在或已過期', {
        'session.id': sessionId,
        'error.type': 'session_not_found',
        'request.id': req.requestId,
      });

      span.end();
      return res.status(404).json({ error: 'Session 不存在或已過期' });
    }

    const username = session.user.username;
    span.setAttribute('user.username', username);

    // 刪除 session
    await Session.destroy({ where: { sessionId } });

    const remainingSessions = await Session.count();

    span.setAttribute('user.action', 'logout');
    span.setAttribute('sessions.remaining_count', remainingSessions);
    span.setStatus({ code: SpanStatusCode.OK });

    log.info('用戶登出成功', {
      'user.username': username,
      'user.action': 'logout',
      'session.id': sessionId,
      'sessions.remaining_count': remainingSessions,
      'request.id': req.requestId,
    });

    span.end();
    res.status(200).json({ message: '登出成功' });
  } catch (error) {
    span.setAttribute('error.type', 'database_error');
    span.setAttribute('error.message', error.message);
    span.setStatus({ code: SpanStatusCode.ERROR, message: '數據庫錯誤' });

    log.error('登出失敗：數據庫錯誤', {
      'session.id': sessionId,
      'error.type': 'database_error',
      'error.message': error.message,
      'request.id': req.requestId,
    });

    span.end();
    res.status(500).json({ error: '登出失敗，請稍後再試' });
  }
});

app.get('/users', async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: ['username', 'createdAt'],
      order: [['createdAt', 'DESC']]
    });

    const userList = users.map(u => ({
      username: u.username
    }));

    log.info('查詢用戶列表', {
      'operation': 'list_users',
      'users.count': userList.length,
      'request.id': req.requestId,
    });

    res.status(200).json({
      count: userList.length,
      users: userList
    });
  } catch (error) {
    log.error('查詢用戶列表失敗：數據庫錯誤', {
      'operation': 'list_users',
      'error.type': 'database_error',
      'error.message': error.message,
      'request.id': req.requestId,
    });
    res.status(500).json({ error: '查詢失敗，請稍後再試' });
  }
});

app.get('/user', async (req, res) => {
  const { sessionId } = req.query;

  if (!sessionId) {
    log.error('查詢失敗：缺少 sessionId', {
      'error.type': 'validation_error',
      'request.id': req.requestId,
    });
    return res.status(400).json({ error: '請提供 sessionId' });
  }

  try {
    // 查找 session 並關聯 user
    const session = await Session.findOne({
      where: { sessionId },
      include: [{ model: User, as: 'user' }]
    });

    if (!session) {
      log.error('查詢失敗：Session 不存在或已過期', {
        'session.id': sessionId,
        'error.type': 'session_not_found',
        'request.id': req.requestId,
      });
      return res.status(404).json({ error: 'Session 不存在或已過期' });
    }

    const username = session.user.username;

    log.info('查詢當前用戶成功', {
      'operation': 'get_current_user',
      'user.username': username,
      'session.id': sessionId,
      'request.id': req.requestId,
    });

    res.status(200).json({
      username: username,
      sessionId
    });
  } catch (error) {
    log.error('查詢用戶失敗：數據庫錯誤', {
      'operation': 'get_current_user',
      'session.id': sessionId,
      'error.type': 'database_error',
      'error.message': error.message,
      'request.id': req.requestId,
    });
    res.status(500).json({ error: '查詢失敗，請稍後再試' });
  }
});

// ===== Helper Functions =====
function generateSessionId() {
  return `sess_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

// ===== Server =====
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
      console.log(`手動 Logging/Tracing 版本 (manual.js) 已啟動`);
      console.log(`伺服器運行於: http://localhost:${PORT}`);
      console.log(`數據庫: MySQL (ob_poc)`);
      console.log(`========================================\n`);
    });
  } catch (error) {
    console.error('[Server] Failed to start:', error);
    process.exit(1);
  }
}

// 啟動伺服器
startServer();
process.on('SIGTERM', async () => {
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
