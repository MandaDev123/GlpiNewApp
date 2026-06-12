import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/apirest.php': {
        target: 'http://localhost/glpi/public',
        changeOrigin: true,
        secure: false,
      }
    }
  }
})
