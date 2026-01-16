<template>
  <div class="dashboard-container">
    <h2>用戶管理面板</h2>

    <div class="dashboard-info">
      <p>當前用戶：<strong>{{ username }}</strong></p>
      <p>Session ID：<code>{{ sessionId }}</code></p>
    </div>

    <!-- CPU 計算區塊 -->
    <div class="compute-section">
      <div class="section-header">
        <h3>CPU 密集運算</h3>
        <button 
          @click="handleCompute" 
          :disabled="computing" 
          class="compute-btn"
        >
          {{ computing ? '計算中...' : '開始計算' }}
        </button>
      </div>

      <div v-if="computeError" class="error-message">{{ computeError }}</div>

      <div v-if="computeResult" class="compute-result">
        <h4>計算結果</h4>
        <div class="result-grid">
          <div class="result-item">
            <span class="label">迭代次數：</span>
            <span class="value">{{ computeResult.iterations.toLocaleString() }}</span>
          </div>
          <div class="result-item">
            <span class="label">計算結果：</span>
            <span class="value">{{ computeResult.result }}</span>
          </div>
          <div class="result-item">
            <span class="label">預計耗時：</span>
            <span class="value">{{ computeResult.plannedDuration }} ms</span>
          </div>
          <div class="result-item">
            <span class="label">實際耗時：</span>
            <span class="value">{{ computeResult.actualDuration }} ms</span>
          </div>
        </div>
      </div>
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
import { pushEvent, pushLog } from '../instrumentation';

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

// CPU 計算相關狀態
const computing = ref(false);
const computeResult = ref(null);
const computeError = ref('');

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

const handleCompute = async () => {
  computing.value = true;
  computeError.value = '';
  computeResult.value = null;

  const startTime = Date.now();

  // 推送開始計算事件到 Faro
  pushEvent('compute_start', {
    username: props.username,
    sessionId: props.sessionId,
    timestamp: new Date().toISOString(),
  });

  pushLog('開始 CPU 密集運算', 'info', {
    username: props.username,
    operation: 'cpu_compute',
  });

  try {
    const response = await fetch(`${API_BASE_URL}/compute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();
    const clientDuration = Date.now() - startTime;

    if (response.ok) {
      computeResult.value = data;

      // 推送完成事件到 Faro
      pushEvent('compute_complete', {
        username: props.username,
        sessionId: props.sessionId,
        iterations: data.iterations,
        result: data.result,
        plannedDuration: data.plannedDuration,
        actualDuration: data.actualDuration,
        clientDuration: clientDuration,
        timestamp: new Date().toISOString(),
      });

      pushLog('CPU 運算完成', 'info', {
        username: props.username,
        operation: 'cpu_compute',
        iterations: data.iterations,
        actualDuration: data.actualDuration,
        clientDuration: clientDuration,
      });
    } else {
      computeError.value = data.error || '計算失敗';

      pushEvent('compute_error', {
        username: props.username,
        sessionId: props.sessionId,
        error: data.error,
        timestamp: new Date().toISOString(),
      });

      pushLog('CPU 運算失敗', 'error', {
        username: props.username,
        operation: 'cpu_compute',
        error: data.error,
      });
    }
  } catch (err) {
    computeError.value = '連接失敗，請確認 Backend 是否運行';

    pushEvent('compute_error', {
      username: props.username,
      sessionId: props.sessionId,
      error: err.message,
      timestamp: new Date().toISOString(),
    });

    pushLog('CPU 運算連接失敗', 'error', {
      username: props.username,
      operation: 'cpu_compute',
      error: err.message,
    });
  } finally {
    computing.value = false;
  }
};

onMounted(() => {
  fetchUsers();
});
</script>

<style scoped>
.compute-section {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 30px;
}

.compute-btn {
  background: #28a745;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 5px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.3s ease;
}

.compute-btn:hover:not(:disabled) {
  background: #218838;
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(40, 167, 69, 0.3);
}

.compute-btn:disabled {
  background: #6c757d;
  cursor: not-allowed;
  opacity: 0.6;
}

.compute-result {
  margin-top: 20px;
  background: white;
  border-radius: 8px;
  padding: 20px;
  border: 1px solid #dee2e6;
}

.compute-result h4 {
  margin: 0 0 15px 0;
  color: #28a745;
  font-size: 16px;
}

.result-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 15px;
}

.result-item {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.result-item .label {
  font-size: 12px;
  color: #6c757d;
  font-weight: 500;
}

.result-item .value {
  font-size: 18px;
  color: #212529;
  font-weight: 600;
}
</style>
