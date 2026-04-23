/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SOCKET_PORT: string;
  readonly VITE_URL_BASE: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}