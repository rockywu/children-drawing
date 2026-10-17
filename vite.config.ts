import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "./",
  plugins: [
    vue(),
    VitePWA({
      registerType: "prompt",
      injectRegister: false,
      includeAssets: ["favicon.svg", "icons/apple-touch-icon.png"],
      manifest: {
        id: ".",
        name: "画画星球",
        short_name: "画画星球",
        description: "适合 8～16 岁，让想象力自由生长的本地创作画室。",
        lang: "zh-CN",
        start_url: ".",
        scope: ".",
        display: "standalone",
        background_color: "#f8f9f3",
        theme_color: "#f0f4e9",
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "icons/maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,svg,webmanifest}"],
        navigateFallback: "index.html",
        cleanupOutdatedCaches: true,
        skipWaiting: false,
        clientsClaim: false,
      },
    }),
  ],
});
