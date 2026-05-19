<script setup lang="ts">
import { ref } from 'vue'
import GerarJarTab from './tabs/GerarJarTab.vue'
import ServidorTab from './tabs/ServidorTab.vue'
import AmbienteTab from './tabs/AmbienteTab.vue'
import SistemaTab from './tabs/SistemaTab.vue'

const props = defineProps<{ isDark: boolean }>()

const tabs = [
  { key: 'gerar', label: 'Gerar JAR', icon: 'package' },
  { key: 'servidor', label: 'Servidor', icon: 'server' },
  { key: 'ambiente', label: 'Ambiente', icon: 'globe' },
  { key: 'sistema', label: 'Sistema', icon: 'layers' },
] as const

type TabKey = typeof tabs[number]['key']
const activeTab = ref<TabKey>('gerar')
</script>

<template>
  <div class="h-full flex flex-col overflow-hidden min-h-0">
    <!-- Tab bar -->
    <div class="flex-shrink-0 flex items-center gap-0.5 px-6 pt-4 pb-0">
      <button v-for="tab in tabs" :key="tab.key" @click="activeTab = tab.key"
        class="relative flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium rounded-t-lg transition-all"
        :class="[
          activeTab === tab.key
            ? isDark
              ? 'text-blue-400 bg-zinc-800/80 border border-b-0 border-white/[.06]'
              : 'text-blue-600 bg-white border border-b-0 border-zinc-200'
            : isDark
              ? 'text-zinc-500 hover:text-zinc-300'
              : 'text-zinc-500 hover:text-zinc-700'
        ]">
        <!-- Icons -->
        <svg v-if="tab.icon === 'package'" class="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none">
          <path d="M2 5l6-3 6 3v6l-6 3-6-3V5z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" />
          <path d="M2 5l6 3 6-3M8 8v6.5" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" />
        </svg>
        <svg v-else-if="tab.icon === 'server'" class="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none">
          <rect x="2" y="2" width="12" height="5" rx="1" stroke="currentColor" stroke-width="1.3" />
          <rect x="2" y="9" width="12" height="5" rx="1" stroke="currentColor" stroke-width="1.3" />
          <circle cx="5" cy="4.5" r="0.75" fill="currentColor" />
          <circle cx="5" cy="11.5" r="0.75" fill="currentColor" />
        </svg>
        <svg v-else-if="tab.icon === 'globe'" class="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.3" />
          <path d="M2 8h12M8 2c-2 2-2 10 0 12M8 2c2 2 2 10 0 12" stroke="currentColor" stroke-width="1.3" />
        </svg>
        <svg v-else-if="tab.icon === 'layers'" class="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none">
          <path d="M2 8l6 3 6-3" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" />
          <path d="M2 11l6 3 6-3" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" />
          <path d="M2 5l6 3 6-3-6-3-6 3z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" />
        </svg>
        {{ tab.label }}
      </button>
    </div>

    <!-- Tab content -->
    <div class="flex-1 min-h-0 overflow-y-auto px-6 py-5 border-t -mt-px"
      :class="isDark ? 'border-white/[.06]' : 'border-zinc-200'">
      <GerarJarTab v-if="activeTab === 'gerar'" :isDark="isDark" />
      <ServidorTab v-else-if="activeTab === 'servidor'" :isDark="isDark" />
      <AmbienteTab v-else-if="activeTab === 'ambiente'" :isDark="isDark" />
      <SistemaTab v-else-if="activeTab === 'sistema'" :isDark="isDark" />
    </div>
  </div>
</template>
