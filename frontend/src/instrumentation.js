import { initializeFaro, getWebInstrumentations } from '@grafana/faro-web-sdk';
import { TracingInstrumentation } from '@grafana/faro-web-tracing';

const SERVICE_NAME = 'fe_web';
const ENVIRONMENT = import.meta.env.VITE_ENVIRONMENT || 'stag';

// 初始化 Grafana Faro
export const faro = initializeFaro({
  url: 'http://localhost:12347/collect', // Alloy Faro receiver endpoint
  app: {
    name: SERVICE_NAME,
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
    // 過濾 OPTIONS 請求的 traces 和 logs
    if (item.type === 'trace' || item.type === 'log') {
      const payload = item.payload || item;

      // 檢查是否為 OPTIONS 請求
      if (payload.http?.method === 'OPTIONS' ||
          payload.event_data_http?.method === 'OPTIONS' ||
          (typeof payload === 'string' && payload.includes('OPTIONS'))) {
        return null; // 返回 null 表示丟棄此項
      }
    }

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
export const pushLog = (message, level = 'info', context = {}) => {
  faroAPI.pushLog([message], {
    level: level.toUpperCase(),
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
