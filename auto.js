// auto.js - 使用自動化儀器的版本
// 重要：必須在最開頭引入 tracing.js，這樣 OpenTelemetry 才能自動捕捉所有操作
require('./tracing.js');

const express = require('express');
const app = express();
const PORT = 3000;

// 用於存儲用戶資料的記憶體資料庫
const users = new Map(); // key: username, value: { username, password }
const sessions = new Map(); // key: sessionId, value: username

// Middleware
app.use(express.json());

// ===== API Endpoints =====

// POST /register - 使用者註冊
app.post('/register', (req, res) => {
  const { username, password } = req.body;

  // 基本驗證
  if (!username || !password) {
    return res.status(400).json({ error: '請提供帳號和密碼' });
  }

  if (users.has(username)) {
    return res.status(409).json({ error: '帳號已存在' });
  }

  // 儲存用戶（實際應用應該要加密密碼）
  users.set(username, { username, password });

  console.log(`用戶註冊成功: ${username}`);
  res.status(201).json({ message: '註冊成功', username });
});

// POST /login - 用戶登入驗證
app.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: '請提供帳號和密碼' });
  }

  const user = users.get(username);
  if (!user || user.password !== password) {
    return res.status(401).json({ error: '帳號或密碼錯誤' });
  }

  // 建立 session
  const sessionId = generateSessionId();
  sessions.set(sessionId, username);

  console.log(`用戶登入成功: ${username}`);
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
    return res.status(400).json({ error: '請提供 sessionId' });
  }

  const username = sessions.get(sessionId);
  if (!username) {
    return res.status(404).json({ error: 'Session 不存在或已過期' });
  }

  sessions.delete(sessionId);
  console.log(`用戶登出: ${username}`);
  res.status(200).json({ message: '登出成功' });
});

// GET /users - 列出已註冊用戶清單
app.get('/users', (req, res) => {
  const userList = Array.from(users.values()).map(u => ({
    username: u.username
  }));

  res.status(200).json({
    count: userList.length,
    users: userList
  });
});

// GET /user - 列出目前已經登入的用戶
app.get('/user', (req, res) => {
  const { sessionId } = req.query;

  if (!sessionId) {
    return res.status(400).json({ error: '請提供 sessionId' });
  }

  const username = sessions.get(sessionId);
  if (!username) {
    return res.status(404).json({ error: 'Session 不存在或已過期' });
  }

  const user = users.get(username);
  res.status(200).json({
    username: user.username,
    sessionId
  });
});

// ===== Helper Functions =====

function generateSessionId() {
  return `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// ===== 啟動伺服器 =====

app.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`自動化儀器版本 (auto.js) 已啟動`);
  console.log(`伺服器運行於: http://localhost:${PORT}`);
  console.log(`========================================\n`);
  console.log(`提示：所有 HTTP 請求、Express 路由等都會被自動追蹤`);
  console.log(`無需手動添加任何追蹤代碼\n`);
});
