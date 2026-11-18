import { randomUUID, createHash } from 'node:crypto'
import { Prisma, PrismaClient } from '@prisma/client'
import { snapshotSchema } from '@dacos/contracts'
export function createRepository(url) {
  const db = new PrismaClient({ datasources: { db: { url } } })
  const historyInterval=Number(process.env.DEMO_HISTORY_INTERVAL_MS??60000)
  if(!Number.isFinite(historyInterval)||historyInterval<10000)throw new Error('DEMO_HISTORY_INTERVAL_MS must be at least 10000')
  let lastHistoryAt=0
  return {
    db,
    async health() { await db.$queryRaw`SELECT 1`; return true },
    async save(input) {
      const snapshot = snapshotSchema.parse(input)
      const historyDue=Date.now()-lastHistoryAt>=historyInterval
      await db.$transaction(async tx => {
        for (const zone of snapshot.zones) await tx.zone.upsert({ where: { id: zone.id }, create: zone, update: {} })
        for (const worker of snapshot.workers) await tx.worker.upsert({ where: { id: worker.id }, create: worker, update: {} })
        for (const device of snapshot.devices) await tx.device.upsert({ where: { id: device.id }, create: device, update: device })
        for (const reading of snapshot.readings) {
          const data = { ...reading, timestamp: new Date(reading.timestamp), value: reading.value === null ? Prisma.JsonNull : reading.value }
          await tx.reading.upsert({ where: { id: data.id }, create: data, update: data })
        }
        if(historyDue&&snapshot.readings.length)await tx.readingHistory.createMany({skipDuplicates:true,data:snapshot.readings.filter(r=>!['offline','stale'].includes(r.quality)).map(r=>({id:createHash('sha256').update(`${snapshot.streamId}:${r.id}:${r.timestamp}`).digest('hex'),workerId:r.workerId,deviceId:r.deviceId,zoneId:r.zoneId,kind:r.kind,metric:r.metric,value:r.value===null?Prisma.JsonNull:r.value,unit:r.unit,timestamp:new Date(r.timestamp),source:r.source,simulation:r.simulation,quality:r.quality,sequence:r.sequence}))})
        // This milestone stores bounded current demo state, not an unbounded health history.
        // Incident history survives scenario changes.
        await tx.alert.deleteMany()
        if (snapshot.alerts.length) await tx.alert.createMany({ data: snapshot.alerts.map(a => ({ ...a, timestamp: new Date(a.timestamp) })) })
        if (snapshot.incidents.length) await tx.incident.createMany({ data: snapshot.incidents.map(i => ({ ...i, timestamp: new Date(i.timestamp) })), skipDuplicates: true })
      }, { timeout: 20000 })
      if(historyDue)lastHistoryAt=Date.now()
    },
    async deviceState() {
      const [registrations, events, workers, operationalIncidents] = await Promise.all([db.deviceRegistration.findMany({ orderBy: { createdAt: 'asc' } }), db.incidentEvent.findMany({take:250,orderBy:{receivedAt:'desc'}}), db.worker.findMany({where:{active:true}}), db.operationalIncident.findMany({where:{lifecycleStatus:{notIn:['RESOLVED','CLOSED']}},take:250,orderBy:{createdAt:'desc'},include:{events:{orderBy:{createdAt:'asc'}}}})])
      return { registrations, events, workers, operationalIncidents }
    },
    async registerDevice(data, actorId = null) { return db.$transaction(async tx => {
      const device = await tx.deviceRegistration.create({ data })
      await tx.deviceAssignment.create({ data: { id: randomUUID(), deviceId: device.id, workerId: device.workerId, actorId: actorId ?? 'pairing' } })
      await tx.auditEvent.create({ data: { id: randomUUID(), actorId, action: 'device.paired', targetId: device.id, details: { workerId: device.workerId, source: device.source } } })
      return device
    }) },
    async revokeDevice(id, actorId = null) { await db.$transaction(async tx => {
      await tx.deviceRegistration.update({ where: { id }, data: { connectionStatus: 'revoked', tokenHash: '' } })
      await tx.auditEvent.create({ data: { id: randomUUID(), actorId, action: 'device.revoke', targetId: id, details: {} } })
    }) },
    async saveDevicePacket(registration, packet, receivedAt, event) {
      return db.$transaction(async tx => {
        const result = await tx.deviceRegistration.updateMany({ where: { id: registration.id, sequence: registration.sequence, tokenHash: registration.tokenHash, workerId: registration.workerId, connectionStatus: { notIn: ['revoked','unpaired'] } }, data: {
          sequence: packet.sequence, timestamp: new Date(packet.timestamp), lastSeen: receivedAt,
          ...(packet.metrics.length ? { measurementTimestamp: new Date(packet.timestamp) } : {}),
          connectionStatus: packet.connectionStatus, metrics: packet.metrics.length ? packet.metrics : registration.metrics,
        } })
        if (!result.count) throw Object.assign(new Error('Concurrent packet; retry with a newer sequence'), { status: 409 })
        await tx.deviceTelemetry.create({ data: { id: `${packet.deviceId}:${packet.sequence}`, deviceId: packet.deviceId, sequence: packet.sequence, timestamp: new Date(packet.timestamp), receivedAt, packet } })
        const worker=await tx.worker.findUnique({where:{id:packet.workerId}})
        if(packet.metrics.length)await tx.readingHistory.createMany({data:packet.metrics.map(m=>({id:`${packet.deviceId}:${packet.sequence}:${m.metric}`,workerId:packet.workerId,deviceId:packet.deviceId,zoneId:worker?.zoneId??'',kind:m.metric==='battery'?'device':'health',metric:m.metric,value:m.value,unit:m.unit,timestamp:new Date(packet.timestamp),receivedAt,source:packet.source,simulation:packet.source==='simulator',quality:packet.quality,sequence:packet.sequence}))})
        if (packet.source === 'hardware') {
          const rules=await tx.alertRule.findMany({where:{enabled:true}})
          for (const rule of rules) {
            const metric=packet.metrics.find(m=>m.metric===rule.metric)
            if (!metric || !(rule.comparator==='gte' ? metric.value>=rule.threshold : metric.value<=rule.threshold)) continue
            if (await tx.operationalIncident.findFirst({where:{ruleId:rule.id,deviceId:packet.deviceId,lifecycleStatus:{notIn:['RESOLVED','CLOSED']}}})) continue
            const message=`Hardware rule ${rule.metric} ${rule.comparator} ${rule.threshold}: received ${metric.value} ${metric.unit}`
            const incident=await tx.operationalIncident.create({data:{id:randomUUID(),ruleId:rule.id,deviceId:packet.deviceId,workerId:packet.workerId,severity:rule.severity,severityLevel:rule.severity==='critical'?'CRITICAL':'MEDIUM',kind:'HARDWARE_RULE',message,simulation:false,events:{create:{id:randomUUID(),actorId:'rule-engine',action:'created',note:message,toStatus:'OPEN'}}}})
            await tx.auditEvent.create({data:{id:randomUUID(),action:'incident.hardware_rule_created',targetId:incident.id,details:{ruleId:rule.id,deviceId:packet.deviceId,simulation:false}}})
          }
        }
        if (event) {
          const sosEventId=packet.eventId?`${packet.deviceId}:${packet.eventId}`:null
          const receipt=sosEventId?await tx.simulatedSosAction.findUnique({where:{id:sosEventId}}):null
          const existing=receipt??await tx.operationalIncident.findFirst({where:{OR:[...(sosEventId?[{sosEventId}]:[]),{deviceId:packet.deviceId,kind:'SIMULATED_SOS',lifecycleStatus:{notIn:['RESOLVED','CLOSED']}}]}})
          if(!existing){
            await tx.incidentEvent.create({data:event})
            await tx.operationalIncident.create({data:{id:event.id,sosEventId,dedupKey:`sos:${packet.deviceId}`,deviceId:event.deviceId,workerId:event.workerId,severity:'critical',severityLevel:'CRITICAL',kind:'SIMULATED_SOS',message:event.message,simulation:true,events:{create:{id:randomUUID(),actorId:'device-simulator',action:'created',note:event.message,toStatus:'OPEN'}}}})
            await tx.auditEvent.create({data:{id:randomUUID(),action:'incident.simulated_sos_created',targetId:event.id,details:{deviceId:packet.deviceId,simulation:true}}})
            if(sosEventId)await tx.simulatedSosAction.create({data:{id:sosEventId,incidentId:event.id}})
          } else if(sosEventId&&!receipt){
            await tx.simulatedSosAction.create({data:{id:sosEventId,incidentId:existing.id}})
          }
        }
      })
    },
    async close() { await db.$disconnect() },
  }
}
