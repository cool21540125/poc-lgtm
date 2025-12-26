import { useState } from 'react';
import { pushEvent, pushError } from '../instrumentation';

const API_BASE_URL = 'http://localhost:3000';

function Register({ onRegisterSuccess, onSwitchToLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (response.ok) {
        // 發送註冊成功事件到 Faro
        pushEvent('user_register_success', {
          username: data.username,
          timestamp: new Date().toISOString(),
        });

        alert(`註冊成功！用戶：${data.username}`);
        onRegisterSuccess();
      } else {
        setError(data.error || '註冊失敗');

        // 發送註冊失敗事件到 Faro
        pushEvent('user_register_failed', {
          username,
          error: data.error,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (err) {
      setError('連接失敗，請確認 Backend 是否運行');

      // 發送錯誤到 Faro
      pushError(err, {
        component: 'Register',
        action: 'register',
        username,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <h2>註冊</h2>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="username">用戶名：</label>
          <input
            type="text"
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            placeholder="請輸入用戶名"
          />
        </div>

        <div className="form-group">
          <label htmlFor="password">密碼：</label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="請輸入密碼"
          />
        </div>

        {error && <div className="error-message">{error}</div>}

        <button type="submit" disabled={loading} className="submit-btn">
          {loading ? '註冊中...' : '註冊'}
        </button>
      </form>

      <div className="switch-view">
        <p>已有帳號？ <button onClick={onSwitchToLogin} className="link-btn">登入</button></p>
      </div>
    </div>
  );
}

export default Register;
