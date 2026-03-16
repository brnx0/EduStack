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
  /* Tons de Azul Educação - Tema Claro */
  --blue-primary: #1a4f8b;      /* Azul Institucional */
  --blue-secondary: #2196f3;    /* Azul de Ação */
  --blue-hover: #1565c0;        /* Azul Darker para Hover */
  
  --bg-app: #f0f4f8;            /* Cinza azulado muito claro */
  --text-primary: #1c2b39;      /* Azul quase preto para leitura */
  --text-secondary: #546e7a;    /* Cinza azulado para subtítulos */
  --bg-card: #ffffff;
  --bg-card-border: #d1d9e6;
  --bg-input: #ffffff;
  --border-input: #b0bec5;
  --bg-btn: var(--blue-primary);
  --bg-btn-hover: var(--blue-hover);
  --text-btn: #ffffff;
  --bg-btn-disabled: #cfd8dc;
  --text-btn-disabled: #90a4ae;
  --bg-modal: #ffffff;
  --bg-overlay: rgba(28, 43, 57, 0.6);
  
  /* Cartões Educativos (Flashcards) */
  --card-back-bg: repeating-linear-gradient(45deg, #e3f2fd, #e3f2fd 10px, #bbdefb 10px, #bbdefb 20px);
  --card-back-border: #90caf9;
  --card-front-bg: #ffffff;
  --card-front-text: #1c2b39;
  --card-front-border: #b0bec5;
  
  --bg-topbar: #ffffff;
  --border-topbar: #d1d9e6;
  --border-focus: var(--blue-secondary);
}

/* Tema Escuro - Azul Profundo */
:root[data-theme='dark'] {
  --bg-app: #0f172a;            /* Azul Marinho Profundo (Slate 950) */
  --text-primary: #f1f5f9;
  --text-secondary: #94a3b8;
  --bg-card: #1e293b;           /* Azul acinzentado */
  --bg-card-border: #334155;
  --bg-input: #0f172a;
  --border-input: #475569;
  --bg-btn: var(--blue-secondary);
  --bg-btn-hover: #42a5f5;
  --text-btn: #ffffff;
  --bg-btn-disabled: #334155;
  --text-btn-disabled: #64748b;
  --bg-modal: #1e293b;
  --bg-overlay: rgba(0, 0, 0, 0.8);
  
  --card-back-bg: repeating-linear-gradient(45deg, #1e293b, #1e293b 10px, #334155 10px, #334155 20px);
  --card-back-border: #475569;
  --card-front-bg: #1e293b;
  --card-front-text: #f1f5f9;
  --card-front-border: #334155;
  
  --bg-topbar: #1e293b;
  --border-topbar: #334155;
  --border-focus: var(--blue-secondary);
}

/* Base e Estrutura */
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
  font-family: 'Inter', 'Segoe UI', Tahoma, sans-serif;
}

.app-container {
  min-height: 100vh;
  background-color: var(--bg-app);
  color: var(--text-primary);
  display: flex;
  flex-direction: column;
  transition: all 0.3s ease;
}

.app-topbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 2rem;
  background-color: var(--bg-topbar);
  border-bottom: 2px solid var(--border-topbar); /* Linha levemente mais grossa para estrutura */
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
}

.app-topbar .logo {
  font-weight: 800;
  font-size: 1.4rem;
  color: var(--blue-primary); /* Logo em destaque azul */
}

/* No tema dark, a logo precisa ser mais clara */
:root[data-theme='dark'] .app-topbar .logo {
  color: var(--blue-secondary);
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
  background-color: var(--bg-app);
}
</style>
