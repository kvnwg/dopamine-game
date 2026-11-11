/// <reference types="vite/client" />

declare const __APP_VERSION__: string;

interface ImportMetaEnv {
  readonly VITE_CHEATS?: string;
  /** 'crazygames' in the CrazyGames build (.env.crazygames). */
  readonly VITE_PLATFORM?: string;
}
