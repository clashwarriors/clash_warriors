import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { visualizer } from 'rollup-plugin-visualizer'
import { NodeGlobalsPolyfillPlugin } from '@esbuild-plugins/node-globals-polyfill'

export default defineConfig({
  plugins: [
    react(),
    visualizer({
      open: true, // Opens in browser after build
      filename: 'bundle-report.html', // Optional custom name
    }),
  ],

  server: {
    host: true, // Needed for tunneling (e.g., localtunnel)
    allowedHosts: ['clashwarriorstestingserver.loca.lt'],
  },

  build: {
    chunkSizeWarningLimit: 1500, // optional: silence 500kb warning
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
        },
      },
    },
  },

  optimizeDeps: {
    esbuildOptions: {
      define: {
        global: 'globalThis',
      },
      plugins: [
        NodeGlobalsPolyfillPlugin({
          buffer: true,
        }),
      ],
    },
  },
})
