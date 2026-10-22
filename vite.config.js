import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// VITE_BASE is "/" locally. The GitHub Pages workflow sets it to "/<repo-name>/".
export default defineConfig({
  base: process.env.VITE_BASE || "/",
  plugins: [react()],
});
