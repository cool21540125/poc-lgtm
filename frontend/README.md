# Frontend - User Management Web UI

這是 OpenTelemetry POC 的 Frontend Web UI，提供用戶註冊、登入、登出和查看用戶列表的功能。

## 技術棧

- **React** - UI 框架
- **Vite** - 開發伺服器和建構工具
- **純 CSS** - 樣式（無額外 CSS 框架）

## 功能

### 1. 用戶註冊 (Register)
- 輸入用戶名和密碼
- 呼叫 `POST /register` API
- 註冊成功後跳轉到登入頁面

### 2. 用戶登入 (Login)
- 輸入用戶名和密碼
- 呼叫 `POST /login` API
- 登入成功後顯示 Dashboard

### 3. Dashboard
- 顯示當前用戶資訊
- 顯示 Session ID
- **列出所有用戶** (GET /users)
- 登出按鈕

### 4. 用戶登出 (Logout)
- 清除前端狀態
- 返回登入頁面
- **注意**: 目前未呼叫 backend logout API

## 快速開始

### 前置需求

確保 Backend API 已經運行在 `http://localhost:3000`

```bash
# 在另一個終端啟動 backend
cd ../backend
npm run start:auto  # 或 start:manual
```

### 安裝與運行

```bash
# 安裝依賴
npm install

# 啟動開發伺服器
npm run dev

# Frontend 將運行在 http://localhost:5173
```

### 其他命令

```bash
# 建構生產版本
npm run build

# 預覽生產建構
npm run preview
```

## API 端點配置

Frontend 預設連接到 `http://localhost:3000`，配置在各組件中：

- `src/components/Register.jsx` - API_BASE_URL
- `src/components/Login.jsx` - API_BASE_URL
- `src/components/Dashboard.jsx` - API_BASE_URL

## 架構說明

### 組件結構

```
src/
├── App.jsx                 # 主應用程式（管理路由和用戶狀態）
├── App.css                 # 全局樣式
└── components/
    ├── Register.jsx        # 註冊組件
    ├── Login.jsx           # 登入組件
    └── Dashboard.jsx       # Dashboard 組件（需登入）
```

### 狀態管理

使用 React Hooks (useState) 進行簡單的狀態管理：

- `currentView`: 控制當前顯示的頁面 ('login', 'register', 'dashboard')
- `user`: 存儲登入用戶資訊 ({ username, sessionId })

### 路由邏輯

採用 **前端控制** 的簡單路由：

- 未登入：只能看到 Login 和 Register
- 已登入：顯示 Dashboard 和 Logout 按鈕

## OpenTelemetry 觀測

當您與 UI 互動時，所有 API 呼叫都會：

1. **觸發 Backend traces** - 在 Tempo 中可見
2. **產生 Backend logs** - 在 Loki 中可見
3. **關聯 trace ID 和 span ID** - logs 與 traces 互相關聯

### 在 Grafana 中觀察

1. 訪問 http://localhost:3001
2. 選擇 **Tempo** 查詢 traces
3. 選擇 **Loki** 查詢 logs
4. 點擊 log 中的 Trace ID 可跳轉到對應的 trace 查看完整請求鏈路

## 使用流程範例

1. **註冊新用戶**
   - 輸入用戶名: `alice`
   - 輸入密碼: `password123`
   - 點擊「註冊」

2. **登入**
   - 輸入相同的用戶名和密碼
   - 點擊「登入」

3. **查看 Dashboard**
   - 看到歡迎訊息
   - 看到 Session ID
   - 看到所有已註冊用戶列表

4. **登出**
   - 點擊右上角「Logout」按鈕
   - 返回登入頁面

## 注意事項

- **無路由守衛**：URL 不會改變，純粹是 state 切換
- **Session 管理**：Session 僅在前端狀態中，重新整理頁面會丟失
- **無持久化**：重啟 backend 會丟失所有用戶資料
- **無表單驗證**：僅基本的必填檢查
- **CORS 已啟用**：Backend 允許所有來源的請求

## 下一步

- [ ] 在 Grafana 中觀察 traces 和 logs 的關聯
- [ ] 展示 distributed tracing 如何幫助 debug
- [ ] 體驗 OpenTelemetry 的價值
