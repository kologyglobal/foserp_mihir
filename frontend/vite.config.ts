import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(rootDir, './src'),
    },
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    open: '/crm',
    // Same-origin /api in local API mode — matches production nginx proxy behaviour.
    // When the backend is down or mid-restart (tsx watch), default http-proxy returns
    // text/plain 502 which the SPA client rejects as non-JSON — return JSON instead.
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
        configure(proxy) {
          proxy.on('error', (_err, _req, res) => {
            const sock = res as { writeHead?: (code: number, headers: Record<string, string>) => void; end?: (body: string) => void; headersSent?: boolean; writableEnded?: boolean }
            if (typeof sock.writeHead !== 'function' || sock.headersSent || sock.writableEnded) return
            sock.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' })
            sock.end?.(
              JSON.stringify({
                success: false,
                message:
                  'API server unavailable on port 5000. Start `npm run dev` in backend, or wait if it is restarting.',
                code: 'API_PROXY_UNAVAILABLE',
                errors: null,
              }),
            )
          })
        },
      },
    },
  },
})
