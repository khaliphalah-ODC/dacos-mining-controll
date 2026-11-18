import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { readFileSync } from 'node:fs'
import { createServer as createHttpsServer } from 'node:https'
import { fileURLToPath } from 'node:url'
const repositoryRoot = fileURLToPath(new URL('..', import.meta.url))
export default defineConfig(({ mode }) => {
  const environment = loadEnv(mode, repositoryRoot, '')
  const unsafe=Object.keys(environment).filter(key=>/^VITE_.*(SECRET|PASSWORD|DATABASE|PRIVATE_KEY)/i.test(key))
  if(unsafe.length)throw new Error('Do not put server secrets in VITE_ variables: '+unsafe.join(', '))
  const apiPort = process.env.API_PORT ?? environment.API_PORT ?? 3001
  const cert = process.env.DEVICE_TLS_CERT ?? environment.DEVICE_TLS_CERT
  const key = process.env.DEVICE_TLS_KEY ?? environment.DEVICE_TLS_KEY
  const lanHost = process.env.DEVICE_LAN_HOST ?? environment.DEVICE_LAN_HOST
  if (lanHost && !/^(10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)$/.test(lanHost)) throw new Error('DEVICE_LAN_HOST must be a private LAN IPv4 address')
  if (lanHost && (!cert || !key)) throw new Error('LAN device testing requires DEVICE_TLS_CERT and DEVICE_TLS_KEY')
  if (!!cert !== !!key) throw new Error('Set both DEVICE_TLS_CERT and DEVICE_TLS_KEY')
  const tls = cert ? { cert: readFileSync(cert), key: readFileSync(key) } : undefined
  const lanPlugin = {
    name: 'dacos-private-lan',
    configureServer(server) {
      if (!lanHost) return
      // Keep laptop localhost available for pairing while serving phones on one private interface.
      const lan = createHttpsServer(tls, server.middlewares)
      lan.on('upgrade', (request, socket, head) => server.httpServer.emit('upgrade', request, socket, head))
      lan.on('error', error => { server.config.logger.error(`Private LAN listener failed: ${error.message}`); server.close() })
      server.httpServer.once('listening', () => lan.listen(server.httpServer.address().port, lanHost))
      const close = server.close.bind(server)
      server.close = async () => {
        lan.closeAllConnections()
        if (lan.listening) await new Promise(resolve => lan.close(resolve))
        await close()
      }
    },
  }
  return {
    plugins: [vue(), lanPlugin],
    envDir: repositoryRoot,
    server: {
      host: '127.0.0.1',
      https: tls,
      fs: { allow: [repositoryRoot], deny: ['.env', '.env.*', '*.{crt,pem,key}', '**/.git/**', '**/.data/**', '**/.tools/**', '**/.certs/**', '**/.aws/**', '**/.codex/**', '**/.agents/**', '**/*.credential', '**/backend/**'] },
      proxy: {
        '/api': {
          target: `http://127.0.0.1:${apiPort}`, changeOrigin: false,
          configure(proxy) {
            proxy.on('proxyReq', (outgoing, request) => {
              // Override incoming values so LAN clients cannot claim laptop-only access.
              outgoing.setHeader('x-dacos-client-local', ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(request.socket.remoteAddress) ? 'true' : 'false')
            })
          },
        },
        '/socket.io': { target: `http://127.0.0.1:${apiPort}`, ws: true },
      },
    },
  }
})
