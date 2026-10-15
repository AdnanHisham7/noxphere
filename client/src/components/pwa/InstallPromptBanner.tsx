// src/components/pwa/InstallPromptBanner.tsx
import React, { useState, useEffect } from "react";
import { Download, Share, PlusSquare, X, Smartphone, Sparkles, Check, ArrowDown } from "lucide-react";
import { isPwaInstalled } from "../../pwaRegister";

const DISMISS_COOLDOWN_DAYS = 2; // Prompt again after 2 days if dismissed
const STORAGE_KEY = "noxphere_pwa_dismissed_until";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export const InstallPromptBanner: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);
  const [showAndroidFallbackGuide, setShowAndroidFallbackGuide] = useState(false);
  const [isIosDevice, setIsIosDevice] = useState(false);
  const [isAndroidDevice, setIsAndroidDevice] = useState(false);

  useEffect(() => {
    // 1. If already installed in standalone mode, never show
    if (isPwaInstalled()) {
      return;
    }

    // 2. Detect platform
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOS =
      /iphone|ipad|ipod/.test(userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const isAndroid = /android/.test(userAgent);

    setIsIosDevice(isIOS);
    setIsAndroidDevice(isAndroid);

    // 3. Check if user dismissed recently
    const dismissedUntil = localStorage.getItem(STORAGE_KEY);
    if (dismissedUntil && Date.now() < Number(dismissedUntil)) {
      return;
    }

    // 4. Capture native beforeinstallprompt for Android & Chromium
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Small delay for smooth entry
      setTimeout(() => setIsVisible(true), 1500);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // 5. On iOS, beforeinstallprompt does not exist, so we show the banner after a gentle delay
    let iosTimer: ReturnType<typeof setTimeout> | null = null;
    if (isIOS) {
      iosTimer = setTimeout(() => {
        setIsVisible(true);
      }, 2500);
    }

    // 6. Listen for app installed event
    const handleAppInstalled = () => {
      setIsVisible(false);
      setShowIosGuide(false);
      setShowAndroidFallbackGuide(false);
      setDeferredPrompt(null);
    };
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
      if (iosTimer) clearTimeout(iosTimer);
    };
  }, []);

  const handleDismiss = () => {
    setIsVisible(false);
    setShowIosGuide(false);
    setShowAndroidFallbackGuide(false);
    // Don't show again for cooldown duration
    const cooldownMs = DISMISS_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
    localStorage.setItem(STORAGE_KEY, String(Date.now() + cooldownMs));
  };

  const handleInstallClick = async () => {
    if (isIosDevice) {
      // Show iOS step-by-step installation instructions modal / sheet
      setShowIosGuide(true);
      return;
    }

    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === "accepted") {
          setIsVisible(false);
        }
        setDeferredPrompt(null);
      } catch (err) {
        console.warn("[PWA] Prompt error:", err);
      }
    } else {
      // Fallback for Android/browsers where beforeinstallprompt was not captured
      setShowAndroidFallbackGuide(true);
    }
  };

  if (!isVisible && !showIosGuide && !showAndroidFallbackGuide) {
    return null;
  }

  return (
    <>
      {/* ── Floating Install Noxphere Container ── */}
      {isVisible && (
        <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:w-96 z-50 animate-fade-in">
          <div className="card p-4 sm:p-4.5 rounded-2xl border border-volt-500/30 dark:border-volt-400/20 shadow-2xl bg-white dark:bg-pitch-800 backdrop-blur-md relative overflow-hidden ring-1 ring-black/5 dark:ring-white/10">
            {/* Volt subtle glowing accent strip */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-volt-500 via-volt-400 to-emerald-400" />

            <div className="flex items-start gap-3.5">
              {/* App Icon */}
              <div className="relative shrink-0 mt-0.5">
                <div className="w-12 h-12 rounded-xl bg-pitch-900 border border-slate-200 dark:border-white/10 p-1 flex items-center justify-center shadow-sm overflow-hidden">
                  <img
                    src="/logo.png"
                    alt="Noxphere App"
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      // Fallback if logo.png is not loaded
                      (e.target as HTMLElement).style.display = "none";
                    }}
                  />
                </div>
                <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-volt-400 text-pitch-950 flex items-center justify-center shadow-xs">
                  <Sparkles size={9} className="stroke-[2.5]" />
                </div>
              </div>

              {/* Text content */}
              <div className="flex-1 min-w-0 pr-6">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h4 className="text-sm font-bold font-display text-slate-900 dark:text-white tracking-wide">
                    Install Noxphere
                  </h4>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded bg-volt-500/10 text-volt-600 dark:text-volt-400 border border-volt-500/20 font-mono">
                    App
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-snug">
                  {isIosDevice
                    ? "Add Noxphere to your iPhone home screen for lightning-fast full-screen access."
                    : "Install the official Noxphere app for fast loading, offline support, and full-screen experience."}
                </p>

                {/* Actions */}
                <div className="mt-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleInstallClick}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3.5 bg-volt-400 hover:bg-volt-300 active:scale-95 text-pitch-950 font-display font-bold text-xs uppercase tracking-wide rounded-lg transition-all shadow-sm"
                  >
                    {isIosDevice ? (
                      <>
                        <Share size={13} className="shrink-0" />
                        <span>Install on iPhone</span>
                      </>
                    ) : (
                      <>
                        <Download size={13} className="shrink-0" />
                        <span>Install App</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleDismiss}
                    className="py-2 px-3 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-pitch-700 transition-colors"
                  >
                    Not now
                  </button>
                </div>
              </div>

              {/* Close Button */}
              <button
                type="button"
                onClick={handleDismiss}
                className="absolute top-2.5 right-2.5 p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-pitch-700 transition-colors"
                title="Dismiss"
              >
                <X size={15} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── iOS Step-by-Step Installation Modal / Bottom Sheet ── */}
      {showIosGuide && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 sm:p-4 bg-black/60 dark:bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="card w-full max-w-md rounded-2xl border border-slate-200 dark:border-white/10 p-5 sm:p-6 shadow-2xl bg-white dark:bg-pitch-800 relative space-y-4">
            <button
              type="button"
              onClick={() => setShowIosGuide(false)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-pitch-700 transition-colors"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-pitch-900 border border-slate-200 dark:border-white/10 p-1 flex items-center justify-center shrink-0">
                <img src="/logo.png" alt="Noxphere" className="w-full h-full object-contain" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white font-display">
                  Install Noxphere on iPhone / iPad
                </h3>
                <p className="text-2xs text-slate-500 dark:text-slate-400">
                  Follow these 2 quick steps in Safari to add to your Home Screen:
                </p>
              </div>
            </div>

            {/* Steps Container */}
            <div className="space-y-3 pt-1">
              <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-pitch-700/50 border border-slate-200/80 dark:border-white/5">
                <div className="w-7 h-7 rounded-lg bg-sky-500/10 text-sky-500 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                  1
                </div>
                <div className="text-xs text-slate-700 dark:text-slate-200">
                  <p className="font-semibold text-slate-900 dark:text-white">
                    Tap the Share icon
                  </p>
                  <p className="text-2xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1.5 flex-wrap">
                    Look for the{" "}
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white dark:bg-pitch-800 border border-slate-200 dark:border-white/10 font-bold text-sky-500">
                      <Share size={12} /> Share
                    </span>{" "}
                    icon in Safari's bottom toolbar.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-pitch-700/50 border border-slate-200/80 dark:border-white/5">
                <div className="w-7 h-7 rounded-lg bg-volt-500/10 text-volt-600 dark:text-volt-400 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                  2
                </div>
                <div className="text-xs text-slate-700 dark:text-slate-200">
                  <p className="font-semibold text-slate-900 dark:text-white">
                    Select "Add to Home Screen"
                  </p>
                  <p className="text-2xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1.5 flex-wrap">
                    Scroll down and tap{" "}
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white dark:bg-pitch-800 border border-slate-200 dark:border-white/10 font-bold text-slate-900 dark:text-white">
                      <PlusSquare size={12} /> Add to Home Screen
                    </span>
                    , then tap <strong>Add</strong> in the top-right corner.
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowIosGuide(false);
                  handleDismiss();
                }}
                className="w-full py-2.5 px-4 bg-volt-400 hover:bg-volt-300 text-pitch-950 font-display font-bold text-xs uppercase tracking-wide rounded-lg transition-all text-center"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Android / Desktop Fallback Guide (When beforeinstallprompt not supported by browser) ── */}
      {showAndroidFallbackGuide && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 sm:p-4 bg-black/60 dark:bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="card w-full max-w-md rounded-2xl border border-slate-200 dark:border-white/10 p-5 sm:p-6 shadow-2xl bg-white dark:bg-pitch-800 relative space-y-4">
            <button
              type="button"
              onClick={() => setShowAndroidFallbackGuide(false)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-pitch-700 transition-colors"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-pitch-900 border border-slate-200 dark:border-white/10 p-1 flex items-center justify-center shrink-0">
                <img src="/logo.png" alt="Noxphere" className="w-full h-full object-contain" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white font-display">
                  Install Noxphere
                </h3>
                <p className="text-2xs text-slate-500 dark:text-slate-400">
                  Add the app to your device via your browser menu:
                </p>
              </div>
            </div>

            <div className="space-y-3 pt-1">
              <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-pitch-700/50 border border-slate-200/80 dark:border-white/5">
                <div className="w-7 h-7 rounded-lg bg-volt-500/10 text-volt-600 dark:text-volt-400 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                  1
                </div>
                <div className="text-xs text-slate-700 dark:text-slate-200">
                  <p className="font-semibold text-slate-900 dark:text-white">
                    Open browser menu
                  </p>
                  <p className="text-2xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Tap the <strong>three dots (⋮)</strong> in your browser's top-right or bottom bar.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-pitch-700/50 border border-slate-200/80 dark:border-white/5">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                  2
                </div>
                <div className="text-xs text-slate-700 dark:text-slate-200">
                  <p className="font-semibold text-slate-900 dark:text-white">
                    Select "Install app" or "Add to Home screen"
                  </p>
                  <p className="text-2xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Noxphere will be installed directly onto your device launcher.
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowAndroidFallbackGuide(false);
                  handleDismiss();
                }}
                className="w-full py-2.5 px-4 bg-volt-400 hover:bg-volt-300 text-pitch-950 font-display font-bold text-xs uppercase tracking-wide rounded-lg transition-all text-center"
              >
                Understood
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
