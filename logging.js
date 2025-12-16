const { LoggerProvider, SimpleLogRecordProcessor } = require('@opentelemetry/sdk-logs');
const { OTLPLogExporter } = require('@opentelemetry/exporter-logs-otlp-http');
const { resourceFromAttributes } = require('@opentelemetry/resources');
const { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } = require('@opentelemetry/semantic-conventions');
const { logs } = require('@opentelemetry/api-logs');

const loggerProvider = new LoggerProvider({
  resource: resourceFromAttributes({
    [ATTR_SERVICE_NAME]: 'tony_auto',
    [ATTR_SERVICE_VERSION]: '0.1.0',
  }),
  processors: [new SimpleLogRecordProcessor(new OTLPLogExporter({
    url: 'http://localhost:4318/v1/logs',
  }))],
});
logs.setGlobalLoggerProvider(loggerProvider);

process.on('SIGTERM', () => {
  loggerProvider.shutdown()
    .then(() => console.log('OpenTelemetry LoggerProvider 已關閉'))
    .catch((error) => console.log('關閉 LoggerProvider 時發生錯誤', error))
    .finally(() => process.exit(0));
});

module.exports = loggerProvider;
