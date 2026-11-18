import { beforeAll, afterAll, beforeEach, describe, it, expect } from 'vitest'
import request from 'supertest'
import { spawnSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { rm } from 'node:fs/promises'
import { startDatabase } from '../scripts/database.mjs'
import { createRepository } from '../src/repositories/postgres.js'
import { SimulationAdapter } from '../src/simulation/adapter.js'
import { TelemetryService } from '../src/services/telemetry.js'
import { createApp } from '../src/app.js'
import { registrationPrivacyVersion } from '@dacos/contracts'
let database,repository,service,app,zoneId
const accounts={},directory=`/tmp/dacos-registration-tests-${randomUUID()}`
let sequence=0
const sample = overrides => ({fullName:`Applicant ${++sequence}`,phone:`+231770${String(sequence).padStart(6,'0')}`,employeeNumber:'',jobTitle:'Electrician',workArea:'BOTH',site:'Fictional Phase 10 Test Site',shift:'Day',emergencyContact:'Optional contact, provided with permission',acknowledgement:true,privacyVersion:registrationPrivacyVersion,website:'',...overrides})
const publicPost = body => request(app).post('/api/public/worker-applications').set('Host','localhost:5173').set('Origin','http://localhost:5173').send(body)
const as = (role,method,path,body,csrf=true) => {const req=request(app)[method](path).set('Cookie',accounts[role].cookie);if(csrf)req.set('x-csrf-token',accounts[role].csrf);return body===undefined?req:req.send(body)}
const submitted = async body => {await publicPost(body).expect(202);return repository.db.workerApplication.findFirstOrThrow({where:{fullName:body.fullName},orderBy:{createdAt:'desc'}})}
const review = (id,body,role='SUPERVISOR') => as(role,'post',`/api/manage/worker-applications/${id}/review`,body)
beforeAll(async()=>{
  database=await startDatabase({directory,port:55437,database:'dacos_registration_test'})
  const migrated=spawnSync(process.execPath,['node_modules/prisma/build/index.js','migrate','deploy','--schema','backend/prisma/schema.prisma'],{env:{...process.env,DATABASE_URL:database.url},encoding:'utf8'})
  if(migrated.status!==0)throw new Error(migrated.stderr||migrated.stdout)
  repository=createRepository(database.url)
  service=new TelemetryService({adapter:new SimulationAdapter({seed:13}),repository})
  await service.update();zoneId=service.snapshot().zones[0].id
  app=createApp({service,repository})
  for(const role of ['ADMIN','SUPERVISOR','OPERATOR']){
    const email=`${role.toLowerCase()}@registration.test`
    await app.locals.auth.createUser({email,password:'Registration-test-password-2026',name:role,role})
    const login=await request(app).post('/api/auth/login').set('Host','localhost:5173').set('Origin','http://localhost:5173').send({email,password:'Registration-test-password-2026'}).expect(200)
    accounts[role]={cookie:login.headers['set-cookie'][0].split(';')[0],csrf:login.body.csrfToken}
  }
})
beforeEach(async()=>{await repository.db.registrationThrottle.deleteMany()})
afterAll(async()=>{await service?.stop();await repository?.close();await database?.stop();await rm(directory,{recursive:true,force:true});await rm(`${directory}.credential`,{force:true})})
describe('QR worker application integration with PostgreSQL',()=>{
  it('stores a pending, acknowledged application without exposing personal information or creating workers/users',async()=>{
    const workers=await repository.db.worker.count(),users=await repository.db.user.count(),input=sample()
    const response=await publicPost(input).expect(202)
    expect(Object.keys(response.body)).toEqual(['message'])
    expect(JSON.stringify(response.body)).not.toContain(input.fullName)
    const a=await repository.db.workerApplication.findFirstOrThrow({where:{fullName:input.fullName}})
    expect(a).toMatchObject({status:'PENDING',privacyVersion:registrationPrivacyVersion,reviewedAt:null,approvedWorkerId:null})
    expect(a.acknowledgedAt).toBeInstanceOf(Date)
    expect(await repository.db.worker.count()).toBe(workers);expect(await repository.db.user.count()).toBe(users)
    await request(app).get('/api/public/worker-applications').expect(401)
    await request(app).get(`/api/public/worker-applications/${a.id}`).expect(401)
    expect(await repository.db.auditEvent.count({where:{targetId:a.id,action:'worker.application_submitted'}})).toBe(1)
  })
  it('validates fields, acknowledgement, privacy version and origin; suppresses honeypot submissions',async()=>{
    const input=sample()
    for(const bad of [{acknowledgement:false},{phone:'not-a-phone'},{workArea:'GPS'},{privacyVersion:'outdated'},{unexpected:'x'},{fullName:' '.repeat(3)},{employeeNumber:'x'.repeat(51)}]){await repository.db.registrationThrottle.deleteMany();await publicPost({...input,...bad}).expect(400)}
    await repository.db.registrationThrottle.deleteMany()
    await publicPost({...input,acknowledgement:false}).expect(400)
    await request(app).post('/api/public/worker-applications').set('Host','localhost:5173').send(input).expect(403)
    await request(app).post('/api/public/worker-applications').set('Host','localhost:5173').set('Origin','https://untrusted.example').send(input).expect(403)
    await publicPost({...input,website:'spam.example'}).expect(202)
    expect(await repository.db.workerApplication.count({where:{fullName:input.fullName}})).toBe(0)
  })
  it('uses persistent IP throttles and collapses exact pending duplicates with the same public receipt',async()=>{
    const input=sample(),responses=await Promise.all([publicPost(input),publicPost(input)])
    expect(responses.map(r=>r.status)).toEqual([202,202]);expect(responses[0].body).toEqual(responses[1].body)
    expect(await repository.db.workerApplication.count({where:{fullName:input.fullName}})).toBe(1)
    for(let i=0;i<3;i++)await publicPost(input).expect(202)
    await publicPost(input).expect(429)
    expect(await repository.db.registrationThrottle.count()).toBe(2)
  })
  it('protects every review endpoint from anonymous/operator access and rejects missing CSRF',async()=>{
    const a=await submitted(sample())
    for(const path of ['/api/manage/worker-applications',`/api/manage/worker-applications/${a.id}`]){
      await request(app).get(path).expect(401);await as('OPERATOR','get',path).expect(403)
      await as('SUPERVISOR','get',path).expect(200);await as('ADMIN','get',path).expect(200)
    }
    const input={action:'reject',note:'Not eligible for this site'}
    await request(app).post(`/api/manage/worker-applications/${a.id}/review`).send(input).expect(401)
    await review(a.id,input,'OPERATOR').expect(403)
    await as('SUPERVISOR','post',`/api/manage/worker-applications/${a.id}/review`,input,false).expect(403)
    await review(a.id,{...input,note:''}).expect(400)
    await as('SUPERVISOR','get','/api/manage/worker-applications?limit=1').expect(200)
  })
  it('approves transactionally with a unique worker ID and keeps contacts out of operational APIs/snapshots',async()=>{
    const input=sample({employeeNumber:'EMP-ONE',emergencyContact:'Sensitive emergency contact'}),a=await submitted(input),userCount=await repository.db.user.count()
    await review(a.id,{action:'approve',mode:'create',zoneId:'missing-zone',note:'Checked identity'}).expect(400)
    expect((await repository.db.workerApplication.findUnique({where:{id:a.id}})).status).toBe('PENDING')
    const response=await review(a.id,{action:'approve',mode:'create',zoneId,note:'Checked identity and site roster'}).expect(200)
    expect(response.body.workerId).toMatch(/^WK-[a-f0-9-]{36}$/)
    const worker=await repository.db.worker.findUniqueOrThrow({where:{id:response.body.workerId}})
    expect(worker).toMatchObject({active:true,origin:'registered',name:input.fullName,role:input.jobTitle})
    expect(await repository.db.workerPrivateProfile.findUnique({where:{workerId:worker.id}})).toMatchObject({phone:input.phone,employeeNumber:'EMP-ONE'})
    expect(await repository.db.user.count()).toBe(userCount)
    const snapshot=await as('OPERATOR','get','/api/telemetry/snapshot').expect(200)
    const general=await as('OPERATOR','get',`/api/workers/${worker.id}`).expect(200)
    const inventory=await as('SUPERVISOR','get','/api/manage/workers').expect(200)
    for(const data of [snapshot.body,general.body,inventory.body]){expect(JSON.stringify(data)).not.toContain(input.phone);expect(JSON.stringify(data)).not.toContain('Sensitive emergency contact');expect(JSON.stringify(data)).not.toContain('EMP-ONE')}
    expect(await repository.db.auditEvent.count({where:{targetId:a.id,action:'worker.application_approved'}})).toBe(1)
  })
  it('requires duplicate acknowledgement, blocks duplicate site employee identities, and links without overwriting',async()=>{
    const input=sample({employeeNumber:'EMP-LINK'}),a=await submitted(input)
    const approved=await review(a.id,{action:'approve',mode:'create',zoneId,note:'Verified roster'}).expect(200)
    const second=await submitted(sample({employeeNumber:'emp-link',site:'  FICTIONAL phase 10 TEST SITE ',phone:input.phone,emergencyContact:'Different contact'}))
    const detail=await as('SUPERVISOR','get',`/api/manage/worker-applications/${second.id}`).expect(200)
    expect(detail.body.duplicates.hasMatches).toBe(true);expect(detail.body.duplicates.workers[0].reasons).toContain('site employee number')
    const payload={action:'approve',mode:'create',zoneId,note:'Reviewed potential duplicate'}
    await review(second.id,payload).expect(409)
    const before=await repository.db.worker.count()
    await review(second.id,{...payload,duplicateAcknowledged:true}).expect(409)
    expect(await repository.db.worker.count()).toBe(before)
    const result=await review(second.id,{action:'approve',mode:'link',workerId:approved.body.workerId,duplicateAcknowledged:true,note:'Confirmed same existing worker; retain original details'}).expect(200)
    expect(result.body.workerId).toBe(approved.body.workerId)
    expect(await repository.db.worker.count()).toBe(before)
    expect((await repository.db.workerPrivateProfile.findUnique({where:{workerId:approved.body.workerId}})).emergencyContact).toBe(input.emergencyContact)
  })
  it('serializes competing reviewers so one application creates only one worker',async()=>{
    const a=await submitted(sample()),before=await repository.db.worker.count(),payload={action:'approve',mode:'create',zoneId,note:'Reviewed concurrently'}
    const responses=await Promise.all([review(a.id,payload,'ADMIN'),review(a.id,payload,'SUPERVISOR')])
    expect(responses.map(r=>r.status).sort()).toEqual([200,409])
    expect(await repository.db.worker.count()).toBe(before+1)
    expect(await repository.db.auditEvent.count({where:{targetId:a.id,action:'worker.application_approved'}})).toBe(1)
  })
  it('rejects without creating a worker, retains notes/audit, supports reapplication and rejects repeated review',async()=>{
    const input=sample(),a=await submitted(input),before=await repository.db.worker.count()
    await review(a.id,{action:'reject',note:'Not on the approved site roster'},'ADMIN').expect(200)
    expect(await repository.db.worker.count()).toBe(before)
    expect(await repository.db.workerApplication.findUnique({where:{id:a.id}})).toMatchObject({status:'REJECTED',reviewNote:'Not on the approved site roster'})
    await review(a.id,{action:'approve',mode:'create',zoneId,note:'Attempt repeated review'}).expect(409)
    await publicPost(input).expect(202)
    expect(await repository.db.workerApplication.count({where:{fullName:input.fullName}})).toBe(2)
    const audit=await as('ADMIN','get','/api/audit').expect(200)
    expect(audit.body.data.some(e=>e.targetId===a.id&&e.action==='worker.application_rejected')).toBe(true)
  })
})
