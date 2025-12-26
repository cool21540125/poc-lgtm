# OpenTelemetry Logs & Traces POC

這是一個 OpenTelemetry 觀測性 (Observability) 的 POC 專案，展示如何將 logs 和 traces 整合到應用程式中，並透過 LGTM stack 進行視覺化分析。

## 專案架構

```
ob-loki-alloy/
├── backend/              # Backend API 應用程式
│   ├── auto.js          # 自動化 instrumentation 版本
│   ├── manual.js        # 手動 instrumentation 版本
│   ├── logging.js       # OpenTelemetry Logs 配置
│   ├── tracing.js       # OpenTelemetry Traces 配置
│   ├── test-api.rest    # API 測試檔案
│   ├── TESTING_GUIDE.md # 完整測試指南
│   └── README.md        # Backend 詳細說明
├── frontend/            # Frontend Web UI (待實作)
├── lgtm/               # LGTM 觀測堆疊配置
│   ├── docker-compose.yaml
│   ├── config.alloy    # Alloy pipeline 配置
│   ├── tempo-standalone.yaml
│   └── loki-standalone.yaml
└── api/                # API 測試檔案

```

## 快速開始

### 1. 啟動 LGTM 觀測堆疊

```bash
cd lgtm
docker compose up -d
```

### 2. 啟動 Backend API

```bash
cd backend

# 安裝依賴（首次執行）
npm install

# 啟動自動化版本
npm run start:auto

# 或啟動手動版本
npm run start:manual
```

### 3. 訪問服務

- **Backend API**: http://localhost:3000
- **Grafana**: http://localhost:3001 (查看 logs 和 traces)
- **Alloy UI**: http://localhost:12345

## 核心概念

### Auto vs Manual Instrumentation

專案包含兩種 OpenTelemetry instrumentation 實作方式：

#### **Auto.js - 自動化**
- ✅ 簡單快速，最少程式碼
- ✅ 自動追蹤 HTTP 請求和 Express 路由
- ❌ 無法自定義業務邏輯屬性

#### **Manual.js - 手動**
- ✅ 完全控制 spans 和屬性
- ✅ 可添加豐富的業務邏輯元數據
- ❌ 需要手動管理 span 生命週期

詳細比較請參考 [backend/TESTING_GUIDE.md](backend/TESTING_GUIDE.md)

## LGTM Stack

- **L**oki - Log 聚合與儲存
- **G**rafana - 視覺化儀表板
- **T**empo - 分散式追蹤後端
- **Alloy** - OpenTelemetry Collector

資料流向：
```
Backend App → Alloy (OTLP) → Loki/Tempo → Grafana
```

## 相關文檔

- [backend/README.md](backend/README.md) - Backend API 詳細說明
- [backend/TESTING_GUIDE.md](backend/TESTING_GUIDE.md) - 完整測試指南與 Grafana 查詢範例
- [lgtm/CLAUDE.md](lgtm/CLAUDE.md) - LGTM stack 架構說明
- [CLAUDE.md](CLAUDE.md) - 專案開發指南

## 下一步

- [ ] 實作 Frontend Web UI
- [ ] 從 UI 呼叫 Backend API
- [ ] 在 Grafana 中觀察 traces 如何追蹤請求鏈路
- [ ] 展示 OpenTelemetry 的實際價值
