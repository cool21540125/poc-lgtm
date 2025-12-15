# OpenTelemetry Demo - Auto vs Manual Instrumentation

這個專案展示了 OpenTelemetry 的兩種實作方式：**自動化儀器 (Auto Instrumentation)** 和 **手動儀器 (Manual Instrumentation)**，用於內部 demo 和教學目的。

## 📁 專案結構

```
.
├── auto.js           # 自動化儀器版本 (port 3000)
├── manual.js         # 手動儀器版本 (port 3001)
├── tracing.js        # OpenTelemetry 自動化儀器設定檔
├── test-api.rest     # API 測試檔案
└── README.md         # 說明文件
```

## 🚀 快速開始

### 1. 安裝依賴

```bash
npm install
```

### 2. 啟動伺服器

**選項 A：啟動自動化儀器版本 (port 3000)**
```bash
npm run start:auto
```

**選項 B：啟動手動儀器版本 (port 3001)**
```bash
npm run start:manual
```

**選項 C：同時啟動兩個版本（使用兩個終端機視窗）**
```bash
# 終端機 1
npm run start:auto

# 終端機 2
npm run start:manual
```

### 3. 測試 API

使用 `test-api.rest` 檔案來測試 API：
- 如果使用 VS Code，請安裝 [REST Client](https://marketplace.visualstudio.com/items?itemName=humao.rest-client) 擴充套件
- 或使用 curl、Postman、Insomnia 等工具

## 📊 API 端點

所有版本都提供以下 API：

| 方法 | 路徑 | 說明 | 請求 Body |
|------|------|------|-----------|
| POST | `/register` | 使用者註冊 | `{ "username": "xxx", "password": "xxx" }` |
| POST | `/login` | 用戶登入 | `{ "username": "xxx", "password": "xxx" }` |
| POST | `/logout` | 用戶登出 | `{ "sessionId": "xxx" }` |
| GET | `/users` | 列出所有已註冊用戶 | 無 |
| GET | `/user?sessionId=xxx` | 查詢當前登入用戶 | Query string |

## 🔍 兩種實作方式的差異

### 自動化儀器 (Auto Instrumentation) - `auto.js`

**特點：**
- ✅ 只需要在應用啟動前引入 `tracing.js`
- ✅ 自動捕捉 HTTP 請求、Express 路由、資料庫查詢等
- ✅ 程式碼簡潔，不需要手動添加追蹤邏輯
- ❌ 較少的業務邏輯細節
- ❌ 客製化程度較低

**使用方式：**
```javascript
// 必須在最開頭引入
require('./tracing.js');

// 然後正常撰寫程式碼，無需額外的追蹤邏輯
const express = require('express');
const app = express();
// ... 其他程式碼
```

**收集到的資料：**
- HTTP 請求的基本資訊（方法、URL、狀態碼）
- Express 路由資訊
- 請求/回應時間
- 基本的錯誤資訊

---

### 手動儀器 (Manual Instrumentation) - `manual.js`

**特點：**
- ✅ 完全控制要追蹤的內容
- ✅ 可以添加自定義的屬性、事件、業務邏輯資訊
- ✅ 更詳細的追蹤資料
- ❌ 需要手動撰寫追蹤邏輯
- ❌ 程式碼較為冗長

**使用方式：**
```javascript
// 1. 取得 tracer
const tracer = opentelemetry.trace.getTracer('my-tracer', '1.0.0');

// 2. 建立 span
const span = tracer.startSpan('操作名稱');

// 3. 添加自定義屬性
span.setAttributes({
  'user.username': username,
  'operation.type': 'register',
});

// 4. 添加事件
span.addEvent('註冊成功', { count: users.size });

// 5. 設定狀態
span.setStatus({ code: opentelemetry.SpanStatusCode.OK });

// 6. 結束 span
span.end();
```

**收集到的資料：**
- 所有自動化儀器收集的資料
- **自定義的 span 名稱**（例如：`user.register`, `user.login`）
- **自定義屬性**（例如：`user.username`, `operation.type`）
- **自定義事件**（例如：「開始驗證註冊資料」、「註冊成功」）
- **更詳細的錯誤資訊和狀態**

## 📝 如何在 Manual 版本中自定義要收集的資料

在 `manual.js` 中，你可以完全控制要追蹤的內容：

### 1. 建立 Span（追蹤範圍）
```javascript
const span = tracer.startSpan('操作名稱', { parent: parentSpan });
```

### 2. 添加屬性 (Attributes)
用於記錄結構化的資料，可以用來過濾和搜尋
```javascript
span.setAttributes({
  'custom.field': 'value',
  'user.id': userId,
  'operation.type': 'database_query',
});
```

### 3. 添加事件 (Events)
用於記錄特定時間點發生的事情
```javascript
span.addEvent('事件名稱', {
  'detail.info': 'some detail',
  'timestamp': Date.now(),
});
```

### 4. 設定狀態 (Status)
用於標記操作是否成功
```javascript
// 成功
span.setStatus({ code: opentelemetry.SpanStatusCode.OK });

// 失敗
span.setStatus({
  code: opentelemetry.SpanStatusCode.ERROR,
  message: '錯誤訊息'
});
```

### 5. 記錄例外
```javascript
try {
  // ... 程式碼
} catch (error) {
  span.recordException(error);
  span.setStatus({
    code: opentelemetry.SpanStatusCode.ERROR,
    message: error.message
  });
}
```

### 6. 結束 Span
```javascript
span.end(); // 必須呼叫，否則 span 不會被發送
```

詳細範例請參考 `manual.js` 檔案末尾的註解說明。

## 🎯 Demo 展示建議

### 1. 準備工作
- 啟動 OpenTelemetry Collector（確保 `http://localhost:4318/v1/traces` 可用）
- 同時啟動 `auto.js` 和 `manual.js`

### 2. 展示流程
1. **執行相同的 API 請求**（註冊、登入、查詢等）在兩個版本上
2. **觀察 traces 差異**：
   - Auto 版本：顯示基本的 HTTP 和路由資訊
   - Manual 版本：顯示詳細的業務邏輯、自定義事件、屬性等

3. **展示錯誤情況**（例如：重複註冊、密碼錯誤）：
   - 比較兩個版本如何記錄錯誤資訊
   - Manual 版本會有更詳細的錯誤事件和狀態

### 3. 討論要點
- **何時使用自動化儀器**：快速啟動、標準化追蹤、減少維護成本
- **何時使用手動儀器**：需要詳細的業務邏輯追蹤、客製化需求、debug 特定問題
- **混合使用**：在自動化儀器的基礎上，針對關鍵業務邏輯添加手動追蹤

## 🔧 設定說明

### OpenTelemetry Collector Endpoint

預設使用 `http://localhost:4318/v1/traces`（OTLP HTTP endpoint）。

如需修改，請編輯：
- `tracing.js` 中的 `OTLPTraceExporter` 設定
- `manual.js` 中的 `OTLPTraceExporter` 設定

### 服務名稱 (Service Name)

- Auto 版本：`otel-demo-auto`
- Manual 版本：`otel-demo-manual`

可在對應的檔案中修改 `ATTR_SERVICE_NAME` 的值。

## 📚 參考資料

- [OpenTelemetry JavaScript 官方文件](https://opentelemetry.io/docs/instrumentation/js/)
- [OpenTelemetry Auto Instrumentation](https://opentelemetry.io/docs/instrumentation/js/automatic/)
- [OpenTelemetry Manual Instrumentation](https://opentelemetry.io/docs/instrumentation/js/instrumentation/)

## ⚠️ 注意事項

- 此專案僅供內部 demo 和教學使用
- 使用記憶體存儲資料，重啟伺服器後資料會消失
- 密碼未加密，不適合用於生產環境
- Session 管理非常簡單，實際應用需要更完善的實作
