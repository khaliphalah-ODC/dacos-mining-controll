import { snapshotSchema } from '@dacos/contracts'
import { connectionStatus,measurementQuality } from './devices.js'
export class TelemetryService {
  constructor({ adapter, repository }) {
    this.adapter = adapter
    this.repository = repository
    this.current = null
    this.listeners = new Set()
    this.incidentListeners=new Set()
    this.incidentVersions=new Map()
    this.timer = null
    this.pending = Promise.resolve()
    this.lastError = null
    this.deviceState = { registrations: [], events: [] }
  }
  subscribeIncidents(listener){this.incidentListeners.add(listener);return()=>this.incidentListeners.delete(listener)}
  publishIncident(incident){
    if((this.incidentVersions.get(incident.id)??-1)>=incident.version)return
    this.incidentVersions.set(incident.id,incident.version)
    if(this.incidentVersions.size>1000)this.incidentVersions.delete(this.incidentVersions.keys().next().value)
    for(const listener of this.incidentListeners)listener({id:incident.id,version:incident.version,updatedAt:new Date(incident.updatedAt).toISOString()})
  }
  notifyIncidentChanges(){for(const incident of this.deviceState.operationalIncidents??[])this.publishIncident(incident)}
  subscribe(listener) { this.listeners.add(listener); return () => this.listeners.delete(listener) }
  // Serialize ticks and scenario mutations: no interleaved persistence or reordered events.
  update(scenario) {
    const work = this.pending.catch(() => {}).then(async () => {
      const next = snapshotSchema.parse(await (scenario ? this.adapter.setScenario(scenario) : this.adapter.advance()))
      try {
        await this.repository.save(next)
        if (this.repository.deviceState) this.deviceState = await this.repository.deviceState()
        this.current = this.withDevices(next)
        this.notifyIncidentChanges()
        this.lastError = null
        for (const listener of this.listeners) listener(this.current)
        return this.current
      } catch (error) {
        this.lastError = error
        throw error
      }
    })
    this.pending = work
    return work
  }
  withDevices(snapshot) {
    if (this.deviceState.workers) snapshot = { ...snapshot, workers: this.deviceState.workers.filter(w => w.active && (this.adapter.mode !== 'operational' || w.origin === 'registered')) }
    const iso = value => value ? new Date(value).toISOString() : null
    const activeSos=new Set((this.deviceState.operationalIncidents??[]).filter(i=>i.kind==='SIMULATED_SOS').map(i=>i.id))
    const currentSos=this.deviceState.operationalIncidents?this.deviceState.events.filter(e=>activeSos.has(e.id)):this.deviceState.events
    const deviceAlerts = currentSos.map(e => ({ id: `SOS:${e.id}`, timestamp: iso(e.timestamp), source: 'device-simulator', simulation: true, quality: 'simulated', severity: 'critical', type: 'simulated-sos', zoneId: snapshot.workers.find(w => w.id === e.workerId)?.zoneId ?? '', workerId: e.workerId, status: 'demonstration', message: e.message }))
    const sosIds=new Set(this.deviceState.events.map(e=>e.id))
    const workflow=(this.deviceState.operationalIncidents??[]).filter(i=>!sosIds.has(i.id))
    const workflowAlerts=workflow.map(i=>({id:`WORKFLOW:${i.id}`,timestamp:iso(i.createdAt),source:i.ruleId?'rule-engine':'operator-report',simulation:i.simulation,quality:i.simulation?'simulated':'live',severity:i.severity,type:'workflow',zoneId:snapshot.workers.find(w=>w.id===i.workerId)?.zoneId??'',workerId:i.workerId,status:i.status,message:i.message}))
    const workflowIncidents=workflow.map(i=>({...workflowAlerts.find(a=>a.id===`WORKFLOW:${i.id}`),id:i.id,alertId:`WORKFLOW:${i.id}`,timeline:i.events.map(e=>({timestamp:iso(e.createdAt),message:`${e.action}: ${e.note}`}))}))
    const active = this.deviceState.registrations.filter(d => d.workerId && d.connectionStatus !== 'revoked' && snapshot.workers.some(w => w.id === d.workerId))
    const external = active.flatMap(d => d.metrics.map(m => ({ ...m, id: `${d.id}:${m.metric}`, deviceId: d.id, workerId: d.workerId, zoneId: snapshot.workers.find(w => w.id === d.workerId)?.zoneId ?? '', kind: m.metric === 'battery' ? 'device' : 'health', timestamp: iso(d.measurementTimestamp ?? d.lastSeen), sequence: Math.max(0, d.sequence), source: d.source, simulation: d.source === 'simulator', quality:measurementQuality(d) })))
    const deviceSessions = snapshot.workers.flatMap(w => {
      const records = this.deviceState.registrations.filter(d => d.workerId === w.id)
      const device = records.find(d => d.connectionStatus !== 'revoked') ?? records.at(-1)
      if (!device) return []
      const { tokenHash, createdAt, ...d } = device
      return [{ ...d, connectionStatus:connectionStatus(device), lastSeen:iso(d.lastSeen), timestamp:iso(d.measurementTimestamp) }]
    })
    const readings = [...(this.adapter.previous?.readings ?? snapshot.readings).filter(r => (!r.workerId || snapshot.workers.some(w => w.id === r.workerId)) && !deviceSessions.some(d => d.workerId === r.workerId && ['health', 'device'].includes(r.kind))), ...external]
    const hardware = this.adapter.mode === 'operational' || readings.some(r => !r.simulation)
    const source = hardware ? (readings.some(r => r.simulation) ? 'dacos-mixed' : 'dacos-hardware') : 'dacos-simulator'
    return { ...snapshot, source, simulation:!hardware, readings, alerts: [...snapshot.alerts.filter(a => !['simulated-sos','workflow'].includes(a.type)), ...deviceAlerts, ...workflowAlerts], incidents:[...snapshot.incidents.filter(i=>i.source!=='rule-engine'&&i.source!=='operator-report'),...workflowIncidents], deviceSessions,
      deviceEvents: this.deviceState.events.map(e => ({ ...e, timestamp: iso(e.timestamp), receivedAt: iso(e.receivedAt) })) }
  }
  refreshDevices() {
    const work = this.pending.catch(() => {}).then(async () => {
      this.deviceState = await this.repository.deviceState()
      this.notifyIncidentChanges()
      // Adapter sequences are independent; reserve the next sequence for this publication.
      this.adapter.sequence = Math.max(this.adapter.sequence, this.current.sequence) + 1
      this.current = this.withDevices({ ...this.current, sequence: this.adapter.sequence })
      for (const listener of this.listeners) listener(this.current)
    })
    this.pending = work
    return work
  }
  start(interval = 2000) {
    this.timer = setInterval(() => this.update().catch(error => console.error(JSON.stringify({event:'telemetry.persistence_failed',code:typeof error.code==='string'?error.code:'INTERNAL'}))), interval)
  }
  async stop() { clearInterval(this.timer); await this.pending.catch(() => {}) }
  snapshot() {
    if (!this.current || this.lastError) throw Object.assign(new Error('Telemetry unavailable'), { status: 503 })
    return this.current
  }
}
export function workerStatus(snapshot, worker) {
  const hardware = snapshot.deviceSessions?.some(d => d.workerId === worker.id && d.source === 'hardware' && d.connectionStatus !== 'revoked')
  if (!hardware && snapshot.scenario === 'disconnected') return 'offline'
  if (!hardware && snapshot.scenario === 'stale') return 'stale'
  return snapshot.alerts.find(a => a.workerId === worker.id)?.severity ?? 'normal'
}
export function summary(snapshot) {
  const statuses = snapshot.workers.map(w => workerStatus(snapshot, w))
  const available = !['disconnected', 'stale'].includes(snapshot.scenario)
  return {
    registered: snapshot.workers.length, active: available ? snapshot.workers.length : null,
    safe: available ? statuses.filter(s => s === 'normal').length : null,
    attention: available ? statuses.filter(s => s === 'warning').length : null,
    emergencies: snapshot.alerts.filter(a => a.severity === 'critical').length,
    wearables: snapshot.devices.filter(d => d.type === 'wearable').length,
    gasSensors: snapshot.devices.filter(d => d.type === 'environmental').length,
    underground: available ? snapshot.workers.filter(w => w.zoneId !== 'L1').length : null,
    source: snapshot.source, simulation: snapshot.simulation, timestamp: snapshot.timestamp, scenario: snapshot.scenario,
  }
}
