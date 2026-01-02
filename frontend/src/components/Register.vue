<template>
  <div class="auth-container">
    <h2>註冊</h2>
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
        {{ loading ? '註冊中...' : '註冊' }}
      </button>
    </form>

    <div class="switch-view">
      <p>已有帳號？ <button @click="$emit('switch-to-login')" class="link-btn">登入</button></p>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { pushEvent, pushError } from '../instrumentation';

const API_BASE_URL = 'http://localhost:3000';

const emit = defineEmits(['register-success', 'switch-to-login']);

const username = ref('');
const password = ref('');
const error = ref('');
const loading = ref(false);

const handleSubmit = async () => {
  error.value = '';
  loading.value = true;

  try {
    console.log('registering...');
    const response = await fetch(`${API_BASE_URL}/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: username.value,
        password: password.value,
      }),
    });
    console.log('---- register OK ----');

    const data = await response.json();

    if (response.ok) {
      // 發送註冊成功事件到 Faro
      pushEvent('user_register_success', {
        username: data.username,
        timestamp: new Date().toISOString(),
      });

      alert(`註冊成功！用戶：${data.username}`);
      emit('register-success');
    } else {
      error.value = data.error || '註冊失敗';

      // 發送註冊失敗事件到 Faro
      pushEvent('user_register_failed', {
        username: username.value,
        error: data.error,
        timestamp: new Date().toISOString(),
      });
    }
  } catch (err) {
    error.value = '連接失敗，請確認 Backend 是否運行';

    // 發送錯誤到 Faro
    pushError(err, {
      component: 'Register',
      action: 'register',
      username: username.value,
    });
  } finally {
    loading.value = false;
  }
};
</script>
