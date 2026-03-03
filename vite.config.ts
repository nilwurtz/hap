import { defineConfig } from "vite"

export default defineConfig({
  root: "demo",
  base: "/hap/",
  build: {
    outDir: "../dist-demo",
    emptyOutDir: true,
  },
})
