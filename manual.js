// manual.js - 使用手動儀器的版本
// 在這個版本中，我們需要手動建立 spans 和添加自定義的追蹤資訊

const express = require('express');
const { NodeSDK } = require('@opentelemetry/sdk-node');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');
const { Resource } = require('@opentelemetry/resources');
const { ATTR_SERVICE_NAME } = require('@opentelemetry/semantic-conventions');
const opentelemetry = require('@opentelemetry/api');

const app = express();
const PORT = 3000;

// ===== OpenTelemetry 手動設定 =====

// 1. 設定 Resource (服務資訊)
const resource = new Resource({
  [ATTR_SERVICE_NAME]: 'otel-demo-manual',
});

// 2. 設定 Exporter
const traceExporter = new OTLPTraceExporter({
  url: 'http://localhost:4318/v1/traces',
});

// 3. 初始化 SDK（手動版本不使用自動儀器）
const sdk = new NodeSDK({
  resource,
  traceExporter,
  // 注意：這裡沒有設定 instrumentations，所以不會自動追蹤
});

sdk.start();
console.log('OpenTelemetry 手動儀器已啟動');

// 4. 取得 Tracer 實例（用於建立 spans）
// 📌 重點：透過這個 tracer 來手動建立 spans
const tracer = opentelemetry.trace.getTracer('manual-demo-tracer', '1.0.0');

// ===== 資料存儲 =====

const users = new Map();
const sessions = new Map();

// ===== Middleware =====

app.use(express.json());

// 📌 自定義 Middleware：為每個請求建立 span
// 這是手動儀器的核心概念 - 你需要明確地告訴 OpenTelemetry 要追蹤什麼
app.use((req, res, next) => {
  // 建立一個新的 span 來追蹤這個 HTTP 請求
  const span = tracer.startSpan(`HTTP ${req.method} ${req.path}`);

  // 📌 添加自定義屬性 (attributes)：你可以記錄任何你想要的資訊
  span.setAttributes({
    'http.method': req.method,
    'http.url': req.url,
    'http.target': req.path,
    // 可以添加更多自定義屬性，例如：
    // 'user.ip': req.ip,
    // 'custom.field': 'custom value',
  });

  // 當請求結束時，結束 span
  res.on('finish', () => {
    span.setAttribute('http.status_code', res.statusCode);
    span.end();
  });

  // 將 span 存在 request 物件中，讓後續的 handler 可以使用
  req.span = span;

  next();
});

// ===== API Endpoints =====

// POST /register - 使用者註冊
app.post('/register', (req, res) => {
  // 📌 建立子 span：用於追蹤特定的業務邏輯
  // startSpan 的第二個參數可以指定 parent span
  const span = tracer.startSpan('user.register', {
    parent: req.span,
  });

  const { username, password } = req.body;

  // 📌 添加事件 (event)：記錄重要的時間點
  span.addEvent('開始驗證註冊資料');

  // 基本驗證
  if (!username || !password) {
    // 📌 記錄錯誤事件
    span.addEvent('驗證失敗：缺少帳號或密碼');
    span.setStatus({ code: opentelemetry.SpanStatusCode.ERROR, message: '缺少必要欄位' });
    span.end();
    return res.status(400).json({ error: '請提供帳號和密碼' });
  }

  if (users.has(username)) {
    span.addEvent('驗證失敗：帳號已存在', { username });
    span.setStatus({ code: opentelemetry.SpanStatusCode.ERROR, message: '帳號已存在' });
    span.end();
    return res.status(409).json({ error: '帳號已存在' });
  }

  // 📌 添加自定義屬性：記錄業務相關的資訊
  span.setAttributes({
    'user.username': username,
    'user.action': 'register',
    // 注意：密碼等敏感資訊不應該記錄在 traces 中
  });

  // 儲存用戶
  users.set(username, { username, password });

  // 📌 記錄成功事件
  span.addEvent('註冊成功', {
    'user.username': username,
    'user.count': users.size,
  });

  console.log(`用戶註冊成功: ${username}`);

  span.setStatus({ code: opentelemetry.SpanStatusCode.OK });
  span.end(); // 📌 記得結束 span

  res.status(201).json({ message: '註冊成功', username });
});

// POST /login - 用戶登入驗證
app.post('/login', (req, res) => {
  const span = tracer.startSpan('user.login', {
    parent: req.span,
  });

  const { username, password } = req.body;

  span.addEvent('開始驗證登入資料');

  if (!username || !password) {
    span.addEvent('驗證失敗：缺少帳號或密碼');
    span.setStatus({ code: opentelemetry.SpanStatusCode.ERROR });
    span.end();
    return res.status(400).json({ error: '請提供帳號和密碼' });
  }

  const user = users.get(username);
  if (!user || user.password !== password) {
    span.addEvent('登入失敗：帳號或密碼錯誤', { username });
    span.setStatus({ code: opentelemetry.SpanStatusCode.ERROR });
    span.end();
    return res.status(401).json({ error: '帳號或密碼錯誤' });
  }

  // 建立 session
  const sessionId = generateSessionId();
  sessions.set(sessionId, username);

  span.setAttributes({
    'user.username': username,
    'user.action': 'login',
    'session.id': sessionId,
  });

  span.addEvent('登入成功', {
    'user.username': username,
    'active.sessions': sessions.size,
  });

  console.log(`用戶登入成功: ${username}`);

  span.setStatus({ code: opentelemetry.SpanStatusCode.OK });
  span.end();

  res.status(200).json({
    message: '登入成功',
    sessionId,
    username
  });
});

// POST /logout - 用戶登出
app.post('/logout', (req, res) => {
  const span = tracer.startSpan('user.logout', {
    parent: req.span,
  });

  const { sessionId } = req.body;

  if (!sessionId) {
    span.addEvent('登出失敗：缺少 sessionId');
    span.setStatus({ code: opentelemetry.SpanStatusCode.ERROR });
    span.end();
    return res.status(400).json({ error: '請提供 sessionId' });
  }

  const username = sessions.get(sessionId);
  if (!username) {
    span.addEvent('登出失敗：Session 不存在');
    span.setStatus({ code: opentelemetry.SpanStatusCode.ERROR });
    span.end();
    return res.status(404).json({ error: 'Session 不存在或已過期' });
  }

  sessions.delete(sessionId);

  span.setAttributes({
    'user.username': username,
    'user.action': 'logout',
    'session.id': sessionId,
  });

  span.addEvent('登出成功', { 'user.username': username });

  console.log(`用戶登出: ${username}`);

  span.setStatus({ code: opentelemetry.SpanStatusCode.OK });
  span.end();

  res.status(200).json({ message: '登出成功' });
});

// GET /users - 列出已註冊用戶清單
app.get('/users', (req, res) => {
  // 📌 這是一個簡單的查詢操作範例
  const span = tracer.startSpan('users.list', {
    parent: req.span,
  });

  const userList = Array.from(users.values()).map(u => ({
    username: u.username
  }));

  span.setAttributes({
    'users.count': userList.length,
    'operation': 'list_all_users',
  });

  span.addEvent('查詢用戶列表', { count: userList.length });

  span.setStatus({ code: opentelemetry.SpanStatusCode.OK });
  span.end();

  res.status(200).json({
    count: userList.length,
    users: userList
  });
});

// GET /user - 列出目前已經登入的用戶
app.get('/user', (req, res) => {
  const span = tracer.startSpan('user.get_current', {
    parent: req.span,
  });

  const { sessionId } = req.query;

  if (!sessionId) {
    span.addEvent('查詢失敗：缺少 sessionId');
    span.setStatus({ code: opentelemetry.SpanStatusCode.ERROR });
    span.end();
    return res.status(400).json({ error: '請提供 sessionId' });
  }

  const username = sessions.get(sessionId);
  if (!username) {
    span.addEvent('查詢失敗：Session 不存在');
    span.setStatus({ code: opentelemetry.SpanStatusCode.ERROR });
    span.end();
    return res.status(404).json({ error: 'Session 不存在或已過期' });
  }

  const user = users.get(username);

  span.setAttributes({
    'user.username': username,
    'session.id': sessionId,
  });

  span.addEvent('查詢當前用戶成功', { username });

  span.setStatus({ code: opentelemetry.SpanStatusCode.OK });
  span.end();

  res.status(200).json({
    username: user.username,
    sessionId
  });
});

// ===== Helper Functions =====

function generateSessionId() {
  return `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// ===== 優雅關閉 =====

process.on('SIGTERM', () => {
  sdk.shutdown()
    .then(() => console.log('OpenTelemetry SDK 已關閉'))
    .catch((error) => console.log('關閉 SDK 時發生錯誤', error))
    .finally(() => process.exit(0));
});

// ===== 啟動伺服器 =====

app.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`手動儀器版本 (manual.js) 已啟動`);
  console.log(`伺服器運行於: http://localhost:${PORT}`);
  console.log(`========================================\n`);
  console.log(`📌 重點說明：`);
  console.log(`1. 使用 tracer.startSpan() 建立 span`);
  console.log(`2. 使用 span.setAttributes() 添加自定義屬性`);
  console.log(`3. 使用 span.addEvent() 記錄重要事件`);
  console.log(`4. 使用 span.setStatus() 設定狀態`);
  console.log(`5. 記得呼叫 span.end() 結束追蹤\n`);
});

// ===== 📌 如何自定義要收集的 logs/traces =====
//
// 在手動儀器中，你有完全的控制權，可以決定要追蹤什麼資訊：
//
// 1. **建立 Span (追蹤範圍)**
//    const span = tracer.startSpan('操作名稱', { parent: parentSpan });
//
// 2. **添加屬性 (Attributes)**
//    - 用於記錄結構化的資料，可以用來過濾和搜尋
//    span.setAttributes({
//      'custom.field': 'value',
//      'user.id': userId,
//      'operation.type': 'database_query',
//    });
//
// 3. **添加事件 (Events)**
//    - 用於記錄特定時間點發生的事情
//    span.addEvent('事件名稱', {
//      'detail.info': 'some detail',
//      'timestamp': Date.now(),
//    });
//
// 4. **設定狀態 (Status)**
//    - 用於標記操作是否成功
//    span.setStatus({ code: opentelemetry.SpanStatusCode.OK });
//    span.setStatus({ code: opentelemetry.SpanStatusCode.ERROR, message: '錯誤訊息' });
//
// 5. **結束 Span**
//    span.end(); // 必須呼叫，否則 span 不會被發送
//
// 6. **建立子 Span (建立父子關係)**
//    const childSpan = tracer.startSpan('子操作', {
//      parent: parentSpan,  // 或使用 opentelemetry.trace.setSpan(context, parentSpan)
//    });
//
// 範例：追蹤資料庫操作
// const dbSpan = tracer.startSpan('database.query', { parent: req.span });
// dbSpan.setAttributes({
//   'db.system': 'postgresql',
//   'db.statement': 'SELECT * FROM users',
//   'db.name': 'myapp',
// });
// try {
//   const result = await db.query('SELECT * FROM users');
//   dbSpan.addEvent('查詢成功', { rows: result.length });
//   dbSpan.setStatus({ code: opentelemetry.SpanStatusCode.OK });
// } catch (error) {
//   dbSpan.addEvent('查詢失敗', { error: error.message });
//   dbSpan.setStatus({ code: opentelemetry.SpanStatusCode.ERROR, message: error.message });
//   dbSpan.recordException(error); // 記錄例外
// } finally {
//   dbSpan.end();
// }
