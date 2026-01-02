<template>
  <div class="dashboard-container">
    <h2>用戶管理面板</h2>

    <div class="dashboard-info">
      <p>當前用戶：<strong>{{ username }}</strong></p>
      <p>Session ID：<code>{{ sessionId }}</code></p>
    </div>

    <div class="users-section">
      <div class="section-header">
        <h3>所有用戶列表</h3>
        <button @click="fetchUsers" :disabled="loading" class="refresh-btn">
          {{ loading ? '加載中...' : '刷新' }}
        </button>
      </div>

      <div v-if="error" class="error-message">{{ error }}</div>

      <table v-if="!error && users.length > 0" class="users-table">
        <thead>
          <tr>
            <th>#</th>
            <th>用戶名</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(user, index) in users" :key="user.username">
            <td>{{ index + 1 }}</td>
            <td>{{ user.username }}</td>
          </tr>
        </tbody>
      </table>

      <p v-if="!error && users.length === 0 && !loading" class="no-data">
        目前沒有任何用戶
      </p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';

const API_BASE_URL = 'http://localhost:3000';

const props = defineProps({
  sessionId: {
    type: String,
    required: true,
  },
  username: {
    type: String,
    required: true,
  },
});

const users = ref([]);
const loading = ref(false);
const error = ref('');

const fetchUsers = async () => {
  loading.value = true;
  error.value = '';

  try {
    const response = await fetch(`${API_BASE_URL}/users`);
    const data = await response.json();

    if (response.ok) {
      users.value = data.users || [];
    } else {
      error.value = '獲取用戶列表失敗';
    }
  } catch (err) {
    error.value = '連接失敗，請確認 Backend 是否運行';
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  fetchUsers();
});
</script>
