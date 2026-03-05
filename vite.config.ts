import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

// https://vite.dev/config/
export default defineConfig({
  plugins: [svelte()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/vexflow')) {
            return 'vexflow';
          }

          if (id.includes('node_modules/@tonaljs') || id.includes('node_modules/tonal')) {
            return 'music-theory';
          }
        },
      },
    },
  },
})
