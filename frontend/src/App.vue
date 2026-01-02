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
import { pushEvent, setUser as setFaroUser } from './instrumentation';

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
};

const handleRegisterSuccess = () => {
  currentView.value = 'login';
};

const handleLogout = () => {
  // 發送登出事件到 Faro
  pushEvent('user_logout', {
    username: user.value?.username,
    timestamp: new Date().toISOString(),
  });

  user.value = null;
  currentView.value = 'login';
};
</script>
