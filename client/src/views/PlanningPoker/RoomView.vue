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
  const socketUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';
  socket = io(socketUrl);

  socket.on('connect', () => {
    const deckQuery = route.query.deck as string;
    if (deckQuery) {
      socket?.emit('create-room', { roomId, deck: deckQuery });
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

onMounted(() => { if (username.value) connectSocket(); });
onUnmounted(() => { if (socket) socket.disconnect(); });

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

const revealVotes  = () => socket?.emit('reveal-votes', { roomId });
const resetVotes   = () => socket?.emit('reset-votes',  { roomId });

const copyInviteLink = async () => {
  await navigator.clipboard.writeText(window.location.href);
  alert('Invite link copied to clipboard!');
};

const averageVote = computed(() => {
  if (!roomState.value.revealed) return null;
  const votes = Object.values(roomState.value.participants)
    .map(p => p.vote)
    .filter(v => v !== null && v !== '?');
  if (votes.length === 0) return 0;
  const sum = votes.reduce((acc, val) => {
    const num = parseFloat(val!);
    return isNaN(num) ? acc : acc + num;
  }, 0);
  const numVoters = votes.filter(v => !isNaN(parseFloat(v!))).length;
  if (numVoters === 0) return '-';
  return (sum / numVoters).toFixed(1);
});

const participantsList = computed(() =>
  Object.entries(roomState.value.participants).map(([id, p]) => ({ id, ...p }))
);

// Herda o tema do portal via prop
const props = defineProps<{ isDark?: boolean }>();
const isDark = computed(() => props.isDark ?? true);
</script>

<template>
  <!-- O componente herda o bg do HomeView via .app-root -->
  <main class="flex flex-col flex-1 transition-colors duration-300">

    <!-- ── Join Modal ── -->
    <div
      v-if="showJoinModal"
      class="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 backdrop-blur-sm"
    >
      <div
        class="w-[90%] max-w-sm rounded-2xl border p-8 shadow-2xl"
        :class="isDark
          ? 'bg-zinc-900 border-white/[.06]'
          : 'bg-white border-zinc-200'"
      >
        <h2
          class="mb-6 text-xl font-bold"
          :class="isDark ? 'text-white' : 'text-zinc-900'"
        >
          Entrar na sala
        </h2>
        <div class="flex gap-2">
          <input
            v-model="joinName"
            placeholder="Seu nome"
            @keyup.enter="joinRoom"
            autofocus
            class="flex-1 rounded-lg border px-3 py-2.5 text-sm outline-none transition-all"
            :class="isDark
              ? 'bg-zinc-800 border-zinc-700 text-white placeholder-zinc-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15'
              : 'bg-zinc-50 border-zinc-300 text-zinc-900 placeholder-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15'"
          />
          <button
            @click="joinRoom"
            :disabled="!joinName.trim()"
            class="rounded-lg bg-blue-500 px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-blue-400 active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Entrar
          </button>
        </div>
      </div>
    </div>

    <!-- ── Room View ── -->
    <div v-else class="flex flex-col flex-1 w-full max-w-5xl mx-auto px-4 md:px-8 py-4">

      <!-- Header -->
      <header
        class="flex items-center justify-between border-b py-4"
        :class="isDark ? 'border-white/[.06]' : 'border-zinc-200'"
      >
        <div class="flex items-center gap-3">
          <h1
            class="text-base font-semibold"
            :class="isDark ? 'text-white' : 'text-zinc-900'"
          >
            Sala:
            <span class="font-mono text-blue-400">{{ roomId }}</span>
          </h1>

          <!-- Copy link -->
          <button
            @click="copyInviteLink"
            aria-label="Copiar link"
            class="group relative flex h-7 w-7 items-center justify-center rounded-lg border transition-all"
            :class="isDark
              ? 'border-zinc-700 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300'
              : 'border-zinc-200 text-zinc-400 hover:border-zinc-300 hover:text-zinc-600'"
          >
            <svg class="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none">
              <rect x="5" y="5" width="8" height="8" rx="1.5" stroke="currentColor" stroke-width="1.3"/>
              <path d="M3 11V3h8" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <span
              class="invisible group-hover:visible absolute bottom-[130%] left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md px-2 py-1 text-[.65rem] font-medium opacity-0 group-hover:opacity-100 transition-opacity"
              :class="isDark ? 'bg-zinc-700 text-zinc-200' : 'bg-zinc-800 text-white'"
            >
              Copiar link
            </span>
          </button>
        </div>

        <!-- Actions -->
        <div class="flex gap-2">
          <button
            v-if="!roomState.revealed"
            @click="revealVotes"
            :disabled="participantsList.length === 0"
            class="rounded-lg bg-blue-500 px-4 py-2 text-xs font-semibold text-white transition-all hover:bg-blue-400 active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Revelar cartas
          </button>
          <button
            v-else
            @click="resetVotes"
            class="rounded-lg bg-emerald-500 px-4 py-2 text-xs font-semibold text-white transition-all hover:bg-emerald-400 active:scale-[.98]"
          >
            Próxima rodada
          </button>
        </div>
      </header>

      <!-- Participants -->
      <div class="flex flex-1 flex-col items-center justify-center py-10">
        <div class="flex flex-wrap justify-center gap-6">
          <div
            v-for="p in participantsList"
            :key="p.id"
            class="flex flex-col items-center gap-2.5"
          >
            <!-- Card face-down -->
            <div
              v-if="!roomState.revealed"
              class="flex h-24 w-16 items-center justify-center rounded-xl border-2 text-xl font-bold shadow-md transition-all duration-300"
              :class="p.hasVoted
                ? 'border-blue-500 bg-blue-500 text-white shadow-blue-500/20'
                : isDark
                  ? 'border-zinc-700 bg-zinc-800 text-zinc-600'
                  : 'border-zinc-200 bg-zinc-100 text-zinc-400'"
            >
              <span v-if="p.hasVoted">
                <svg class="w-5 h-5 text-white" viewBox="0 0 16 16" fill="none">
                  <path d="M2.5 8l4 4 7-7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </span>
              <span v-else class="animate-pulse text-sm">···</span>
            </div>

            <!-- Card revealed -->
            <div
              v-else
              class="flex h-24 w-16 items-center justify-center rounded-xl border-2 text-xl font-bold shadow-md transition-all duration-300"
              :class="isDark
                ? 'border-zinc-600 bg-zinc-800 text-white'
                : 'border-zinc-300 bg-white text-zinc-900'"
            >
              {{ p.vote || '–' }}
            </div>

            <span
              class="text-xs font-medium"
              :class="isDark ? 'text-zinc-500' : 'text-zinc-500'"
            >
              {{ p.name }}
            </span>
          </div>
        </div>

        <!-- Average badge -->
        <div
          v-if="roomState.revealed"
          class="mt-10 rounded-xl border px-8 py-4"
          :class="isDark
            ? 'border-emerald-500/25 bg-emerald-500/10'
            : 'border-emerald-200 bg-emerald-50'"
        >
          <p class="text-center text-2xl font-bold text-emerald-500">
            Média: {{ averageVote }}
          </p>
        </div>
      </div>

      <!-- Voting deck -->
      <div
        class="mt-auto border-t py-8"
        :class="isDark ? 'border-white/[.06]' : 'border-zinc-200'"
      >
        <div class="flex flex-wrap justify-center gap-2.5 md:gap-3">
          <button
            v-for="card in activeDeck"
            :key="card"
            @click="castVote(card)"
            :disabled="roomState.revealed"
            class="flex h-16 w-12 items-center justify-center rounded-lg border-2 text-base font-bold shadow-sm outline-none transition-all duration-200 md:h-20 md:w-14 md:text-lg"
            :class="[
              roomState.revealed
                ? 'cursor-not-allowed opacity-40'
                : 'cursor-pointer hover:-translate-y-2 hover:shadow-lg',
              myVote === card
                ? isDark
                  ? 'border-blue-400 bg-blue-500 text-white shadow-blue-500/30 -translate-y-2 md:-translate-y-3'
                  : 'border-blue-500 bg-blue-500 text-white shadow-blue-500/30 -translate-y-2 md:-translate-y-3'
                : isDark
                  ? 'border-zinc-700 bg-zinc-800 text-zinc-300 hover:border-blue-500 hover:text-white'
                  : 'border-zinc-200 bg-white text-zinc-700 hover:border-blue-400 hover:text-blue-600'
            ]"
          >
            {{ card }}
          </button>
        </div>
      </div>

    </div>
  </main>
</template>