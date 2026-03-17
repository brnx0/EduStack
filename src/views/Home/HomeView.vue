<script setup lang="ts">
defineProps<{ isDark?: boolean }>()
</script>

<template>
  <div class="h-full">
    <div class="p-8 transition-colors duration-300"
         :class="isDark ? 'bg-zinc-950 border-white/[.06]' : 'bg-white border-zinc-200'">
      <h2 class="text-2xl font-bold mb-4" :class="isDark ? 'text-white' : 'text-zinc-900'">
        Dashboard Inicial
      </h2>
      <p class="text-sm" :class="isDark ? 'text-zinc-400' : 'text-zinc-600'">
        Bem-vindo ao EduStack! Selecione uma ferramenta no menu lateral esquerdo para começar.
      </p>
    </div>
  </div>
</template>
