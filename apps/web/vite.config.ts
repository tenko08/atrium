import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [
    tsconfigPaths(),     // MUST be first
    tanstackStart(),     // MUST be before viteReact
    viteReact(),         // MUST be last
  ],
  server: {
    port: 3000,
  },
})
