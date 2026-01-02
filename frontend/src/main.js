import { createApp } from 'vue';
import App from './App.vue';
import './assets/main.css';

// 初始化 Faro（必須在應用啟動前）
import './instrumentation.js';

createApp(App).mount('#app');
