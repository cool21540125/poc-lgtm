const { NodeTracerProvider } = require('@opentelemetry/sdk-trace-node');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');
const { BatchSpanProcessor } = require('@opentelemetry/sdk-trace-node');
const { resourceFromAttributes } = require('@opentelemetry/resources');
const { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } = require('@opentelemetry/semantic-conventions');
const { registerInstrumentations } = require('@opentelemetry/instrumentation');
const { HttpInstrumentation } = require('@opentelemetry/instrumentation-http');
const { ExpressInstrumentation } = require('@opentelemetry/instrumentation-express');

// 創建 Resource（服務識別資訊）
const resource = resourceFromAttributes({
  [ATTR_SERVICE_NAME]: 'tony_auto',
  [ATTR_SERVICE_VERSION]: '0.1.0',
});

// 創建 Trace Provider
const provider = new NodeTracerProvider({
  resource: resource,
});

// 配置 OTLP Exporter（發送到 Alloy）
const exporter = new OTLPTraceExporter({
  url: 'http://localhost:4318/v1/traces',
});

// 使用 Batch Processor（批次處理，提高性能）
provider.addSpanProcessor(new BatchSpanProcessor(exporter));

// 註冊 Provider
provider.register();

// 自動化 Instrumentation - 自動追蹤 HTTP 和 Express 請求
registerInstrumentations({
  instrumentations: [
    new HttpInstrumentation({
      requestHook: (span, request) => {
        // 為 HTTP 請求添加時間戳
        span.setAttribute('http.request.timestamp', new Date().toISOString());
      },
    }),
    new ExpressInstrumentation({
      requestHook: (span, info) => {
        // 為 Express 請求添加路由資訊
        span.setAttribute('express.route', info.route || 'unknown');
      },
    }),
  ],
});

console.log('✓ OpenTelemetry Tracing 已初始化（自動化版本）');
console.log('  - 服務名稱: tony_auto');
console.log('  - 自動追蹤 HTTP 和 Express 請求');
console.log('  - Traces 發送到: http://localhost:4318/v1/traces → Alloy → Tempo\n');

module.exports = provider;
