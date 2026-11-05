import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import fs from "fs";
import path from "path";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

// https://vite.dev/config/
const base = (process.env.VITE_BASE_PATH ?? "/").replace(/\/?$/, "/");

export default defineConfig({
  base,
  plugins: [
    react(),
    tailwindcss(),
    {
      name: "generate-404",
      closeBundle() {
        // Copy index.html to 404.html after build
        fs.copyFileSync("dist/index.html", "dist/404.html");
      },
    },
    VitePWA({
      registerType: "autoUpdate",
      workbox: {
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
      manifest: {
        name: "Kimchi",
        short_name: "Kimchi",
        description: "Share the date, not your data.",
        theme_color: "#fff7ef",
        background_color: "#fff7ef",
        display: "standalone",
        lang: "en",
        scope: base,
        start_url: base,
        icons: [
          { src: "icon-192.png", type: "image/png", sizes: "192x192" },
          { src: "icon-512.png", type: "image/png", sizes: "512x512" },
          {
            src: "icon-192-maskable.png",
            type: "image/png",
            sizes: "192x192",
            purpose: "maskable",
          },
          {
            src: "icon-512-maskable.png",
            type: "image/png",
            sizes: "512x512",
            purpose: "maskable",
          },
          {
            src: "icon-kimchi.svg",
            type: "image/svg+xml",
            sizes: "any",
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
