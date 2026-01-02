import { initializeFaro, getWebInstrumentations } from '@grafana/faro-web-sdk';
import { TracingInstrumentation } from '@grafana/faro-web-tracing';

const SERVICE_NAME = 'fe_vue';
const SERVICE_VERSION = '0.1.3';
const ENVIRONMENT = import.meta.env.VITE_ENVIRONMENT || 'stag';

// 初始化 Grafana Faro
export const faro = initializeFaro({
  url: 'http://localhost:12347/collect', // Alloy Faro receiver endpoint
  app: {
    name: SERVICE_NAME,
    version: SERVICE_VERSION,
    environment: ENVIRONMENT,
  },

  // 啟用各種 instrumentation
  instrumentations: [
    ...getWebInstrumentations({
      captureConsole: false,
      captureConsoleDisabledLevels: ['log', 'debug', 'info'],
    }),

    new TracingInstrumentation({
      instrumentationOptions: {
        propagateTraceHeaderCorsUrls: [
          /http:\/\/localhost:3000.*/,
        ],
      },
    }),
  ],

  // 啟用 session tracking
  sessionTracking: {
    enabled: true,
    persistent: true,
  },

  beforeSend: (item) => {
    return item;
  },
});

// 導出 Faro API 以便在應用中使用
export const { api: faroAPI } = faro;

// 工具函數：推送自定義事件
export const pushEvent = (name, attributes = {}, domain = 'custom') => {
  faroAPI.pushEvent(name, attributes, domain);
};

// 工具函數：推送自定義日誌
export const pushLog = (message, context = {}, level = 'info') => {
  faroAPI.pushLog([message], {
    level,
    context,
  });
};

// 工具函數：推送錯誤
export const pushError = (error, context = {}) => {
  faroAPI.pushError(error, {
    context,
  });
};

// 工具函數：設置用戶資訊
export const setUser = (user) => {
  faroAPI.setUser({
    id: user.sessionId || 'unknown',
    username: user.username || 'anonymous',
    attributes: {
      sessionId: user.sessionId,
    },
  });
};

console.log('[Faro] Initialized successfully');
console.log('[Faro] Session ID:', faroAPI.getSession()?.id);
