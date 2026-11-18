import { randomBytes, randomUUID, createHash, timingSafeEqual } from 'node:crypto'
import { devicePacketSchema } from '@dacos/contracts'
const hash = value => createHash('sha256').update(value).digest('hex')
const fail = (status, message) => { throw Object.assign(new Error(message), { status }) }
// Shared by health telemetry and location ingestion; human JWTs cannot authenticate devices.
export function authenticateDeviceRegistration(device, authorization) {
  const tokenHash = hash(authorization?.replace(/^Bearer /, '') ?? '')
  if (!device || !/^[a-f0-9]{64}$/.test(device.tokenHash ?? '') || ['revoked','unpaired'].includes(device.connectionStatus) || !timingSafeEqual(Buffer.from(device.tokenHash), Buffer.from(tokenHash))) fail(401, 'Invalid device authorization')
  return device
}
export function connectionStatus(device, now = Date.now()) {
  if (device?.connectionStatus === 'revoked') return 'revoked'
  if (device?.connectionStatus === 'unpaired') return 'unpaired'
  if (!device?.lastSeen) return 'unavailable'
  if (device.connectionStatus === 'disconnected') return 'disconnected'
  const age = now - Date.parse(device.lastSeen)
  return age > 30000 ? 'disconnected' : age > 10000 ? 'stale' : 'connected'
}
export function measurementQuality(device,now=Date.now()){
 const status=connectionStatus(device,now)
 if(['unavailable','unpaired'].includes(status))return 'unavailable'
 if(['revoked','disconnected'].includes(status))return 'offline'
 if(status==='stale'||now-Date.parse(device.measurementTimestamp??device.timestamp??device.lastSeen)>10000)return 'stale'
 return device.source==='simulator'?'simulated':'live'
}
export class DeviceService {
  constructor(repository, telemetry, clock = () => new Date()) {
    this.repository = repository; this.telemetry = telemetry; this.clock = clock
    this.pairings = new Map(); this.rates = new Map(); this.pending = Promise.resolve()
  }
  issuePairing(actorId = null) {
    const now = this.clock().getTime()
    for (const [code, pairing] of this.pairings) if (pairing.expires < now) this.pairings.delete(code)
    if (this.pairings.size >= 10) fail(429, 'Too many pending pairings')
    const code = randomBytes(16).toString('hex')
    this.pairings.set(code, { expires: now + 120000, actorId })
    return { code, expiresAt: new Date(now + 120000).toISOString() }
  }
  serialize(work) {
    const result = this.pending.catch(() => {}).then(work)
    this.pending = result
    return result
  }
  register({ code, workerId, transport, source }) {
    return this.serialize(async () => {
      if ((this.pairings.get(code)?.expires ?? 0) < this.clock().getTime()) fail(403, 'Pairing expired or invalid')
      if (this.telemetry.snapshot().mode === 'operational' && source !== 'hardware') fail(403,'Only hardware pairing is allowed in operational mode')
      if (!this.telemetry.snapshot().workers.some(w => w.id === workerId)) fail(400, 'Unknown fictional worker')
      const { registrations } = await this.repository.deviceState()
      if (registrations.some(d => d.workerId === workerId && d.connectionStatus !== 'revoked')) fail(409, 'Worker already assigned; use another fictional worker')
      const token = randomBytes(32).toString('hex')
      const data = { id: randomUUID(), workerId, transport, source, tokenHash: hash(token), metrics: [] }
      await this.repository.registerDevice(data, this.pairings.get(code)?.actorId)
      this.pairings.delete(code)
      await this.telemetry.refreshDevices()
      return { deviceId: data.id, workerId, transport, source, token }
    })
  }
  ingest(input, authorization) {
    return this.serialize(async () => {
      const packet = devicePacketSchema.parse(input)
      if (this.telemetry.snapshot().mode === 'operational' && packet.source !== 'hardware') fail(403,'Simulator packets are disabled in operational mode')
      const { registrations } = await this.repository.deviceState()
      const device = registrations.find(d => d.id === packet.deviceId)
      authenticateDeviceRegistration(device, authorization)
      if (['workerId', 'transport', 'source'].some(key => packet[key] !== device[key])) fail(403, 'Registration does not match packet')
      const now = this.clock()
      const bucket = this.rates.get(device.id)
      if (bucket && now.getTime() - bucket < 500) fail(429, 'Send at most two packets per second')
      this.rates.set(device.id, now.getTime())
      if (packet.sequence === device.sequence) return { accepted:false,duplicate:true,deviceId:device.id,sequence:device.sequence,receivedAt:device.lastSeen }
      if (packet.sequence < device.sequence || (device.timestamp && Date.parse(packet.timestamp) < new Date(device.timestamp).getTime())) fail(409, 'Out-of-order reading')
      if (Math.abs(now.getTime() - Date.parse(packet.timestamp)) > 120000) fail(400, 'Reading timestamp must be within two minutes')
      const event = packet.sos ? { id: randomUUID(), deviceId: device.id, workerId: device.workerId, timestamp: new Date(packet.timestamp), receivedAt: now, simulation: true, message: 'SIMULATED SOS — no responders contacted' } : null
      await this.repository.saveDevicePacket(device, packet, now, event)
      await this.telemetry.refreshDevices()
      return { accepted: true, deviceId:packet.deviceId, sequence: packet.sequence, receivedAt: now.toISOString(), simulation: packet.source === 'simulator' }
    })
  }
}
