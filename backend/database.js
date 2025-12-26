const { Sequelize } = require('sequelize');

// 創建 Sequelize 實例
const sequelize = new Sequelize('ob_poc', 'root', '1qaz@WSX', {
  host: '127.0.0.1',
  port: 3306,
  dialect: 'mysql',
  logging: false, // 設為 true 可以看到 SQL 查詢
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },
});

// 測試數據庫連接
async function testConnection() {
  try {
    await sequelize.authenticate();
    console.log('[Database] Connection established successfully.');
    return true;
  } catch (error) {
    console.error('[Database] Unable to connect:', error.message);
    return false;
  }
}

// 同步所有 models 到數據庫
async function syncDatabase(options = {}) {
  try {
    // force: true 會刪除並重建表（開發時使用）
    // alter: true 會修改表結構以匹配 model（較安全）
    await sequelize.sync(options);
    console.log('[Database] All models synchronized successfully.');
    return true;
  } catch (error) {
    console.error('[Database] Error syncing models:', error.message);
    return false;
  }
}

module.exports = {
  sequelize,
  testConnection,
  syncDatabase,
};
