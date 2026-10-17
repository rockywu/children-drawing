import { ref, shallowRef } from "vue";
import { registerSW } from "virtual:pwa-register";

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export const installPrompt = shallowRef<InstallPromptEvent>();
export const webAppInstalled = ref(false);

export function setupWebApp() {
  if (window.desktop || !/^https?:$/.test(location.protocol)) return;
  const standalone = window.matchMedia("(display-mode: standalone)");
  const syncInstalled = () => {
    webAppInstalled.value =
      standalone.matches ||
      !!(navigator as Navigator & { standalone?: boolean }).standalone;
  };
  syncInstalled();
  standalone.addEventListener("change", syncInstalled);
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    installPrompt.value = event as InstallPromptEvent;
  });
  window.addEventListener("appinstalled", () => {
    webAppInstalled.value = true;
    installPrompt.value = undefined;
  });
  // A new worker waits for the open drawing windows to close; never reload a painting to update.
  if (
    import.meta.env.PROD &&
    "serviceWorker" in navigator &&
    window.isSecureContext
  )
    registerSW();
}
