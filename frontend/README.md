# Frontend Vue - User Management Web UI

這是 OpenTelemetry POC 的 **Vue3 Frontend Web UI**，提供用戶註冊、登入、登出和查看用戶列表的功能。

## 技術棧

- **Vue 3** - 使用 Composition API
- **Vite** - 開發伺服器和建構工具
- **Grafana Faro SDK 2.1.0** - 前端 observability (auto instrumentation)
- **純 CSS** - 樣式（無額外 CSS 框架）

## 功能

### 1. 用戶註冊 (Register)
- 輸入用戶名和密碼
- 呼叫 `POST /register` API
- 註冊成功後跳轉到登入頁面
- 發送 Faro events: `user_register_success`, `user_register_failed`

### 2. 用戶登入 (Login)
- 輸入用戶名和密碼
- 呼叫 `POST /login` API
- 登入成功後顯示 Dashboard
- 發送 Faro event: `user_login`
- 設置 Faro user context

### 3. Dashboard
- 顯示當前用戶資訊
- 顯示 Session ID
- **列出所有用戶** (GET /users)
- 登出按鈕

### 4. 用戶登出 (Logout)
- 清除前端狀態
- 返回登入頁面
- 發送 Faro event: `user_logout`

## 快速開始

### 前置需求

1. **Backend API** 已經運行在 `http://localhost:3000`

```bash
# 在另一個終端啟動 backend
cd ../backend
npm run start:auto  # 或 start:manual
```

2. **LGTM Stack** 已經啟動（包含 Alloy Faro receiver）

```bash
# 啟動 LGTM stack
cd ../lgtm
docker compose up -d
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

- `src/components/Login.vue` - API_BASE_URL
- `src/components/Register.vue` - API_BASE_URL
- `src/components/Dashboard.vue` - API_BASE_URL

## 架構說明

### 專案結構

```
frontend/
├── package.json
├── vite.config.js
├── index.html
└── src/
    ├── main.js              # 應用入口
    ├── App.vue              # 主應用組件
    ├── instrumentation.js   # Faro SDK 配置
    ├── assets/
    │   └── main.css         # 全局樣式
    └── components/
        ├── Login.vue        # 登入組件
        ├── Register.vue     # 註冊組件
        └── Dashboard.vue    # Dashboard 組件
```

### 狀態管理

使用 Vue 3 Composition API (ref) 進行簡單的狀態管理：

- `currentView`: 控制當前顯示的頁面 ('login', 'register', 'dashboard')
- `user`: 存儲登入用戶資訊 ({ username, sessionId })

### 路由邏輯

採用 **前端控制** 的簡單路由：

- 未登入：只能看到 Login 和 Register
- 已登入：顯示 Dashboard 和 Logout 按鈕

## Grafana Faro Observability

### 配置說明

在 `src/instrumentation.js` 中配置：

- **Service Name**: `fe_vue`
- **Service Version**: `0.1.0`
- **Environment**: `stag` (可透過 `VITE_ENVIRONMENT` 環境變數覆蓋)
- **Faro Collector URL**: `http://localhost:12347/collect` (Alloy Faro receiver)

### 自動收集的數據

Faro SDK 會自動收集：

1. **Web Vitals** - 頁面效能指標
2. **Errors** - JavaScript 錯誤和異常
3. **Console Logs** - 特定級別的 console 輸出
4. **User Sessions** - 用戶會話追蹤
5. **Traces** - 自動 HTTP fetch/XHR tracing

### 手動發送的事件

應用程式中手動發送的事件：

- `user_register_success` - 註冊成功
- `user_register_failed` - 註冊失敗
- `user_login` - 用戶登入
- `user_logout` - 用戶登出

### Trace Context Propagation

Faro Tracing Instrumentation 會自動在 HTTP 請求中注入 trace headers：

- 目標：`http://localhost:3000/*`
- Headers: `traceparent`, `tracestate` (W3C Trace Context)

這使得前端 traces 可以與 backend traces 關聯。

## 在 Grafana 中觀察

1. 訪問 http://localhost:3001
2. 選擇 **Tempo** 查詢 traces
   - 使用 `service.name="fe_vue"` 過濾前端 traces
3. 選擇 **Loki** 查詢 logs
   - 使用 `{service_name="fe_vue"}` 過濾前端 logs
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

## 技術亮點

- **Vue 3 Composition API** - 使用 `<script setup>` 簡潔語法
- **Grafana Faro 2.1.0** - 最新版本的前端可觀測性 SDK
- **自動化 Instrumentation** - 無需手動埋點即可收集 traces 和 logs
- **Trace Context Propagation** - 自動與 Backend traces 關聯

## Troubleshooting

### 如果無法連接 Backend

檢查 Backend 是否運行：

```bash
curl http://localhost:3000/users
```

### 如果 Faro 數據未出現在 Grafana

1. 檢查 Alloy 是否運行：

```bash
cd ../lgtm
docker compose logs -f alloy
```

2. 檢查 Faro receiver 端點：

```bash
curl http://localhost:12347
```

3. 確認瀏覽器 Console 中有 Faro 初始化訊息
