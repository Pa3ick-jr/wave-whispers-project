import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// IMPORTANT: this must match your GitHub repo name exactly, wrapped in slashes.
// If you name your repo something other than "wave-whispers", change it here too.
export default defineConfig({
  plugins: [react()],
  base: '/wave-whispers-project/',
})
