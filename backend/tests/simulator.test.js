import { describe, it, expect } from 'vitest'
import { SimulationAdapter } from '../src/simulation/adapter.js'
import { snapshotSchema } from '@dacos/contracts'
import { TelemetryService } from '../src/services/telemetry.js'
const clock = () => new Date('2026-11-13T12:00:00Z')
describe('backend simulator and persistence', () => {
  it('generates repeatable readings with explicit unavailable capabilities', () => {
    const a = new SimulationAdapter({ seed: 3, clock }).advance()
    const b = new SimulationAdapter({ seed: 3, clock }).advance()
    expect(a.readings).toEqual(b.readings)
    expect(snapshotSchema.safeParse(a).success).toBe(true)
    expect(a.readings.find(r => r.metric === 'fatigue')).toMatchObject({ value: null, quality: 'unavailable' })
    expect(a.readings.every(r => r.simulation && r.source === 'dacos-simulator')).toBe(true)
  })
  it('supports scenarios, never refreshes offline values or clears known incidents on disconnect', () => {
    let time = Date.parse('2026-11-13T12:00:00Z')
    const simulator = new SimulationAdapter({ clock: () => new Date(time) })
    const initial = simulator.advance()
    time += 1000
    const offline = simulator.setScenario('disconnected')
    expect(offline.readings[0].timestamp).toBe(initial.readings[0].timestamp)
    expect(offline.readings[0].value).toBe(initial.readings[0].value)
    expect(offline.readings[0].quality).toBe('offline')
    expect(offline.alerts).toHaveLength(1)
    expect(simulator.setScenario('stale').readings[0].quality).toBe('stale')
    expect(simulator.setScenario('normal').alerts).toHaveLength(0)
    expect(simulator.setScenario('warning').alerts[0].severity).toBe('warning')
    expect(simulator.setScenario('critical').alerts[0].severity).toBe('critical')
    expect(() => simulator.setScenario('real')).toThrow()
  })
  it('does not publish failed persistence or silently return simulated fallback data', async () => {
    const repository = { save: async () => { throw new Error('db offline') } }
    const service = new TelemetryService({ adapter: new SimulationAdapter({ clock }), repository })
    const emitted = []
    service.subscribe(s => emitted.push(s))
    await expect(service.update()).rejects.toThrow('db offline')
    expect(emitted).toHaveLength(0)
    expect(() => service.snapshot()).toThrow('unavailable')
  })
})
