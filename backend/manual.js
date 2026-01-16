// ===== OpenTelemetry Tracing Setup =====
const { NodeTracerProvider } = require('@opentelemetry/sdk-trace-node');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');
const { BatchSpanProcessor } = require('@opentelemetry/sdk-trace-node');
const { trace, SpanStatusCode } = require('@opentelemetry/api');
const { registerInstrumentations } = require('@opentelemetry/instrumentation');
const { HttpInstrumentation } = require('@opentelemetry/instrumentation-http');
const { ExpressInstrumentation } = require('@opentelemetry/instrumentation-express');
// const { SequelizeInstrumentation } = require('@opentelemetry/instrumentation-sequelize');

// ===== OpenTelemetry Logging Setup =====
const { LoggerProvider, SimpleLogRecordProcessor } = require('@opentelemetry/sdk-logs');
const { OTLPLogExporter } = require('@opentelemetry/exporter-logs-otlp-http');
const { resourceFromAttributes } = require('@opentelemetry/resources');
const { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } = require('@opentelemetry/semantic-conventions');
const { logs, SeverityNumber } = require('@opentelemetry/api-logs');

// Resource 定義（Tracing 和 Logging 共用）
const resource = resourceFromAttributes({
  [ATTR_SERVICE_NAME]: 'be_api',
  [ATTR_SERVICE_VERSION]: '0.1.0',
  "environment.name": 'stag'
});

// ===== Tracing Provider =====
const tracerProvider = new NodeTracerProvider({
  resource: resource,
  spanProcessors: [new BatchSpanProcessor(new OTLPTraceExporter({
    url: 'http://localhost:4318/v1/traces',
  }))]
});
tracerProvider.register();

// 註冊 HTTP 和 Express 自動 instrumentation
registerInstrumentations({
  tracerProvider: tracerProvider,
  instrumentations: [
    new HttpInstrumentation({
      // OpenTelemetry 會自動接收和傳播 W3C Trace Context (traceparent, tracestate)
      ignoreIncomingRequestHook: (req) => {
        // Ignore OPTIONS requests
        if (req.method === 'OPTIONS') {
          return true;
        }
        return false;
      },
    }),
    new ExpressInstrumentation(),
    // Sequelize instrumentation 已移除，避免產生內部 SQL 查詢的 traces
    // new SequelizeInstrumentation({
    //   // 啟用 SQL 語句記錄（會顯示完整的 SQL 查詢）
    //   // responseHook: (span, response) => {
    //   //   // 可以在這裡添加自定義屬性
    //   // }
    // }),
  ],
});

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

// ===== API =====

app.post('/register', async (req, res) => {
  const { username, password } = req.body;

  // 使用 auto-instrumentation 建立的 active span
  const span = trace.getActiveSpan();

  // 添加業務相關屬性到 auto span
  if (span) {
    span.setAttribute('operation.type', 'user_registration');
    if (username) {
      span.setAttribute('user.username', username);
    }
  }

  if (!username || !password) {
    if (span) {
      span.setAttribute('error.type', 'validation_error');
      span.setAttribute('error.field', !username ? 'username' : 'password');
      span.setStatus({ code: SpanStatusCode.ERROR, message: '缺少必要欄位' });
    }

    log.error('註冊失敗：缺少必要欄位', {
      'user.username': username || 'undefined',
      'error.type': 'validation_error',
      'error.field': !username ? 'username' : 'password',
      'request.id': req.requestId,
    });

    return res.status(400).json({ error: '請提供帳號和密碼' });
  }

  try {
    const { user, totalUsers } = await userService.registerUser(username, password);

    if (span) {
      span.setAttribute('user.action', 'register');
      span.setAttribute('users.total_count', totalUsers);
      span.setStatus({ code: SpanStatusCode.OK });
    }

    log.info('註冊成功', {
      'user.username': username,
      'user.action': 'register',
      'users.total_count': totalUsers,
      'request.id': req.requestId,
    })

    res.status(201).json({ message: '註冊成功', username: user.username });
  } catch (error) {
    if (error.message === 'USER_EXISTS') {
      if (span) {
        span.setAttribute('error.type', 'conflict');
        span.setStatus({ code: SpanStatusCode.ERROR, message: '帳號已存在' });
      }

      log.error('註冊失敗：帳號已存在', {
        'user.username': username,
        'error.type': 'conflict',
        'request.id': req.requestId,
      });

      return res.status(409).json({ error: '帳號已存在' });
    }

    if (span) {
      span.setAttribute('error.type', 'database_error');
      span.setAttribute('error.message', error.message);
      span.setStatus({ code: SpanStatusCode.ERROR, message: '數據庫錯誤' });
    }

    log.error('註冊失敗：數據庫錯誤', {
      'user.username': username,
      'error.type': 'database_error',
      'error.message': error.message,
      'request.id': req.requestId,
    });

    res.status(500).json({ error: '註冊失敗，請稍後再試' });
  }
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  // 使用 auto-instrumentation 建立的 active span
  const span = trace.getActiveSpan();

  // 添加業務相關屬性
  if (span) {
    span.setAttribute('operation.type', 'user_authentication');
    if (username) {
      span.setAttribute('user.username', username);
    }
  }

  if (!username || !password) {
    if (span) {
      span.setAttribute('error.type', 'validation_error');
      span.setStatus({ code: SpanStatusCode.ERROR, message: '缺少必要欄位' });
    }

    log.error('登入失敗：缺少必要欄位', {
      'error.type': 'validation_error',
      'request.id': req.requestId,
    });

    return res.status(400).json({ error: '請提供帳號和密碼' });
  }

  try {
    const sessionId = generateSessionId();
    const { user, activeSessions } = await userService.loginUser(username, password, sessionId);

    if (span) {
      span.setAttribute('user.action', 'login');
      span.setAttribute('session.id', sessionId);
      span.setAttribute('sessions.active_count', activeSessions);
      span.setStatus({ code: SpanStatusCode.OK });
    }

    log.info(`${username} - 用戶登入成功`);

    res.status(200).json({
      message: '登入成功',
      sessionId,
      username: user.username
    });
  } catch (error) {
    if (error.message === 'USER_NOT_FOUND' || error.message === 'INVALID_PASSWORD') {
      if (span) {
        span.setAttribute('error.type', 'authentication_failed');
        span.setAttribute('error.reason', error.message === 'USER_NOT_FOUND' ? 'user_not_found' : 'invalid_password');
        span.setStatus({ code: SpanStatusCode.ERROR, message: '帳號或密碼錯誤' });
      }

      log.error('登入失敗：帳號或密碼錯誤', {
        'user.username': username,
        'error.type': 'authentication_failed',
        'error.reason': error.message === 'USER_NOT_FOUND' ? 'user_not_found' : 'invalid_password',
        'request.id': req.requestId,
      });

      return res.status(401).json({ error: '帳號或密碼錯誤' });
    }

    if (span) {
      span.setAttribute('error.type', 'database_error');
      span.setAttribute('error.message', error.message);
      span.setStatus({ code: SpanStatusCode.ERROR, message: '數據庫錯誤' });
    }

    log.error('登入失敗：數據庫錯誤', {
      'user.username': username,
      'error.type': 'database_error',
      'error.message': error.message,
      'request.id': req.requestId,
    });

    res.status(500).json({ error: '登入失敗，請稍後再試' });
  }
});

app.post('/logout', async (req, res) => {
  const { sessionId } = req.body;

  // 使用 auto-instrumentation 建立的 active span
  const span = trace.getActiveSpan();

  // 添加業務相關屬性
  if (span) {
    span.setAttribute('operation.type', 'user_logout');
    if (sessionId) {
      span.setAttribute('session.id', sessionId);
    }
  }

  if (!sessionId) {
    if (span) {
      span.setAttribute('error.type', 'validation_error');
      span.setStatus({ code: SpanStatusCode.ERROR, message: '缺少 sessionId' });
    }

    log.error('登出失敗：缺少 sessionId', {
      'error.type': 'validation_error',
      'request.id': req.requestId,
    });

    return res.status(400).json({ error: '請提供 sessionId' });
  }

  try {
    const { username, remainingSessions } = await userService.logoutUser(sessionId);

    if (span) {
      span.setAttribute('user.username', username);
      span.setAttribute('user.action', 'logout');
      span.setAttribute('sessions.remaining_count', remainingSessions);
      span.setStatus({ code: SpanStatusCode.OK });
    }

    log.info('用戶登出成功', {
      'user.username': username,
      'user.action': 'logout',
      'session.id': sessionId,
      'sessions.remaining_count': remainingSessions,
      'request.id': req.requestId,
    });

    res.status(200).json({ message: '登出成功' });
  } catch (error) {
    if (error.message === 'SESSION_NOT_FOUND') {
      if (span) {
        span.setAttribute('error.type', 'session_not_found');
        span.setStatus({ code: SpanStatusCode.ERROR, message: 'Session 不存在或已過期' });
      }

      log.error('登出失敗：Session 不存在或已過期', {
        'session.id': sessionId,
        'error.type': 'session_not_found',
        'request.id': req.requestId,
      });

      return res.status(404).json({ error: 'Session 不存在或已過期' });
    }

    if (span) {
      span.setAttribute('error.type', 'database_error');
      span.setAttribute('error.message', error.message);
      span.setStatus({ code: SpanStatusCode.ERROR, message: '數據庫錯誤' });
    }

    log.error('登出失敗：數據庫錯誤', {
      'session.id': sessionId,
      'error.type': 'database_error',
      'error.message': error.message,
      'request.id': req.requestId,
    });

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

app.post('/compute', async (req, res) => {
  const startTime = Date.now();

  // 使用 auto-instrumentation 建立的 active span
  const span = trace.getActiveSpan();

  // 隨機計算時間 1~3 秒
  const computeDuration = Math.floor(Math.random() * 2000) + 1000; // 1000-3000ms

  // 添加業務相關屬性
  if (span) {
    span.setAttribute('operation.type', 'cpu_compute');
    span.setAttribute('compute.duration_ms', computeDuration);
    span.setAttribute('compute.type', 'intensive');
  }

  log.info('開始 CPU 密集運算', {
    'operation': 'cpu_compute',
    'compute.duration_ms': computeDuration,
    'request.id': req.requestId,
  });

  try {
    // CPU 密集運算：計算質數
    let result = 0;
    const endTime = Date.now() + computeDuration;
    let iterations = 0;

    while (Date.now() < endTime) {
      // 計算質數來消耗 CPU
      let num = Math.floor(Math.random() * 10000) + 1000;
      let isPrime = true;

      for (let i = 2; i <= Math.sqrt(num); i++) {
        if (num % i === 0) {
          isPrime = false;
          break;
        }
      }

      if (isPrime) {
        result = num;
      }
      iterations++;
    }

    const actualDuration = Date.now() - startTime;

    if (span) {
      span.setAttribute('compute.iterations', iterations);
      span.setAttribute('compute.result', result);
      span.setAttribute('compute.actual_duration_ms', actualDuration);
      span.setStatus({ code: SpanStatusCode.OK });
    }

    log.info('CPU 運算完成', {
      'operation': 'cpu_compute',
      'compute.iterations': iterations,
      'compute.result': result,
      'compute.planned_duration_ms': computeDuration,
      'compute.actual_duration_ms': actualDuration,
      'request.id': req.requestId,
    });

    res.status(200).json({
      message: 'CPU 運算完成',
      result: result,
      iterations: iterations,
      plannedDuration: computeDuration,
      actualDuration: actualDuration
    });
  } catch (error) {
    const actualDuration = Date.now() - startTime;

    if (span) {
      span.setAttribute('error.type', 'compute_error');
      span.setAttribute('error.message', error.message);
      span.setAttribute('compute.actual_duration_ms', actualDuration);
      span.setStatus({ code: SpanStatusCode.ERROR, message: '運算失敗' });
    }

    log.error('CPU 運算失敗', {
      'operation': 'cpu_compute',
      'error.type': 'compute_error',
      'error.message': error.message,
      'compute.actual_duration_ms': actualDuration,
      'request.id': req.requestId,
    });

    res.status(500).json({ error: '運算失敗，請稍後再試' });
  }
});

// ===== Server =====
startServer(app, PORT, '手動 Logging/Tracing 版本 (manual.js)');

// 優雅關閉
process.on('SIGTERM', () => gracefulShutdown(tracerProvider, loggerProvider));
process.on('SIGINT', () => gracefulShutdown(tracerProvider, loggerProvider));
