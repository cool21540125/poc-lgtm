# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Research Agents 使用指引

當遇到以下類型的問題時，**必須優先使用對應的 Agent 從源碼中查找**，經過分析後再給出答覆：

### 可用 Agents

| Agent | 用途 | 涵蓋的源碼倉庫 |
|-------|------|---------------|
| `ob-grafana-stack` | Grafana 生態系問題 | Grafana, Tempo, Loki, Mimir, Alloy, Faro |
| `ob-opentelemetry` | OpenTelemetry 標準與實作 | opentelemetry-js, opentelemetry-specification, semantic-conventions |

### 版本對齊機制（重要）

**Agent 查找前必須確保源碼版本與專案一致。** 版本來源如下：

#### Daemon Services 版本
從 `lgtm/docker-compose.yaml` 的 image tag 取得：
```bash
grep -E "image: grafana/" lgtm/docker-compose.yaml
```

#### SDK 版本
從 `package.json` 或 `package-lock.json` 取得：
- **Backend OTel SDK**: `backend/package.json` → `@opentelemetry/*`
- **Frontend Faro SDK**: `frontend/package.json` → `@grafana/faro-*`

#### 版本查找順序
1. 先讀取 `package-lock.json`（精確版本）
2. 若無，讀取 `package.json`（範圍版本，取 major.minor）

### 何時使用

**使用 `ob-grafana-stack`：**
- Grafana dashboard、datasource 配置問題
- Tempo traces 查詢、Service Graph、metrics generator
- Loki logs 查詢、label 配置
- Alloy pipeline、receiver、exporter 配置
- Faro SDK 前端監控問題

**使用 `ob-opentelemetry`：**
- OTel SDK API 使用方式（TracerProvider, LoggerProvider 等）
- Instrumentation 配置（自動/手動）
- Semantic conventions（attribute 命名規範）
- OTLP 協議細節

### 使用原則

1. **先確認版本，再查源碼** — Agent 必須先從專案文件確認版本，git checkout 後再搜索
2. **先查源碼，後給建議** — 不要憑記憶回答，優先從源碼找到確切實作
3. **跨組件問題用 `ob-grafana-stack`** — 如 Service Graph 涉及 Tempo + Grafana，在同一個 agent 中處理
4. **OTel 標準問題用 `ob-opentelemetry`** — 如 attribute 命名、SDK 用法
5. **兩者都相關時** — 可依序呼叫兩個 agents，綜合分析

## Project Overview

這是一個 OpenTelemetry 觀測性 POC 專案，展示如何將 logs 和 traces 整合到 Node.js 應用程式中，並透過 LGTM (Loki, Grafana, Tempo, Alloy) stack 進行視覺化分析。

**專案目標**：比較 OpenTelemetry 的自動化與手動 instrumentation 實作方式，並透過實際的 Web UI 展示 distributed tracing 的價值。

## Project Structure

```
ob-loki-alloy/
├── backend/              # Backend API 應用程式
│   ├── auto.js          # 使用自動化 instrumentation
│   ├── manual.js        # 使用手動 instrumentation
│   ├── logging.js       # OpenTelemetry Logs SDK 配置
│   ├── tracing.js       # OpenTelemetry Traces SDK 配置（自動化）
│   ├── package.json     # Backend dependencies
│   ├── test-api.rest    # REST Client 測試檔案
│   ├── TESTING_GUIDE.md # 完整測試指南
│   └── README.md        # Backend 詳細說明
├── frontend/         # Frontend Web UI (Vue 3 + Faro SDK)
│   ├── src/
│   │   ├── App.vue
│   │   ├── main.js
│   │   ├── instrumentation.js  # Faro SDK 配置
│   │   └── components/
│   ├── package.json
│   ├── vite.config.js
│   └── README.md
├── lgtm/               # LGTM 觀測堆疊
│   ├── docker-compose.yaml
│   ├── config.alloy    # Alloy OTLP receiver & pipeline
│   ├── tempo-standalone.yaml
│   ├── loki-standalone.yaml
│   └── CLAUDE.md       # LGTM stack 架構說明
└── api/                # API 測試檔案
```

## Common Commands

### LGTM Stack Management

```bash
# Start the observability stack
cd lgtm && docker compose up -d

# Check service status
cd lgtm && docker compose ps

# View logs
cd lgtm && docker compose logs -f alloy
cd lgtm && docker compose logs -f tempo
cd lgtm && docker compose logs -f loki

# Restart services
cd lgtm && docker compose restart alloy

# Stop all services
cd lgtm && docker compose down
```

### Backend Development

```bash
# Install dependencies
cd backend && npm install

# Run auto instrumentation version
cd backend && npm run start:auto

# Run manual instrumentation version
cd backend && npm run start:manual

# Test APIs
cd backend
# Use test-api.rest with REST Client extension
# or use curl commands in TESTING_GUIDE.md
```

### Verification Commands

```bash
# Query traces from Tempo (requires tempo-cli)
tempo-cli query api search --org-id=single-tenant localhost:3200 '{}' 2024-01-01T00:00:00Z 2026-01-01T00:00:00Z

# Query logs from Loki
curl -s 'http://localhost:3100/loki/api/v1/query_range?query=%7Bservice_name%3D%22tony_auto%22%7D&limit=10'
```

## Code Architecture

### Backend API Structure

Both `auto.js` and `manual.js` implement the same Express.js API with identical business logic:

- **POST /register** - User registration
- **POST /login** - User authentication (returns sessionId)
- **POST /logout** - User logout
- **GET /users** - List all registered users
- **GET /user?sessionId=xxx** - Get current logged-in user

Data structures:
- `users` Map: stores username → {username, password}
- `sessions` Map: stores sessionId → username

### OpenTelemetry Implementation

**auto.js (Automated Instrumentation):**
- Uses `HttpInstrumentation` and `ExpressInstrumentation` from `tracing.js`
- Automatically creates spans for all HTTP requests
- Simple log helper: `log.info()`, `log.error()`
- Minimal attributes, fast development

**manual.js (Manual Instrumentation):**
- Manually creates spans using `tracer.startSpan()`
- Full control over span attributes (e.g., `user.username`, `error.type`, `operation`)
- Rich log attributes for complex queries
- Requires careful span lifecycle management

### LGTM Stack Data Flow

```
Backend (auto.js/manual.js)
    ↓ OTLP/HTTP (port 4318)
Alloy (collector & processor)
    ├─→ Logs → Loki (port 3100)
    └─→ Traces → Tempo (port 4317 gRPC)
         ↓
Grafana (port 3001) - Query & Visualization
```

## Important Configuration Files

### backend/tracing.js
OpenTelemetry Traces SDK 配置，包含：
- NodeTracerProvider with resource attributes
- BatchSpanProcessor for efficient batching
- OTLPTraceExporter targeting `http://localhost:4318/v1/traces`
- HttpInstrumentation & ExpressInstrumentation for auto tracing

**重要修正**：必須在 NodeTracerProvider 建構時傳入 `spanProcessors`，不能使用 `provider.addSpanProcessor()`

### backend/logging.js
OpenTelemetry Logs SDK 配置，包含：
- LoggerProvider with resource attributes
- SimpleLogRecordProcessor (immediate send, no batching)
- OTLPLogExporter targeting `http://localhost:4318/v1/logs`

### lgtm/config.alloy
Alloy pipeline 配置，包含：
- OTLP receiver (HTTP 4318, gRPC 4317)
- Attribute processor (adds `env=stag`, Loki label hints)
- Batch processors for logs and traces
- Exporters: Loki (native API) and Tempo (OTLP gRPC)

## Development Notes

- Both applications use CommonJS modules (`type: "commonjs"` in package.json)
- Service names differ: `tony_auto` (auto.js) vs `be_api` (manual.js)
- All logs include `traceid` and `spanid` for correlation
- Grafana requires no authentication (anonymous login enabled)
- Tempo OTLP receivers listen on `0.0.0.0:4317/4318` (not `127.0.0.1`)

## Service Ports

- **Frontend Vue**: 5173
- **Backend API**: 3000
- **Grafana**: 3001 (mapped from internal 3000)
- **Loki HTTP**: 3100
- **Loki gRPC**: 9095
- **Tempo HTTP**: 3200
- **Tempo gRPC**: 9096 (mapped from internal 9095)
- **Tempo OTLP gRPC**: 4317 (internal only)
- **Tempo OTLP HTTP**: 4318 (internal only)
- **Alloy OTLP HTTP**: 4318
- **Alloy OTLP gRPC**: 4317
- **Alloy UI**: 12345
- **Alloy Faro**: 12347

## Frontend Implementation

Frontend Web UI 已使用 **Vue 3** 實作，位於 `frontend/`：

- **技術**: Vue 3 Composition API + Vite
- **Observability**: Grafana Faro SDK 2.1.0 (auto instrumentation)
- **Service Name**: `fe_web`
- **Port**: 5173
- **功能**: 註冊、登入、登出、查看用戶列表
- **Trace Propagation**: 自動注入 W3C Trace Context headers 到 Backend API 請求

### 啟動 Frontend

```bash
cd frontend
npm install
npm run dev
```

訪問 http://localhost:5173

## Troubleshooting

If traces are not appearing in Tempo:
- Check Alloy logs: `cd lgtm && docker compose logs -f alloy`
- Verify Tempo is receiving: `tempo-cli query api search ...`
- Check OTLP exporter URLs in backend code (should be `localhost:4318`)

If logs are not appearing in Loki:
- Check Loki logs: `cd lgtm && docker compose logs -f loki`
- Verify labels are correct in Alloy config (`service_name` label)
- Query Loki directly: `curl http://localhost:3100/loki/api/v1/query_range?query={service_name="tony_auto"}`
