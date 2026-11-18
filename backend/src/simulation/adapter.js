import { randomUUID } from 'node:crypto'
import { snapshotSchema, scenarioSchema } from '@dacos/contracts'
import { workers, zones, devices } from './fixtures.js'

// Gateway adapters implement snapshot(), advance(), and setScenario(). No UI generation.
export class SimulationAdapter {
  constructor({ seed = 42, clock = () => new Date(), scenario = 'critical' } = {}) {
    this.seed = seed >>> 0
    this.clock = clock
    this.scenario = scenarioSchema.parse(scenario)
    this.sequence = 0
    this.streamId = randomUUID()
    this.previous = null
    this.eventStartedAt = null
  }
  random() {
    this.seed = (Math.imul(1664525, this.seed) + 1013904223) >>> 0
    return this.seed / 4294967296
  }
  setScenario(scenario) {
    this.scenario = scenarioSchema.parse(scenario)
    this.eventStartedAt = null
    return this.advance()
  }
  snapshot() { return this.previous ?? this.advance() }
  advance() {
    const now = this.clock().toISOString()
    this.sequence++
    const impaired = ['disconnected', 'stale'].includes(this.scenario)
    const quality = this.scenario === 'disconnected' ? 'offline' : this.scenario === 'stale' ? 'stale' : 'simulated'
    const noisy = (base, scale = 1) => Number((base + (this.random() - .5) * scale).toFixed(2))
    const metadata = { timestamp: now, source: 'dacos-simulator', simulation: true, quality }
    const readings = []
    const add = (device, kind, metric, value, unit) => {
      const id = `${device.id}:${metric}`
      const prior = this.previous?.readings.find(reading => reading.id === id)
      readings.push({ ...metadata, id, kind, workerId: device.workerId, deviceId: device.id, zoneId: device.zoneId,
        metric, value: impaired ? (prior?.value ?? null) : value, unit,
        timestamp: impaired ? (prior?.timestamp ?? new Date(this.clock().getTime() - 60000).toISOString()) : now,
        quality: value === null && !impaired ? 'unavailable' : quality, sequence: this.sequence })
    }
    for (const device of devices) {
      const hazard = device.zoneId === 'L3'
      if (device.type === 'wearable') {
        const affected = device.workerId === 'WK-884'
        add(device, 'health', 'heartRate', noisy(affected && this.scenario === 'critical' ? 104 : 78, 4), 'bpm')
        add(device, 'health', 'spo2', noisy(affected ? 97 : 98, .6), '%')
        add(device, 'health', 'temperature', noisy(37.1, .2), '°C')
        add(device, 'health', 'respiration', null, 'breaths/min')
        add(device, 'health', 'fatigue', null, 'index')
        add(device, 'device', 'battery', affected ? 68 : 92, '%')
        const geometry = zones.find(z => z.id === device.zoneId).geometry
        add(device, 'location', 'position', { x: noisy(geometry.x, 8), y: noisy(geometry.y, 8) }, 'fictional-map-units')
      } else {
        const methane = hazard && this.scenario === 'critical' ? .85 : hazard && this.scenario === 'warning' ? .36 : .18
        for (const [metric, base, unit, scale] of [
          ['ch4', methane, '% Vol', .01], ['co', hazard ? 12 : 8, 'ppm', .3], ['o2', 20.9, '% Vol', .04],
          ['h2s', 0, 'ppm', 0], ['pm10', 1.4, 'mg/m³', .04], ['no2', .2, 'ppm', .01], ['so2', .1, 'ppm', .01],
          ['co2', .04, '% Vol', .002], ['airTemperature', 28.4, '°C', .2], ['humidity', 76, '% RH', .4],
          ['pressure', 104.2, 'kPa', .04], ['airVelocity', 2.1, 'm/s', .1],
        ]) add(device, 'environment', metric, noisy(base, scale), unit)
      }
    }
    const severity = ['warning', 'critical'].includes(this.scenario) ? this.scenario : null
    if (severity && !this.eventStartedAt) this.eventStartedAt = now
    const alerts = severity ? [{ ...metadata, id: 'DEMO-CH4-L3', timestamp: this.eventStartedAt,
      severity, type: 'environmental', zoneId: 'L3', workerId: 'WK-884', status: 'open', message: 'SIMULATED methane excursion — example threshold only' }] : []
    const incidents = severity ? [{ ...metadata, id: 'DEMO-INC-084', alertId: 'DEMO-CH4-L3', timestamp: this.eventStartedAt,
      workerId: 'WK-884', zoneId: 'L3', severity, status: 'demonstration',
      timeline: [{ timestamp: this.eventStartedAt, message: 'Demonstration event generated. No real response dispatched.' }] }] : []
    // Impairment never manufactures an all-clear: retain known incidents/alerts.
    this.previous = snapshotSchema.parse({ streamId: this.streamId, sequence: this.sequence, timestamp: now,
      source: 'dacos-simulator', simulation: true, scenario: this.scenario, workers, zones, devices, readings,
      alerts: impaired ? (this.previous?.alerts ?? []).map(a => ({ ...a, quality })) : alerts,
      incidents: impaired ? (this.previous?.incidents ?? []).map(i => ({ ...i, quality })) : incidents })
    return this.previous
  }
}
