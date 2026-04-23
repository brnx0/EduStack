<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const username = ref('')
const selectedDeck = ref('fabrica')

const props = defineProps<{ isDark?: boolean }>()
const isDark = computed(() => props.isDark ?? true)

const decks = {
  fibonacci: '0, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, ?',
  fabrica: 'Tempo estimado.',
}

const createRoom = () => {
  if (!username.value.trim()) return
  const roomId = Math.random().toString(36).substring(2, 9)
  localStorage.setItem('poker-username', username.value)
  router.push({
    name: 'poker-room',
    params: { roomId },
    query: { deck: selectedDeck.value },
  })
}
</script>

<template>
  <main class="flex h-full w-full items-center justify-center p-6">
    <div
      class="w-full max-w-sm rounded-xl border p-6 transition-colors duration-300"
      :class="isDark
        ? 'bg-zinc-950 border-white/[.06]'
        : 'bg-white border-zinc-200'"
    >
      <!-- Header -->
      <div class="mb-6">
        <h1
          class="mb-1 text-lg font-bold"
          :class="isDark ? 'text-white' : 'text-zinc-900'"
        >
          Planning Poker
        </h1>
        <p
          class="text-xs leading-relaxed"
          :class="isDark ? 'text-zinc-500' : 'text-zinc-400'"
        >
          Estime tarefas em tempo real com o time.
        </p>
      </div>

      <div class="flex flex-col gap-4">
        <!-- Nome -->
        <div class="flex flex-col gap-1.5">
          <label
            for="username"
            class="text-[.7rem] font-medium uppercase tracking-widest"
            :class="isDark ? 'text-zinc-500' : 'text-zinc-400'"
          >
            Nome
          </label>
          <input
            id="username"
            v-model="username"
            placeholder="Digite seu nome"
            @keyup.enter="createRoom"
            class="h-11 w-full rounded-lg border px-3 text-sm outline-none transition-all duration-150"
            :class="isDark
              ? 'bg-zinc-800 border-zinc-700 text-white placeholder-zinc-600 hover:border-zinc-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15'
              : 'bg-zinc-50 border-zinc-300 text-zinc-900 placeholder-zinc-400 hover:border-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15'"
          />
        </div>

        <!-- Deck -->
        <div class="flex flex-col gap-1.5">
          <label
            for="deck"
            class="text-[.7rem] font-medium uppercase tracking-widest"
            :class="isDark ? 'text-zinc-500' : 'text-zinc-400'"
          >
            Deck
          </label>
          <select
            id="deck"
            v-model="selectedDeck"
            class="h-11 w-full rounded-lg border px-3 text-sm outline-none transition-all duration-150 cursor-pointer"
            :class="isDark
              ? 'bg-zinc-800 border-zinc-700 text-white hover:border-zinc-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15'
              : 'bg-zinc-50 border-zinc-300 text-zinc-900 hover:border-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15'"
          >
            <option value="fibonacci">Fibonacci (0, 1, 2, 3, 5, 8…)</option>
            <option value="fabrica">Fábrica</option>
          </select>
          <p
            class="text-[.68rem]"
            :class="isDark ? 'text-zinc-600' : 'text-zinc-400'"
          >
            {{ decks[selectedDeck as keyof typeof decks] }}
          </p>
        </div>

        <!-- Submit -->
        <button
          @click="createRoom"
          :disabled="!username.trim()"
          class="mt-1 h-11 w-full rounded-lg bg-blue-500 text-sm font-semibold text-white transition-all duration-150 hover:bg-blue-400 active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Criar sala
        </button>
      </div>
    </div>
  </main>
</template>