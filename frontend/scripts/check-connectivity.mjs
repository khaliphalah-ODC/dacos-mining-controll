// Requires an isolated Chrome debugging session on 127.0.0.1:9223 and a running DACOS.
// Creates and revokes one test registration; leaves its append-only simulated SOS history.
const base = process.env.BASE_URL ?? 'http://127.0.0.1:5173'
const tabs = await (await fetch('http://127.0.0.1:9223/json')).json()
const tab = tabs.find(t => t.type === 'page')
const socket = new WebSocket(tab.webSocketDebuggerUrl)
await new Promise(resolve => socket.addEventListener('open', resolve, { once: true }))
let sequence = 0
const pending = new Map(), exceptions = []
socket.addEventListener('message', ({ data }) => {
  const message = JSON.parse(data)
  if (message.method === 'Runtime.exceptionThrown') exceptions.push(message.params)
  if (message.id) { const { resolve, reject } = pending.get(message.id); pending.delete(message.id); message.error ? reject(message.error) : resolve(message.result) }
})
const send = (method, params = {}) => new Promise((resolve, reject) => { const id = ++sequence; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params })) })
const evaluate = async expression => { const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails)); return result.result.value }
const pause = ms => new Promise(resolve => setTimeout(resolve, ms))
const until = async expression => { for (let i = 0; i < 100; i++) { if (await evaluate(expression)) return; await pause(100) } throw new Error(`Timed out: ${expression}`) }
const click = label => evaluate(`(() => { const b = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === ${JSON.stringify(label)}); if (!b || b.disabled) throw Error('Button unavailable'); b.click() })()`)
await send('Page.enable'); await send('Runtime.enable')
// Optional test credentials stay in the process environment and are never printed.
await send('Page.navigate', { url: base + '/login' })
await new Promise(resolve => setTimeout(resolve, 1200))
if (!await evaluate("fetch('/api/auth/session').then(r => r.ok)")) {
  if (!process.env.DACOS_TEST_EMAIL || !process.env.DACOS_TEST_PASSWORD) throw new Error('Sign in first, or supply DACOS_TEST_EMAIL and DACOS_TEST_PASSWORD for an ADMIN/SUPERVISOR test account')
  const loginBody = JSON.stringify({ email:process.env.DACOS_TEST_EMAIL,password:process.env.DACOS_TEST_PASSWORD })
  const ok = await evaluate(`fetch('/api/auth/login', { method:'POST',headers:{'Content-Type':'application/json'},body:${JSON.stringify(loginBody)} }).then(r => r.ok)`)
  if (!ok) throw new Error('Browser test sign-in failed')
}

let registrationId
try {
  await send('Page.navigate', { url: base + '/device-simulator' })
  await until("!!document.querySelector('select option[value=\"W-014\"]')")
  await click('Create single-use code')
  await until("!!document.querySelector('code')")
  await evaluate("(() => { const input = document.querySelector('input'); input.value = document.querySelector('code').textContent; input.dispatchEvent(new Event('input', { bubbles: true })); })()")
  await click('Pair test device')
  await until("document.body.innerText.includes('3. Send simulated readings')")
  registrationId = await evaluate("fetch('/api/telemetry/snapshot').then(r => r.json()).then(s => s.deviceSessions.find(d => d.workerId === 'W-014').id)")
  await evaluate("(() => { const input = document.querySelector('input[type=number]'); input.value = '81'; input.dispatchEvent(new Event('input', { bubbles: true })); })()")
  await click('Start transmission')
  await until("document.body.innerText.includes('Server acknowledgement:')")
  await pause(600); await click('SIMULATED SOS')
  await until("[...document.querySelectorAll('button')].some(b => b.textContent.trim() === 'Stop safely' && !b.disabled)")
  await pause(600); await click('Stop safely')
  await until("document.body.innerText.includes('Stopped')")
  await pause(650)
  for (const route of ['/workers/W-014', '/device-simulator', '/ble-gateway']) {
    await send('Page.navigate', { url: base + route }); await until("!!document.querySelector('.connectivity-page')")
    if (route.includes('W-014')) await until("document.body.innerText.includes('81 bpm') && document.body.innerText.includes('SIMULATED SOS')")
    for (const width of [1440, 768, 390, 360]) {
      await send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: false })
      await pause(100)
      const result = await evaluate('({ width: innerWidth, content: document.documentElement.scrollWidth })')
      if (result.content > width) throw new Error(`Overflow: ${route} ${JSON.stringify(result)}`)
    }
    console.log(`PASS ${route}: desktop/tablet/phone widths`)
  }
  if (exceptions.length) throw new Error(`${exceptions.length} browser runtime exceptions`)
  console.log('PASS Wi-Fi UI pairing, transmission, simulated SOS and Worker Detail updates')
} finally {
  if (registrationId) await evaluate(`fetch('/api/auth/session').then(r => r.json()).then(session => fetch('/api/devices/${registrationId}/revoke', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-csrf-token':session.csrfToken }, body: '{}' })).then(r => { if (!r.ok) throw Error('Test registration cleanup failed') })`)
  socket.close()
}
