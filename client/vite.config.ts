import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  root: path.resolve(__dirname),
  plugins: [react()],
  build: {
    outDir: path.resolve(__dirname, "../dist-client"),
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3030",
        changeOrigin: true,
      },
      "/status/feed.xml": {
        target: "http://localhost:3030",
        changeOrigin: true,
      },
      "/feed.xml": {
        target: "http://localhost:3030",
        changeOrigin: true,
      },
      "/sitemap.xml": {
        target: "http://localhost:3030",
        changeOrigin: true,
      },
      "/robots.txt": {
        target: "http://localhost:3030",
        changeOrigin: true,
      },
    },
  },
});
