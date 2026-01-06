import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
  },
  preview: {
    // Allow external hosts (like Koyeb) to access the Vite preview server
    allowedHosts: true,
  },
});
