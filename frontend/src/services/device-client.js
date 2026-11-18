import { useAuthStore } from '../stores/auth.js'
export async function deviceRequest(path, body, token) {
  const csrf = token ? '' : useAuthStore().csrfToken
  const response = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(csrf ? { 'x-csrf-token': csrf } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error ?? `Request failed (${response.status})`)
  return result
}
export function createDeviceSender(registration, request = deviceRequest) {
  let sequence = -1
  let pending = Promise.resolve()
  let lastSent = 0
  return (metrics, { sos = false, connectionStatus = 'connected' } = {}) => {
    const work = pending.catch(() => {}).then(async () => {
      const delay = 550 - (Date.now() - lastSent)
      if (delay > 0) await new Promise(resolve => setTimeout(resolve, delay))
      lastSent = Date.now()
      return request('/api/device-telemetry', {
      deviceId: registration.deviceId, workerId: registration.workerId, transport: registration.transport, source: registration.source,
      timestamp: new Date().toISOString(), sequence: ++sequence, quality: registration.source === 'simulator' ? 'simulated' : 'live', metrics, sos, ...(sos ? {eventId:crypto.randomUUID()} : {}), connectionStatus,
    }, registration.token)
    })
    pending = work
    return work
  }
}
