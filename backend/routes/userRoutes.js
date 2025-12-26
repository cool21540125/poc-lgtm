const express = require('express');
const userController = require('../controllers/userController');

/**
 * 創建用戶路由
 * @param {Object} log - Logger 實例（來自 auto.js 的 log helper）
 * @returns {Router} Express Router
 */
function createUserRoutes(log) {
  const router = express.Router();

  // POST /register - 用戶註冊
  router.post('/register', (req, res) => userController.register(req, res, log));

  // POST /login - 用戶登入
  router.post('/login', (req, res) => userController.login(req, res, log));

  // POST /logout - 用戶登出
  router.post('/logout', (req, res) => userController.logout(req, res, log));

  // GET /users - 獲取用戶列表
  router.get('/users', (req, res) => userController.getUsers(req, res, log));

  // GET /user - 獲取當前登入用戶
  router.get('/user', (req, res) => userController.getCurrentUser(req, res, log));

  return router;
}

module.exports = createUserRoutes;
