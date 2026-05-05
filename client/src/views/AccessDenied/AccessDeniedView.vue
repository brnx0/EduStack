<script setup lang="ts">
import { useRouter } from 'vue-router'

defineProps<{ isDark: boolean }>()

const router = useRouter()
</script>

<template>
  <div
    class="flex h-full flex-col items-center justify-center gap-6 p-6"
    :class="isDark ? 'text-zinc-100' : 'text-zinc-800'"
  >
    <!-- Icon -->
    <div
      class="flex h-16 w-16 items-center justify-center rounded-2xl border"
      :class="isDark ? 'border-red-500/20 bg-red-500/10' : 'border-red-200 bg-red-50'"
    >
      <svg
        class="w-7 h-7"
        :class="isDark ? 'text-red-400' : 'text-red-500'"
        viewBox="0 0 24 24"
        fill="none"
      >
        <rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" stroke-width="1.5" />
        <path
          d="M7 11V7a5 5 0 0110 0v4"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
        />
        <circle cx="12" cy="16" r="1.5" fill="currentColor" />
      </svg>
    </div>

    <!-- Text -->
    <div class="text-center">
      <h2
        class="text-lg font-semibold"
        :class="isDark ? 'text-white' : 'text-zinc-900'"
      >
        Acesso Negado
      </h2>
      <p
        class="mt-1.5 text-sm max-w-xs"
        :class="isDark ? 'text-zinc-500' : 'text-zinc-400'"
      >
        Você não tem permissão para acessar esta área. Entre em contato com o administrador.
      </p>
    </div>

    <!-- Back button -->
    <button
      @click="router.push('/home')"
      class="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all"
      :class="isDark
        ? 'border border-white/[.08] text-zinc-400 hover:border-white/[.14] hover:text-zinc-200'
        : 'border border-zinc-200 text-zinc-500 hover:border-zinc-300 hover:text-zinc-700'"
    >
      <svg class="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none">
        <path d="M10 3L5 8l5 5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
      Voltar ao início
    </button>
  </div>
</template>
