import { Capacitor } from '@capacitor/core';

export const isNative = (): boolean => Capacitor.isNativePlatform();

/** The CrazyGames web build (`npm run build:crazygames`, mode `crazygames`, see .env.crazygames). */
export const isCrazyGames: boolean = import.meta.env.VITE_PLATFORM === 'crazygames';
