<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'

// ── Theme ──────────────────────────────────────────────────────────────
const isDark = ref(true)
function toggleTheme() { isDark.value = !isDark.value }

// ── Sidebar ────────────────────────────────────────────────────────────
const sidebarOpen = ref(true)

const navItems = [
  { label: 'Planning Poker', href: '/poker', icon: 'grid' },
]

const route  = useRoute()
const router = useRouter()

// Esconde shell (sidebar + topbar) na tela de login
const showShell = computed(() => !route.meta.hideHeader)

// Título da rota atual para o topbar
const pageTitle = computed(() => {
  const match = navItems.find(i => route.path.startsWith(i.href))
  return match?.label ?? 'Início'
})

// ── Drawer ─────────────────────────────────────────────────────────────
const drawerOpen = ref(false)
const drawerItem = ref<{ label: string; href: string } | null>(null)

function openDrawer(item: { label: string; href: string }) {
  drawerItem.value = item
  drawerOpen.value = true
}
function closeDrawer() { drawerOpen.value = false }

// Navega direto (sem drawer) — usado nos itens da nav principal
function navigate(href: string) {
  router.push(href)
}
</script>

<template>
  <div
    class="app-root flex h-screen overflow-hidden font-sans transition-colors duration-300"
    :class="isDark ? 'bg-zinc-900' : 'bg-zinc-50'"
  >

    <aside
      v-if="showShell"
      class="flex flex-col flex-shrink-0 transition-all duration-300 ease-in-out border-r z-20"
      :class="[
        sidebarOpen ? 'w-56' : 'w-14',
        isDark ? 'bg-zinc-950 border-white/[.06]' : 'bg-white border-zinc-200'
      ]"
    >
      <!-- Logo -->
      <div @click="router.push('/home')"
        class="flex items-center gap-2.5 px-3.5 border-b h-14 flex-shrink-0"
        :class="isDark ? 'border-white/[.06]' : 'border-zinc-200'"
      >
        <div class="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-blue-500">
          <svg class="w-3.5 h-3.5 text-white" viewBox="0 0 16 16" fill="none">
            <rect x="1" y="1" width="6" height="6" rx="1.5" fill="currentColor" opacity=".9"/>
            <rect x="9" y="1" width="6" height="6" rx="1.5" fill="currentColor" opacity=".6"/>
            <rect x="1" y="9" width="6" height="6" rx="1.5" fill="currentColor" opacity=".6"/>
            <rect x="9" y="9" width="6" height="6" rx="1.5" fill="currentColor" opacity=".3"/>
          </svg>
        </div>
        <span
          v-if="sidebarOpen"
          class="text-sm font-semibold tracking-wide whitespace-nowrap overflow-hidden"
          :class="isDark ? 'text-white' : 'text-zinc-900'"
        >
          EduStack
        </span>
      </div>

      <!-- Nav -->
      <nav class="flex flex-col gap-1 p-2 flex-1 overflow-y-auto">
        <button
          v-for="item in navItems"
          :key="item.href"
          @click="navigate(item.href)"
          class="group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-all duration-150 w-full"
          :class="[
            route.path.startsWith(item.href)
              ? isDark ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-50 text-blue-600'
              : isDark ? 'text-zinc-500 hover:bg-white/[.04] hover:text-zinc-200'
                       : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800'
          ]"
          :title="!sidebarOpen ? item.label : ''"
        >
          <span class="flex-shrink-0 w-4 h-4 flex items-center justify-center">
            <svg v-if="item.icon === 'grid'" class="w-4 h-4" viewBox="0 0 16 16" fill="none">
              <rect x="1" y="1" width="6" height="6" rx="1" stroke="currentColor" stroke-width="1.3"/>
              <rect x="9" y="1" width="6" height="6" rx="1" stroke="currentColor" stroke-width="1.3"/>
              <rect x="1" y="9" width="6" height="6" rx="1" stroke="currentColor" stroke-width="1.3"/>
              <rect x="9" y="9" width="6" height="6" rx="1" stroke="currentColor" stroke-width="1.3"/>
            </svg>
          </span>
          <span
            v-if="sidebarOpen"
            class="text-xs font-medium whitespace-nowrap overflow-hidden"
          >
            {{ item.label }}
          </span>
        </button>
      </nav>

      <!-- Bottom: tema + recolher -->
      <div
        class="flex flex-col gap-1 p-2 border-t flex-shrink-0"
        :class="isDark ? 'border-white/[.06]' : 'border-zinc-200'"
      >
        <button
          @click="toggleTheme"
          class="flex items-center gap-2.5 rounded-lg px-2.5 py-2 transition-all duration-150 w-full"
          :class="isDark
            ? 'text-zinc-500 hover:bg-white/[.04] hover:text-zinc-200'
            : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800'"
          :title="!sidebarOpen ? (isDark ? 'Modo claro' : 'Modo escuro') : ''"
        >
          <span class="flex-shrink-0 w-4 h-4 flex items-center justify-center">
            <svg v-if="isDark" class="w-4 h-4" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="2.5" stroke="currentColor" stroke-width="1.3"/>
              <path d="M8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M2.93 2.93l1.06 1.06M12.01 12.01l1.06 1.06M2.93 13.07l1.06-1.06M12.01 3.99l1.06-1.06" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
            </svg>
            <svg v-else class="w-4 h-4" viewBox="0 0 16 16" fill="none">
              <path d="M13.5 10A6 6 0 016 2.5a6 6 0 100 11 6 6 0 007.5-3.5z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>
            </svg>
          </span>
          <span v-if="sidebarOpen" class="text-xs font-medium whitespace-nowrap">
            {{ isDark ? 'Modo claro' : 'Modo escuro' }}
          </span>
        </button>

        <button
          @click="sidebarOpen = !sidebarOpen"
          class="flex items-center gap-2.5 rounded-lg px-2.5 py-2 transition-all duration-150 w-full"
          :class="isDark
            ? 'text-zinc-600 hover:bg-white/[.04] hover:text-zinc-400'
            : 'text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600'"
        >
          <span class="flex-shrink-0 w-4 h-4 flex items-center justify-center">
            <svg
              class="w-4 h-4 transition-transform duration-300"
              :class="sidebarOpen ? '' : 'rotate-180'"
              viewBox="0 0 16 16" fill="none"
            >
              <path d="M10 3L5 8l5 5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </span>
          <span v-if="sidebarOpen" class="text-xs font-medium whitespace-nowrap">Recolher</span>
        </button>
      </div>
    </aside>

    <!-- ══════════════════════════════════════════
         CONTEÚDO PRINCIPAL
    ══════════════════════════════════════════ -->
    <div class="flex flex-1 flex-col overflow-hidden">

      <!-- Topbar — oculta na tela de login -->
      <header
        v-if="showShell"
        class="flex h-14 flex-shrink-0 items-center justify-between border-b px-6"
        :class="isDark ? 'bg-zinc-950 border-white/[.06]' : 'bg-white border-zinc-200'"
      >
        <div class="flex items-center gap-3">
          <h1
            class="text-sm font-semibold"
            :class="isDark ? 'text-white' : 'text-zinc-900'"
          >
            {{ pageTitle }}
          </h1>
          <span
            class="rounded-full px-2 py-0.5 text-[.6rem] font-medium uppercase tracking-widest border"
            :class="isDark
              ? 'border-blue-500/20 bg-blue-500/10 text-blue-400'
              : 'border-blue-200 bg-blue-50 text-blue-600'"
          >
            Interno
          </span>
        </div>

        <div class="flex items-center gap-3">
          <span class="text-xs" :class="isDark ? 'text-zinc-600' : 'text-zinc-400'">dev.team</span>
          <div class="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-[.65rem] font-semibold text-white">
            DT
          </div>
        </div>
      </header>

      <!-- Página — router-view único e definitivo -->
      <main
        class="flex-1 overflow-hidden"
        :class="isDark ? 'bg-zinc-900' : 'bg-zinc-50'"
      >
        <!-- isDark é passado via v-bind para todos os filhos que declaram a prop -->
        <router-view v-slot="{ Component }">
          <component :is="Component" :isDark="isDark" />
        </router-view>
      </main>
    </div>

    <!-- ══════════════════════════════════════════
         DRAWER (para formulários futuros)
    ══════════════════════════════════════════ -->
    <Transition name="fade">
      <div
        v-if="drawerOpen"
        class="fixed inset-0 z-30 bg-black/40 backdrop-blur-[2px]"
        @click="closeDrawer"
      />
    </Transition>

    <Transition name="slide">
      <aside
        v-if="drawerOpen"
        class="fixed right-0 top-0 z-40 flex h-full w-full max-w-md flex-col shadow-2xl"
        :class="isDark ? 'bg-zinc-900' : 'bg-white'"
      >
        <div
          class="flex h-14 flex-shrink-0 items-center justify-between border-b px-5"
          :class="isDark ? 'border-white/[.06]' : 'border-zinc-200'"
        >
          <div class="flex items-center gap-2.5">
            <div class="h-1.5 w-1.5 rounded-full bg-blue-500" />
            <span
              class="text-sm font-semibold"
              :class="isDark ? 'text-white' : 'text-zinc-900'"
            >
              {{ drawerItem?.label }}
            </span>
          </div>
          <button
            @click="closeDrawer"
            class="flex h-7 w-7 items-center justify-center rounded-lg transition-colors"
            :class="isDark
              ? 'text-zinc-500 hover:bg-white/[.06] hover:text-zinc-300'
              : 'text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700'"
          >
            <svg class="w-4 h-4" viewBox="0 0 16 16" fill="none">
              <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
            </svg>
          </button>
        </div>

        <div class="flex-1 overflow-y-auto p-5">
          <!-- Conteúdo do formulário será inserido aqui via slot/componente dinâmico -->
          <div class="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div
              class="flex h-12 w-12 items-center justify-center rounded-xl border"
              :class="isDark ? 'border-white/[.06] bg-zinc-800' : 'border-zinc-200 bg-zinc-100'"
            >
              <svg class="w-5 h-5" :class="isDark ? 'text-zinc-600' : 'text-zinc-400'" viewBox="0 0 20 20" fill="none">
                <rect x="3" y="3" width="14" height="14" rx="2" stroke="currentColor" stroke-width="1.4"/>
                <path d="M7 8h6M7 11h4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
              </svg>
            </div>
            <p class="text-sm font-medium" :class="isDark ? 'text-zinc-400' : 'text-zinc-600'">
              {{ drawerItem?.label }}
            </p>
            <p class="max-w-[220px] text-xs leading-relaxed" :class="isDark ? 'text-zinc-600' : 'text-zinc-400'">
              O formulário desta seção será renderizado aqui quando implementado.
            </p>
          </div>
        </div>

        <div
          class="flex flex-shrink-0 items-center justify-end gap-2 border-t px-5 py-3.5"
          :class="isDark ? 'border-white/[.06]' : 'border-zinc-200'"
        >
          <button
            @click="closeDrawer"
            class="rounded-lg border px-4 py-2 text-xs font-medium transition-all"
            :class="isDark
              ? 'border-zinc-700 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200'
              : 'border-zinc-200 text-zinc-500 hover:border-zinc-300 hover:text-zinc-700'"
          >
            Cancelar
          </button>
          <button class="rounded-lg bg-blue-500 px-4 py-2 text-xs font-semibold text-white transition-all hover:bg-blue-400 active:scale-[.98]">
            Salvar
          </button>
        </div>
      </aside>
    </Transition>

  </div>
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap');

.font-sans { font-family: 'DM Sans', sans-serif; }
.font-mono { font-family: 'DM Mono', monospace; }

.slide-enter-active, .slide-leave-active {
  transition: transform 0.25s cubic-bezier(.4,0,.2,1);
}
.slide-enter-from, .slide-leave-to { transform: translateX(100%); }

.fade-enter-active, .fade-leave-active { transition: opacity 0.2s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>