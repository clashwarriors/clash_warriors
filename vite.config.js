import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { visualizer } from 'rollup-plugin-visualizer'
import { NodeGlobalsPolyfillPlugin } from '@esbuild-plugins/node-globals-polyfill'
import compression from 'vite-plugin-compression' // ✅ Gzip plugin

export default defineConfig({
  plugins: [
    react(),

    // ✅ Bundle visualizer for analysis
    visualizer({
      open: false,
      filename: 'bundle-report.html',
    }),

    // ✅ Gzip compression for production assets
    compression({
      algorithm: 'gzip',
      ext: '.gz',
      deleteOriginFile: false,
      threshold: 10240, // Only compress files >10KB
    }),
  ],

  server: {
    host: true,
    allowedHosts: ['clashwarriorstestingserver.loca.lt'],
  },

  build: {
    target: 'esnext', // ✅ Output for modern browsers
    minify: 'terser', // ✅ Better compression than default 'esbuild'
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    },
    brotliSize: false, // ✅ Disable to speed up build
    chunkSizeWarningLimit: 1500,
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
