import react from '@vitejs/plugin-react'
import path from 'path'
import { defineConfig } from 'vite'

export default defineConfig({
  base: '/store/',
  plugins: [react()],
  server: {
    port: 5175,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // The public store embeds the courier sidebar source. Keep both apps on the
      // marketplace runtime so Router and React context providers remain shared.
      react: path.resolve(__dirname, 'node_modules/react'),
      'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
      'react-router-dom': path.resolve(__dirname, 'node_modules/react-router-dom'),
    },
    dedupe: ['react', 'react-dom', 'react-router-dom'],
  },
  css: {
    postcss: './postcss.config.js',
  },
})
