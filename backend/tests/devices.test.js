import { describe, it, expect } from 'vitest'
import { DeviceService, connectionStatus } from '../src/services/devices.js'
import { devicePacketSchema } from '@dacos/contracts'
function setup() {
  let now = Date.parse('2026-11-14T12:00:00Z')
  const registrations = [], events = [], packets = []
  const repository = {
    deviceState: async () => ({ registrations, events }),
    registerDevice: async data => registrations.push({ ...data, sequence: -1, timestamp: null, lastSeen: null }),
    saveDevicePacket: async (d, p, receivedAt, event) => { packets.push(p); Object.assign(d, { sequence: p.sequence, timestamp: p.timestamp, lastSeen: receivedAt.toISOString(), connectionStatus: p.connectionStatus, metrics: p.metrics }); if (event) events.push(event) },
  }
  const service = new DeviceService(repository, { snapshot: () => ({ workers: [{ id: 'W-014' }] }), refreshDevices: async () => {} }, () => new Date(now))
  return { service, registrations, events, packets, advance: (ms = 1000) => { now += ms }, packet: r => ({ deviceId: r.deviceId, workerId: r.workerId, transport: r.transport, source: r.source, timestamp: new Date(now).toISOString(), sequence: 0, connectionStatus: 'connected', quality: 'simulated', metrics: [{ metric: 'heartRate', value: 82, unit: 'bpm' }] }) }
}
async function pair(s) { return s.service.register({ code: s.service.issuePairing().code, workerId: 'W-014', transport: 'wifi', source: 'simulator' }) }
describe('paired device ingestion', () => {
  it('validates values, units, quality, metrics and unknown fields', async () => {
    const s = setup(), r = await pair(s), packet = s.packet(r)
    expect(devicePacketSchema.safeParse(packet).success).toBe(true)
    for (const invalid of [{ ...packet, source: 'hardware' }, { ...packet, extra: 1 }, { ...packet, sequence: -1 }, { ...packet, metrics: [{ metric: 'heartRate', value: 400, unit: 'bpm' }] }, { ...packet, metrics: [...packet.metrics, ...packet.metrics] }]) expect(devicePacketSchema.safeParse(invalid).success).toBe(false)
  })
  it('requires an unexpired single-use code and prevents reassignment', async () => {
    const s = setup(), code = s.service.issuePairing().code
    s.advance(121000)
    await expect(s.service.register({ code, workerId: 'W-014' })).rejects.toMatchObject({ status: 403 })
    await pair(s)
    await expect(pair(s)).rejects.toMatchObject({ status: 409 })
  })
  it('rejects unauthorized submissions and registration mismatches', async () => {
    const s = setup(), r = await pair(s), p = s.packet(r)
    await expect(s.service.ingest(p, 'Bearer invalid')).rejects.toMatchObject({ status: 401 })
    await expect(s.service.ingest({ ...p, workerId: 'other' }, `Bearer ${r.token}`)).rejects.toMatchObject({ status: 403 })
  })
  it('persists once, rejects out-of-order readings, and limits transmission rate', async () => {
    const s = setup(), r = await pair(s), p = s.packet(r), auth = `Bearer ${r.token}`
    expect(await s.service.ingest(p, auth)).toMatchObject({ accepted: true })
    await expect(s.service.ingest(p, auth)).rejects.toMatchObject({ status: 429 })
    s.advance()
    expect(await s.service.ingest(p, auth)).toMatchObject({ duplicate: true })
    expect(s.packets).toHaveLength(1)
    s.advance()
    await s.service.ingest({ ...s.packet(r), sequence: 2 }, auth)
    s.advance()
    await expect(s.service.ingest({ ...s.packet(r), sequence: 1 }, auth)).rejects.toMatchObject({ status: 409 })
    s.advance()
    await expect(s.service.ingest({ ...s.packet(r), sequence: 3, timestamp: p.timestamp }, auth)).rejects.toMatchObject({ status: 409 })
  })
  it('creates append-only simulated SOS and marks stale / disconnected separately', async () => {
    const s = setup(), r = await pair(s), p = { ...s.packet(r), sos: true }, auth = `Bearer ${r.token}`
    await s.service.ingest(p, auth)
    expect(s.events[0]).toMatchObject({ simulation: true, message: 'SIMULATED SOS — no responders contacted' })
    expect(connectionStatus(s.registrations[0], Date.parse(p.timestamp) + 11000)).toBe('stale')
    expect(connectionStatus(s.registrations[0], Date.parse(p.timestamp) + 31000)).toBe('disconnected')
    s.advance(); await s.service.ingest({ ...s.packet(r), sequence: 1, connectionStatus: 'disconnected' }, auth)
    expect(connectionStatus(s.registrations[0])).toBe('disconnected')
    expect(connectionStatus(null)).toBe('unavailable')
    expect(s.events).toHaveLength(1)
  })
})
