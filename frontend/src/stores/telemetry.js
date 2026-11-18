import {applyTelemetryDelta} from '../services/deltas.js'
import { useAuthStore } from './auth.js'
import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { io } from 'socket.io-client'
import { createSnapshotGate, qualityFor } from '../services/telemetry.js'
export const useTelemetryStore = defineStore('telemetry', () => {
  const preview = import.meta.env.VITE_STATIC_PREVIEW === 'true'
  let previewStarted = false
  const snapshot = ref(null)
  const connected = ref(false)
  const incidentRevision=ref(0)
  const now = ref(Date.now())
  const lastReceived = ref(0)
  const error = ref(preview ? 'Loading static preview…' : 'Connecting to monitoring…')
  const busy = ref(false)
  let accept = createSnapshotGate()
  let socket, timer, initialController, startGeneration=0
  const state = computed(() => {
    if (preview) return snapshot.value ? 'simulated' : 'unavailable'
    if (!connected.value) return snapshot.value ? 'offline' : 'unavailable'
    if (!snapshot.value) return 'unavailable'
    if (snapshot.value.simulation !== false && snapshot.value.scenario === 'disconnected') return 'offline'
    if ((snapshot.value.simulation !== false && snapshot.value.scenario === 'stale') || now.value - lastReceived.value > 6500) return 'stale'
    if(snapshot.value.mode==='operational'){
      const qualities=snapshot.value.readings.map(r=>qualityFor(r,{connected:connected.value,now:now.value,lastReceived:lastReceived.value}))
      if(qualities.includes('live'))return 'live'
      if(qualities.includes('stale'))return 'stale'
      if(qualities.includes('offline'))return 'offline'
      return 'unavailable'
    }
    return snapshot.value.simulation === false ? 'live' : 'simulated'
  })
  const workers = computed(() => snapshot.value?.workers ?? [])
  const alerts = computed(() => snapshot.value?.alerts ?? [])
  const read = (metric, deviceId) => {
    const fixtureDevice = snapshot.value?.devices.find(d => d.id === deviceId)
    const registration = snapshot.value?.deviceSessions?.find(d => d.id === deviceId || (fixtureDevice?.workerId && d.workerId === fixtureDevice.workerId))
    return snapshot.value?.readings.find(r => r.metric === metric && (!deviceId || r.deviceId === (registration && ['heartRate','spo2','temperature','battery'].includes(metric) ? registration.id : deviceId)))
  }
  function metric(name, deviceId, digits) {
    const reading = read(name, deviceId)
    const quality = qualityFor(reading, { connected: preview || connected.value, now: preview ? Date.parse(snapshot.value?.timestamp ?? '') : now.value, lastReceived: preview ? Date.parse(snapshot.value?.timestamp ?? '') : lastReceived.value })
    if (['unavailable', 'offline'].includes(quality)) return '—'
    return typeof reading.value === 'number' && digits !== undefined ? reading.value.toFixed(digits) : reading.value
  }
  function mean(name, digits = 1) {
    if (!snapshot.value || ['offline', 'unavailable'].includes(state.value)) return '—'
    const values = snapshot.value.readings.filter(r => r.metric === name && typeof r.value === 'number' && !['offline','stale','unavailable'].includes(qualityFor(r, { connected: connected.value || preview, now: preview ? Date.parse(snapshot.value.timestamp) : now.value, lastReceived: preview ? Date.parse(snapshot.value.timestamp) : lastReceived.value }))).map(r => r.value)
    return values.length ? (values.reduce((a, b) => a + b, 0) / values.length).toFixed(digits) : '—'
  }
  function point(deviceId, baseX, baseY) {
    const reading = read('position', deviceId)
    const zone = snapshot.value?.zones.find(z => z.id === reading?.zoneId)
    if (!reading?.value || !zone) return `translate(${baseX}, ${baseY})`
    return `translate(${baseX + reading.value.x - zone.geometry.x}, ${baseY + reading.value.y - zone.geometry.y})`
  }
  function receive(input) {
    const parsed = accept(input)
    if (!parsed) return
    snapshot.value = parsed
    lastReceived.value = Date.now()
    error.value = ''
  }
  function start() {
    if (preview) {
      if (previewStarted) return
      previewStarted = true
      import('../preview/snapshot.json').then(({ default: fixture }) => {
        if (previewStarted) receive(fixture)
      }).catch(() => { error.value = 'Static preview fixture unavailable' })
      return
    }
    if (socket) { if(!socket.connected)socket.connect(); return }
    const generation=++startGeneration
    initialController=new AbortController()
    useAuthStore().request('/api/telemetry/snapshot',undefined,'GET',{signal:initialController.signal}).then(value=>{if(generation===startGeneration)receive(value)}).catch(failure=>{if(failure.name!=='AbortError'&&generation===startGeneration)error.value='Monitoring data unavailable'})
    const remote=import.meta.env.VITE_SOCKET_ORIGIN
    const options={...(remote?{transports:['websocket'],auth:async callback=>{try{callback({...await useAuthStore().request('/api/auth/socket-ticket',{}),delta:true})}catch{callback({ticket:'invalid',delta:true})}}}:{auth:{delta:true}}), reconnection: true, reconnectionDelay: 500, reconnectionDelayMax: 5000 }
    socket = remote?io(remote,options):io(options)
    socket.on('connect', () => { connected.value = true })
    socket.on('disconnect', reason => { if (reason === 'io server disconnect') useAuthStore().restore(); connected.value = false; error.value = 'Connection lost — last readings retained, not current' })
    socket.on('connect_error', failure => { if (['Sign in required','Session unavailable'].includes(failure.message)) useAuthStore().restore(); connected.value = false; error.value = 'Realtime unavailable — no substitute data' })
    socket.on('telemetry:snapshot', receive)
    socket.on('telemetry:delta',packet=>{if(packet?.sequence<=snapshot.value?.sequence)return;const next=applyTelemetryDelta(snapshot.value,packet);if(next)receive(next);else socket.emit('telemetry:resync')})
    socket.on('incident:changed',message=>{if(message&&typeof message.id==='string'&&Number.isInteger(message.version))incidentRevision.value++})
    socket.on('telemetry:unavailable', () => { connected.value = false; error.value = 'Telemetry unavailable' })
    timer = setInterval(() => { now.value = Date.now() }, 500)
  }
  function stop() { ++startGeneration; initialController?.abort(); previewStarted = false; socket?.removeAllListeners(); socket?.disconnect(); socket = null; accept=createSnapshotGate(); clearInterval(timer); connected.value = false }
  async function setScenario(scenario) {
    if (preview) return
    busy.value = true
    try {
      receive(await useAuthStore().request('/api/simulation/scenario',{scenario}))
    } catch (failure) { error.value = failure.message }
    finally { busy.value = false }
  }
  function workerStatus(id) {
    if (snapshot.value && !snapshot.value.deviceSessions?.some(d => d.workerId === id && d.source === 'hardware' && d.connectionStatus !== 'revoked')) {
      if (snapshot.value.scenario === 'disconnected') return 'offline'
      if (snapshot.value.scenario === 'stale') return 'stale'
    }
    if (!['simulated','live'].includes(state.value)) return state.value
    return alerts.value.find(a => a.workerId === id)?.severity ?? 'normal'
  }
  const summary = computed(() => {
    if (!snapshot.value) return {}
    const usable = ['simulated','live'].includes(state.value)
    return { registered: workers.value.length, active: usable ? workers.value.length : '—', safe: usable ? workers.value.filter(w => workerStatus(w.id) === 'normal').length : '—',
      attention: usable ? alerts.value.filter(a => a.severity === 'warning').length : '—', emergencies: alerts.value.filter(a => a.severity === 'critical').length,
      wearables: snapshot.value.devices.filter(d => d.type === 'wearable').length, gasSensors: snapshot.value.devices.filter(d => d.type === 'environmental').length,
      underground: usable ? workers.value.filter(w => w.zoneId !== 'L1').length : '—' }
  })
  return { incidentRevision, preview, snapshot, connected, now, lastReceived, error, busy, state, workers, alerts, summary, read, metric, mean, point, workerStatus, start, stop, setScenario }
})
