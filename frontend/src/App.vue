<template>
  <div class="app">
    <header>
      <h1>OpenTelemetry POC - User Management (Vue3)</h1>
      <div v-if="user" class="user-info">
        <span>Welcome, {{ user.username }}!</span>
        <button @click="handleLogout" class="logout-btn">Logout</button>
      </div>
    </header>

    <main>
      <Login
        v-if="currentView === 'login'"
        @login-success="handleLoginSuccess"
        @switch-to-register="currentView = 'register'"
      />

      <Register
        v-if="currentView === 'register'"
        @register-success="handleRegisterSuccess"
        @switch-to-login="currentView = 'login'"
      />

      <Dashboard
        v-if="currentView === 'dashboard' && user"
        :session-id="user.sessionId"
        :username="user.username"
      />
    </main>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import Login from './components/Login.vue';
import Register from './components/Register.vue';
import Dashboard from './components/Dashboard.vue';
import { pushEvent, pushLog, setUser as setFaroUser } from './instrumentation';

const currentView = ref('login'); // 'login', 'register', 'dashboard'
const user = ref(null); // { username, sessionId }

const handleLoginSuccess = (userData) => {
  user.value = userData;
  currentView.value = 'dashboard';

  // 發送登入事件到 Faro
  setFaroUser(userData);
  pushEvent('user_login', {
    username: userData.username,
    timestamp: new Date().toISOString(),
  });

  pushLog(`用戶進入 Dashboard: ${userData.username}`, 'info', {
    username: userData.username,
    sessionId: userData.sessionId,
    view: 'dashboard',
  });
};

const handleRegisterSuccess = () => {
  currentView.value = 'login';
};

const handleLogout = () => {
  const username = user.value?.username;

  // TODO: 比較 - Event
  pushEvent('user_logout', {
    username,
    timestamp: new Date().toISOString(),
  });

  // TODO: 比較 - Log
  pushLog(`用戶登出: ${username}`, 'info', {
    username,
    action: 'logout',
  });

  user.value = null;
  currentView.value = 'login';
};
</script>
