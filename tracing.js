// tracing.js - OpenTelemetry 自動化儀器設定檔
// 這個檔案會在應用程式啟動前被載入，用於設定 OpenTelemetry

const { NodeSDK } = require('@opentelemetry/sdk-node');
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');
const { resourceFromAttributes } = require('@opentelemetry/resources');
const { ATTR_SERVICE_NAME } = require('@opentelemetry/semantic-conventions');

// 設定 OTLP Exporter (可以改成你的 collector endpoint)
const traceExporter = new OTLPTraceExporter({
  url: 'http://localhost:4318/v1/traces', // 預設 OTLP HTTP endpoint
});

// 建立 NodeSDK 實例
const sdk = new NodeSDK({
  resource: resourceFromAttributes({
    [ATTR_SERVICE_NAME]: 'otel-demo-auto', // 服務名稱
  }),
  traceExporter,
  // 自動儀器：會自動捕捉 HTTP、Express 等常見框架的 traces
  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-fs': {
        enabled: false, // 關閉檔案系統追蹤以減少雜訊
      },
    }),
  ],
});

// 啟動 SDK
sdk.start();

console.log('OpenTelemetry 自動化儀器已啟動');

// 優雅關閉
process.on('SIGTERM', () => {
  sdk.shutdown()
    .then(() => console.log('OpenTelemetry SDK 已關閉'))
    .catch((error) => console.log('關閉 SDK 時發生錯誤', error))
    .finally(() => process.exit(0));
});

module.exports = sdk;
