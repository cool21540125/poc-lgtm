const userService = require('../services/userService');
const { generateSessionId } = require('../utils/helpers');

/**
 * User Controller
 * 處理 HTTP 請求和響應，適用於 auto.js（自動化版本）
 */

class UserController {
  /**
   * POST /register - 用戶註冊
   */
  async register(req, res, log) {
    const { username, password } = req.body;

    // 基本驗證
    if (!username || !password) {
      log.error('註冊失敗：缺少帳號或密碼');
      return res.status(400).json({ error: '請提供帳號和密碼' });
    }

    try {
      const { user, totalUsers } = await userService.registerUser(username, password);

      log.info(`用戶註冊成功: ${username}`);
      res.status(201).json({ message: '註冊成功', username: user.username });
    } catch (error) {
      if (error.message === 'USER_EXISTS') {
        log.error(`註冊失敗：帳號已存在 - ${username}`);
        return res.status(409).json({ error: '帳號已存在' });
      }

      log.error(`註冊失敗：數據庫錯誤 - ${error.message}`);
      res.status(500).json({ error: '註冊失敗，請稍後再試' });
    }
  }

  /**
   * POST /login - 用戶登入
   */
  async login(req, res, log) {
    const { username, password } = req.body;

    if (!username || !password) {
      log.error('登入失敗：缺少帳號或密碼');
      return res.status(400).json({ error: '請提供帳號和密碼' });
    }

    try {
      const sessionId = generateSessionId();
      const { user, activeSessions } = await userService.loginUser(username, password, sessionId);

      log.info(`用戶登入成功: ${username}`);
      res.status(200).json({
        message: '登入成功',
        sessionId,
        username: user.username,
      });
    } catch (error) {
      if (error.message === 'USER_NOT_FOUND' || error.message === 'INVALID_PASSWORD') {
        log.error(`登入失敗：帳號或密碼錯誤 - ${username}`);
        return res.status(401).json({ error: '帳號或密碼錯誤' });
      }

      log.error(`登入失敗：數據庫錯誤 - ${error.message}`);
      res.status(500).json({ error: '登入失敗，請稍後再試' });
    }
  }

  /**
   * POST /logout - 用戶登出
   */
  async logout(req, res, log) {
    const { sessionId } = req.body;

    if (!sessionId) {
      log.error('登出失敗：缺少 sessionId');
      return res.status(400).json({ error: '請提供 sessionId' });
    }

    try {
      const { username, remainingSessions } = await userService.logoutUser(sessionId);

      log.info(`用戶登出: ${username}`);
      res.status(200).json({ message: '登出成功' });
    } catch (error) {
      if (error.message === 'SESSION_NOT_FOUND') {
        log.error('登出失敗：Session 不存在或已過期');
        return res.status(404).json({ error: 'Session 不存在或已過期' });
      }

      log.error(`登出失敗：數據庫錯誤 - ${error.message}`);
      res.status(500).json({ error: '登出失敗，請稍後再試' });
    }
  }

  /**
   * GET /users - 獲取用戶列表
   */
  async getUsers(req, res, log) {
    try {
      const userList = await userService.getAllUsers();

      log.info(`查詢用戶列表，共 ${userList.length} 位用戶`);
      res.status(200).json({
        count: userList.length,
        users: userList,
      });
    } catch (error) {
      log.error(`查詢用戶列表失敗：數據庫錯誤 - ${error.message}`);
      res.status(500).json({ error: '查詢失敗，請稍後再試' });
    }
  }

  /**
   * GET /user - 獲取當前登入用戶
   */
  async getCurrentUser(req, res, log) {
    const { sessionId } = req.query;

    if (!sessionId) {
      log.error('查詢失敗：缺少 sessionId');
      return res.status(400).json({ error: '請提供 sessionId' });
    }

    try {
      const { username, sessionId: sid } = await userService.getUserBySession(sessionId);

      log.info(`查詢當前用戶: ${username}`);
      res.status(200).json({
        username,
        sessionId: sid,
      });
    } catch (error) {
      if (error.message === 'SESSION_NOT_FOUND') {
        log.error('查詢失敗：Session 不存在或已過期');
        return res.status(404).json({ error: 'Session 不存在或已過期' });
      }

      log.error(`查詢用戶失敗：數據庫錯誤 - ${error.message}`);
      res.status(500).json({ error: '查詢失敗，請稍後再試' });
    }
  }
}

module.exports = new UserController();
