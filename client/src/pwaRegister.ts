// src/pwaRegister.ts

/**
 * Registers the Noxphere Service Worker for PWA functionality.
 */
export function registerServiceWorker() {
  if (typeof window === 'undefined') return;

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then((registration) => {
          // Listen for updates found
          registration.onupdatefound = () => {
            const installingWorker = registration.installing;
            if (installingWorker) {
              installingWorker.onstatechange = () => {
                if (installingWorker.state === 'installed') {
                  if (navigator.serviceWorker.controller) {
                    // New content available, dispatch custom event or reload if needed
                    window.dispatchEvent(new CustomEvent('noxphere:pwa-update-available'));
                  }
                }
              };
            }
          };
        })
        .catch((error) => {
          console.warn('[PWA] Service worker registration failed:', error);
        });
    });
  }
}

/**
 * Checks whether the current window is already running in PWA standalone / installed mode.
 */
export function isPwaInstalled(): boolean {
  if (typeof window === 'undefined') return false;

  const isStandaloneMatch = window.matchMedia('(display-mode: standalone)').matches;
  const isIosStandalone = (window.navigator as any).standalone === true;
  const isAndroidAppReferrer = document.referrer.includes('android-app://');

  return Boolean(isStandaloneMatch || isIosStandalone || isAndroidAppReferrer);
}
