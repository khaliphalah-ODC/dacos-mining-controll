import { it, expect, vi } from 'vitest'
import { createServer } from 'vite'
import { resolve } from 'node:path'
it('serves frontend modules while denying private workspace files over development HTTP', async () => {
  vi.stubEnv('DEVICE_TLS_CERT',''); vi.stubEnv('DEVICE_TLS_KEY',''); vi.stubEnv('DEVICE_LAN_HOST','')
  let server
  try {
    server = await createServer({ root:resolve('frontend'), configFile:resolve('frontend/vite.config.js'), logLevel:'silent', optimizeDeps:{noDiscovery:true,include:[]}, server:{host:'127.0.0.1',port:0} })
    await server.listen()
    const base = `http://127.0.0.1:${server.httpServer.address().port}`
    const frontend = await fetch(base + '/src/views/LoginView.vue',{signal:AbortSignal.timeout(5000)})
    expect(frontend.status).toBe(200); await frontend.text()
    for (const path of ['.data/test-postgres.credential','backend/src/security/auth.js','.env','deploy/.env']) {
      const response = await fetch(`${base}/@fs${resolve(path)}`,{signal:AbortSignal.timeout(5000)})
      expect(response.status).toBe(403)
      await response.text()
    }
  } finally { server?.httpServer?.closeAllConnections(); await server?.close(); vi.unstubAllEnvs() }
})
