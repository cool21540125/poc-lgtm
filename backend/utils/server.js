const { testConnection, syncDatabase } = require('../models');

/**
 * 啟動服務器的通用邏輯
 * @param {Express} app - Express 應用實例
 * @param {number} port - 端口號
 * @param {string} version - 版本名稱（auto/manual）
 */
async function startServer(app, port, version) {
  try {
    // 測試數據庫連接
    console.log('[Database] Testing connection...');
    const connected = await testConnection();
    if (!connected) {
      console.error('[Database] Failed to connect. Please check your database configuration.');
      process.exit(1);
    }

    // 同步數據庫 models（開發環境使用 alter: true，生產環境建議使用 migration）
    console.log('[Database] Synchronizing models...');
    await syncDatabase({ alter: true });

    // 啟動 Express 服務器
    app.listen(port, () => {
      console.log(`\n========================================`);
      console.log(`${version} 版本已啟動`);
      console.log(`伺服器運行於: http://localhost:${port}`);
      console.log(`數據庫: MySQL (ob_poc)`);
      console.log(`========================================\n`);
    });
  } catch (error) {
    console.error('[Server] Failed to start:', error);
    process.exit(1);
  }
}

/**
 * 優雅關閉服務器
 * @param {Object} tracerProvider - OpenTelemetry TracerProvider
 * @param {Object} loggerProvider - OpenTelemetry LoggerProvider
 */
async function gracefulShutdown(tracerProvider, loggerProvider) {
  console.log('\n正在關閉...');
  try {
    if (tracerProvider) {
      await tracerProvider.shutdown();
      console.log('OpenTelemetry TracerProvider 已關閉');
    }
    if (loggerProvider) {
      await loggerProvider.shutdown();
      console.log('OpenTelemetry LoggerProvider 已關閉');
    }
  } catch (error) {
    console.error('關閉失敗:', error);
  }
  process.exit(0);
}

module.exports = {
  startServer,
  gracefulShutdown,
};
