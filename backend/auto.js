// auto.js - 使用自動化 Logging 和 Tracing 的版本
// 重要：在開頭引入 tracing.js 和 logging.js，設定 OpenTelemetry
const tracerProvider = require('./tracing.js');  // 必須先引入 tracing（自動儀器化）
const loggerProvider = require('./logging.js');

const express = require('express');
const { SeverityNumber } = require('@opentelemetry/api-logs');
const corsMiddleware = require('./middleware/cors');
const createUserRoutes = require('./routes/userRoutes');
const { startServer, gracefulShutdown } = require('./utils/server');

const app = express();
const PORT = 3000;

// 取得 logger 實例（自動化版本：簡單使用，不添加額外屬性）
const logger = loggerProvider.getLogger('default');

// 建立一個簡單的 logger helper
// 在自動化版本中，只需要簡單地呼叫 info/warn/error 方法
const log = {
  info: (message) => {
    console.log(`[INFO] ${message}`);
    logger.emit({
      severityNumber: SeverityNumber.INFO,
      severityText: 'INFO',
      body: message,
    });
  },
  warn: (message) => {
    console.warn(`[WARN] ${message}`);
    logger.emit({
      severityNumber: SeverityNumber.WARN,
      severityText: 'WARN',
      body: message,
    });
  },
  error: (message) => {
    console.error(`[ERROR] ${message}`);
    logger.emit({
      severityNumber: SeverityNumber.ERROR,
      severityText: 'ERROR',
      body: message,
    });
  },
};

// ===== Middleware =====
app.use(express.json());
app.use(corsMiddleware);

// ===== Routes =====
app.use(createUserRoutes(log));

// ===== 啟動伺服器 =====
startServer(app, PORT, '自動化 Logging 版本 (auto.js)').then(() => {
  console.log(`提示：使用簡單的 log.info() / log.error() 方法`);
  console.log(`所有 logs 會**立即**透過 OTLP 發送到 Alloy → Loki\n`);
  console.log(`使用 SimpleLogRecordProcessor，每條 log 都會立即發送\n`);
});

// 優雅關閉
process.on('SIGINT', () => gracefulShutdown(tracerProvider, loggerProvider));
process.on('SIGTERM', () => gracefulShutdown(tracerProvider, loggerProvider));
