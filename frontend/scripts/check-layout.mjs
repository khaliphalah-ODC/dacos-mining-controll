// Browser QA via an already running local Chrome debugging session.
const response = await fetch('http://127.0.0.1:9223/json')
const tabs = await response.json()
const tab = tabs.find(tab => tab.type === 'page')
const socket = new WebSocket(tab.webSocketDebuggerUrl)
await new Promise(resolve => socket.addEventListener('open', resolve, { once: true }))
let sequence = 0
let failures = 0
const pending = new Map()
socket.addEventListener('message', ({ data }) => {
  const message = JSON.parse(data)
  if (message.method === 'Runtime.exceptionThrown') { failures++; console.log(JSON.stringify(message.params)) }
  if (message.id) {
    const callback = pending.get(message.id)
    pending.delete(message.id)
    if (message.error) callback.reject(message.error)
    else callback.resolve(message.result)
  }
})
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++sequence
  pending.set(id, { resolve, reject })
  socket.send(JSON.stringify({ id, method, params }))
})
const evaluate = async expression => {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails))
  return result.result.value
}
await send('Page.enable')
await send('Runtime.enable')
// Optional test credentials stay in the process environment and are never printed.
await send('Page.navigate', { url: (process.env.BASE_URL ?? 'http://127.0.0.1:5173') + '/login' })
await new Promise(resolve => setTimeout(resolve, 1200))
if (!await evaluate("fetch('/api/auth/session').then(r => r.ok)")) {
  if (!process.env.DACOS_TEST_EMAIL || !process.env.DACOS_TEST_PASSWORD) throw new Error('Sign in first, or supply DACOS_TEST_EMAIL and DACOS_TEST_PASSWORD for an ADMIN/SUPERVISOR test account')
  const loginBody = JSON.stringify({ email:process.env.DACOS_TEST_EMAIL,password:process.env.DACOS_TEST_PASSWORD })
  const ok = await evaluate(`fetch('/api/auth/login', { method:'POST',headers:{'Content-Type':'application/json'},body:${JSON.stringify(loginBody)} }).then(r => r.ok)`)
  if (!ok) throw new Error('Browser test sign-in failed')
}

for (const route of ['/overview', '/workers', '/map', '/environmental']) {
console.log('Checking route', route)
await send('Page.navigate', { url: (process.env.BASE_URL ?? 'http://127.0.0.1:5173') + route })
for (let attempt = 0; attempt < 100; attempt++) {
  if (await evaluate("!!document.querySelector('main')")) break
  await new Promise(resolve => setTimeout(resolve, 100))
}
await new Promise(resolve => setTimeout(resolve, 500))

for (const width of [1920, 1440, 1366, 1024, 768, 390, 360]) {
  await send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: false })
  await evaluate('document.fonts.ready')
  await new Promise(resolve => setTimeout(resolve, 100))
  const result = await evaluate(`({ width: innerWidth, content: document.documentElement.scrollWidth, mounted: !!document.querySelector('main'), simulation: document.body.innerText.includes('SIMULATION MODE') })`)
  if (result.content > width || !result.mounted || !result.simulation) failures++
  console.log(JSON.stringify(result))
}
await evaluate("document.querySelector('.navigation-toggle').click()")
const opened = await evaluate("document.querySelector('#primary-navigation').classList.contains('navigation-open')")
await evaluate("document.querySelector('.navigation-backdrop').click()")
const closed = await evaluate("!document.querySelector('#primary-navigation').classList.contains('navigation-open')")
console.log(JSON.stringify({ drawerOpens: opened, drawerCloses: closed }))
if (!opened || !closed) failures++
}
// Exercise the UI controls against the real local backend, not mocked packets.
await send('Page.navigate', { url: (process.env.BASE_URL ?? 'http://127.0.0.1:5173') + '/environmental' })
await new Promise(resolve => setTimeout(resolve, 1800))
for (const scenario of ['normal', 'warning', 'critical', 'disconnected', 'stale']) {
  await evaluate(`(() => { const select = document.querySelector('.telemetry-status select'); select.value = '${scenario}'; select.dispatchEvent(new Event('change', { bubbles: true })); })()`)
  await new Promise(resolve => setTimeout(resolve, 100))
  for (let attempt = 0; attempt < 100; attempt++) {
    if (await evaluate(`document.querySelector('.telemetry-status select').value === '${scenario}' && !document.querySelector('.telemetry-status select').disabled`)) break
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  const result = await evaluate(`({ scenario: document.querySelector('.telemetry-status select').value, state: document.querySelector('.telemetry-status [role=status]').textContent.trim(), methane: document.querySelector('main .text-3xl').textContent.trim() })`)
  const expected = scenario === 'disconnected' ? 'OFFLINE' : scenario === 'stale' ? 'STALE' : 'SIMULATED'
  if (result.scenario !== scenario || result.state !== expected || (scenario === 'disconnected' && result.methane !== '—')) failures++
  console.log(JSON.stringify(result))
}
await evaluate("fetch('/api/auth/session').then(r => r.json()).then(session => fetch('/api/simulation/scenario', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-csrf-token':session.csrfToken }, body: JSON.stringify({ scenario: 'critical' }) }))")
socket.close()
if (failures) process.exitCode = 1
