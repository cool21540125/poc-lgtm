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

// ===== App Dependencies =====
const express = require('express');
const corsMiddleware = require('./middleware/cors');
const userService = require('./services/userService');
const { generateSessionId } = require('./utils/helpers');
const { startServer, gracefulShutdown } = require('./utils/server');

const app = express();
const PORT = 3000;

// ===== Middleware =====
app.use(express.json());
app.use(corsMiddleware);

// ===== API Endpoints with Manual Instrumentation =====

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
    const { user, totalUsers } = await userService.registerUser(username, password);

    span.setAttribute('user.action', 'register');
    span.setAttribute('users.total_count', totalUsers);
    span.setStatus({ code: SpanStatusCode.OK });

    log.info('註冊成功', {
      'user.username': username,
      'user.action': 'register',
      'users.total_count': totalUsers,
      'request.id': req.requestId,
    })

    span.end();
    res.status(201).json({ message: '註冊成功', username: user.username });
  } catch (error) {
    if (error.message === 'USER_EXISTS') {
      span.setAttribute('error.type', 'conflict');
      span.setStatus({ code: SpanStatusCode.ERROR, message: '帳號已存在' });

      log.error('註冊失敗：帳號已存在', {
        'user.username': username,
        'error.type': 'conflict',
        'request.id': req.requestId,
      });

      span.end();
      return res.status(409).json({ error: '帳號已存在' });
    }

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
    const sessionId = generateSessionId();
    const { user, activeSessions } = await userService.loginUser(username, password, sessionId);

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
    if (error.message === 'USER_NOT_FOUND' || error.message === 'INVALID_PASSWORD') {
      span.setAttribute('error.type', 'authentication_failed');
      span.setAttribute('error.reason', error.message === 'USER_NOT_FOUND' ? 'user_not_found' : 'invalid_password');
      span.setStatus({ code: SpanStatusCode.ERROR, message: '帳號或密碼錯誤' });

      log.error('登入失敗：帳號或密碼錯誤', {
        'user.username': username,
        'error.type': 'authentication_failed',
        'error.reason': error.message === 'USER_NOT_FOUND' ? 'user_not_found' : 'invalid_password',
        'request.id': req.requestId,
      });

      span.end();
      return res.status(401).json({ error: '帳號或密碼錯誤' });
    }

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
    const { username, remainingSessions } = await userService.logoutUser(sessionId);

    span.setAttribute('user.username', username);
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
    if (error.message === 'SESSION_NOT_FOUND') {
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
    const userList = await userService.getAllUsers();

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
    const { username, sessionId: sid } = await userService.getUserBySession(sessionId);

    log.info('查詢當前用戶成功', {
      'operation': 'get_current_user',
      'user.username': username,
      'session.id': sessionId,
      'request.id': req.requestId,
    });

    res.status(200).json({
      username: username,
      sessionId: sid
    });
  } catch (error) {
    if (error.message === 'SESSION_NOT_FOUND') {
      log.error('查詢失敗：Session 不存在或已過期', {
        'session.id': sessionId,
        'error.type': 'session_not_found',
        'request.id': req.requestId,
      });
      return res.status(404).json({ error: 'Session 不存在或已過期' });
    }

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

// ===== Server =====
startServer(app, PORT, '手動 Logging/Tracing 版本 (manual.js)');

// 優雅關閉
process.on('SIGTERM', () => gracefulShutdown(tracerProvider, loggerProvider));
process.on('SIGINT', () => gracefulShutdown(tracerProvider, loggerProvider));
