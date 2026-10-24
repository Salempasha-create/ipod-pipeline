import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// In dev, /api is proxied to the backend started with `--port 8765`.
const backend = process.env.IPOD_PIPELINE_BACKEND ?? "http://127.0.0.1:8765";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: { "/api": backend },
  },
});
