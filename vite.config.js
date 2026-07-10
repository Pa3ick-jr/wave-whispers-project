import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// IMPORTANT: this must match your GitHub repo name exactly, wrapped in slashes.
// Your repo is "wave-whispers-project" — if you ever rename it, update this too.
export default defineConfig({
  plugins: [react()],
  base: '/wave-whispers-project/',
  optimizeDeps: {
    exclude: ['@supabase/supabase-js'],
  },
})
