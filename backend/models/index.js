const { sequelize, testConnection, syncDatabase } = require('../database');
const User = require('./User');
const Session = require('./Session');

// 導出所有 models 和數據庫工具
module.exports = {
  sequelize,
  testConnection,
  syncDatabase,
  User,
  Session,
};
