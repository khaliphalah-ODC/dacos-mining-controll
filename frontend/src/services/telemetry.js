import { snapshotSchema } from '@dacos/contracts'
export function validateSnapshot(input) { return snapshotSchema.safeParse(input) }
export function qualityFor(reading, { connected, now = Date.now(), lastReceived, maxAge = 6500 }) {
  if (!connected) return 'offline'
  if (!reading || reading.value === null) return 'unavailable'
  if (['offline', 'unavailable'].includes(reading.quality)) return reading.quality
  if (now - lastReceived > maxAge || now - Date.parse(reading.timestamp) > maxAge || reading.quality === 'stale') return 'stale'
  return reading.quality
}
// Old packets and previous server sessions cannot rewind the UI.
export function createSnapshotGate() {
  let stream = null
  let sequence = -1
  const retired = new Set()
  return input => {
    const parsed = validateSnapshot(input)
    if (!parsed.success) return null
    const snapshot = parsed.data
    if (retired.has(snapshot.streamId)) return null
    if (snapshot.streamId !== stream) {
      if (stream) retired.add(stream)
      stream = snapshot.streamId
      sequence = -1
    }
    if (snapshot.sequence <= sequence) return null
    sequence = snapshot.sequence
    return snapshot
  }
}
