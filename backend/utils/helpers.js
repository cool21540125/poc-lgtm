/**
 * Helper Functions
 * 通用工具函數
 */

/**
 * 生成唯一的 Session ID
 */
function generateSessionId() {
  return `sess_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

module.exports = {
  generateSessionId,
};
