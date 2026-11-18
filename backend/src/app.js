import express from 'express'
import { mountPublicLocationIngestion, mountLocations } from './services/locations.js'
import { mountPublicWorkerApplications, mountWorkerApplicationReview } from './services/worker-applications.js'
import {randomUUID} from 'node:crypto'
import {allowedOrigin,configuredOrigins} from './security/origins.js'
import {mountReporting} from './services/reporting.js'
import {resolve,extname} from 'node:path'
import {mountIncidents} from './services/incidents.js'
import { mountOperations } from './services/operations-api.js'
import { mountManagement } from './services/management.js'
import { AuthService } from './security/auth.js'
import { DeviceService } from './services/devices.js'
import { z } from 'zod'
import { filterSchema, scenarioSchema } from '@dacos/contracts'
import { summary, workerStatus } from './services/telemetry.js'

export function createApp({ service, repository, allowSimulationControl = true, frontendDirectory = null }) {
  const app = express()
  if(process.env.DACOS_TRUST_PROXY){
    if(['true','*'].includes(process.env.DACOS_TRUST_PROXY))throw new Error('Configure explicit trusted proxy addresses, never all proxies')
    app.set('trust proxy',/^[1-3]$/.test(process.env.DACOS_TRUST_PROXY)?Number(process.env.DACOS_TRUST_PROXY):process.env.DACOS_TRUST_PROXY.split(',').map(value=>value.trim()))
  }
  const origins=configuredOrigins()
  app.use((req,res,next)=>{
    req.requestId=randomUUID();res.set('X-Request-ID',req.requestId)
    const origin=req.get('origin')
    if(origin){
      if(!allowedOrigin(origin,req.get('host'),origins))return res.status(403).json({error:'Origin not allowed'})
      res.set({'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Credentials':'true','Access-Control-Allow-Methods':'GET,POST,PATCH,HEAD,OPTIONS','Access-Control-Allow-Headers':'Content-Type,X-CSRF-Token,Authorization'})
      res.vary('Origin')
      if(req.method==='OPTIONS')return res.sendStatus(204)
    }
    if(process.env.NODE_ENV==='production'&&origin&&!req.secure&&!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(req.get('host')??''))return res.status(400).json({error:'HTTPS through a trusted proxy is required'})
    next()
  })
  const devices = new DeviceService(repository, service)
  const pairingAdminAllowed=req=>(req.get('x-dacos-client-local')!=='false'&&/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(req.get('host')??''))||(process.env.NODE_ENV==='production'&&req.secure&&origins.includes(req.get('origin')))

  const secureDeviceRequest = (req, res, next) => {
    const origin = req.get('origin')
    const host = req.get('host')
    const local = /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host ?? '')
    // Same origin browser clients only. HTTPS is terminated by a trusted local proxy.
    if (origin && !allowedOrigin(origin,host,origins)) return res.status(403).json({ error: 'Use same-origin HTTPS or localhost' })
    if (!local && !origin?.startsWith('https://')) return res.status(403).json({ error: 'Secure connection required' })
    next()
  }
  app.disable('x-powered-by')
  app.use((_req,res,next)=>{
    res.set({'X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin','X-Frame-Options':'DENY'})
    if(process.env.NODE_ENV==='production')res.set('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https: data:; font-src 'self'; connect-src 'self' wss:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'")
    next()
  })
  app.use(express.json({ limit: '16kb' }))
  app.use('/api', (_req, res, next) => { res.set('Cache-Control', 'no-store'); next() })
  const auth = new AuthService(repository.db)
  app.locals.auth = auth
  auth.mount(app)
  mountPublicWorkerApplications(app, {auth,repository})
  app.post('/api/device-pairing', auth.middleware, auth.roles('ADMIN', 'SUPERVISOR'), auth.csrf, secureDeviceRequest, async (req, res, next) => {
    if (!pairingAdminAllowed(req)) return res.status(403).json({ error: 'Create pairing from the laptop localhost page' })
    try { await auth.audit('device.pairing_issued', req.auth.userId); res.json(devices.issuePairing(req.auth.userId)) } catch (e) { next(e) }
  })
  app.post('/api/devices/:id/revoke', auth.middleware, auth.roles('ADMIN', 'SUPERVISOR'), auth.csrf, secureDeviceRequest, async (req, res, next) => {
    try {
      if (!pairingAdminAllowed(req)) return res.status(403).json({ error: 'Revoke from laptop localhost' })
      await repository.revokeDevice(z.string().uuid().parse(req.params.id), req.auth.userId)
      await service.refreshDevices()
      res.json({ revoked: true })
    } catch (error) { next(error) }
  })
  app.post('/api/devices/register' , secureDeviceRequest, async (req, res, next) => {
    try {
      const input = z.object({ code: z.string().regex(/^[a-f0-9]{32}$/), workerId: z.string().max(50), transport: z.enum(['wifi', 'ble-gateway']), source: z.enum(['simulator', 'hardware']) }).strict().parse(req.body)
      res.status(201).json(await devices.register(input))
    } catch (error) { next(error) }
  })
  app.post('/api/device-telemetry', secureDeviceRequest, async (req, res, next) => {
    try { res.json(await devices.ingest(req.body, req.get('authorization'))) } catch (error) { next(error) }
  })
  app.get('/api/health', async (_req, res, next) => {
    try { await repository.health(); res.json({ status: service.lastError ? 'degraded' : 'ok', database: 'connected', mode:service.adapter.mode ?? 'demo', simulation:service.current?.simulation ?? true, source:service.current?.source ?? 'unavailable' }) }
    catch (error) { next(Object.assign(error, { status: 503 })) }
  })
  app.get('/api/live',(_req,res)=>res.json({status:'ok'}))
  app.get('/api/ready',async(_req,res)=>{try{await repository.health();service.snapshot();res.json({status:'ready'})}catch{res.status(503).json({status:'not-ready'})}})
  mountPublicLocationIngestion(app,{repository,service,secureDeviceRequest})
  app.use('/api', auth.middleware, auth.csrf)
  mountLocations(app,{auth,repository,service})
  mountReporting(app,{repository,service})
  mountIncidents(app,{auth,repository,service})
  mountOperations(app, { auth, repository, service })
  mountManagement(app, { auth, repository, service })
  mountWorkerApplicationReview(app, {auth,repository,service})
  app.get('/api/telemetry/snapshot', (_req, res) => res.json(service.snapshot()))
  app.get('/api/dashboard/summary', (_req, res) => res.json(summary(service.snapshot())))
  app.get('/api/workers', (req, res) => {
    const {limit,cursor,...query}=req.query
    const paging=z.object({limit:z.coerce.number().int().min(1).max(100).optional(),cursor:z.string().max(50).optional()}).parse({limit,cursor})
    const filters = filterSchema.parse(query)
    const snapshot = service.snapshot()
    const data = snapshot.workers.map(w => ({ ...w, status: workerStatus(snapshot, w), readings: snapshot.readings.filter(r => r.workerId === w.id) }))
      .filter(w => !filters.q || `${w.id} ${w.name} ${w.role}`.toLowerCase().includes(filters.q.toLowerCase()))
      .filter(w => !filters.zoneId || w.zoneId === filters.zoneId).filter(w => !filters.status || w.status === filters.status)
    const offset=paging.cursor?data.findIndex(w=>w.id===paging.cursor)+1:0
    const rows=paging.limit?data.slice(offset,offset+paging.limit):data
    res.json({data:rows,nextCursor:paging.limit&&offset+paging.limit<data.length?rows.at(-1)?.id:null,source:snapshot.source,simulation:snapshot.simulation,timestamp:snapshot.timestamp})
  })
  app.get('/api/workers/:id', (req, res) => {
    const snapshot = service.snapshot()
    const worker = snapshot.workers.find(w => w.id === req.params.id)
    if (!worker) return res.status(404).json({ error: 'Worker not found' })
    res.json({ ...worker, status: workerStatus(snapshot, worker), readings: snapshot.readings.filter(r => r.workerId === worker.id), simulation: !snapshot.readings.some(r => r.workerId === worker.id && !r.simulation), devices: snapshot.deviceSessions?.filter(d => d.workerId === worker.id) ?? [], events: snapshot.deviceEvents?.filter(e => e.workerId === worker.id) ?? [] })
  })
  for (const [path, key] of [['zones', 'zones'], ['devices', 'devices'], ['alerts', 'alerts'], ['incidents', 'incidents']]) {
    app.get(`/api/${path}`, (_req, res) => { const snapshot = service.snapshot(); res.json({ data: snapshot[key], timestamp: snapshot.timestamp, simulation: snapshot.simulation, source: snapshot.source }) })
  }
  for (const [path, kind] of [['health', 'health'], ['environmental', 'environment']]) {
    app.get(`/api/readings/${path}`, (req, res) => {
      const { zoneId } = z.object({ zoneId: z.string().max(50).optional() }).strict().parse(req.query)
      const snapshot = service.snapshot()
      res.json({ data: snapshot.readings.filter(r => r.kind === kind && (!zoneId || r.zoneId === zoneId)), timestamp: snapshot.timestamp, simulation: snapshot.simulation, source: snapshot.source })
    })
  }
  app.post('/api/simulation/scenario', auth.roles('ADMIN', 'SUPERVISOR'), async (req, res, next) => {
    try {
      if (!allowSimulationControl) return res.status(403).json({ error: 'Simulation controls disabled' })
      // No cross-origin mutation, credentials, threshold edits, or responder integrations.
      const origin = req.get('origin')
      if (origin && !['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:3001', 'http://127.0.0.1:3001', `http://127.0.0.1:${process.env.FRONTEND_PORT ?? 5173}`, `http://localhost:${process.env.FRONTEND_PORT ?? 5173}`].includes(origin)) return res.status(403).json({ error: 'Origin not allowed' })
      const { scenario } = z.object({ scenario: scenarioSchema }).strict().parse(req.body)
      res.json(await service.update(scenario))
    } catch (error) { next(error) }
  })
  app.use('/api', (_req, res) => res.status(404).json({ error: 'API endpoint not found' }))
  if(frontendDirectory){
    const directory=resolve(frontendDirectory)
    app.use(express.static(directory,{dotfiles:'deny',index:false}))
    app.use((req,res,next)=>req.method==='GET'&&!extname(req.path)&&req.accepts('html')?res.sendFile(resolve(directory,'index.html')):next())
  }
  app.use((error, _req, res, _next) => {
    if (error.code === 'P2002' || error.code === 'P2034') { error.status = 409; error.message = 'Conflicting or duplicate record' }
    if (error.code === 'P2025') { error.status = 404; error.message = 'Record not found' }
    const status = error instanceof z.ZodError || error.type === 'entity.parse.failed' ? 400 : error.status ?? 500
    if(status>=500)console.error(JSON.stringify({event:'request.failed',requestId:_req.requestId,method:_req.method,path:_req.route?.path??'/api',status,code:typeof error.code==='string'?error.code:'INTERNAL'}))
    res.status(status).json({ error: status === 400 ? 'Invalid request' : status === 503 ? 'Telemetry or database unavailable' : status < 500 ? error.message : 'Request failed', ...(error instanceof z.ZodError ? { issues: error.issues } : {}) })
  })
  return app
}
