// Only these documented wire formats are decoded. Unknown vendor data is ignored.
export const DEMO_SERVICE = '7a1d0001-6e5a-4c21-9b7d-5d41434f5300'
export const DEMO_CHARACTERISTIC = '7a1d0002-6e5a-4c21-9b7d-5d41434f5300'
export function parseHeartRate(view) {
  if (view.byteLength < 2) throw new Error('Truncated heart-rate measurement')
  const flags = view.getUint8(0), wide = flags & 1
  const size = wide ? 3 : 2
  const extra = flags & 8 ? 2 : 0
  if (view.byteLength < size + extra || ((flags & 16) && (view.byteLength < size + extra + 2 || (view.byteLength - size - extra) % 2))) throw new Error('Truncated optional heart-rate fields')
  if ((flags & 4) && !(flags & 2)) throw new Error('Heart-rate sensor has no skin contact')
  const value = wide ? view.getUint16(1, true) : view.getUint8(1)
  if (value > 250) throw new Error('Heart rate outside supported range')
  return [{ metric: 'heartRate', value, unit: 'bpm' }]
}
// Demo v1: version u8, HR u16 LE, temperature centi-degrees i16 LE, SpO2 u8, battery u8.
export function parseDemo(view) {
  if (view.byteLength !== 7 || view.getUint8(0) !== 1) throw new Error('Expected DACOS demo v1, 7 bytes')
  const metrics = [
    { metric: 'heartRate', value: view.getUint16(1, true), unit: 'bpm' },
    { metric: 'temperature', value: view.getInt16(3, true) / 100, unit: '°C' },
    { metric: 'spo2', value: view.getUint8(5), unit: '%' },
    { metric: 'battery', value: view.getUint8(6), unit: '%' },
  ]
  if (metrics[0].value > 250 || metrics[1].value < 20 || metrics[1].value > 50 || metrics[2].value > 100 || metrics[3].value > 100) throw new Error('Invalid DACOS demo measurement')
  return metrics
}
export class BleGateway {
  constructor({ bluetooth, secure = true, onReading, onStatus, onError, clock = () => Date.now() }) {
    Object.assign(this, { bluetooth, secure, onReading, onStatus, onError, clock })
    this.device = null; this.characteristic = null; this.generation = 0; this.lastRelay = -Infinity
    this.disconnected = () => { this.generation++; this.cleanup(); this.onStatus({ connected: false, deviceId: this.device?.id, lastSeen: this.lastSeen }) }
  }
  async choose({ demo = false, service = DEMO_SERVICE, characteristic = DEMO_CHARACTERISTIC } = {}) {
    if (!this.secure || !this.bluetooth) throw new Error('Web Bluetooth unavailable. Use a supported secure browser or a native BLE gateway.')
    this.disconnect()
    const serviceId = demo ? service.toLowerCase() : 'heart_rate'
    const characteristicId = demo ? characteristic.toLowerCase() : 'heart_rate_measurement'
    // User gesture invokes the browser chooser; no background or unapproved scanning.
    this.lastSeen = null; this.lastRelay = -Infinity
    this.device = await this.bluetooth.requestDevice({ filters: [{ services: [serviceId] }] })
    this.device.addEventListener('gattserverdisconnected', this.disconnected)
    this.options = { serviceId, characteristicId, demo }
    await this.connect()
  }
  async connect() {
    if (!this.device) throw new Error('Choose a peripheral first')
    this.cleanup()
    const generation = ++this.generation
    try {
      const server = await this.device.gatt.connect()
      const service = await server.getPrimaryService(this.options.serviceId)
      const characteristic = await service.getCharacteristic(this.options.characteristicId)
      if (generation !== this.generation) { this.device.gatt.disconnect(); return }
      this.characteristic = characteristic
      this.listener = event => this.consume(event.target.value, generation)
      characteristic.addEventListener('characteristicvaluechanged', this.listener)
      if (characteristic.properties.notify || characteristic.properties.indicate) await characteristic.startNotifications()
      else if (!characteristic.properties.read) throw new Error('Characteristic supports neither read nor notifications')
      if (characteristic.properties.read) await this.consume(await characteristic.readValue(), generation)
      if (generation === this.generation) this.onStatus({ connected: true, deviceId: this.device.id, lastSeen: this.lastSeen })
    } catch (error) { this.disconnect(); throw error }
  }
  async consume(view, generation) {
    if (generation !== this.generation) return
    try {
      const metrics = this.options.demo ? parseDemo(view) : parseHeartRate(view)
      this.lastSeen = new Date(this.clock()).toISOString()
      this.onStatus({ connected: true, deviceId: this.device.id, lastSeen: this.lastSeen })
      // Coalesce fast peripherals instead of accumulating a queue of stale readings.
      if (this.clock() - this.lastRelay < 1000) return
      this.lastRelay = this.clock()
      await this.onReading(metrics)
    } catch (error) { this.onError(error) }
  }
  cleanup() {
    if (this.characteristic && this.listener) this.characteristic.removeEventListener('characteristicvaluechanged', this.listener)
    this.characteristic = null; this.listener = null
  }
  disconnect() {
    this.generation++; this.cleanup()
    if (this.device) {
      this.device.removeEventListener('gattserverdisconnected', this.disconnected)
      this.device.gatt.disconnect()
      this.onStatus({ connected: false, deviceId: this.device.id, lastSeen: this.lastSeen })
    }
  }
  async reconnect() {
    if (!this.device) throw new Error('Choose a peripheral first')
    this.device.removeEventListener('gattserverdisconnected', this.disconnected)
    this.device.addEventListener('gattserverdisconnected', this.disconnected)
    this.lastRelay = -Infinity
    await this.connect()
  }
}
