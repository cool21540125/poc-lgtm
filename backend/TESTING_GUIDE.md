# OpenTelemetry POC 測試指南

## 測試結果摘要 ✅

兩個版本的應用程式都已成功將 logs 和 traces 發送到 LGTM stack。

### Auto.js (自動化版本)
- **Service Name**: `tony_auto`
- **Logs**: ✅ 成功發送到 Loki
- **Traces**: ✅ 成功發送到 Tempo (自動 instrumentation)
- **特點**: 使用 HttpInstrumentation 和 ExpressInstrumentation 自動追蹤所有 HTTP 請求

### Manual.js (手動版本)
- **Service Name**: `be_api`
- **Logs**: ✅ 成功發送到 Loki (包含自定義屬性)
- **Traces**: ✅ 成功發送到 Tempo (手動創建 spans)
- **特點**: 完全控制 span 屬性和業務邏輯元數據

## 如何啟動服務

### 1. 啟動 LGTM Stack
```bash
cd lgtm
docker compose up -d
```

### 2. 啟動應用程式 (擇一)

**自動化版本:**
```bash
npm run start:auto
```

**手動版本:**
```bash
npm run start:manual
```

### 3. 測試 API

```bash
# 註冊用戶
curl -X POST http://localhost:3000/register \
  -H "Content-Type: application/json" \
  -d '{"username": "alice", "password": "password123"}'

# 登入
curl -X POST http://localhost:3000/login \
  -H "Content-Type: application/json" \
  -d '{"username": "alice", "password": "password123"}'

# 查詢用戶列表
curl http://localhost:3000/users
```

## 在 Grafana 中查看資料

訪問 Grafana: http://localhost:3001 (無需登入)

### 查看 Logs (Loki)

1. 進入 **Explore** 頁面
2. 選擇 **Loki** 資料源
3. 使用以下 LogQL 查詢:

**查看 auto.js 的所有 logs:**
```logql
{service_name="tony_auto"}
```

**查看 manual.js 的所有 logs:**
```logql
{service_name="be_api"}
```

**查看錯誤級別的 logs:**
```logql
{service_name="be_api"} | json | severity="ERROR"
```

**查看特定用戶的操作 (manual.js 獨有):**
```logql
{service_name="be_api"} | json | user_username="alice"
```

### 查看 Traces (Tempo)

1. 進入 **Explore** 頁面
2. 選擇 **Tempo** 資料源
3. 使用以下 TraceQL 查詢:

**查看 auto.js 的所有 traces:**
```traceql
{resource.service.name="tony_auto"}
```

**查看 manual.js 的所有 traces:**
```traceql
{resource.service.name="be_api"}
```

**查看特定操作的 traces (manual.js):**
```traceql
{resource.service.name="be_api" && name="user.register"}
```

**查看有錯誤的 traces (manual.js):**
```traceql
{resource.service.name="be_api" && status=error}
```

## Logs 與 Traces 的關聯

兩個版本的 logs 都包含 `traceid` 和 `spanid`，可以在 Grafana 中點擊 log 記錄中的 Trace ID 直接跳轉到對應的 trace 查看完整的請求鏈路。

## 兩種實作方式的比較

### Auto.js (自動化)
**優點:**
- 程式碼簡單，只需引入 tracing.js 和 logging.js
- 自動追蹤所有 HTTP 請求，無需手動創建 spans
- 適合快速開發和標準化的日誌需求

**缺點:**
- 無法添加自定義業務邏輯屬性到 spans
- Logs 只包含基本資訊 (message, severity, timestamp)

### Manual.js (手動)
**優點:**
- 完全控制 span 的屬性和生命週期
- 可以添加豐富的業務邏輯元數據 (user.username, error.type, operation 等)
- Logs 可以包含自定義屬性用於複雜查詢

**缺點:**
- 需要在每個 API endpoint 手動創建和管理 spans
- 程式碼較為冗長
- 需要注意正確關閉 spans

## CLI 驗證命令

```bash
# 使用 tempo-cli 查詢 traces
tempo-cli query api search --org-id=single-tenant localhost:3200 '{}' 2024-01-01T00:00:00Z 2026-01-01T00:00:00Z

# 使用 curl 查詢 Loki logs
curl -s 'http://localhost:3100/loki/api/v1/query_range?query=%7Bservice_name%3D%22tony_auto%22%7D&limit=10'
```

## 重要修正

在測試過程中發現並修正了 `tracing.js` 的錯誤:
- **問題**: `provider.addSpanProcessor()` 不是一個有效的方法
- **修正**: 將 `spanProcessors` 配置直接傳入 `NodeTracerProvider` 的建構函數中

## 服務端口

- **應用程式**: 3000
- **Grafana**: 3001
- **Loki**: 3100
- **Tempo**: 3200
- **Alloy OTLP HTTP**: 4318
- **Alloy OTLP gRPC**: 4317
- **Alloy UI**: 12345
