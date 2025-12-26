import { useState, useEffect } from 'react';

const API_BASE_URL = 'http://localhost:3000';

function Dashboard({ sessionId, username }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchUsers = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_BASE_URL}/users`);
      const data = await response.json();

      if (response.ok) {
        setUsers(data.users || []);
      } else {
        setError('獲取用戶列表失敗');
      }
    } catch (err) {
      setError('連接失敗，請確認 Backend 是否運行');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  return (
    <div className="dashboard-container">
      <h2>用戶管理面板</h2>

      <div className="dashboard-info">
        <p>當前用戶：<strong>{username}</strong></p>
        <p>Session ID：<code>{sessionId}</code></p>
      </div>

      <div className="users-section">
        <div className="section-header">
          <h3>所有用戶列表</h3>
          <button onClick={fetchUsers} disabled={loading} className="refresh-btn">
            {loading ? '加載中...' : '刷新'}
          </button>
        </div>

        {error && <div className="error-message">{error}</div>}

        {!error && users.length > 0 && (
          <table className="users-table">
            <thead>
              <tr>
                <th>#</th>
                <th>用戶名</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user, index) => (
                <tr key={user.username}>
                  <td>{index + 1}</td>
                  <td>{user.username}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {!error && users.length === 0 && !loading && (
          <p className="no-data">目前沒有任何用戶</p>
        )}
      </div>
    </div>
  );
}

export default Dashboard;
