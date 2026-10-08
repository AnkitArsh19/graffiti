import { resolve } from "path";
import { fileURLToPath } from "url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const rootDir = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 5173,
    allowedHosts: [
      "graffiti.ankitarsh.me",
      "localhost",
      "127.0.0.1",
    ],
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(rootDir, "index.html"),
        overlay: resolve(rootDir, "overlay.html"),
      },
    },
  },
});
