import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Replace 'pdr-tracker' with your actual GitHub repo name
  base: '/pdr-tracker/',
})
