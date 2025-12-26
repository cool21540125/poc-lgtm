import { initializeFaro, getWebInstrumentations } from '@grafana/faro-web-sdk';
import { TracingInstrumentation } from '@grafana/faro-web-tracing';

// 初始化 Grafana Faro
export const faro = initializeFaro({
  url: 'http://localhost:12345/collect', // Alloy Faro receiver endpoint
  app: {
    name: 'web',
    version: '0.1.0',
    environment: 'dev',
  },

  // 啟用各種 instrumentation
  instrumentations: [
    // 自動收集 Web Vitals、錯誤、控制台日誌等
    ...getWebInstrumentations({
      captureConsole: true,           // 捕獲 console.log/error/warn
      captureConsoleDisabledLevels: [], // 不禁用任何級別
    }),

    // 啟用分散式追蹤
    new TracingInstrumentation({
      instrumentationOptions: {
        // 自動追蹤 fetch 和 XHR 請求
        propagateTraceHeaderCorsUrls: [
          /http:\/\/localhost:3000.*/, // Backend API
        ],
      },
    }),
  ],

  // 啟用 session tracking
  sessionTracking: {
    enabled: true,
    persistent: true, // session 跨頁面持久化
  },

  // 自動收集用戶互動事件
  beforeSend: (item) => {
    // 可以在這裡過濾或修改要發送的數據
    console.log('[Faro] Sending:', item.type, item);
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
