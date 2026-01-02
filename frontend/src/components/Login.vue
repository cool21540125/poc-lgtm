<template>
  <div class="auth-container">
    <h2>登入</h2>
    <form @submit.prevent="handleSubmit">
      <div class="form-group">
        <label for="username">用戶名：</label>
        <input
          type="text"
          id="username"
          v-model="username"
          required
          placeholder="請輸入用戶名"
        />
      </div>

      <div class="form-group">
        <label for="password">密碼：</label>
        <input
          type="password"
          id="password"
          v-model="password"
          required
          placeholder="請輸入密碼"
        />
      </div>

      <div v-if="error" class="error-message">{{ error }}</div>

      <button type="submit" :disabled="loading" class="submit-btn">
        {{ loading ? '登入中...' : '登入' }}
      </button>
    </form>

    <div class="switch-view">
      <p>還沒有帳號？ <button @click="$emit('switch-to-register')" class="link-btn">註冊</button></p>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { pushLog } from '../instrumentation';

const API_BASE_URL = 'http://localhost:3000';

const emit = defineEmits(['login-success', 'switch-to-register']);

const username = ref('');
const password = ref('');
const error = ref('');
const loading = ref(false);

const handleSubmit = async () => {
  error.value = '';
  loading.value = true;

  try {
    const response = await fetch(`${API_BASE_URL}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: username.value,
        password: password.value,
      }),
    });

    const data = await response.json();

    if (response.ok) {

      pushLog(`用戶登入成功: ${data.username}`, 'info', {
        username: data.username,
        sessionId: data.sessionId,
        action: 'login',
      });

      emit('login-success', {
        username: data.username,
        sessionId: data.sessionId,
      });
    } else {
      error.value = data.error || '登入失敗';

      pushLog(`用戶登入失敗: ${username.value} - ${data.error}`, 'error', {
        username: username.value,
        error: data.error,
        action: 'login',
      });
    }
  } catch (err) {
    error.value = '連接失敗，請確認 Backend 是否運行';

    pushLog(`連接失敗: ${err.message}`, 'error', {
      component: 'Login',
      action: 'login',
      username: username.value,
    });
  } finally {
    loading.value = false;
  }
};
</script>
