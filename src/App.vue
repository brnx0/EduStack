<script setup lang="ts">
import { useTheme } from './composables/useTheme';

const { isDark, toggleTheme } = useTheme();
</script>

<template>
  <div class="app-container">
    <header class="app-topbar">
      <div class="logo">EduStack Poker</div>
      <button class="theme-toggle" @click="toggleTheme" aria-label="Toggle Theme">
        {{ isDark ? '☀️ Light Mode' : '🌙 Dark Mode' }}
      </button>
    </header>
    <router-view />
  </div>
</template>

<style>
:root {
  --bg-app: #f4f4f9;
  --text-primary: #121212;
  --text-secondary: #555555;
  --bg-card: #ffffff;
  --bg-card-border: rgba(0, 0, 0, 0.1);
  --bg-input: #ffffff;
  --border-input: #cccccc;
  --bg-btn: #646cff;
  --bg-btn-hover: #747bff;
  --text-btn: #ffffff;
  --bg-btn-disabled: #e0e0e0;
  --text-btn-disabled: #888888;
  --bg-modal: #ffffff;
  --bg-overlay: rgba(0, 0, 0, 0.4);
  --card-back-bg: repeating-linear-gradient(45deg, #e0e0e0, #e0e0e0 10px, #d0d0d0 10px, #d0d0d0 20px);
  --card-back-border: #bbbbbb;
  --card-front-bg: #ffffff;
  --card-front-text: #121212;
  --card-front-border: #cccccc;
  --bg-topbar: #ffffff;
  --border-topbar: rgba(0, 0, 0, 0.1);
  --border-focus: #646cff;
}

:root[data-theme='dark'] {
  --bg-app: #121212;
  --text-primary: #eeeeee;
  --text-secondary: #a0a0a0;
  --bg-card: rgba(255, 255, 255, 0.05);
  --bg-card-border: rgba(255, 255, 255, 0.1);
  --bg-input: rgba(0, 0, 0, 0.2);
  --border-input: rgba(255, 255, 255, 0.2);
  --bg-btn: #646cff;
  --bg-btn-hover: #747bff;
  --text-btn: #ffffff;
  --bg-btn-disabled: #444444;
  --text-btn-disabled: #888888;
  --bg-modal: #2a2a35;
  --bg-overlay: rgba(0, 0, 0, 0.7);
  --card-back-bg: repeating-linear-gradient(45deg, #2a2a35, #2a2a35 10px, #333340 10px, #333340 20px);
  --card-back-border: #444455;
  --card-front-bg: #ffffff;
  --card-front-text: #121212;
  --card-front-border: #cccccc;
  --bg-topbar: #1e1e24;
  --border-topbar: rgba(255, 255, 255, 0.1);
  --border-focus: #646cff;
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
  font-family: 'Inter', 'Roboto', sans-serif;
}

.app-container {
  min-height: 100vh;
  background-color: var(--bg-app);
  color: var(--text-primary);
  display: flex;
  flex-direction: column;
  transition: background-color 0.3s, color 0.3s;
}

.app-topbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 2rem;
  background-color: var(--bg-topbar);
  border-bottom: 1px solid var(--border-topbar);
  transition: background-color 0.3s, border-color 0.3s;
}

.app-topbar .logo {
  font-weight: bold;
  font-size: 1.25rem;
  color: var(--text-primary);
}

.theme-toggle {
  background: var(--bg-input);
  border: 1px solid var(--border-input);
  color: var(--text-primary);
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  cursor: pointer;
  font-weight: 600;
  transition: all 0.2s;
}

.theme-toggle:hover {
  border-color: var(--border-focus);
}
</style>
