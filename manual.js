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

// ===== App =====
const express = require('express');
const app = express();
const PORT = 3000;
const users = new Map();
const sessions = new Map();

// ===== Middleware =====
app.use(express.json());

// ===== API =====

app.post('/register', (req, res) => {
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

  if (users.has(username)) {
    span.setAttribute('error.type', 'conflict');
    span.setAttribute('users.count', users.size);
    span.setStatus({ code: SpanStatusCode.ERROR, message: '帳號已存在' });

    log.error('註冊失敗：帳號已存在', {
      'user.username': username,
      'error.type': 'conflict',
      'users.count': users.size,
      'request.id': req.requestId,
    });

    span.end();
    return res.status(409).json({ error: '帳號已存在' });
  }

  // 儲存用戶
  users.set(username, { username, password });

  span.setAttribute('user.action', 'register');
  span.setAttribute('users.total_count', users.size);
  span.setStatus({ code: SpanStatusCode.OK });

  log.info('註冊成功', {
    'user.username': username,
    'user.action': 'register',
    'users.total_count': users.size,
    'request.id': req.requestId,
  })

  span.end();
  res.status(201).json({ message: '註冊成功', username });
});

app.post('/login', (req, res) => {
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

  const user = users.get(username);
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

  const sessionId = generateSessionId();
  sessions.set(sessionId, username);

  span.setAttribute('user.action', 'login');
  span.setAttribute('session.id', sessionId);
  span.setAttribute('sessions.active_count', sessions.size);
  span.setStatus({ code: SpanStatusCode.OK });

  log.info(`${username} - 用戶登入成功`);

  span.end();
  res.status(200).json({
    message: '登入成功',
    sessionId,
    username
  });
});

app.post('/logout', (req, res) => {
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

  const username = sessions.get(sessionId);
  if (!username) {
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

  span.setAttribute('user.username', username);
  sessions.delete(sessionId);
  span.setAttribute('user.action', 'logout');
  span.setAttribute('sessions.remaining_count', sessions.size);
  span.setStatus({ code: SpanStatusCode.OK });

  log.info('用戶登出成功', {
    'user.username': username,
    'user.action': 'logout',
    'session.id': sessionId,
    'sessions.remaining_count': sessions.size,
    'request.id': req.requestId,
  });

  span.end();
  res.status(200).json({ message: '登出成功' });
});

app.get('/users', (req, res) => {
  const userList = Array.from(users.values()).map(u => ({
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
});

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

// ===== Server =====
app.listen(PORT, () => {
  console.log(`伺服器運行於: http://localhost:${PORT}`);
});
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
