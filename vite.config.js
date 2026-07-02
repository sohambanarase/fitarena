import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // During `vite dev` the /api function isn't running. Point it at your deployed
  // Vercel URL, or run `vercel dev` instead of `vite dev` to serve both together.
  server: { port: 5173 },
});
