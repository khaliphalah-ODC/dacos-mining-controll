import { beforeAll, afterAll, describe, it, expect } from 'vitest'
import request from 'supertest'
import { createServer } from 'node:http'
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { io as connect } from 'socket.io-client'
import { startDatabase } from '../scripts/database.mjs'
import { createRepository } from '../src/repositories/postgres.js'
import { SimulationAdapter } from '../src/simulation/adapter.js'
import { TelemetryService } from '../src/services/telemetry.js'
import { createApp } from '../src/app.js'
import { attachRealtime } from '../src/realtime/index.js'
let database, repository, service, app, server, realtime, cookie, csrf
let http
const sockets = []
beforeAll(async () => {
  // Dedicated test cluster: never reset the developer's database.
  database = await startDatabase({ directory: '.data/test-postgres', port: 55433, database: 'dacos_test' })
  const result = spawnSync(process.execPath, [resolve('node_modules/prisma/build/index.js'), 'migrate', 'deploy', '--schema', 'backend/prisma/schema.prisma'], { env: { ...process.env, DATABASE_URL: database.url }, encoding: 'utf8' })
  if (result.status !== 0) throw new Error(result.stderr || result.stdout)
  repository = createRepository(database.url)
  await repository.db.loginThrottle.deleteMany()
  // Only device test data in this dedicated cluster; production history is untouched.
  await repository.db.deviceTelemetry.deleteMany()
  await repository.db.incidentEvent.deleteMany()
  await repository.db.deviceAssignment.deleteMany()
  await repository.db.deviceRegistration.deleteMany()
  await repository.db.worker.deleteMany({where:{id:{startsWith:'PAGE-'}}})
  service = new TelemetryService({ adapter: new SimulationAdapter({ seed: 12 }), repository })
  await service.update()
  app = createApp({ service, repository })
  const email = `regression-${Date.now()}@example.test`
  await app.locals.auth.createUser({ email, password: 'Regression-test-password-2026', name: 'Regression admin', role: 'ADMIN' })
  const signedIn = await request(app).post('/api/auth/login').set('Host', 'localhost:5173').set('Origin', 'http://localhost:5173').send({ email, password: 'Regression-test-password-2026' })
  cookie = signedIn.headers['set-cookie'][0].split(';')[0]; csrf = signedIn.body.csrfToken
  http = { get: path => request(app).get(path).set('Cookie', cookie), post: path => request(app).post(path).set('Cookie', cookie).set('x-csrf-token', csrf) }
  server = createServer(app)
  realtime = attachRealtime(server, service, app.locals.auth)
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
})
afterAll(async () => {
  sockets.forEach(socket => socket.disconnect())
  await service?.stop()
  await realtime?.close()
  await repository?.close()
  await database?.stop()
})
describe('PostgreSQL API and Socket.IO integration', () => {
  it('persists seeded entities and current readings in actual PostgreSQL', async () => {
    expect(await repository.db.worker.count({ where: { id: { in: ['WK-884','WK-302','WK-119','WK-512','WK-741','WK-228','WK-905','WK-417','W-014'] } } })).toBe(9)
    expect(await repository.db.zone.count()).toBe(4)
    expect(await repository.db.device.count()).toBe(13)
    expect(await repository.db.reading.count()).toBe(111)
    expect((await http.get('/api/health')).body.database).toBe('connected')
  })
  it('serves summary, filters, details, and reading endpoints', async () => {
    expect((await http.get('/api/dashboard/summary')).body.registered).toBe(9)
    const workers = await http.get('/api/workers?q=Marcus&zoneId=L3&status=critical')
    expect(workers.body.data.map(w => w.id)).toEqual(['WK-884'])
    expect((await http.get('/api/workers/WK-884')).body.readings).toHaveLength(7)
    await http.get('/api/workers/unknown').expect(404)
    await http.get('/api/workers?status=unsafe').expect(400)
    await http.get('/api/readings/environmental?zoneId=L3').expect(200)
    for (const path of ['zones', 'devices', 'alerts', 'incidents', 'readings/health', 'telemetry/snapshot']) await http.get(`/api/${path}`).expect(200)
    await http.get('/api/no-such-route').expect(404)
  })
  it('validates fixture controls and persists scenario transitions', async () => {
    await http.post('/api/simulation/scenario').send({ scenario: 'real' }).expect(400)
    await http.post('/api/simulation/scenario').send({ scenario: 'normal', threshold: 99 }).expect(400)
    await http.post('/api/simulation/scenario').set('Origin', 'https://untrusted.example').send({ scenario: 'normal' }).expect(403)
    const response = await http.post('/api/simulation/scenario').send({ scenario: 'warning' }).expect(200)
    expect(response.body.alerts[0].severity).toBe('warning')
    expect((await repository.db.alert.findMany())[0].severity).toBe('warning')
    const offline = await http.post('/api/simulation/scenario').send({ scenario: 'disconnected' }).expect(200)
    expect(offline.body.readings.every(r => r.quality === 'offline')).toBe(true)
    expect((await repository.db.reading.findFirst()).quality).toBe('offline')
  })
  it('sends authoritative snapshots on first connection and reconnect; emits timestamped reading events', async () => {
    const url = `http://127.0.0.1:${server.address().port}`
    const client = connect(url, { transports: ['websocket'], autoConnect: false, extraHeaders: { Cookie: cookie } })
    sockets.push(client)
    const nextEvent = event => new Promise(resolve => client.once(event, resolve))
    const first = nextEvent('telemetry:snapshot'); client.connect()
    expect((await first).simulation).toBe(true)
    const next = nextEvent('telemetry:snapshot'), reading = nextEvent('health:reading')
    await service.update('normal')
    const payload = await next
    expect(payload.sequence).toBe(service.current.sequence)
    expect(await reading).toMatchObject({ source: 'dacos-simulator', simulation: true, quality: 'simulated' })
    client.disconnect()
    await service.update('critical')
    const reconnected = nextEvent('telemetry:snapshot'); client.connect()
    expect((await reconnected).sequence).toBe(service.current.sequence)
    client.disconnect()
  })
  it('pairs Wi-Fi telemetry, persists SOS across scenarios and restart, and protects device routes', async () => {
    const post = path => http.post(path).set('Host', 'localhost:5173').set('Origin', 'http://localhost:5173')
    await http.post('/api/device-pairing').set('Host', '192.168.1.5:5173').set('Origin', 'http://192.168.1.5:5173').send({}).expect(403)
    await post('/api/device-pairing').set('x-dacos-client-local', 'false').send({}).expect(403)
    const code = (await post('/api/device-pairing').send({}).expect(200)).body.code
    const input = { code, workerId: 'W-014', transport: 'wifi', source: 'simulator' }
    const paired = (await post('/api/devices/register').send(input).expect(201)).body
    await post('/api/devices/register').send(input).expect(403)
    const packet = { deviceId: paired.deviceId, workerId: 'W-014', transport: 'wifi', source: 'simulator', quality: 'simulated', connectionStatus: 'connected', sequence: 0, timestamp: new Date().toISOString(), metrics: [{ metric: 'heartRate', value: 89, unit: 'bpm' }], sos: true }
    await post('/api/device-telemetry').send(packet).expect(401)
    await post('/api/device-telemetry').set('Authorization', `Bearer ${paired.token}`).send({ ...packet, sequence: -1 }).expect(400)
    await post('/api/device-telemetry').set('Authorization', `Bearer ${paired.token}`).send(packet).expect(200)
    expect(await repository.db.deviceTelemetry.count()).toBe(1)
    expect(await repository.db.incidentEvent.count()).toBe(1)
    const detail = (await http.get('/api/workers/W-014').expect(200)).body
    expect(detail.devices[0].metrics[0].value).toBe(89)
    expect(detail.events[0].message).toContain('SIMULATED SOS')
    expect(JSON.stringify(detail)).not.toContain(paired.token)
    expect(JSON.stringify(detail)).not.toContain('tokenHash')
    await service.update('normal')
    expect(service.snapshot().deviceEvents).toHaveLength(1)
    expect(service.snapshot().alerts.some(a => a.type === 'simulated-sos')).toBe(true)
    await new Promise(resolve => setTimeout(resolve, 550))
    await post('/api/device-telemetry').set('Authorization', `Bearer ${paired.token}`).send({ ...packet, sequence: 1, timestamp: new Date().toISOString(), metrics: [], sos: false, connectionStatus: 'disconnected' }).expect(200)
    const stopped = (await http.get('/api/workers/W-014')).body.devices[0]
    expect(stopped.metrics[0].value).toBe(89)
    expect(stopped.timestamp).toBe(packet.timestamp)
    expect(stopped.connectionStatus).toBe('disconnected')
    const restarted = new TelemetryService({ repository, adapter: new SimulationAdapter() })
    await restarted.update()
    expect(restarted.snapshot().deviceSessions[0].sequence).toBe(1)
    expect(restarted.snapshot().deviceEvents).toHaveLength(1)
    await post(`/api/devices/${paired.deviceId}/revoke`).send({}).expect(200)
    await post('/api/device-telemetry').set('Authorization', `Bearer ${paired.token}`).send(packet).expect(401)
    expect(await repository.db.incidentEvent.count()).toBe(1)
    await post('/api/device-telemetry').send({ payload: 'x'.repeat(18000) }).expect(413)
  })

  it('manages workers, inventory, assignments, credentials and hardware provenance', async () => {
    const { randomUUID } = await import('node:crypto')
    const id = `T-${randomUUID()}`
    await http.post('/api/manage/workers').send({ id, name:'Managed worker', role:'Technician', shift:'A', zoneId:'L2' }).expect(201)
    await request(app).patch(`/api/manage/workers/${id}`).set('Cookie',cookie).set('x-csrf-token',csrf).send({ name:'Edited worker' }).expect(200)
    await service.update('normal')
    expect(service.snapshot().workers.find(w => w.id === id).name).toBe('Edited worker')
    const device = (await http.post('/api/manage/devices').send({ model:'ESP32-S3 test', serialNumber:randomUUID(), firmwareVersion:'0.1', transport:'wifi', source:'hardware' }).expect(201)).body
    expect(device.connectionStatus).toBe('unpaired')
    await http.post(`/api/manage/devices/${device.id}/assignment`).send({ workerId:id }).expect(200)
    const other = (await http.post('/api/manage/devices').send({ model:'Other', serialNumber:randomUUID(), firmwareVersion:'0.1', transport:'wifi', source:'hardware' }).expect(201)).body
    await http.post(`/api/manage/devices/${other.id}/assignment`).send({ workerId:id }).expect(409)
    await request(app).patch(`/api/manage/workers/${id}`).set('Cookie',cookie).set('x-csrf-token',csrf).send({ active:false }).expect(409)
    const rule=(await http.post('/api/operations/rules').send({metric:'heartRate',comparator:'gte',threshold:84,severity:'warning'}).expect(201)).body
    expect(rule.enabled).toBe(false)
    await http.post(`/api/operations/rules/${rule.id}/review`).send({enabled:true,note:'Test rule only; not an approved mine threshold'}).expect(200)
    const provisioned = (await http.post(`/api/manage/devices/${device.id}/reprovision`).send({}).expect(200)).body
    const packet = { deviceId:device.id, workerId:id, transport:'wifi', source:'hardware', quality:'live', timestamp:new Date().toISOString(), sequence:provisioned.nextSequence, connectionStatus:'connected', metrics:[{ metric:'heartRate',value:85,unit:'bpm' }], sos:false }
    await http.post('/api/device-telemetry').set('Host','localhost:5173').set('Authorization',`Bearer ${provisioned.token}`).send(packet).expect(200)
    expect(service.snapshot().readings.find(r => r.deviceId === device.id)).toMatchObject({ source:'hardware', simulation:false, value:85 })
    const { snapshotSchema } = await import('@dacos/contracts')
    expect(snapshotSchema.safeParse(service.snapshot()).success).toBe(true)
    expect(service.snapshot()).toMatchObject({ source:'dacos-mixed',simulation:false })
    await service.update('disconnected')
    expect(service.snapshot().readings.find(r => r.deviceId === device.id).quality).toBe('live')
    const rotated = (await http.post(`/api/manage/devices/${device.id}/rotate`).send({}).expect(200)).body
    expect(rotated.token).not.toBe(provisioned.token)
    await http.post('/api/device-telemetry').set('Host','localhost:5173').set('Authorization',`Bearer ${provisioned.token}`).send(packet).expect(401)
    await new Promise(resolve => setTimeout(resolve,550))
    await http.post('/api/device-telemetry').set('Host','localhost:5173').set('Authorization',`Bearer ${rotated.token}`).send({ ...packet, timestamp:new Date().toISOString(), sequence:rotated.nextSequence }).expect(200)
    await http.post(`/api/manage/devices/${device.id}/revoke`).send({}).expect(200)
    await http.post('/api/device-telemetry').set('Host','localhost:5173').set('Authorization',`Bearer ${rotated.token}`).send(packet).expect(401)
    await http.post(`/api/manage/devices/${device.id}/assignment`).send({ workerId:null }).expect(200)
    await request(app).patch(`/api/manage/workers/${id}`).set('Cookie',cookie).set('x-csrf-token',csrf).send({ active:false }).expect(200)
    await service.update()
    expect(service.snapshot().workers.some(w => w.id === id)).toBe(false)
    expect(await repository.db.deviceAssignment.count({ where:{ deviceId:device.id } })).toBe(1)
    expect(await repository.db.deviceTelemetry.count({ where:{ deviceId:device.id } })).toBe(2)
    expect(await repository.db.operationalIncident.count({where:{ruleId:rule.id,deviceId:device.id}})).toBe(1)
    const raised=await repository.db.operationalIncident.findFirst({where:{ruleId:rule.id,deviceId:device.id}})
    expect(await repository.db.auditEvent.count({where:{targetId:raised.id,action:'incident.hardware_rule_created'}})).toBe(1)
    await http.post(`/api/operations/rules/${rule.id}/review`).send({enabled:false,note:'Test complete'}).expect(200)
    expect(JSON.stringify((await http.get('/api/manage/devices')).body)).not.toContain('tokenHash')
  })
  it('records incident actions and paginates retained telemetry history', async()=>{
    const incident=(await http.post('/api/operations/incidents').send({message:'SIMULATED workflow test',severity:'warning',simulation:true,workerId:'W-014'}).expect(201)).body
    await http.post(`/api/operations/incidents/${incident.id}/events`).send({action:'acknowledge',note:'Reviewed test'}).expect(200)
    await http.post(`/api/operations/incidents/${incident.id}/events`).send({action:'assign',note:'Assign test',ownerId:(await app.locals.auth.session(cookie)).userId}).expect(200)
    await http.post(`/api/operations/incidents/${incident.id}/events`).send({action:'start',note:'Response started'}).expect(200)
    await http.post(`/api/operations/incidents/${incident.id}/events`).send({action:'resolve',note:'Test completed'}).expect(200)
    await http.post(`/api/operations/incidents/${incident.id}/events`).send({action:'escalate',note:'Too late'}).expect(409)
    expect(await repository.db.operationalIncidentEvent.count({where:{incidentId:incident.id}})).toBe(5)
    expect((await http.get('/api/operations/status').expect(200)).body.persistence).toBe('ok')
    const page=(await http.get('/api/history/telemetry?limit=1').expect(200)).body
    expect(page.data).toHaveLength(1)
    const next=(await http.get(`/api/history/telemetry?limit=1&cursor=${encodeURIComponent(page.nextCursor)}`).expect(200)).body
    expect(next.data[0].id).not.toBe(page.data[0].id)
    await http.get('/api/history/telemetry?limit=1000').expect(400)
  })
  it('rejects unauthenticated operational requests and Socket.IO clients', async () => {
    await request(app).get('/api/telemetry/snapshot').expect(401)
    await request(app).post('/api/simulation/scenario').send({ scenario: 'normal' }).expect(401)
    const client = connect(`http://127.0.0.1:${server.address().port}`, { transports: ['websocket'], reconnection: false, autoConnect: false })
    sockets.push(client)
    const failure = new Promise(resolve => client.once('connect_error', resolve))
    client.connect()
    expect((await failure).message).toBe('Sign in required')
  })
  it('allows supervisor management and disconnects sockets after logout', async () => {
    const { randomUUID } = await import('node:crypto')
    const email = `supervisor-${randomUUID()}@example.test`, password = 'Supervisor-test-password'
    await app.locals.auth.createUser({ email,password,name:'Supervisor',role:'SUPERVISOR' })
    const login = await request(app).post('/api/auth/login').set('Host','localhost:5173').set('Origin','http://localhost:5173').send({email,password}).expect(200)
    const sessionCookie = login.headers['set-cookie'][0].split(';')[0]
    await request(app).get('/api/manage/workers').set('Cookie',sessionCookie).expect(200)
    await request(app).get('/api/users').set('Cookie',sessionCookie).expect(403)
    const client = connect(`http://127.0.0.1:${server.address().port}`,{transports:['websocket'],autoConnect:false,extraHeaders:{Cookie:sessionCookie}})
    sockets.push(client)
    const connected = new Promise(resolve => client.once('connect',resolve)); client.connect(); await connected
    const disconnected = new Promise(resolve => client.once('disconnect',resolve))
    await request(app).post('/api/auth/logout').set('Cookie',sessionCookie).set('Host','localhost:5173').set('Origin','http://localhost:5173').set('x-csrf-token',login.body.csrfToken).send({}).expect(200)
    expect(await disconnected).toBe('io server disconnect')
    await request(app).get('/api/auth/session').set('Cookie',sessionCookie).expect(401)
  })
  it('upgrades legacy scrypt passwords to bcrypt after successful JWT login',async()=>{
    const {randomUUID,scryptSync}=await import('node:crypto')
    const email=`legacy-${randomUUID()}@example.test`,password='Legacy-test-password-2026'
    const user=await app.locals.auth.createUser({email,password,name:'Legacy',role:'OPERATOR'})
    const hash=`scrypt:legacy-salt:${scryptSync(password,'legacy-salt',64,{N:32768,r:8,p:1,maxmem:64*1024*1024}).toString('hex')}`
    await repository.db.user.update({where:{id:user.id},data:{passwordHash:hash}})
    const login=await request(app).post('/api/auth/login').set('Host','localhost:5173').set('Origin','http://localhost:5173').send({email,password}).expect(200)
    expect((await repository.db.user.findUnique({where:{id:user.id}})).passwordHash).toMatch(/^\$2b\$12\$/)
    const cookie=login.headers['set-cookie'][0].split(';')[0]
    expect(cookie.split('=')[1].split('.')).toHaveLength(3)
    await request(app).get('/api/auth/session').set('Cookie',cookie).expect(200)
  })
  it('authenticates users, validates cookies and CSRF, enforces roles and expires sessions', async () => {
    const auth = app.locals.auth
    const { randomUUID } = await import('node:crypto')
    const email = `admin-${randomUUID()}@example.test`
    const password = 'DACOS-test-password-2026'
    await auth.createUser({ email, password, name: 'Test admin', role: 'ADMIN' })
    const login = () => request(app).post('/api/auth/login').set('Host', 'localhost:5173').set('Origin', 'http://localhost:5173')
    await request(app).get('/api/auth/session').expect(401)
    await login().send({ email, password: 'incorrect' }).expect(401)
    const response = await login().send({ email, password }).expect(200)
    const cookie = response.headers['set-cookie'][0].split(';')[0]
    expect(response.headers['set-cookie'][0]).toContain('HttpOnly')
    expect(response.headers['set-cookie'][0]).toContain('SameSite=Strict')
    expect(JSON.stringify(response.body)).not.toContain('passwordHash')
    const csrf = response.body.csrfToken
    await request(app).get('/api/users').set('Cookie', cookie).expect(200)
    await request(app).post('/api/auth/logout').set('Cookie', cookie).set('Host','localhost:5173').set('Origin','http://localhost:5173').send({}).expect(403)
    const session = await auth.session(cookie)
    expect(session.id).not.toBe(cookie.split('=')[1])
    const operator = await auth.createUser({ email: `operator-${randomUUID()}@example.test`, password, name: 'Operator', role: 'OPERATOR' })
    const opLogin = await login().send({ email: operator.email, password }).expect(200)
    await request(app).get('/api/users').set('Cookie', opLogin.headers['set-cookie'][0].split(';')[0]).expect(403)
    await request(app).get('/api/manage/devices').set('Cookie', opLogin.headers['set-cookie'][0].split(';')[0]).expect(403)
    await request(app).post('/api/auth/password').set('Cookie', cookie).set('Host','localhost:5173').set('Origin','http://localhost:5173').set('x-csrf-token',csrf).send({ currentPassword: password, password: password + '-changed' }).expect(200)
    await request(app).get('/api/auth/session').set('Cookie',cookie).expect(401)
    const updated = await login().send({ email, password: password + '-changed' }).expect(200)
    const newCookie = updated.headers['set-cookie'][0].split(';')[0]
    const current = await auth.session(newCookie)
    await repository.db.session.update({ where: { id: current.id }, data: { expiresAt: new Date(0) } })
    expect(await auth.session(newCookie)).toBeNull()
    expect(await repository.db.auditEvent.count({ where: { actorId: response.body.user.id } })).toBeGreaterThan(2)
  })


  it('enforces the complete incident lifecycle, operator permissions, ownership and concurrent acknowledgements',async()=>{
    const {randomUUID}=await import('node:crypto')
    const user=await app.locals.auth.createUser({email:`responder-${randomUUID()}@example.test`,password:'Responder-test-password',name:'Responder',role:'OPERATOR'})
    const login=await request(app).post('/api/auth/login').set('Host','localhost:5173').set('Origin','http://localhost:5173').send({email:user.email,password:'Responder-test-password'}).expect(200)
    const opCookie=login.headers['set-cookie'][0].split(';')[0]
    const post=path=>request(app).post(path).set('Cookie',opCookie).set('x-csrf-token',login.body.csrfToken)
    const message=`Lifecycle test ${randomUUID()}`
    const created=(await http.post('/api/operations/incidents').send({message,severity:'LOW',simulation:true}).expect(201)).body
    const url=`/api/operations/incidents/${created.id}/events`
    expect(created).toMatchObject({lifecycleStatus:'OPEN',severityLevel:'LOW'})
    await http.post(url).send({action:'resolve',note:'Too early'}).expect(409)
    await request(app).post(url).set('Cookie',opCookie).send({action:'acknowledge',note:'Missing CSRF'}).expect(403)
    await post(url).send({action:'note',note:'   '}).expect(400)
    await post(url).send({action:'assign',ownerId:user.id,note:'Unauthorized'}).expect(403)
    await post('/api/operations/incidents').send({message:'Unauthorized',severity:'HIGH',simulation:true}).expect(403)
    const attempts=await Promise.all([post(url).send({action:'acknowledge',note:'Acknowledged'}),post(url).send({action:'acknowledge',note:'Concurrent duplicate'})])
    expect(attempts.map(r=>r.status).sort()).toEqual([200,409])
    await post(url).send({action:'resolve',note:'Not assigned'}).expect(403)
    const assigned=(await http.post(url).send({action:'assign',note:'Assigned to responder',ownerId:user.id}).expect(200)).body
    expect(assigned.lifecycleStatus).toBe('ASSIGNED')
    await post(url).send({action:'start',note:'Stale client',version:0}).expect(409)
    await post(url).send({action:'start',note:'Response started',version:assigned.version}).expect(200)
    await post(url).send({action:'escalate',note:'Unauthorized'}).expect(403)
    await http.post(url).send({action:'escalate',note:'Demonstration increase'}).expect(200)
    const resolved=(await post(url).send({action:'resolve',note:'Response complete'}).expect(200)).body
    expect(resolved.resolvedAt).toBeTruthy()
    await post(url).send({action:'close',note:'Unauthorized'}).expect(403)
    const closed=(await http.post(url).send({action:'close',note:'Supervisor reviewed'}).expect(200)).body
    expect(closed).toMatchObject({lifecycleStatus:'CLOSED',severityLevel:'MEDIUM',ownerId:user.id})
    expect(closed.closedAt).toBeTruthy()
    await http.post(url).send({action:'note',note:'Cannot alter closed record'}).expect(409)
    const detail=(await http.get(`/api/operations/incidents/${created.id}`).expect(200)).body
    expect(detail.events.filter(e=>e.action==='acknowledge')).toHaveLength(1)
    expect(detail.events.find(e=>e.action==='assign')).toMatchObject({fromStatus:'ACKNOWLEDGED',toStatus:'ASSIGNED',ownerId:user.id})
    const list=(await http.get(`/api/operations/incidents?status=CLOSED&severity=MEDIUM&q=${encodeURIComponent(message)}`).expect(200)).body
    expect(list.data.map(i=>i.id)).toEqual([created.id])
    await http.get('/api/operations/incidents?status=INVALID').expect(400)
    await http.get('/api/operations/incidents/not-found').expect(404)
    expect(await repository.db.auditEvent.count({where:{targetId:created.id}})).toBeGreaterThan(5)
  })
  it('applies configurable demonstration escalation only to eligible simulated incidents and remains idempotent',async()=>{
    const demo=(await http.post('/api/operations/incidents').send({message:'DEMO escalation candidate',severity:'LOW',simulation:true}).expect(201)).body
    const real=(await http.post('/api/operations/incidents').send({message:'Non-simulated report',severity:'LOW',simulation:false}).expect(201)).body
    await repository.db.operationalIncident.updateMany({where:{id:{in:[demo.id,real.id]}},data:{createdAt:new Date(Date.now()-120000)}})
    const rule=(await http.post('/api/operations/escalation-rules').send({name:'Demo time escalation',afterMinutes:1,targetSeverity:'HIGH',enabled:true}).expect(201)).body
    await http.post('/api/operations/incidents-escalate-due').send({}).expect(200)
    await http.post('/api/operations/incidents-escalate-due').send({}).expect(200)
    expect((await http.get(`/api/operations/incidents/${demo.id}`)).body.severityLevel).toBe('HIGH')
    expect((await http.get(`/api/operations/incidents/${real.id}`)).body.severityLevel).toBe('LOW')
    expect(await repository.db.operationalIncidentEvent.count({where:{incidentId:demo.id,escalationRuleId:rule.id}})).toBe(1)
    await request(app).patch(`/api/operations/escalation-rules/${rule.id}`).set('Cookie',cookie).set('x-csrf-token',csrf).send({enabled:false}).expect(200)
  })

  it('deduplicates repeated SOS actions, retains incidents on disconnection and preserves resolved history',async()=>{
    const {randomUUID}=await import('node:crypto')
    const post=path=>http.post(path).set('Host','localhost:5173').set('Origin','http://localhost:5173')
    const code=(await post('/api/device-pairing').send({}).expect(200)).body.code
    const paired=(await post('/api/devices/register').send({code,workerId:'W-014',transport:'wifi',source:'simulator'}).expect(201)).body
    const eventId=randomUUID(),coalescedEventId=randomUUID()
    const packet={deviceId:paired.deviceId,workerId:'W-014',transport:'wifi',source:'simulator',quality:'simulated',connectionStatus:'connected',sequence:0,timestamp:new Date().toISOString(),metrics:[],sos:true,eventId}
    const send=async(sequence,change={})=>{await new Promise(r=>setTimeout(r,550));return post('/api/device-telemetry').set('Authorization',`Bearer ${paired.token}`).send({...packet,sequence,timestamp:new Date().toISOString(),...change}).expect(200)}
    await send(0);await send(1);await send(2,{eventId:coalescedEventId})
    expect(await repository.db.operationalIncident.count({where:{deviceId:paired.deviceId}})).toBe(1)
    expect(await repository.db.incidentEvent.count({where:{deviceId:paired.deviceId}})).toBe(1)
    const incident=await repository.db.operationalIncident.findFirst({where:{deviceId:paired.deviceId}})
    expect(incident).toMatchObject({kind:'SIMULATED_SOS',severityLevel:'CRITICAL',simulation:true})
    await send(3,{connectionStatus:'disconnected',sos:false})
    expect(service.snapshot().alerts.some(a=>a.id===`SOS:${incident.id}`)).toBe(true)
    const owner=(await app.locals.auth.session(cookie)).userId
    for(const [action,extra] of [['acknowledge',{}],['assign',{ownerId:owner}],['start',{}],['resolve',{}],['close',{}]]) await http.post(`/api/operations/incidents/${incident.id}/events`).send({action,note:`Demo ${action}`,...extra}).expect(200)
    expect(service.snapshot().alerts.some(a=>a.id===`SOS:${incident.id}`)).toBe(false)
    await send(4);await send(5,{eventId:coalescedEventId})
    expect(await repository.db.operationalIncident.count({where:{deviceId:paired.deviceId}})).toBe(1)
    await send(6,{eventId:randomUUID()})
    expect(await repository.db.operationalIncident.count({where:{deviceId:paired.deviceId}})).toBe(2)
    await post(`/api/devices/${paired.deviceId}/revoke`).send({}).expect(200)
    expect(await repository.db.incidentEvent.count({where:{deviceId:paired.deviceId}})).toBe(2)
    expect((await http.get(`/api/operations/incidents/${incident.id}`)).body.lifecycleStatus).toBe('CLOSED')
  })

  it('migrates legacy incident history without deleting records or inventing resolution times',async()=>{
    const {mkdtemp,cp,readdir,rm}=await import('node:fs/promises')
    const {tmpdir}=await import('node:os')
    const {randomBytes}=await import('node:crypto')
    const {PrismaClient}=await import('@prisma/client')
    const directory=await mkdtemp(resolve(tmpdir(),'dacos-migration-'))
    const name=`dacos_migration_check_${randomBytes(6).toString('hex')}`
    const url=new URL(database.url);url.pathname=`/${name}`
    let client,created=false
    const deploy=()=>{
      const result=spawnSync(process.execPath,[resolve('node_modules/prisma/build/index.js'),'migrate','deploy','--schema',resolve(directory,'schema.prisma')],{env:{...process.env,DATABASE_URL:url.toString()},encoding:'utf8'})
      if(result.status!==0)throw new Error('Isolated incident migration failed: '+(result.stderr||result.stdout).replaceAll(url.toString(),'[test database]'))
    }
    try{
      await repository.db.$executeRawUnsafe(`CREATE DATABASE "${name}"`);created=true
      await cp(resolve('backend/prisma/schema.prisma'),resolve(directory,'schema.prisma'))
      const migrationNames=await readdir(resolve('backend/prisma/migrations'))
      for(const migration of migrationNames.filter(m=>m==='migration_lock.toml'||m<'202611160006'))await cp(resolve('backend/prisma/migrations',migration),resolve(directory,'migrations',migration),{recursive:true})
      deploy()
      client=new PrismaClient({datasources:{db:{url:url.toString()}}})
      await client.$executeRaw`INSERT INTO "OperationalIncident" ("id","severity","message","simulation","status","createdAt") VALUES ('legacy-resolved','critical','Historical report',true,'resolved','2026-01-01T00:00:00Z')`
      await client.$executeRaw`INSERT INTO "OperationalIncidentEvent" ("id","incidentId","actorId","action","note","createdAt") VALUES ('legacy-resolution','legacy-resolved','legacy-user','resolve','Known resolution time','2026-01-02T00:00:00Z')`
      await client.$executeRaw`INSERT INTO "IncidentEvent" ("id","deviceId","workerId","timestamp","receivedAt","message","simulation") VALUES ('legacy-sos','legacy-device','legacy-worker','2026-01-03T00:00:00Z','2026-01-03T00:00:01Z','SIMULATED historical SOS',true)`
      for(const migration of migrationNames.filter(m=>m!=='migration_lock.toml'&&m>='202611160006'))await cp(resolve('backend/prisma/migrations',migration),resolve(directory,'migrations',migration),{recursive:true})
      deploy()
      const resolved=await client.operationalIncident.findUnique({where:{id:'legacy-resolved'}})
      expect(resolved.lifecycleStatus).toBe('RESOLVED')
      expect(resolved.resolvedAt.toISOString()).toBe('2026-01-02T00:00:00.000Z')
      expect(await client.incidentEvent.count()).toBe(1)
      expect(await client.operationalIncidentEvent.count({where:{incidentId:'legacy-resolved'}})).toBe(1)
      expect(await client.operationalIncident.findUnique({where:{id:'legacy-sos'}})).toMatchObject({kind:'SIMULATED_SOS',simulation:true,lifecycleStatus:'OPEN'})
    }finally{
      await client?.$disconnect()
      if(created)await repository.db.$executeRawUnsafe(`DROP DATABASE "${name}"`)
      await rm(directory,{recursive:true,force:true})
    }
  })

  it('broadcasts compact incident changes to authenticated sockets including resolved and closed updates',async()=>{
    const client=connect(`http://127.0.0.1:${server.address().port}`,{transports:['websocket'],autoConnect:false,extraHeaders:{Cookie:cookie}})
    sockets.push(client)
    const ready=new Promise(resolve=>client.once('connect',resolve));client.connect();await ready
    const next=()=>new Promise(resolve=>client.once('incident:changed',resolve))
    const changed=next()
    const created=(await http.post('/api/operations/incidents').send({message:'SIMULATED realtime lifecycle',severity:'LOW',simulation:true}).expect(201)).body
    expect(await changed).toMatchObject({id:created.id,version:0})
    const owner=(await app.locals.auth.session(cookie)).userId
    for(const [action,extra] of [['acknowledge',{}],['assign',{ownerId:owner}],['start',{}],['resolve',{}],['close',{}]]){
      const event=next()
      const updated=(await http.post(`/api/operations/incidents/${created.id}/events`).send({action,note:`Realtime ${action}`,...extra}).expect(200)).body
      const payload=await event
      expect(payload).toMatchObject({id:created.id,version:updated.version})
      expect(payload.message).toBeUndefined()
    }
    client.disconnect()
  })

  it('serves recorded health/environment history, bounded CSV reports and filtered control-room summaries',async()=>{
    const health=(await http.get('/api/history/readings?kind=health&source=hardware&metric=heartRate&limit=1').expect(200)).body
    expect(health.data).toHaveLength(1)
    expect(health.data[0]).toMatchObject({source:'hardware',simulation:false,metric:'heartRate'})
    expect((await http.get('/api/history/readings?kind=environment&source=hardware').expect(200)).body.data).toEqual([])
    expect((await http.get('/api/history/readings?kind=environment&source=dacos-simulator').expect(200)).body.data.length).toBeGreaterThan(0)
    expect((await http.get('/api/history/readings?from=2099-01-01T00:00:00Z').expect(200)).body.data).toEqual([])
    await http.get('/api/history/readings?limit=10000').expect(400)
    await request(app).get('/api/reports/readings.csv').expect(401)
    const csv=await http.get('/api/reports/readings.csv?source=hardware&metric=heartRate').expect(200)
    expect(csv.headers['content-type']).toContain('text/csv');expect(csv.text).toContain('hardware')
    const report=await http.get('/api/reports/incidents.csv?status=CLOSED').expect(200)
    expect(report.text).toContain('CLOSED')
    const room=(await http.get('/api/control-room?zoneId=L2').expect(200)).body
    expect(room.data.every(w=>w.zoneId==='L2')).toBe(true)
    expect(room.summary.workers).toBe(room.data.length)
  })

  it('uses one-use scoped socket tickets without exposing the session JWT and rejects ticket replay',async()=>{
    const {vi}=await import('vitest')
    vi.stubEnv('DACOS_ALLOWED_ORIGINS','https://pilot.netlify.app')
    try{
      const crossApp=createApp({service,repository})
      const ticketRequest=()=>request(crossApp).post('/api/auth/socket-ticket').set('Host','backend.up.railway.app').set('Origin','https://pilot.netlify.app').set('Cookie',cookie).set('x-csrf-token',csrf).send({})
      const issued=await ticketRequest().expect(200)
      expect(issued.headers['access-control-allow-origin']).toBe('https://pilot.netlify.app')
      expect(issued.body.ticket).toMatch(/^[a-f0-9]{64}$/)
      await request(crossApp).post('/api/auth/socket-ticket').set('Host','backend.up.railway.app').set('Origin','https://attacker.example').set('Cookie',cookie).set('x-csrf-token',csrf).send({}).expect(403)
      const client=connect(`http://127.0.0.1:${server.address().port}`,{transports:['websocket'],autoConnect:false,reconnection:false,auth:{ticket:issued.body.ticket,delta:true}})
      sockets.push(client)
      const ready=new Promise(resolve=>client.once('connect',resolve));client.connect();await ready
      const delta=new Promise(resolve=>client.once('telemetry:delta',resolve))
      if(service.current.sequence%30===29)await service.update()
      await service.update()
      const patch=await delta
      expect(patch.changes).toBeTruthy();expect(patch.changes.zones).toBeUndefined()
      const resynced=new Promise(resolve=>client.once('telemetry:snapshot',resolve));client.emit('telemetry:resync');expect((await resynced).sequence).toBe(service.snapshot().sequence)
      client.disconnect()
      const replay=connect(`http://127.0.0.1:${server.address().port}`,{transports:['websocket'],autoConnect:false,reconnection:false,auth:{ticket:issued.body.ticket}})
      sockets.push(replay);const rejected=new Promise(resolve=>replay.once('connect_error',resolve));replay.connect();expect((await rejected).message).toBe('Sign in required')
      const replacement=(await ticketRequest().expect(200)).body.ticket
      const recovered=connect(`http://127.0.0.1:${server.address().port}`,{transports:['websocket'],autoConnect:false,reconnection:false,auth:{ticket:replacement,delta:true}})
      sockets.push(recovered);const baseline=new Promise(resolve=>recovered.once('telemetry:snapshot',resolve));recovered.connect();expect((await baseline).streamId).toBe(service.snapshot().streamId);recovered.disconnect()
      await request(crossApp).get('/api/auth/session').set('Cookie',`dacos_session=${issued.body.ticket}`).expect(401)
      const expired=(await ticketRequest().expect(200)).body.ticket
      const {createHash}=await import('node:crypto')
      await repository.db.socketTicket.update({where:{id:createHash('sha256').update(expired).digest('hex')},data:{expiresAt:new Date(0)}})
      expect(await crossApp.locals.auth.redeemSocketTicket(expired)).toBeNull()
      await request(crossApp).get('/api/ready').expect(200)
      await request(crossApp).get('/api/live').expect(200)
    }finally{vi.unstubAllEnvs()}
  })

  it('uses secure cookies, exact CORS and trusted HTTPS proxy checks in production configuration',async()=>{
    const {vi}=await import('vitest'),{randomUUID}=await import('node:crypto')
    vi.stubEnv('NODE_ENV','production');vi.stubEnv('DACOS_ALLOWED_ORIGINS','https://pilot.netlify.app');vi.stubEnv('DACOS_TRUST_PROXY','loopback');vi.stubEnv('DACOS_JWT_SECRET','production-test-key-only-'.repeat(4))
    try{
      const prod=createApp({service,repository}),email=`production-${randomUUID()}@example.test`,password='Production-test-password'
      await prod.locals.auth.createUser({email,password,name:'Production config test',role:'ADMIN'})
      const post=path=>request(prod).post(path).set('Host','backend.up.railway.app').set('Origin','https://pilot.netlify.app').set('X-Forwarded-Proto','https')
      await request(prod).post('/api/auth/login').set('Host','backend.up.railway.app').set('Origin','https://pilot.netlify.app').send({email,password}).expect(400)
      const login=await post('/api/auth/login').send({email,password}).expect(200)
      const setCookie=login.headers['set-cookie'][0]
      expect(setCookie).toContain('__Host-dacos_session=');expect(setCookie).toContain('Secure');expect(setCookie).toContain('HttpOnly');expect(setCookie).toContain('SameSite=Strict');expect(setCookie).not.toContain('Domain=')
      expect(login.headers['access-control-allow-origin']).toBe('https://pilot.netlify.app')
      const prodCookie=setCookie.split(';')[0]
      const pairing=await post('/api/device-pairing').set('Cookie',prodCookie).set('x-csrf-token',login.body.csrfToken).send({}).expect(200)
      expect(pairing.body.code).toMatch(/^[a-f0-9]{32}$/)
      await post('/api/operations/incidents').set('Cookie',prodCookie).send({message:'Missing CSRF',severity:'LOW',simulation:true}).expect(403)
      await post('/api/operations/incidents').set('Cookie',prodCookie).set('x-csrf-token',login.body.csrfToken).send({message:'SIMULATED production configuration check',severity:'LOW',simulation:true}).expect(201)
      await request(prod).get('/api/telemetry/snapshot').set('Origin','https://attacker.example').set('Cookie',prodCookie).expect(403)
      const options=await request(prod).options('/api/auth/login').set('Host','backend.up.railway.app').set('Origin','https://pilot.netlify.app').set('Access-Control-Request-Method','POST').expect(204)
      expect(options.headers['access-control-allow-origin']).not.toBe('*')
    }finally{vi.unstubAllEnvs()}
  })
  it('persists login throttling across authentication-service restarts',async()=>{
    await repository.db.loginThrottle.updateMany({data:{hits:10}})
    const restartedApp=createApp({service,repository})
    await request(restartedApp).post('/api/auth/login').set('Host','localhost:5173').set('Origin','http://localhost:5173').send({email:'nobody@example.test',password:'test-password'}).expect(429)
  })

})
it('paginates and searches existing worker/device endpoints without changing unpaged contracts',async()=>{
 const suffix=Date.now().toString(36),prefix=`PAGE-${suffix}`
 for(const ending of ['A','B'])await http.post('/api/manage/workers').send({id:`${prefix}-${ending}`,name:`Pagination ${suffix} ${ending}`,role:'Test technician',shift:'A',zoneId:'L1'}).expect(201)
 const first=await http.get(`/api/manage/workers?q=${prefix}&limit=1`).expect(200)
 expect(first.body.data).toHaveLength(1);expect(first.body.nextCursor).toBeTruthy()
 const second=await http.get(`/api/manage/workers?q=${prefix}&limit=1&cursor=${first.body.nextCursor}`).expect(200)
 expect(second.body.data[0].id).not.toBe(first.body.data[0].id);expect(second.body.nextCursor).toBeNull()
 expect((await http.get(`/api/manage/workers?q=${prefix}`)).body.data).toHaveLength(2)
 const directory=await http.get(`/api/workers?q=${prefix}&limit=1`).expect(200)
 expect(directory.body.data).toHaveLength(1);expect(directory.body.nextCursor).toBeTruthy()
 for(const ending of ['A','B'])await http.post('/api/manage/devices').send({model:`${prefix} model ${ending}`,serialNumber:`${prefix}-${ending}`,firmwareVersion:'test-only',transport:'wifi',source:'simulator'}).expect(201)
 const devices=await http.get(`/api/manage/devices?q=${prefix}&limit=1`).expect(200)
 expect(devices.body.data).toHaveLength(1);expect(devices.body.nextCursor).toBeTruthy()
 expect((await http.get(`/api/manage/devices?q=${prefix}&limit=1&cursor=${devices.body.nextCursor}`)).body.data).toHaveLength(1)
 await http.get('/api/manage/devices?limit=101').expect(400)
 await http.get('/api/workers?limit=-1').expect(400)
 const auditPage=await http.get('/api/audit?limit=1').expect(200)
 expect(auditPage.body.data).toHaveLength(1);expect(auditPage.body.nextCursor).toBeTruthy()
 const auditNext=await http.get('/api/audit?limit=1&cursor='+auditPage.body.nextCursor).expect(200)
 expect(auditNext.body.data[0].id).not.toBe(auditPage.body.data[0].id)
 const usersPage=await http.get('/api/users?limit=1').expect(200)
 expect(usersPage.body.data).toHaveLength(1)
 expect(JSON.stringify(usersPage.body)).not.toContain('passwordHash')
 await http.get('/api/audit?limit=101').expect(400)
 await repository.db.deviceRegistration.deleteMany({where:{model:{startsWith:prefix}}})
 await repository.db.worker.deleteMany({where:{id:{startsWith:prefix}}})
 await service.refreshDevices()
})
it('lists registered configuration zones for management even when demo telemetry omits them',async()=>{
 const id=`CONFIG-${Date.now()}`
 try{
  await http.post('/api/manage/zones').send({id,name:'Registered management test zone',depth:-10,geometry:{x:1,y:2}}).expect(201)
  expect((await http.get('/api/zones')).body.data.some(z=>z.id===id)).toBe(false)
  const configured=await http.get('/api/manage/zones').expect(200)
  expect(configured.body.data.find(z=>z.id===id)).toMatchObject({name:'Registered management test zone',origin:'registered'})
  await request(app).get('/api/manage/zones').expect(401)
  await repository.db.loginThrottle.deleteMany()
  const email=`zone-reader-${Date.now()}@example.test`,password='Zone-reader-test-password'
  await app.locals.auth.createUser({email,password,name:'Zone reader',role:'OPERATOR'})
  const signed=await request(app).post('/api/auth/login').set('Host','localhost:5173').set('Origin','http://localhost:5173').send({email,password}).expect(200)
  await request(app).get('/api/manage/zones').set('Cookie',signed.headers['set-cookie'][0].split(';')[0]).expect(403)
 }finally{await repository.db.zone.deleteMany({where:{id}})}
})
