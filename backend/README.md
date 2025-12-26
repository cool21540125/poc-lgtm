# OpenTelemetry Logs Demo - Auto vs Manual Instrumentation

這個專案展示了 OpenTelemetry Logs 的兩種實作方式：**自動化 Logging** 和 **手動 Logging**，用於內部 demo 和教學目的。

專案架構：**應用程式 (Node.js) → Alloy (OTLP Receiver) → Loki (Logs Storage) → Grafana (Visualization)**

## 📁 專案結構

```
.
├── auto.js                 # 自動化 logging 版本 (port 3000)
├── manual.js               # 手動 logging 版本 (port 3000)
├── logging.js              # OpenTelemetry Logs SDK 設定檔 (用於 auto.js)
├── tracing.js              # [舊] OpenTelemetry Tracing 設定 (本專案不使用)
├── docker-compose.yaml     # Docker Compose 設定檔
├── alloy-config.alloy      # Alloy 設定檔
├── test-api.rest           # API 測試檔案
└── README.md               # 說明文件
```

## 🚀 快速開始

### 步驟 1: 啟動 Observability Stack

```bash
# 啟動 Grafana, Loki, Alloy
docker-compose up -d

# 查看服務狀態
docker-compose ps
```

服務啟動後：
- **Grafana**: http://localhost:3001 (匿名登入已啟用，直接進入即可)
- **Loki**: http://localhost:3100
- **Alloy UI**: http://localhost:12345
- **Alloy OTLP Receiver**: http://localhost:4318

### 步驟 2: 啟動應用程式

**選項 A：啟動自動化 logging 版本**
```bash
npm run start:auto
```

**選項 B：啟動手動 logging 版本**
```bash
npm run start:manual
```

兩個版本都運行在 **port 3000**，請選擇其中一個啟動（或在不同終端機使用修改後的 port）。

### 步驟 3: 發送測試請求

使用 `test-api.rest` 檔案測試 API，或使用 curl：

```bash
# 註冊用戶
curl -X POST http://localhost:3000/register \
  -H "Content-Type: application/json" \
  -d '{"username": "alice", "password": "password123"}'

# 登入
curl -X POST http://localhost:3000/login \
  -H "Content-Type: application/json" \
  -d '{"username": "alice", "password": "password123"}'

# 列出所有用戶
curl http://localhost:3000/users
```

### 步驟 4: 在 Grafana 查看 Logs

1. 打開 Grafana: http://localhost:3001
2. 點擊左側選單的 "Connections" → "Data sources"
3. 點擊 "Add data source"
4. 選擇 "Loki"
5. 設定 URL: `http://loki:3100`
6. 點擊 "Save & test"
7. 前往 "Explore" 查看 logs！

在 Explore 中，你可以使用 LogQL 查詢語法：
```logql
# 查看所有 logs
{service_name="otel-demo-auto-logs"}

# 查看 ERROR level 的 logs
{service_name="otel-demo-manual-logs"} |= "ERROR"

# 查看特定用戶的操作
{service_name="otel-demo-manual-logs"} | json | user_username="alice"
```

## 📊 API 端點

| 方法 | 路徑                  | 說明               | 請求 Body                                  |
|------|-----------------------|--------------------|--------------------------------------------|
| POST | `/register`           | 使用者註冊         | `{ "username": "xxx", "password": "xxx" }` |
| POST | `/login`              | 用戶登入           | `{ "username": "xxx", "password": "xxx" }` |
| POST | `/logout`             | 用戶登出           | `{ "sessionId": "xxx" }`                   |
| GET  | `/users`              | 列出所有已註冊用戶 | 無                                         |
| GET  | `/user?sessionId=xxx` | 查詢當前登入用戶   | Query string                               |

## 🔍 兩種實作方式的差異

### 自動化 Logging - `auto.js`

**特點：**
- ✅ 簡單的 logger wrapper (`log.info()`, `log.error()`)
- ✅ 程式碼簡潔，易於使用
- ✅ 適合快速開發和標準化 logging
- ❌ 較少的自定義資訊
- ❌ 不包含詳細的業務邏輯屬性

**使用方式：**
```javascript
// 引入 logging.js
const loggerProvider = require('./logging.js');
const logger = loggerProvider.getLogger('default');

// 簡單地記錄 logs
log.info('用戶註冊成功: alice');
log.error('註冊失敗：帳號已存在');
```

**收集到的資料：**
- 基本的 log 訊息
- Severity level (INFO, WARN, ERROR)
- 時間戳記
- 服務名稱

---

### 手動 Logging - `manual.js`

**特點：**
- ✅ 完全控制 log 內容和屬性
- ✅ 可以添加豐富的業務邏輯資訊
- ✅ 詳細的結構化 logs，易於查詢和分析
- ✅ 支援多種 severity levels (DEBUG, INFO, WARN, ERROR)
- ❌ 需要手動添加屬性
- ❌ 程式碼較為冗長

**使用方式：**
```javascript
// 手動設定 LoggerProvider
const loggerProvider = new LoggerProvider({ resource });
const logger = loggerProvider.getLogger('manual-demo-logger', '1.0.0');

// 發送帶有自定義屬性的 log
log.info('用戶註冊成功', {
  'user.username': 'alice',
  'user.action': 'register',
  'users.total_count': 5,
  'request.id': 'req_123',
});

log.error('註冊失敗：帳號已存在', {
  'user.username': 'alice',
  'error.type': 'conflict',
  'users.count': 4,
});
```

**收集到的資料：**
- 所有自動化版本的資料
- **自定義屬性** (user.username, error.type, request.id, etc.)
- **業務邏輯資訊** (user.action, operation, etc.)
- **詳細的錯誤分類** (error.type, error.reason)
- **更多的 severity levels** (DEBUG, INFO, WARN, ERROR)

## 📝 如何在 Manual 版本中自定義要收集的資料

在 `manual.js` 中，你可以完全控制要記錄的內容：

### 1. 基本 Log 結構
```javascript
logger.emit({
  severityNumber: SeverityNumber.INFO,
  severityText: 'INFO',
  body: 'Log 訊息內容',
  attributes: { ... },
});
```

### 2. 添加自定義屬性
```javascript
log.info('操作完成', {
  'user.username': 'alice',
  'operation': 'create_user',
  'duration_ms': 150,
  'request.id': 'req_123',
});
```

### 3. 使用不同的 Severity Levels
```javascript
log.debug('詳細除錯資訊');
log.info('一般資訊');
log.warn('警告訊息');
log.error('錯誤訊息');
```

### 4. 記錄錯誤資訊
```javascript
log.error('資料庫查詢失敗', {
  'error.type': 'database_error',
  'error.message': error.message,
  'db.operation': 'select',
  'db.table': 'users',
});
```

詳細範例請參考 `manual.js` 檔案末尾的註解說明。

## 🎯 架構說明

```
┌─────────────────┐
│  Application    │  auto.js / manual.js
│  (Node.js)      │  使用 OpenTelemetry Logs SDK
│                 │  發送 OTLP logs 到 port 4318
└────────┬────────┘
         │ OTLP/HTTP
         │ (logs)
         ▼
┌─────────────────┐
│  Grafana Alloy  │  接收 OTLP logs
│  (Collector)    │  處理並轉發到 Loki
└────────┬────────┘
         │
         │ Loki Push API
         ▼
┌─────────────────┐
│  Grafana Loki   │  儲存 logs
│  (Log Storage)  │  使用 Docker volume: vol_loki
└────────┬────────┘
         │
         │ LogQL Query
         ▼
┌─────────────────┐
│  Grafana        │  視覺化 logs
│  (Visualization)│  http://localhost:3001
└─────────────────┘
```

## 🐋 Docker Compose 服務說明

### Loki
- **Image**: `grafana/loki:3.6.2`
- **Port**: 3100
- **Volume**: `vol_loki` (儲存 logs 資料)
- **說明**: 專門用於儲存和查詢 logs

### Alloy
- **Image**: `grafana/alloy:v1.11.0`
- **Ports**:
  - 4318 (OTLP HTTP receiver)
  - 12345 (Alloy UI)
  - 12347 (Alloy receiver for Faro)
- **設定檔**: `alloy-config.alloy`
- **說明**: 接收 OTLP logs 並轉發到 Loki

### Grafana
- **Image**: `grafana/grafana:12.3`
- **Port**: 3001 (避免與 manual.js 的 3001 衝突，如需要可自行調整)
- **Volume**: `vol_grafana` (儲存 Grafana 設定)
- **說明**: 提供視覺化介面查看 logs
- **預設**: 匿名登入已啟用，無需密碼

## 🔧 常見問題排解

### 1. Alloy 無法連接到 Loki
確認 Docker 服務都已啟動：
```bash
docker-compose ps
```

查看 Alloy logs：
```bash
docker-compose logs alloy
```

### 2. 應用程式無法發送 logs 到 Alloy
確認 Alloy OTLP receiver 正在運行：
```bash
curl http://localhost:4318/v1/logs
```

檢查應用程式的 console 輸出，確認 OpenTelemetry SDK 已啟動。

### 3. Grafana 看不到 logs
- 確認已正確設定 Loki data source
- 嘗試查詢：`{service_name=~".+"}`
- 檢查時間範圍是否正確

### 4. 修改 Alloy 設定後不生效
重新啟動 Alloy 服務：
```bash
docker-compose restart alloy
```

## 🎯 Demo 展示建議

### 1. 準備工作
```bash
# 啟動 observability stack
docker-compose up -d

# 等待服務啟動完成 (約 10-15 秒)
sleep 15

# 啟動應用程式
npm run start:auto  # 或 start:manual
```

### 2. 展示流程

**步驟 1**: 展示自動化版本 (`auto.js`)
- 執行幾個 API 請求（註冊、登入、查詢）
- 在 Grafana 中查看 logs
- 觀察基本的 log 資訊

**步驟 2**: 切換到手動版本 (`manual.js`)
- 執行相同的 API 請求
- 在 Grafana 中查看 logs
- 比較兩個版本的差異：
  - Manual 版本有更多的自定義屬性
  - 更詳細的業務邏輯資訊
  - 更豐富的錯誤分類

**步驟 3**: 展示 LogQL 查詢
```logql
# 查看所有 ERROR logs
{service_name=~".+"} | json | log_level="error"

# 查看特定用戶的操作
{service_name="otel-demo-manual-logs"} | json | user_username="alice"

# 查看特定類型的錯誤
{service_name="otel-demo-manual-logs"} | json | error_type="validation_error"
```

### 3. 討論要點
- **何時使用自動化**: 快速開發、標準化 logging
- **何時使用手動**: 需要詳細的業務邏輯追蹤、複雜的查詢需求
- **混合使用**: 基礎 logging 使用自動化，關鍵業務邏輯使用手動

## 📚 相關資源

- [OpenTelemetry JavaScript Logs API](https://opentelemetry.io/docs/instrumentation/js/api/logs/)
- [Grafana Loki Documentation](https://grafana.com/docs/loki/latest/)
- [Grafana Alloy Documentation](https://grafana.com/docs/alloy/latest/)
- [LogQL Query Language](https://grafana.com/docs/loki/latest/query/)

## 🛑 停止服務

```bash
# 停止應用程式 (Ctrl+C)

# 停止並移除 Docker 容器
docker-compose down

# 停止並移除容器和 volumes（會刪除所有資料）
docker-compose down -v
```

## ⚠️ 注意事項

- 此專案僅供內部 demo 和教學使用
- 使用記憶體存儲用戶資料，重啟後資料會消失
- 密碼未加密，不適合用於生產環境
- Session 管理非常簡單，實際應用需要更完善的實作
- Loki 使用簡單的本地儲存，生產環境建議使用 S3 或其他物件儲存


# 其他

```
npm install @opentelemetry/api
npm install @opentelemetry/auto-instrumentations-node


export OTEL_TRACES_EXPORTER="otlp"
export OTEL_TRACES_EXPORTER="otlp"
export OTEL_EXPORTER_OTLP_ENDPOINT="localhost:4318"
export OTEL_NODE_RESOURCE_DETECTORS="env,host,os"
export OTEL_SERVICE_NAME="tonyyyyyyyyyyy"
NODE_OPTIONS="--require @opentelemetry/auto-instrumentations-node/register" node auto.js
```