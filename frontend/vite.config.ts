import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Port RIENG voi linh-kien-app (5174/8788) va he DVBH goc (5173/8787) - dung 5176/8790 (xem ke
// hoach xay dung "Ports dev").
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5176,
    proxy: {
      "/api": {
        target: "http://localhost:8790",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
  },
});
