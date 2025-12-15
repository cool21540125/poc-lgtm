// test-logs.js - 測試 OTLP Logs 發送
const { LoggerProvider, BatchLogRecordProcessor } = require('@opentelemetry/sdk-logs');
const { OTLPLogExporter } = require('@opentelemetry/exporter-logs-otlp-http');
const { resourceFromAttributes } = require('@opentelemetry/resources');
const { ATTR_SERVICE_NAME } = require('@opentelemetry/semantic-conventions');
const { SeverityNumber } = require('@opentelemetry/api-logs');

console.log('🧪 測試 OTLP Logs 發送...\n');

// 設定 exporter
const logExporter = new OTLPLogExporter({
  url: 'http://localhost:4318/v1/logs',
});

// 設定 processor
const logRecordProcessor = new BatchLogRecordProcessor(logExporter);

// 設定 provider
const loggerProvider = new LoggerProvider({
  resource: resourceFromAttributes({
    [ATTR_SERVICE_NAME]: 'test-otel-logs',
  }),
  logRecordProcessors: [logRecordProcessor],
});

const logger = loggerProvider.getLogger('test-logger');

console.log('✅ LoggerProvider 已建立');
console.log('📤 發送測試 log...');

// 發送測試 log
logger.emit({
  severityNumber: SeverityNumber.INFO,
  severityText: 'INFO',
  body: '🧪 這是一個測試 log',
  attributes: {
    'test.id': '12345',
    'test.type': 'connection_test',
  },
});

console.log('✅ Log 已發送到 logger');
console.log('⏳ 等待 5 秒讓 BatchProcessor flush...');

// 等待 flush
setTimeout(async () => {
  try {
    await loggerProvider.forceFlush();
    console.log('✅ ForceFlush 成功');

    await loggerProvider.shutdown();
    console.log('✅ LoggerProvider 已關閉');
    console.log('\n📋 請檢查：');
    console.log('1. Alloy logs: docker compose logs alloy --tail 20');
    console.log('2. Loki logs: curl http://localhost:3100/loki/api/v1/label');
    process.exit(0);
  } catch (error) {
    console.error('❌ 錯誤:', error);
    process.exit(1);
  }
}, 5000);
