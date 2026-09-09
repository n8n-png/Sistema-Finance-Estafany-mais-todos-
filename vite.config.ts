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
  build: {
    rollupOptions: {
      output: {
        /**
         * Separa as bibliotecas pesadas do código da aplicação.
         *
         * O bundle principal estava em 1,8 MB — em conexão ruim, isso é a
         * diferença entre abrir o painel e desistir. Estas quatro têm em comum
         * mudar pouco: uma vez baixadas, o navegador as reaproveita entre
         * deploys, enquanto só o código da aplicação é rebaixado.
         */
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
          graficos: ["recharts", "chart.js", "react-chartjs-2"],
          documentos: ["jspdf", "jspdf-autotable", "docx", "file-saver"],
          supabase: ["@supabase/supabase-js"],
        },
      },
    },
    // O aviso padrão dispara em 500 kB. Os pedaços separados acima ficam acima
    // disso por natureza; o que importa vigiar é o bundle da aplicação.
    chunkSizeWarningLimit: 900,
  },
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
    // jsdom: é uma aplicação de navegador, e vários módulos tocam em APIs do
    // DOM já no import. Testes de lógica pura funcionam igual aqui.
    environment: "jsdom",
  },
}));
