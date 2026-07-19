import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  // Chemins relatifs : le bundle est servi depuis un sous-dossier du Storage
  // Supabase, une base absolue casserait le chargement des assets.
  base: process.env.DEPLOY_TARGET === "supabase" ? "./" : "/",
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
