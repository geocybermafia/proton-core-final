import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  resolve: {
    dedupe: ['react', 'react-dom', 'wagmi', '@tanstack/react-query', 'viem'],
    alias: {
      'react': path.resolve(__dirname, './node_modules/react'),
      'react-dom': path.resolve(__dirname, './node_modules/react-dom')
    }
  },
  optimizeDeps: {
    include: [
      'react', 
      'react-dom', 
      'wagmi', 
      '@tanstack/react-query', 
      'viem', 
      'framer-motion', 
      'react-router-dom', 
      'lucide-react',
      'firebase/app', 
      'firebase/auth', 
      'firebase/firestore', 
      'firebase/storage'
    ]
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify(mode === 'production' ? 'production' : 'development'),
  },
  server: {
    port: 3000,
    host: '0.0.0.0',
    hmr: false
  },
  build: {
    sourcemap: false,
    reportCompressedSize: false,
    modulePreload: false,
    minify: 'esbuild',
    target: 'esnext'
  }
}));
