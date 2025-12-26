import { useState } from 'react';
import Register from './components/Register';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import { pushEvent, setUser as setFaroUser } from './instrumentation';
import './App.css';

function App() {
  const [currentView, setCurrentView] = useState('login'); // 'login', 'register', 'dashboard'
  const [user, setUser] = useState(null); // { username, sessionId }

  const handleLoginSuccess = (userData) => {
    setUser(userData);
    setCurrentView('dashboard');

    // 發送登入事件到 Faro
    setFaroUser(userData);
    pushEvent('user_login', {
      username: userData.username,
      timestamp: new Date().toISOString(),
    });
  };

  const handleRegisterSuccess = () => {
    setCurrentView('login');
  };

  const handleLogout = () => {
    // 發送登出事件到 Faro
    pushEvent('user_logout', {
      username: user?.username,
      timestamp: new Date().toISOString(),
    });

    setUser(null);
    setCurrentView('login');
  };

  return (
    <div className="App">
      <header>
        <h1>OpenTelemetry POC - User Management</h1>
        {user && (
          <div className="user-info">
            <span>Welcome, {user.username}!</span>
            <button onClick={handleLogout} className="logout-btn">Logout</button>
          </div>
        )}
      </header>

      <main>
        {currentView === 'login' && (
          <Login
            onLoginSuccess={handleLoginSuccess}
            onSwitchToRegister={() => setCurrentView('register')}
          />
        )}

        {currentView === 'register' && (
          <Register
            onRegisterSuccess={handleRegisterSuccess}
            onSwitchToLogin={() => setCurrentView('login')}
          />
        )}

        {currentView === 'dashboard' && user && (
          <Dashboard sessionId={user.sessionId} username={user.username} />
        )}
      </main>
    </div>
  );
}

export default App;
