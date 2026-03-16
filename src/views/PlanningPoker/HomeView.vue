<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();
const username = ref('');
const selectedDeck = ref('fabrica');

const decks = {
  fibonacci: '0, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, ?',
  fabrica: 'Tempo estimado.'
};

const createRoom = () => {
  if (!username.value.trim()) return;
  
  // Generate a random room ID
  const roomId = Math.random().toString(36).substring(2, 9);
  
  // Save credentials to localStorage to use in RoomView (mock auth)
  localStorage.setItem('poker-username', username.value);
  
  // Actually we need to emit create-room, but we can do it when we connect in RoomView
  // OR we pass deck as query parameter so RoomView knows what deck to use to create it
  router.push({ 
    name: 'poker-room', 
    params: { roomId }, 
    query: { deck: selectedDeck.value } 
  });
};
</script>

<template>
  <main class="home">
    <div class="card">
      <h1 class="title">Planning Poker</h1>
      <p class="subtitle">Estimate tasks in real-time with your team</p>

      <div class="form-group">
        <label for="username">Nome</label>
        <input 
          id="username" 
          v-model="username" 
          placeholder="Digite seu nome" 
          @keyup.enter="createRoom"
        />
      </div>

      <div class="form-group">
        <label for="deck">Deck</label>
        <select id="deck" v-model="selectedDeck">
          <option value="fibonacci">Fibonacci (0, 1, 2, 3, 5, 8...)</option>
          <option value="fabrica">Fábrica</option>
        </select>
        <small class="deck-preview">{{ decks[selectedDeck as keyof typeof decks] }}</small>
      </div>

      <button 
        class="create-btn" 
        :disabled="!username.trim()" 
        @click="createRoom"
      >
        Criar sala
      </button>
    </div>
  </main>
</template>

<style scoped>
.home {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  background: var(--bg-app);
  padding: 2rem;
}

.card {
  background: var(--bg-card);
  backdrop-filter: blur(10px);
  padding: 2.5rem;
  border-radius: 1rem;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  border: 1px solid var(--bg-card-border);
  width: 100%;
  max-width: 400px;
  transition: all 0.3s;
}

.title {
  font-size: 2rem;
  font-weight: 700;
  margin-bottom: 0.5rem;
  color: var(--text-primary);
  text-align: center;
}

.subtitle {
  color: var(--text-secondary);
  text-align: center;
  margin-bottom: 2rem;
  font-size: 0.95rem;
}

.form-group {
  margin-bottom: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

label {
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--text-primary);
}

input, select {
  padding: 0.75rem 1rem;
  border-radius: 0.5rem;
  border: 1px solid var(--border-input);
  background: var(--bg-input);
  color: var(--text-primary);
  font-size: 1rem;
  outline: none;
  transition: border-color 0.2s, background 0.2s;
}

input:focus, select:focus {
  border-color: var(--border-focus);
}

.deck-preview {
  color: var(--text-secondary);
  font-size: 0.8rem;
  margin-top: 0.25rem;
}

.create-btn {
  width: 100%;
  padding: 0.875rem;
  border-radius: 0.5rem;
  border: none;
  background: var(--bg-btn);
  color: var(--text-btn);
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s, transform 0.1s;
  margin-top: 1rem;
}

.create-btn:hover:not(:disabled) {
  background: var(--bg-btn-hover);
}

.create-btn:active:not(:disabled) {
  transform: scale(0.98);
}

.create-btn:disabled {
  background: var(--bg-btn-disabled);
  color: var(--text-btn-disabled);
  cursor: not-allowed;
}
</style>
