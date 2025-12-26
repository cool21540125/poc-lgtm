const { User, Session } = require('../models');

/**
 * User Service
 * 包含所有用戶相關的業務邏輯和數據庫操作
 */

class UserService {
  /**
   * 註冊新用戶
   */
  async registerUser(username, password) {
    // 檢查用戶是否已存在
    const existingUser = await User.findOne({ where: { username } });
    if (existingUser) {
      throw new Error('USER_EXISTS');
    }

    // 創建新用戶
    const newUser = await User.create({ username, password });
    const totalUsers = await User.count();

    return {
      user: newUser,
      totalUsers,
    };
  }

  /**
   * 用戶登入
   */
  async loginUser(username, password, sessionId) {
    // 查找用戶
    const user = await User.findOne({ where: { username } });
    if (!user) {
      throw new Error('USER_NOT_FOUND');
    }

    // 驗證密碼
    if (user.password !== password) {
      throw new Error('INVALID_PASSWORD');
    }

    // 建立 session
    await Session.create({
      sessionId,
      userId: user.id,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 小時後過期
    });

    const activeSessions = await Session.count();

    return {
      user,
      sessionId,
      activeSessions,
    };
  }

  /**
   * 用戶登出
   */
  async logoutUser(sessionId) {
    // 查找 session
    const session = await Session.findOne({
      where: { sessionId },
      include: [{ model: User, as: 'user' }],
    });

    if (!session) {
      throw new Error('SESSION_NOT_FOUND');
    }

    const username = session.user.username;

    // 刪除 session
    await Session.destroy({ where: { sessionId } });

    const remainingSessions = await Session.count();

    return {
      username,
      remainingSessions,
    };
  }

  /**
   * 獲取所有用戶列表
   */
  async getAllUsers() {
    const users = await User.findAll({
      attributes: ['username', 'createdAt'],
      order: [['createdAt', 'DESC']],
    });

    return users.map(u => ({
      username: u.username,
    }));
  }

  /**
   * 根據 sessionId 獲取當前用戶
   */
  async getUserBySession(sessionId) {
    // 查找 session 並關聯 user
    const session = await Session.findOne({
      where: { sessionId },
      include: [{ model: User, as: 'user' }],
    });

    if (!session) {
      throw new Error('SESSION_NOT_FOUND');
    }

    return {
      username: session.user.username,
      sessionId,
    };
  }

  /**
   * 獲取用戶統計信息
   */
  async getUserStats() {
    const totalUsers = await User.count();
    const activeSessions = await Session.count();

    return {
      totalUsers,
      activeSessions,
    };
  }
}

module.exports = new UserService();
