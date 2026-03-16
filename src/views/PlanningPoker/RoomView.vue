<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { io, Socket } from 'socket.io-client';

const route = useRoute();
const router = useRouter();
const roomId = route.params.roomId as string;

const username = ref(localStorage.getItem('poker-username') || '');
const userId = ref(localStorage.getItem('poker-userid') || '');
if (!userId.value) {
  userId.value = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  localStorage.setItem('poker-userid', userId.value);
}
const showJoinModal = ref(!username.value);
const joinName = ref('');

let socket: Socket | null = null;

const decks = {
  fibonacci: ['0', '1', '2', '3', '5', '8', '13', '21', '34', '55', '89', '?'],
  fabrica: ['30','60','120','150','180','210','240','270','300','330','360','390','420']
};

type Participant = { name: string; vote: string | null; hasVoted: boolean };
type RoomState = { deck: string; participants: Record<string, Participant>; revealed: boolean };

const roomState = ref<RoomState>({ deck: 'fibonacci', participants: {}, revealed: false });
const myVote = ref<string | null>(null);

const activeDeck = computed(() => decks[roomState.value.deck as keyof typeof decks] || decks.fibonacci);

const connectSocket = () => {
  if (!username.value || !userId.value) return;
  
  // Use VITE_API_URL or default local
  socket = io('http://localhost:3001');

  socket.on('connect', () => {
    // If we're creating the room (we have deck in query)
    const deckQuery = route.query.deck as string;
    if (deckQuery) {
      socket?.emit('create-room', { roomId, deck: deckQuery });
      // Remove query param to clean up URL
      router.replace({ query: {} });
    }

    socket?.emit('join-room', { roomId, name: username.value, userId: userId.value });
  });

  socket.on('room-updated', (state: RoomState) => {
    roomState.value = state;
    if (!state.revealed) {
      const me = state.participants[userId.value];
      myVote.value = me?.vote || null;
    }
  });

  socket.on('error', (msg) => {
    alert(msg);
    router.push('/');
  });
};

onMounted(() => {
  if (username.value) {
    connectSocket();
  }
});

onUnmounted(() => {
  if (socket) {
    socket.disconnect();
  }
});

const joinRoom = () => {
  if (joinName.value.trim()) {
    username.value = joinName.value;
    localStorage.setItem('poker-username', username.value);
    showJoinModal.value = false;
    connectSocket();
  }
};

const castVote = (card: string) => {
  if (roomState.value.revealed) return;
  const newVote = myVote.value === card ? null : card;
  myVote.value = newVote;
  socket?.emit('vote', { roomId, userId: userId.value, vote: newVote });
};

const revealVotes = () => {
  socket?.emit('reveal-votes', { roomId });
};

const resetVotes = () => {
  socket?.emit('reset-votes', { roomId });
};

const copyInviteLink = async () => {
  const url = window.location.href;
  await navigator.clipboard.writeText(url);
  alert('Invite link copied to clipboard!');
};

const averageVote = computed(() => {
  if (!roomState.value.revealed) return null;
  const votes = Object.values(roomState.value.participants)
    .map(p => p.vote)
    .filter(v => v !== null && v !== '?');
  
  if (votes.length === 0) return 0;
  
  const sum = votes.reduce((acc, val) => {
    // Basic mapping for non-numeric (if necessary, though average makes more sense for numbers)
    const num = parseFloat(val!);
    return isNaN(num) ? acc : acc + num;
  }, 0);
  
  const numVoters = votes.filter(v => !isNaN(parseFloat(v!))).length;
  if(numVoters === 0) return '-';
  
  return (sum / numVoters).toFixed(1);
});

const participantsList = computed(() => {
  return Object.entries(roomState.value.participants).map(([id, p]) => ({ id, ...p }));
});
</script>

<template>
  <main class="room">
    <!-- Join Modal if accessed directly via URL -->
    <div v-if="showJoinModal" class="modal-overlay">
      <div class="modal">
        <h2>Join Room</h2>
        <div class="form-group">
          <input 
            v-model="joinName" 
            placeholder="Seu Nome" 
            @keyup.enter="joinRoom" 
            autofocus
          />
          <button @click="joinRoom" :disabled="!joinName.trim()">Join</button>
        </div>
      </div>
    </div>

    <!-- Main Room View -->
    <div v-else class="table-container">
      <header class="room-header">
        <div class="title-area">
          <h1>Room: {{ roomId }}</h1>
          <button class="icon-btn tooltip" @click="copyInviteLink" aria-label="Copy Invite Link">
            📋
            <span class="tooltiptext">Copiar Link</span>
          </button>
        </div>
        <div class="controls">
          <button 
            v-if="!roomState.revealed" 
            class="action-btn reveal-btn" 
            @click="revealVotes"
            :disabled="participantsList.length === 0"
          >
            Revelar Cartas
          </button>
          <button 
            v-else 
            class="action-btn next-btn" 
            @click="resetVotes"
          >
            Próxima rodada
          </button>
        </div>
      </header>

      <div class="board">
        <div class="participants">
          <div 
            v-for="p in participantsList" 
            :key="p.id" 
            class="participant-card"
            :class="{ voted: p.hasVoted }"
          >
            <div class="card-back" v-if="!roomState.revealed">
              <span v-if="p.hasVoted" class="voted-icon">✓</span>
              <span v-else class="thinking-icon">...</span>
            </div>
            <div class="card-front" v-else>
              {{ p.vote || '-' }}
            </div>
            <div class="participant-name">{{ p.name }}</div>
          </div>
        </div>

        <div v-if="roomState.revealed" class="results">
          <h3>Média: {{ averageVote }}</h3>
        </div>
      </div>

      <div class="deck-container">
        <div class="deck">
          <button 
            v-for="card in activeDeck" 
            :key="card"
            class="playing-card"
            :class="{ 
              selected: myVote === card, 
              disabled: roomState.revealed 
            }"
            @click="castVote(card)"
            :disabled="roomState.revealed"
          >
            {{ card }}
          </button>
        </div>
      </div>
    </div>
  </main>
</template>

<style scoped>
.room {
  display: flex;
  flex-direction: column;
  flex: 1;
  background: var(--bg-app);
}

/* Modal */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: var(--bg-overlay);
  backdrop-filter: blur(5px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}
.modal {
  background: var(--bg-modal);
  padding: 2rem;
  border-radius: 1rem;
  width: 90%;
  max-width: 400px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.2);
  border: 1px solid var(--bg-card-border);
}
.modal h2 { margin-bottom: 1.5rem; color: var(--text-primary); }
.form-group { display: flex; gap: 0.5rem; }
.form-group input { flex: 1; padding: 0.75rem; border-radius: 0.5rem; border: 1px solid var(--border-input); background: var(--bg-input); color: var(--text-primary); }
.form-group button { padding: 0.75rem 1.5rem; border-radius: 0.5rem; border: none; background: var(--bg-btn); color: var(--text-btn); cursor: pointer; }

/* Main Room Layout */
.table-container {
  display: flex;
  flex-direction: column;
  flex: 1;
  padding: 1rem 2rem;
  max-width: 1200px;
  margin: 0 auto;
  width: 100%;
}

.room-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 0;
  border-bottom: 1px solid var(--bg-card-border);
}

.title-area {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.title-area h1 {
  font-size: 1.5rem;
  font-weight: 500;
  color: var(--text-primary);
}

.icon-btn {
  background: none;
  border: none;
  font-size: 1.2rem;
  cursor: pointer;
  position: relative;
  transition: opacity 0.2s;
  opacity: 0.7;
  color: var(--text-primary);
}
.icon-btn:hover { opacity: 1; }

.tooltip .tooltiptext {
  visibility: hidden;
  width: 80px;
  background-color: var(--text-primary);
  color: var(--bg-app);
  text-align: center;
  border-radius: 6px;
  padding: 5px;
  position: absolute;
  z-index: 1;
  bottom: 125%;
  left: 50%;
  margin-left: -40px;
  font-size: 0.75rem;
  opacity: 0;
  transition: opacity 0.3s;
}
.tooltip:hover .tooltiptext {
  visibility: visible;
  opacity: 1;
}

.action-btn {
  padding: 0.75rem 1.5rem;
  border-radius: 2rem;
  border: none;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}
.reveal-btn { background: var(--bg-btn); color: var(--text-btn); }
.reveal-btn:hover:not(:disabled) { background: var(--bg-btn-hover); transform: translateY(-2px); }
.reveal-btn:disabled { background: var(--bg-btn-disabled); color: var(--text-btn-disabled); cursor: not-allowed; }
.next-btn { background: #42b883; color: white; }
.next-btn:hover { background: #4dd899; transform: translateY(-2px); }

/* Board */
.board {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem 0;
}

.participants {
  display: flex;
  flex-wrap: wrap;
  gap: 2rem;
  justify-content: center;
}

.participant-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.card-back, .card-front {
  width: 60px;
  height: 90px;
  border-radius: 0.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  font-weight: bold;
  box-shadow: 0 4px 10px rgba(0,0,0,0.1);
  transition: all 0.3s;
}

.card-back {
  background: var(--card-back-bg);
  border: 2px solid var(--card-back-border);
  color: var(--text-primary);
}

.participant-card.voted .card-back {
  background: var(--bg-btn);
  border-color: var(--bg-btn-hover);
}

.voted-icon { color: white; }
.thinking-icon { color: var(--text-secondary); animation: pulse 1.5s infinite; }

.card-front {
  background: var(--card-front-bg);
  color: var(--card-front-text);
  border: 2px solid var(--card-front-border);
}

.participant-name {
  font-size: 0.9rem;
  color: var(--text-secondary);
  font-weight: 500;
}

.results {
  margin-top: 3rem;
  background: rgba(66, 184, 131, 0.1);
  padding: 1rem 2rem;
  border-radius: 1rem;
  border: 1px solid rgba(66, 184, 131, 0.4);
}
.results h3 {
  color: #42b883;
  margin: 0;
  font-size: 1.5rem;
}

@keyframes pulse {
  0% { opacity: 0.5; }
  50% { opacity: 1; }
  100% { opacity: 0.5; }
}

/* Deck area */
.deck-container {
  padding: 2rem 0;
  border-top: 1px solid var(--bg-card-border);
  margin-top: auto;
}

.deck {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 1rem;
}

.playing-card {
  width: 50px;
  height: 75px;
  border-radius: 0.5rem;
  background: var(--card-front-bg);
  color: var(--card-front-text);
  border: 2px solid var(--card-front-border);
  font-size: 1.25rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  box-shadow: 0 4px 6px rgba(0,0,0,0.05);
}

.playing-card:hover:not(.disabled) {
  transform: translateY(-10px);
  border-color: var(--border-focus);
  box-shadow: 0 10px 15px rgba(100, 108, 255, 0.2);
}

.playing-card.selected {
  background: var(--bg-btn);
  color: var(--text-btn);
  border-color: var(--bg-btn-hover);
  transform: translateY(-15px);
  box-shadow: 0 10px 20px rgba(100, 108, 255, 0.4);
}

.playing-card.disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}
</style>
