<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { saveSession } from '../../composables/useAuth'

const router = useRouter()
const loginInput = ref('')
const password = ref('')
const isLoading = ref(false)
const showPassword = ref(false)
const rememberMe = ref(false)
const focused = ref<string | null>(null)
const errorMsg = ref('')

async function handleLogin() {
  if (!loginInput.value || !password.value) {
    errorMsg.value = 'Preencha o login e a senha.'
    return
  }
  isLoading.value = true
  errorMsg.value = ''
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user: loginInput.value, password: password.value }),
    })
    const data = await res.json()
    if (!res.ok) {
      errorMsg.value = data.error ?? 'Erro ao autenticar'
      return
    }
    saveSession(data.token, data.user, rememberMe.value)
    router.push('/home')
  } catch {
    errorMsg.value = 'Não foi possível conectar ao servidor.'
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="flex min-h-screen bg-zinc-950 font-sans">
    <!-- ── Left Panel ── -->
    <div
      class="relative hidden lg:flex flex-1 flex-col justify-between overflow-hidden p-12 bg-zinc-950 border-r border-white/[.06]"
    >
      <!-- Grid texture overlay -->
      <div
        class="pointer-events-none absolute inset-0"
        style="
          background-image:
            repeating-linear-gradient(
              0deg,
              transparent,
              transparent 47px,
              rgba(255, 255, 255, 0.03) 47px,
              rgba(255, 255, 255, 0.03) 48px
            ),
            repeating-linear-gradient(
              90deg,
              transparent,
              transparent 47px,
              rgba(255, 255, 255, 0.03) 47px,
              rgba(255, 255, 255, 0.03) 48px
            );
        "
      />

      <!-- Glow blobs -->
      <div
        class="pointer-events-none absolute -top-24 -left-14 w-[360px] h-[360px] rounded-full"
        style="background: radial-gradient(circle, rgba(59, 130, 246, 0.13) 0%, transparent 68%)"
      />
      <div
        class="pointer-events-none absolute -bottom-16 -right-10 w-[280px] h-[280px] rounded-full"
        style="background: radial-gradient(circle, rgba(99, 102, 241, 0.1) 0%, transparent 68%)"
      />

      <!-- Logo -->
      <div class="relative flex items-center gap-2.5 w-fit">
        <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500">
          <svg class="w-4 h-4 text-white" viewBox="0 0 16 16" fill="none">
            <rect x="1" y="1" width="6" height="6" rx="1.5" fill="currentColor" opacity=".9" />
            <rect x="9" y="1" width="6" height="6" rx="1.5" fill="currentColor" opacity=".6" />
            <rect x="1" y="9" width="6" height="6" rx="1.5" fill="currentColor" opacity=".6" />
            <rect x="9" y="9" width="6" height="6" rx="1.5" fill="currentColor" opacity=".3" />
          </svg>
        </div>
        <span class="text-sm font-semibold tracking-wide text-white">EduStack</span>
        <span
          class="ml-1 rounded-full border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 text-[.6rem] font-medium uppercase tracking-widest text-blue-400"
        >
          Internal
        </span>
      </div>

      <!-- Headline -->
      <div class="relative flex flex-1 flex-col justify-center py-10 max-w-md">
        <div class="mb-4 flex items-center gap-2">
          <div class="h-px w-6 bg-blue-500" />
          <span class="text-[.7rem] font-medium uppercase tracking-[.15em] text-blue-400"
            >Dev Portal</span
          >
        </div>
        <h1
          class="mb-5 font-bold leading-[1.1] text-white"
          style="font-size: clamp(2rem, 3.5vw, 3rem)"
        >
          Tudo que o time<br />
          <span class="text-zinc-500">precisa, num só lugar.</span>
        </h1>
        <p class="text-sm leading-relaxed text-zinc-600 max-w-xs">
          Acesse serviços, documentação, pipelines e ferramentas da equipe de desenvolvimento da
          educação.
        </p>
      </div>
    </div>

    <!-- ── Right Panel ── -->
    <div
      class="flex w-full lg:w-[420px] flex-shrink-0 items-center justify-center bg-zinc-900 px-8 py-12"
    >
      <div class="w-full max-w-[340px]">
        <!-- Mobile logo -->
        <div class="mb-8 flex items-center gap-2 lg:hidden">
          <div class="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500">
            <svg class="w-3.5 h-3.5 text-white" viewBox="0 0 16 16" fill="none">
              <rect x="1" y="1" width="6" height="6" rx="1.5" fill="currentColor" opacity=".9" />
              <rect x="9" y="1" width="6" height="6" rx="1.5" fill="currentColor" opacity=".6" />
              <rect x="1" y="9" width="6" height="6" rx="1.5" fill="currentColor" opacity=".6" />
              <rect x="9" y="9" width="6" height="6" rx="1.5" fill="currentColor" opacity=".3" />
            </svg>
          </div>
          <span class="text-sm font-semibold text-white">EduStack</span>
        </div>

        <!-- Header -->
        <div class="mb-8">
          <h2 class="mb-1.5 text-2xl font-bold text-white">Entrar</h2>
          <p class="text-sm text-zinc-500">Acesso restrito ao time de desenvolvimento.</p>
        </div>

        <!-- Form -->
        <form @submit.prevent="handleLogin" novalidate class="flex flex-col gap-5">
          <!-- Login -->
          <div class="flex flex-col gap-1.5">
            <label
              for="login"
              class="text-[.7rem] font-medium uppercase tracking-widest text-zinc-500"
            >
              Login
            </label>
            <div class="relative">
              <svg
                class="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors duration-150"
                :class="focused === 'login' ? 'text-blue-400' : 'text-zinc-600'"
                viewBox="0 0 20 20"
                fill="none"
              >
                <circle cx="10" cy="7" r="3" stroke="currentColor" stroke-width="1.3" />
                <path
                  d="M3.5 17c0-3.038 2.91-5.5 6.5-5.5s6.5 2.462 6.5 5.5"
                  stroke="currentColor"
                  stroke-width="1.3"
                  stroke-linecap="round"
                />
              </svg>
              <input
                id="login"
                v-model="loginInput"
                type="text"
                placeholder="seu.login"
                autocomplete="username"
                @focus="focused = 'login'"
                @blur="focused = null"
                class="w-full h-11 rounded-lg border bg-zinc-800 pl-10 pr-4 text-sm text-white placeholder-zinc-600 outline-none transition-all duration-150"
                :class="
                  focused === 'login'
                    ? 'border-blue-500 ring-2 ring-blue-500/15'
                    : 'border-zinc-700 hover:border-zinc-600'
                "
              />
            </div>
          </div>

          <!-- Password -->
          <div class="flex flex-col gap-1.5">
            <div class="flex items-center justify-between">
              <label
                for="password"
                class="text-[.7rem] font-medium uppercase tracking-widest text-zinc-500"
              >
                Senha
              </label>
              <a href="#" class="text-xs text-zinc-600 transition-colors hover:text-zinc-400"
                >Esqueceu?</a
              >
            </div>
            <div class="relative">
              <svg
                class="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors duration-150"
                :class="focused === 'password' ? 'text-blue-400' : 'text-zinc-600'"
                viewBox="0 0 20 20"
                fill="none"
              >
                <rect
                  x="3.5"
                  y="9"
                  width="13"
                  height="8.5"
                  rx="1.5"
                  stroke="currentColor"
                  stroke-width="1.3"
                />
                <path
                  d="M6.5 9V6.5a3.5 3.5 0 017 0V9"
                  stroke="currentColor"
                  stroke-width="1.3"
                  stroke-linecap="round"
                />
                <circle cx="10" cy="13" r="1.25" fill="currentColor" />
              </svg>
              <input
                id="password"
                v-model="password"
                :type="showPassword ? 'text' : 'password'"
                placeholder="••••••••••"
                autocomplete="current-password"
                @focus="focused = 'password'"
                @blur="focused = null"
                class="w-full h-11 rounded-lg border bg-zinc-800 pl-10 pr-10 text-sm text-white placeholder-zinc-600 outline-none transition-all duration-150"
                :class="
                  focused === 'password'
                    ? 'border-blue-500 ring-2 ring-blue-500/15'
                    : 'border-zinc-700 hover:border-zinc-600'
                "
              />
              <button
                type="button"
                @click="showPassword = !showPassword"
                class="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-600 transition-colors hover:text-zinc-400"
                :aria-label="showPassword ? 'Ocultar senha' : 'Mostrar senha'"
              >
                <svg v-if="!showPassword" class="w-4 h-4" viewBox="0 0 20 20" fill="none">
                  <path
                    d="M2 10s3-6 8-6 8 6 8 6-3 6-8 6-8-6-8-6z"
                    stroke="currentColor"
                    stroke-width="1.3"
                  />
                  <circle cx="10" cy="10" r="2.25" stroke="currentColor" stroke-width="1.3" />
                </svg>
                <svg v-else class="w-4 h-4" viewBox="0 0 20 20" fill="none">
                  <path
                    d="M3 3l14 14M8.59 8.59A2.25 2.25 0 0012.4 12.4M6.71 6.71C4.9 7.77 3.5 10 3.5 10s3 5 6.5 5c1.22 0 2.35-.37 3.29-.98M13.29 13.29C15.1 12.23 16.5 10 16.5 10S13.5 5 10 5c-.45 0-.89.05-1.3.15"
                    stroke="currentColor"
                    stroke-width="1.3"
                    stroke-linecap="round"
                  />
                </svg>
              </button>
            </div>
          </div>

          <!-- Remember -->
          <label class="flex w-fit cursor-pointer items-center gap-2.5">
            <div class="relative h-4 w-4 flex-shrink-0">
              <input v-model="rememberMe" type="checkbox" class="peer absolute opacity-0 w-0 h-0" />
              <div
                class="flex h-4 w-4 items-center justify-center rounded border transition-all"
                :class="rememberMe ? 'border-blue-500 bg-blue-500' : 'border-zinc-600 bg-zinc-800'"
              >
                <svg v-if="rememberMe" class="w-2.5 h-2.5" viewBox="0 0 10 10" fill="none">
                  <path
                    d="M2 5l2.5 2.5L8 3"
                    stroke="white"
                    stroke-width="1.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </div>
            </div>
            <span class="text-xs text-zinc-500">Manter sessão ativa</span>
          </label>

          <!-- Error -->
          <div
            v-if="errorMsg"
            class="rounded-lg border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-xs text-red-400"
          >
            {{ errorMsg }}
          </div>

          <!-- Submit -->
          <button
            type="submit"
            :disabled="isLoading"
            class="mt-1 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-blue-500 text-sm font-semibold text-white transition-all duration-150 hover:bg-blue-400 active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-70"
          >
            <template v-if="!isLoading">
              <span>Acessar portal</span>
              <svg class="w-4 h-4" viewBox="0 0 20 20" fill="none">
                <path
                  d="M4 10h12M11 5l5 5-5 5"
                  stroke="currentColor"
                  stroke-width="1.6"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </template>
            <template v-else>
              <svg class="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="9" stroke="rgba(255,255,255,.25)" stroke-width="2.5" />
                <path
                  d="M12 3a9 9 0 019 9"
                  stroke="white"
                  stroke-width="2.5"
                  stroke-linecap="round"
                />
              </svg>
            </template>
          </button>
        </form>

        <!-- Footer -->
    
      </div>
    </div>
  </div>
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
.font-sans {
  font-family: 'DM Sans', sans-serif;
}
.font-mono {
  font-family: 'DM Mono', monospace;
}
</style>
