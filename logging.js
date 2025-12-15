// logging.js - OpenTelemetry Logs SDK 設定檔
// 這個檔案會在應用程式啟動前被載入，用於設定 OpenTelemetry Logs

const { LoggerProvider, BatchLogRecordProcessor } = require('@opentelemetry/sdk-logs');
const { OTLPLogExporter } = require('@opentelemetry/exporter-logs-otlp-http');
const { resourceFromAttributes } = require('@opentelemetry/resources');
const { ATTR_SERVICE_NAME } = require('@opentelemetry/semantic-conventions');

// 設定 OTLP Logs Exporter (發送到 Alloy)
const logExporter = new OTLPLogExporter({
  url: 'http://localhost:4318/v1/logs', // OTLP HTTP endpoint for logs
});

// 建立 BatchLogRecordProcessor
const logRecordProcessor = new BatchLogRecordProcessor(logExporter);

// 建立 LoggerProvider
const loggerProvider = new LoggerProvider({
  resource: resourceFromAttributes({
    [ATTR_SERVICE_NAME]: 'otel-demo-auto-logs', // 服務名稱
  }),
  logRecordProcessors: [logRecordProcessor],
});

console.log('OpenTelemetry Logs SDK 已啟動 (自動化版本)');

// 優雅關閉
process.on('SIGTERM', () => {
  loggerProvider.shutdown()
    .then(() => console.log('OpenTelemetry LoggerProvider 已關閉'))
    .catch((error) => console.log('關閉 LoggerProvider 時發生錯誤', error))
    .finally(() => process.exit(0));
});

module.exports = loggerProvider;
