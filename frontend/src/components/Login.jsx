import { useState } from 'react';

const API_BASE_URL = 'http://localhost:3000';

function Login({ onLoginSuccess, onSwitchToRegister }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (response.ok) {
        onLoginSuccess({
          username: data.username,
          sessionId: data.sessionId,
        });
      } else {
        setError(data.error || '登入失敗');
      }
    } catch (err) {
      setError('連接失敗，請確認 Backend 是否運行');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <h2>登入</h2>
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
          {loading ? '登入中...' : '登入'}
        </button>
      </form>

      <div className="switch-view">
        <p>還沒有帳號？ <button onClick={onSwitchToRegister} className="link-btn">註冊</button></p>
      </div>
    </div>
  );
}

export default Login;
