import { beforeAll, afterAll, describe, it, expect } from 'vitest'
import request from 'supertest'
import { spawnSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { rm } from 'node:fs/promises'
import { startDatabase } from '../scripts/database.mjs'
import { createRepository } from '../src/repositories/postgres.js'
import { SimulationAdapter } from '../src/simulation/adapter.js'
import { TelemetryService } from '../src/services/telemetry.js'
import { createApp } from '../src/app.js'
let database,repository,service,app,zoneId,otherZone
const accounts={},directory=`/tmp/dacos-location-tests-${randomUUID()}`
const as=(role,method,path,body)=>{const req=request(app)[method](path).set('Cookie',accounts[role].cookie).set('x-csrf-token',accounts[role].csrf);return body===undefined?req:req.send(body)}
const manage=(method,path,body)=>as('SUPERVISOR',method,path,body)
const packet=(device,overrides={})=>({deviceId:device.id,workerId:device.workerId,source:device.source==='simulator'?'SIMULATED':'GNSS',simulation:device.source==='simulator',sequence:0,timestamp:new Date().toISOString(),...(device.source==='simulator'?{zoneId}:{latitude:6.3,longitude:-10.8,coordinateFrame:'WGS84',accuracyMeters:12}),...overrides})
const send=(device,p,token=device.token)=>request(app).post('/api/device-location').set('Host','localhost:5173').set('Origin','http://localhost:5173').set('Authorization',`Bearer ${token}`).send(p)
const pause=()=>new Promise(r=>setTimeout(r,530))
async function device(source='hardware',existingWorker){
  const workerId=existingWorker??`LOC-${randomUUID()}`
  if(!existingWorker)await manage('post','/api/manage/workers',{id:workerId,name:`Location test ${workerId}`,role:'Test technician',shift:'Day',zoneId}).expect(201)
  const d=(await manage('post','/api/manage/devices',{model:'Synthetic contract test device',serialNumber:randomUUID(),firmwareVersion:'test-only',transport:'wifi',source}).expect(201)).body
  const {token}= (await manage('post',`/api/manage/devices/${d.id}/reprovision`,{}).expect(200)).body
  await manage('post',`/api/manage/devices/${d.id}/assignment`,{workerId}).expect(200)
  return {...d,workerId,token}
}
beforeAll(async()=>{
  database=await startDatabase({directory,port:55438,database:'dacos_locations_test'})
  const migrated=spawnSync(process.execPath,['node_modules/prisma/build/index.js','migrate','deploy','--schema','backend/prisma/schema.prisma'],{env:{...process.env,DATABASE_URL:database.url},encoding:'utf8'})
  if(migrated.status!==0)throw new Error(migrated.stderr||migrated.stdout)
  repository=createRepository(database.url);service=new TelemetryService({adapter:new SimulationAdapter({seed:14}),repository});await service.update()
  ;[zoneId,otherZone]=service.snapshot().zones.map(z=>z.id)
  app=createApp({service,repository})
  for(const role of ['ADMIN','SUPERVISOR','OPERATOR']){const email=`${role.toLowerCase()}@locations.test`;await app.locals.auth.createUser({email,password:'Location-test-password-2026',name:role,role});const login=await request(app).post('/api/auth/login').set('Host','localhost:5173').set('Origin','http://localhost:5173').send({email,password:'Location-test-password-2026'}).expect(200);accounts[role]={cookie:login.headers['set-cookie'][0].split(';')[0],csrf:login.body.csrfToken}}
})
afterAll(async()=>{await service?.stop();await repository?.close();await database?.stop();await rm(directory,{recursive:true,force:true});await rm(`${directory}.credential`,{force:true})})
describe('hybrid location contracts, security and PostgreSQL history',()=>{
  it('does not infer a position from worker registration or administrative zone assignment',async()=>{
    const d=await device()
    const response=await as('OPERATOR','get',`/api/workers/${d.workerId}/location`).expect(200)
    expect(response.body).toMatchObject({status:'UNAVAILABLE',lastKnown:null})
    expect((await as('OPERATOR','get','/api/control-room')).body.data.find(w=>w.id===d.workerId).location.status).toBe('UNAVAILABLE')
  })
  it('requires current device credentials, identity, provenance and valid GNSS coordinates',async()=>{
    const d=await device(),p=packet(d)
    await send(d,p,'bad-token').expect(401)
    await request(app).post('/api/device-location').set('Host','localhost:5173').set('Cookie',accounts.ADMIN.cookie).send(p).expect(401)
    await send(d,{...p,workerId:'another-worker'}).expect(403)
    await send(d,{...p,source:'SIMULATED',simulation:true}).expect(403)
    await send(d,{...p,latitude:91}).expect(400)
    await send(d,{...p,timestamp:new Date(Date.now()+60000).toISOString()}).expect(400)
    await send(d,{...p,zoneId:'missing-zone'}).expect(400)
    await send(d,p).expect(200)
    const current=(await as('OPERATOR','get',`/api/workers/${d.workerId}/location`).expect(200)).body
    expect(current).toMatchObject({status:'CURRENT',lastKnown:{source:'GNSS',latitude:6.3,longitude:-10.8,simulation:false}})
    expect(JSON.stringify(current)).not.toContain(d.token);expect(JSON.stringify(current)).not.toContain('fingerprint')
  })
  it('deduplicates retries, rejects changed/reversed sequences, rate-limits and preserves late history without rewinding',async()=>{
    const d=await device(),p=packet(d,{sequence:3})
    await send(d,p).expect(200)
    expect((await send(d,p).expect(200)).body).toMatchObject({accepted:false,duplicate:true})
    await send(d,{...p,latitude:6.4}).expect(409)
    await send(d,{...p,sequence:2}).expect(409)
    await send(d,{...p,sequence:4}).expect(429)
    await pause()
    const late={...p,sequence:4,timestamp:new Date(Date.now()-3600000).toISOString(),latitude:6.2}
    expect((await send(d,late).expect(200)).body.current).toBe(false)
    expect((await as('OPERATOR','get',`/api/workers/${d.workerId}/location`)).body.lastKnown.sequence).toBe(3)
    expect(await repository.db.locationObservation.count({where:{deviceId:d.id}})).toBe(2)
  })
  it('supports simulated → GNSS → BLE → UWB transitions and labels inferred zone entry/exit history',async()=>{
    const sim=await device('simulator')
    await send(sim,packet(sim)).expect(200)
    expect((await as('OPERATOR','get',`/api/workers/${sim.workerId}/location`)).body.status).toBe('SIMULATED')
    await manage('post',`/api/manage/devices/${sim.id}/assignment`,{workerId:null}).expect(200)
    const real=await device('hardware',sim.workerId)
    await send(real,packet(real)).expect(200)
    await pause()
    const ble=packet(real,{source:'BLE',sequence:1,zoneId:otherZone,checkpointId:'TEST-CHECKPOINT',latitude:undefined,longitude:undefined,coordinateFrame:undefined,accuracyMeters:undefined,confidence:.7})
    await send(real,{...ble,latitude:6,longitude:10}).expect(400)
    await send(real,{...ble,accuracyMeters:1}).expect(400)
    await send(real,ble).expect(200)
    expect((await as('OPERATOR','get',`/api/workers/${real.workerId}/location`)).body.reason).toContain('not precise')
    await pause()
    const uwb=packet(real,{source:'UWB',sequence:2,x:12,y:24,z:3,coordinateFrame:'TEST-LOCAL-METERS',zoneId:otherZone,latitude:undefined,longitude:undefined,accuracyMeters:.5})
    await send(real,{...uwb,coordinateFrame:undefined}).expect(400)
    await send(real,uwb).expect(200)
    const events=(await as('SUPERVISOR','get',`/api/workers/${real.workerId}/movements`)).body.data
    expect(events.filter(e=>e.type==='SOURCE_CHANGE').map(e=>e.source)).toEqual(expect.arrayContaining(['GNSS','BLE','UWB']))
    expect(events.some(e=>e.type==='ZONE_ENTRY'&&e.zoneId===otherZone)).toBe(true)
    expect(events.some(e=>e.type==='ZONE_EXIT'&&e.zoneId===zoneId&&e.simulation)).toBe(true)
    const current=(await as('OPERATOR','get',`/api/workers/${real.workerId}/location`)).body
    expect(current.lastKnown).toMatchObject({source:'UWB',x:12,y:24,coordinateFrame:'TEST-LOCAL-METERS'})
  })
  it('marks stale locations and invalidates tracking when credentials are revoked or assignment changes',async()=>{
    const d=await device(),p=packet(d,{timestamp:new Date(Date.now()-180000).toISOString()})
    await send(d,p).expect(200)
    expect((await as('OPERATOR','get',`/api/workers/${d.workerId}/location`)).body.status).toBe('STALE')
    const rotation=(await manage('post',`/api/manage/devices/${d.id}/rotate`,{}).expect(200)).body
    expect(rotation.nextLocationSequence).toBe(1)
    await send(d,{...p,sequence:1,timestamp:new Date().toISOString()}).expect(401)
    await pause()
    await send(d,{...p,sequence:1,timestamp:new Date().toISOString()},rotation.token).expect(200)
    await manage('post',`/api/manage/devices/${d.id}/revoke`,{}).expect(200)
    expect((await as('OPERATOR','get',`/api/workers/${d.workerId}/location`)).body.status).toBe('UNAVAILABLE')
    await send(d,{...p,sequence:2},rotation.token).expect(401)
    expect(await repository.db.locationObservation.count({where:{workerId:d.workerId}})).toBe(2)
  })
  it('restricts and audits detailed histories, paginates observations and exposes current tracking in the control room',async()=>{
    const d=await device()
    await send(d,packet(d)).expect(200);await pause();await send(d,packet(d,{sequence:1})).expect(200)
    for(const suffix of ['locations','movements']){
      await request(app).get(`/api/workers/${d.workerId}/${suffix}`).expect(401)
      await as('OPERATOR','get',`/api/workers/${d.workerId}/${suffix}`).expect(403)
      await as('SUPERVISOR','get',`/api/workers/${d.workerId}/${suffix}`).expect(200)
    }
    const first=(await as('SUPERVISOR','get',`/api/workers/${d.workerId}/locations?limit=1`)).body
    expect(first.data).toHaveLength(1);expect(first.nextCursor).toBeTruthy()
    const second=(await as('SUPERVISOR','get',`/api/workers/${d.workerId}/locations?limit=1&cursor=${first.nextCursor}`)).body
    expect(second.data[0].id).not.toBe(first.data[0].id);expect(second.nextCursor).toBeNull()
    const control=(await as('OPERATOR','get','/api/control-room')).body
    expect(control.data.find(w=>w.id===d.workerId).location.lastKnown.sequence).toBe(1)
    expect(await repository.db.auditEvent.count({where:{targetId:d.workerId,action:'worker.location_history_viewed'}})).toBeGreaterThan(0)
  })
  it('requires admin authority and explicit confirmation for bounded retention cleanup, preserving incidents/telemetry',async()=>{
    const d=await device()
    await send(d,packet(d)).expect(200)
    const expired=await repository.db.locationObservation.create({data:{id:randomUUID(),workerId:d.workerId,deviceId:d.id,source:'GNSS',simulation:false,timestamp:new Date(Date.now()-10*86400000),latitude:1,longitude:1,coordinateFrame:'WGS84',sequence:1000,fingerprint:'fixture'}})
    await repository.db.locationMovementEvent.create({data:{id:randomUUID(),workerId:d.workerId,observationId:expired.id,type:'ZONE_ENTRY',zoneId,source:'GNSS',simulation:false,timestamp:expired.timestamp}})
    const policy={retentionDays:1,staleSeconds:120,note:'Synthetic test retention policy'}
    await as('SUPERVISOR','patch','/api/manage/location-policy',policy).expect(403)
    await as('ADMIN','patch','/api/manage/location-policy',policy).expect(200)
    const payload={dryRun:true,note:'Inspect isolated test records only'}
    await as('OPERATOR','post','/api/manage/location-retention',payload).expect(403)
    await as('SUPERVISOR','post','/api/manage/location-retention',payload).expect(403)
    const preview=(await as('ADMIN','post','/api/manage/location-retention',payload).expect(200)).body
    expect(preview).toMatchObject({expired:1,deleted:0,dryRun:true})
    const readings=await repository.db.reading.count(),incidents=await repository.db.incident.count()
    await as('ADMIN','post','/api/manage/location-retention',{...payload,dryRun:false}).expect(400)
    const purge=(await as('ADMIN','post','/api/manage/location-retention',{...payload,dryRun:false,confirmation:'PURGE_EXPIRED_LOCATIONS'}).expect(200)).body
    expect(purge).toMatchObject({deleted:1,batchLimit:1000})
    expect(await repository.db.locationMovementEvent.count({where:{observationId:expired.id}})).toBe(0)
    expect(await repository.db.reading.count()).toBe(readings);expect(await repository.db.incident.count()).toBe(incidents)
    expect((await as('OPERATOR','get',`/api/workers/${d.workerId}/location`)).body.lastKnown).not.toBeNull()
  })
})
