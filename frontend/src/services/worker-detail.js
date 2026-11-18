export function deviceConnection(device, now = Date.now()) {
  if (['revoked','unpaired'].includes(device?.connectionStatus)) return device.connectionStatus
  if (!device?.lastSeen) return 'unavailable'
  if (device.connectionStatus === 'disconnected') return 'disconnected'
  const age = now - Date.parse(device.lastSeen)
  return age > 30000 ? 'disconnected' : age > 10000 ? 'stale' : 'connected'
}
export function workerDetail(snapshot, id, now = Date.now()) {
  const worker = snapshot?.workers.find(w => w.id === id)
  if (!worker) return null
  const device = snapshot.deviceSessions?.find(d => d.workerId === id)
  const readings = snapshot.readings.filter(r => r.workerId === id)
  return { worker, device, connection: deviceConnection(device, now),
    zone: snapshot.zones.find(z => z.id === worker.zoneId),
    readings, environment: snapshot.readings.filter(r => r.kind === 'environment' && r.zoneId === worker.zoneId),
    alerts: snapshot.alerts.filter(a => a.workerId === id || a.zoneId === worker.zoneId),
    events: [...snapshot.incidents.filter(i => i.workerId === id).flatMap(i => i.timeline), ...(snapshot.deviceEvents ?? []).filter(e => e.workerId === id)].sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp)),
    measurement(metric) {
      // Once paired, never silently fill missing device metrics from fixtures.
      if (device) {
        if (['revoked','unpaired'].includes(device.connectionStatus)) return 'Unavailable'
        const reading = device.metrics.find(r => r.metric === metric)
        return reading ? `${reading.value} ${reading.unit}${deviceConnection(device,now)==='disconnected'?' (last known; disconnected)':device.timestamp && now - Date.parse(device.timestamp) > 10000 ? ' (stale)' : ''}` : 'Unavailable'
      }
      const r = readings.find(r => r.metric === metric)
      return r?.value != null && !['offline', 'unavailable'].includes(r.quality) ? `${r.value} ${r.unit}` : 'Unavailable'
    },
  }
}
