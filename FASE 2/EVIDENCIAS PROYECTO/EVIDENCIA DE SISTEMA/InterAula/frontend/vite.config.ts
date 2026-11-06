import fs from 'node:fs'
import path from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const currentDir = import.meta.dirname
const rootEnvExists =
  fs.existsSync(path.resolve(currentDir, '../.env')) ||
  fs.existsSync(path.resolve(currentDir, '../.env.local'))

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  envDir: rootEnvExists ? path.resolve(currentDir, '..') : currentDir,
  server: {
    host: true,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('chileEducationCatalog2026.json') || id.includes('subjectsCatalog.json')) {
            return 'education-catalog';
          }
          if (id.includes('node_modules/@supabase')) {
            return 'supabase-vendor';
          }
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom') || id.includes('node_modules/react-router')) {
            return 'react-vendor';
          }
        },
      },
    },
  },
})
