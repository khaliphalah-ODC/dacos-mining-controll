import { describe, it, expect, vi } from 'vitest'
import { createDeviceSender } from '../src/services/device-client.js'
import { parseHeartRate, parseDemo, BleGateway } from '../src/services/ble-gateway.js'
import { workerDetail, deviceConnection } from '../src/services/worker-detail.js'
import { SimulationAdapter } from '../../backend/src/simulation/adapter.js'
const view = bytes => new DataView(Uint8Array.from(bytes).buffer)
describe('Wi-Fi and worker detail', () => {
  it('sends explicit simulated packets, sequences, stop and SOS', async () => {
    const request = vi.fn().mockResolvedValue({ accepted: true })
    const send = createDeviceSender({ deviceId: 'test', workerId: 'W-014', transport: 'wifi', source: 'simulator', token: 'secret' }, request)
    await send([{ metric: 'heartRate', value: 80, unit: 'bpm' }]); await send([], { sos: true }); await send([], { connectionStatus: 'disconnected' })
    expect(request.mock.calls.map(c => c[1].sequence)).toEqual([0, 1, 2])
    expect(request.mock.calls[1][1]).toMatchObject({ sos: true, source: 'simulator', quality: 'simulated' })
    expect(request.mock.calls[2][1].connectionStatus).toBe('disconnected')
  })
  it('uses any valid worker, reports missing readings, and preserves external provenance', () => {
    const snapshot = new SimulationAdapter().advance()
    expect(workerDetail(snapshot, 'unknown')).toBeNull()
    expect(workerDetail(snapshot, 'WK-884').measurement('fatigue')).toBe('Unavailable')
    snapshot.deviceSessions = [{ id: 'test', workerId: 'W-014', source: 'simulator', metrics: [{ metric: 'heartRate', value: 84, unit: 'bpm' }], lastSeen: snapshot.timestamp, connectionStatus: 'connected' }]
    const detail = workerDetail(snapshot, 'W-014', Date.parse(snapshot.timestamp))
    expect(detail.measurement('heartRate')).toBe('84 bpm')
    expect(detail.measurement('spo2')).toBe('Unavailable')
    expect(detail.connection).toBe('connected')
    expect(detail.environment.length).toBeGreaterThan(0)
    expect(deviceConnection(detail.device, Date.parse(snapshot.timestamp) + 11000)).toBe('stale')
  })
})
describe('documented BLE wire formats and mocked GATT', () => {
  it('decodes 8/16-bit HR and validates truncation and contact', () => {
    expect(parseHeartRate(view([0, 78]))[0].value).toBe(78)
    expect(parseHeartRate(view([1, 240, 0]))[0].value).toBe(240)
    expect(() => parseHeartRate(view([1, 78]))).toThrow()
    expect(() => parseHeartRate(view([8, 78]))).toThrow()
    expect(() => parseHeartRate(view([4, 78]))).toThrow('contact')
  })
  it('decodes demo v1 only and rejects invalid values', () => {
    expect(parseDemo(view([1, 78, 0, 126, 14, 98, 92])).map(m => m.value)).toEqual([78, 37.1, 98, 92])
    expect(() => parseDemo(view([2, 78, 0, 126, 14, 98, 92]))).toThrow()
    expect(() => parseDemo(view([1, 78, 0, 126, 14, 120, 92]))).toThrow()
  })
  it('discovers only approved service, subscribes, cleans up and reconnects', async () => {
    const handlers = {}, characteristic = { properties: { notify: true }, addEventListener: vi.fn((_, fn) => { handlers.read = fn }), removeEventListener: vi.fn(), startNotifications: vi.fn() }
    const service = { getCharacteristic: vi.fn(async () => characteristic) }
    const server = { getPrimaryService: vi.fn(async () => service) }
    const device = { id: 'ble-id', addEventListener: vi.fn((_, fn) => { handlers.disconnect = fn }), removeEventListener: vi.fn(), gatt: { connect: vi.fn(async () => server), disconnect: vi.fn() } }
    const bluetooth = { requestDevice: vi.fn(async () => device) }, onReading = vi.fn(), onStatus = vi.fn()
    const gateway = new BleGateway({ bluetooth, onReading, onStatus, onError: e => { throw e } })
    await gateway.choose()
    expect(bluetooth.requestDevice).toHaveBeenCalledWith({ filters: [{ services: ['heart_rate'] }] })
    await handlers.read({ target: { value: view([0, 81]) } })
    expect(onReading).toHaveBeenCalledWith([{ metric: 'heartRate', value: 81, unit: 'bpm' }])
    handlers.disconnect(); expect(characteristic.removeEventListener).toHaveBeenCalled()
    await gateway.reconnect(); expect(device.gatt.connect).toHaveBeenCalledTimes(2)
    gateway.disconnect(); expect(device.gatt.disconnect).toHaveBeenCalled()
    await expect(new BleGateway({ bluetooth: null }).choose()).rejects.toThrow('unavailable')
  })
})
