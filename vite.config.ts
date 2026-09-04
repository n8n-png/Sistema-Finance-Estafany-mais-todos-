/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(() => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    // Restrito a src/: a pasta meu-projeto/ contém o framework AIOS, com testes
    // próprios em outro runner. Sem este filtro, o vitest tenta executá-los e
    // falha em arquivos que não são deste projeto.
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    environment: "node",
  },
}));
