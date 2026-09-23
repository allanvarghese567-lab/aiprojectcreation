import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // IMPORTANT: Change 'ai-agents-dashboard' to your exact GitHub repository name
  base: '/aiprojectcreation/',
})
