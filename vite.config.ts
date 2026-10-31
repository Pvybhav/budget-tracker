import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
//import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  base: "/",
  plugins: [react()],
  envPrefix: ["VITE_", "FIREBASE_"],
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true,
        secure: false,
      },
    },
  },
  preview: {
    host: "0.0.0.0",
    allowedHosts: ["budget-tracker-vw93.onrender.com"],
  },
  build: {
    target: "esnext",
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            return id.toString().split("node_modules/")[1].split("/")[0].toString();
          }
        },
      },
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    restoreMocks: true,
    coverage: {
      include: [
        "src/App.tsx",
        "src/pages/LoginPage.tsx",
        "src/services/api.ts",
        "src/services/budget-carryover.service.ts",
        "src/services/budget-forecast.service.ts",
        "src/services/budget.service.ts",
        "src/services/currency.service.ts",
      ],
      reporter: ["text"],
      thresholds: { branches: 90, lines: 90, statements: 90 },
    },
  },
});
