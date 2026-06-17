import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import path from "path";

export default defineConfig({
  plugins: [
    tanstackRouter({
      target: "react",
      autoCodeSplitting: true,
    }),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // Variáveis lidas pelo app (VITE_*) e também as expostas pelo Tauri (TAURI_*)
  envPrefix: ["VITE_", "TAURI_"],
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
    // necessário para o Tauri conseguir conectar ao dev server
    host: "0.0.0.0",
  },
  build: {
    outDir: "dist",
    // não minificar em modo debug do tauri para builds mais rápidos
    minify: !process.env.TAURI_DEBUG ? "esbuild" : false,
    sourcemap: !!process.env.TAURI_DEBUG,
  },
});
