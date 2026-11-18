import { randomUUID, randomBytes, createHash } from 'node:crypto'
import { z } from 'zod'
import { connectionStatus } from './devices.js'
const fail = (status, message) => { throw Object.assign(new Error(message), { status }) }
const text = z.string().trim().min(1).max(100)
const workerInput = z.object({ id: z.string().regex(/^[A-Za-z0-9-]{1,50}$/), name: text, role: text, shift: text, zoneId: text }).strict()
const listInput=z.object({q:z.string().max(100).default(''),limit:z.coerce.number().int().min(1).max(100).optional(),cursor:z.string().max(100).optional()}).strict()
const listOptions=p=>({...p.limit?{take:p.limit+1}:{},...p.cursor?{cursor:{id:p.cursor},skip:1}:{}})
const listResult=(rows,p)=>({data:p.limit?rows.slice(0,p.limit):rows,nextCursor:p.limit&&rows.length>p.limit?rows[p.limit-1].id:null})
const deviceInput = z.object({ model: text, serialNumber: text, firmwareVersion: text, transport: z.enum(['wifi','ble-gateway']), source: z.enum(['simulator','hardware']) }).strict()
export const inventoryStatus = d => d.connectionStatus === 'revoked' ? 'revoked' : d.connectionStatus === 'unpaired' ? 'unpaired' : connectionStatus(d)
export const publicDevice = ({ tokenHash, ...d }) => ({ ...d, connectionStatus: inventoryStatus(d), battery: d.metrics.find(m => m.metric === 'battery')?.value ?? null })
export function mountManagement(app, { auth, repository, service }) {
  const db = repository.db
  const guard = [auth.roles('ADMIN','SUPERVISOR')]
  const handle = fn => async (req, res, next) => {
    try { await fn(req, res) } catch (e) {
      if (e.code === 'P2002' || e.code === 'P2034') { e.status = 409; e.message = 'Conflicting assignment or duplicate identifier; refresh and try again' }
      if (e.code === 'P2025') { e.status = 404; e.message = 'Record not found' }
      next(e)
    }
  }
  const transaction = work => db.$transaction(work, { isolationLevel: 'Serializable' })
  app.get('/api/manage/zones', ...guard, handle(async (_req,res) => {
    res.json({data:await db.zone.findMany({orderBy:{id:'asc'}})})
  }))
  app.post('/api/manage/zones', ...guard, handle(async (req,res) => {
    const data=z.object({id:text,name:text,depth:z.number().finite(),geometry:z.object({x:z.number().finite(),y:z.number().finite()}).strict()}).strict().parse(req.body)
    const zone=await transaction(async tx => { const zone=await tx.zone.create({data:{...data,origin:'registered'}}); await auth.audit('zone.created',req.auth.userId,zone.id,{},tx); return zone })
    await service.update(); res.status(201).json(zone)
  }))
  app.get('/api/manage/workers', ...guard, handle(async (req, res) => {
    const p=listInput.parse(req.query)
    const rows=await db.worker.findMany({where:{OR:['id','name','role'].map(key=>({[key]:{contains:p.q,mode:'insensitive'}}))},orderBy:{id:'asc'},...listOptions(p)})
    res.json(listResult(rows,p))
  }))
  app.post('/api/manage/workers', ...guard, handle(async (req, res) => {
    const data = workerInput.parse(req.body)
    const worker = await transaction(async tx => {
      if (!await tx.zone.findUnique({ where: { id: data.zoneId } })) fail(400, 'Unknown zone')
      const worker = await tx.worker.create({ data:{...data,origin:'registered'} })
      await auth.audit('worker.created', req.auth.userId, data.id, {}, tx)
      return worker
    })
    await service.refreshDevices(); res.status(201).json(worker)
  }))
  app.patch('/api/manage/workers/:id', ...guard, handle(async (req, res) => {
    const data = workerInput.omit({ id: true }).partial().extend({ active: z.boolean().optional() }).strict().parse(req.body)
    const worker = await transaction(async tx => {
      if (data.zoneId && !await tx.zone.findUnique({ where: { id: data.zoneId } })) fail(400, 'Unknown zone')
      if (data.active === false && await tx.deviceRegistration.count({ where: { workerId: req.params.id, connectionStatus: { not: 'revoked' } } })) fail(409, 'Unassign active devices before deactivating this worker')
      const worker = await tx.worker.update({ where: { id: req.params.id }, data })
      await auth.audit('worker.updated', req.auth.userId, worker.id, data, tx)
      return worker
    })
    await service.refreshDevices(); res.json(worker)
  }))
  app.get('/api/manage/devices', ...guard, handle(async (req, res) => {
    const p=listInput.parse(req.query)
    const rows=await db.deviceRegistration.findMany({where:{OR:['id','model','serialNumber','workerId'].map(key=>({[key]:{contains:p.q,mode:'insensitive'}}))},orderBy:{id:'asc'},...listOptions(p)})
    res.json({...listResult(rows,p),data:listResult(rows,p).data.map(publicDevice)})
  }))
  app.post('/api/manage/devices', ...guard, handle(async (req, res) => {
    const data = deviceInput.parse(req.body)
    if (service.snapshot().mode === 'operational' && data.source !== 'hardware') fail(403,'Only hardware registrations are allowed in operational mode')
    const device = await transaction(async tx => {
      const d = await tx.deviceRegistration.create({ data: { ...data, id: randomUUID(), workerId: null, tokenHash: '', metrics: [], connectionStatus: 'unpaired' } })
      await auth.audit('device.inventory_created', req.auth.userId, d.id, data, tx)
      return d
    })
    res.status(201).json(publicDevice(device))
  }))
  app.patch('/api/manage/devices/:id', ...guard, handle(async (req, res) => {
    const data = deviceInput.pick({ model:true, serialNumber:true, firmwareVersion:true }).partial().strict().parse(req.body)
    const device = await transaction(async tx => { const d = await tx.deviceRegistration.update({ where: { id: req.params.id }, data }); await auth.audit('device.updated', req.auth.userId, d.id, data, tx); return d })
    res.json(publicDevice(device))
  }))
  app.get('/api/manage/devices/:id/assignments', ...guard, handle(async (req, res) => res.json({ data: await db.deviceAssignment.findMany({ where: { deviceId: req.params.id }, orderBy: { assignedAt:'desc' } }) })))
  app.post('/api/manage/devices/:id/assignment', ...guard, handle(async (req, res) => {
    const { workerId } = z.object({ workerId: text.nullable() }).strict().parse(req.body)
    await transaction(async tx => {
      const device = await tx.deviceRegistration.findUnique({ where: { id: req.params.id } })
      if (!device) fail(404, 'Device not found')
      if (workerId && !await tx.worker.findFirst({ where: { id: workerId, active: true } })) fail(400, 'Worker is unavailable')
      if (workerId && device.connectionStatus === 'revoked') fail(409, 'Reprovision revoked device first')
      if (workerId && await tx.deviceRegistration.findFirst({ where: { workerId, id: { not: device.id }, connectionStatus: { not: 'revoked' } } })) fail(409, 'Worker already has an active device')
      await tx.deviceAssignment.updateMany({ where: { deviceId: device.id, endedAt: null }, data: { endedAt: new Date() } })
      await tx.deviceRegistration.update({ where: { id: device.id }, data: { workerId, metrics: [], lastSeen: null, measurementTimestamp: null, connectionStatus: device.tokenHash && device.connectionStatus !== 'revoked' ? 'disconnected' : device.connectionStatus } })
      if (workerId) await tx.deviceAssignment.create({ data: { id: randomUUID(), deviceId: device.id, workerId, actorId: req.auth.userId } })
      await auth.audit(workerId ? 'device.assigned' : 'device.unassigned', req.auth.userId, device.id, { workerId }, tx)
    })
    await service.refreshDevices(); res.json({ updated: true })
  }))
  for (const action of ['revoke','rotate','reprovision']) app.post(`/api/manage/devices/:id/${action}`, ...guard, handle(async (req, res) => {
    const token = randomBytes(32).toString('hex')
    const device = await transaction(async tx => {
      const d = await tx.deviceRegistration.findUnique({ where: { id: req.params.id } })
      if (!d) fail(404, 'Device not found')
      if (action === 'rotate' && ['revoked','unpaired'].includes(d.connectionStatus)) fail(409, 'Device must be provisioned before rotation')
      const tokenHash = action === 'revoke' ? '' : createHash('sha256').update(token).digest('hex')
      const updated = await tx.deviceRegistration.update({ where: { id:d.id }, data: { tokenHash, connectionStatus: action === 'revoke' ? 'revoked' : 'disconnected', metrics: [], lastSeen: null, measurementTimestamp: null } })
      await auth.audit(`device.${action}`, req.auth.userId, d.id, {}, tx)
      return updated
    })
    await service.refreshDevices()
    // Sequence is retained so old history identifiers cannot collide after rotation.
    res.json({ device: publicDevice(device), ...(action === 'revoke' ? {} : { token, nextSequence: device.sequence + 1, nextLocationSequence: device.locationSequence + 1 }) })
  }))
}
