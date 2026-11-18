import { randomUUID, createHash } from 'node:crypto'
import { z } from 'zod'
import { locationObservationSchema } from '@dacos/contracts'
import { authenticateDeviceRegistration } from './devices.js'
const fail=(status,message)=>{throw Object.assign(new Error(message),{status})}
const handle=fn=>async(req,res,next)=>{try{await fn(req,res)}catch(e){next(e)}}
const policyDefaults={retentionDays:90,staleSeconds:120}
export const locationPolicy=async db=>await db.locationPolicy.findUnique({where:{id:'default'}})??policyDefaults
export const publicLocation=({fingerprint,...observation})=>observation
export function locationStatus(observation, device, policy=policyDefaults, now=Date.now()) {
  if(!observation)return {status:'UNAVAILABLE',reason:'Location Unavailable — no positioning observation received',lastKnown:null}
  if(now-Date.parse(observation.timestamp)>policy.retentionDays*86400000)return {status:'UNAVAILABLE',reason:'Location Unavailable — observation is outside the retention window',lastKnown:null}
  const lastKnown=publicLocation(observation)
  if(!device||device.workerId!==observation.workerId||['revoked','unpaired'].includes(device.connectionStatus))return {status:'UNAVAILABLE',reason:'Location Unavailable — device revoked, unpaired or no longer assigned',lastKnown}
  if(now-Date.parse(observation.timestamp)>policy.staleSeconds*1000||device.connectionStatus==='disconnected')return {status:'STALE',reason:'Last-known observation; not a current position',lastKnown}
  return {status:observation.simulation?'SIMULATED':'CURRENT',reason:observation.simulation?'Simulated position — not a physical location':observation.source==='BLE'?'Reported zone/checkpoint proximity; not precise coordinates':'Device-reported position; hardware validation is pending',lastKnown}
}
export async function currentLocations(db, workers) {
  const policy=await locationPolicy(db)
  const states=await db.workerLocationState.findMany({where:{workerId:{in:workers.map(w=>w.id)}},include:{observation:{include:{device:{select:{id:true,workerId:true,connectionStatus:true}}}}}})
  const byWorker=new Map(states.map(s=>[s.workerId,s.observation]))
  return new Map(workers.map(w=>{
    const record=byWorker.get(w.id),device=record?.device,{device:_,...observation}=record??{}
    return [w.id,locationStatus(record?observation:null,device,policy)]
  }))
}

export function mountPublicLocationIngestion(app,{repository,service,secureDeviceRequest}) {
  const db=repository.db
  app.post('/api/device-location',secureDeviceRequest,handle(async(req,res)=>{
    const packet=locationObservationSchema.parse(req.body)
    if(service.snapshot().mode==='operational'&&packet.simulation)fail(403,'Simulated locations are disabled in operational mode')
    const receivedAt=new Date(),age=receivedAt.getTime()-Date.parse(packet.timestamp)
    if(age < -30000 || age > 86400000)fail(400,'Location timestamp must be no more than 30 seconds ahead or 24 hours old')
    const fingerprint=createHash('sha256').update(JSON.stringify(packet)).digest('hex')
    const result=await db.$transaction(async tx=>{
      const device=authenticateDeviceRegistration(await tx.deviceRegistration.findUnique({where:{id:packet.deviceId}}),req.get('authorization'))
      if(device.workerId!==packet.workerId||device.source!==(packet.simulation?'simulator':'hardware'))fail(403,'Location does not match current worker assignment or device provenance')
      if(!await tx.worker.findFirst({where:{id:packet.workerId,active:true}}))fail(403,'Worker is unavailable')
      const duplicate=await tx.locationObservation.findUnique({where:{deviceId_sequence:{deviceId:packet.deviceId,sequence:packet.sequence}}})
      if(duplicate){if(duplicate.fingerprint!==fingerprint)fail(409,'Sequence already used for different location data');return {accepted:false,duplicate:true,sequence:packet.sequence}}
      if(packet.sequence<=device.locationSequence)fail(409,'Location sequence must increase; retain it across reconnects and credential rotation')
      if(packet.zoneId&&!await tx.zone.findUnique({where:{id:packet.zoneId}}))fail(400,'Unknown zone')
      const lastReceipt=await tx.locationObservation.findFirst({where:{deviceId:device.id},orderBy:{receivedAt:'desc'},select:{receivedAt:true}})
      if(lastReceipt&&receivedAt.getTime()-lastReceipt.receivedAt.getTime()<500)fail(429,'Send at most two location observations per second')
      const changed=await tx.deviceRegistration.updateMany({where:{id:device.id,workerId:packet.workerId,tokenHash:device.tokenHash,source:device.source,locationSequence:device.locationSequence,connectionStatus:{notIn:['revoked','unpaired']}},data:{locationSequence:packet.sequence,lastSeen:receivedAt,connectionStatus:'connected'}})
      if(!changed.count)fail(409,'Assignment or credential changed; refresh and retry')
      const observation=await tx.locationObservation.create({data:{...packet,id:randomUUID(),timestamp:new Date(packet.timestamp),receivedAt,fingerprint}})
      const state=await tx.workerLocationState.findUnique({where:{workerId:packet.workerId},include:{observation:true}}),previous=state?.observation
      // Late buffered observations remain history; they never rewind last-known state or create false movements.
      const current=!previous||new Date(packet.timestamp)>=previous.timestamp
      if(current){
        const events=[]
        if(previous?.zoneId&&previous.zoneId!==packet.zoneId)events.push({type:'ZONE_EXIT',zoneId:previous.zoneId,simulation:previous.simulation||packet.simulation})
        if(packet.zoneId&&previous?.zoneId!==packet.zoneId)events.push({type:'ZONE_ENTRY',zoneId:packet.zoneId,simulation:packet.simulation})
        if(previous&&previous.source!==packet.source)events.push({type:'SOURCE_CHANGE',previousSource:previous.source,simulation:previous.simulation||packet.simulation})
        if(events.length)await tx.locationMovementEvent.createMany({data:events.map(e=>({id:randomUUID(),workerId:packet.workerId,observationId:observation.id,timestamp:observation.timestamp,source:packet.source,...e}))})
        await tx.workerLocationState.upsert({where:{workerId:packet.workerId},create:{workerId:packet.workerId,observationId:observation.id},update:{observationId:observation.id}})
      }
      return {accepted:true,duplicate:false,current,sequence:packet.sequence}
    },{isolationLevel:'Serializable'})
    if(result.accepted)try{await service.refreshDevices()}catch{service.lastError=new Error('Location stored; monitoring refresh pending')}
    res.json(result)
  }))
}
const historyFilters=z.object({limit:z.coerce.number().int().min(1).max(100).default(25),cursor:z.string().uuid().optional(),source:z.enum(['GNSS','BLE','UWB','SIMULATED']).optional(),from:z.string().datetime().optional(),to:z.string().datetime().optional()}).strict().refine(v=>!v.from||!v.to||Date.parse(v.from)<=Date.parse(v.to),'Invalid date range')
export function mountLocations(app,{auth,repository,service}) {
  const db=repository.db,elevated=auth.roles('ADMIN','SUPERVISOR')
  const worker=async id=>{const w=await db.worker.findUnique({where:{id}});if(!w)fail(404,'Worker not found');return w}
  app.get('/api/locations/current',handle(async(req,res)=>{
    const workers=await db.worker.findMany({where:{active:true},select:{id:true,name:true,zoneId:true}}),locations=await currentLocations(db,workers)
    res.json({data:workers.map(w=>({...w,location:locations.get(w.id)}))})
  }))
  app.get('/api/workers/:id/location',handle(async(req,res)=>{
    const w=await worker(req.params.id)
    res.json((await currentLocations(db,[w])).get(w.id))
  }))
  for(const [suffix,model] of [['locations','locationObservation'],['movements','locationMovementEvent']])app.get(`/api/workers/:id/${suffix}`,elevated,handle(async(req,res)=>{
    await worker(req.params.id)
    const p=historyFilters.parse(req.query),policy=await locationPolicy(db),cutoff=new Date(Date.now()-policy.retentionDays*86400000)
    const rows=await db[model].findMany({where:{workerId:req.params.id,...(p.source?{source:p.source}:{}),timestamp:{gte:new Date(Math.max(cutoff.getTime(),p.from?Date.parse(p.from):0)),...(p.to?{lte:new Date(p.to)}:{})}},take:p.limit+1,...(p.cursor?{cursor:{id:p.cursor},skip:1}:{}),orderBy:[{timestamp:'desc'},{id:'desc'}]})
    await auth.audit('worker.location_history_viewed',req.auth.userId,req.params.id,{kind:suffix},db)
    res.json({data:rows.slice(0,p.limit).map(publicLocation),nextCursor:rows.length>p.limit?rows[p.limit-1].id:null,retentionDays:policy.retentionDays})
  }))
  app.get('/api/manage/location-policy',elevated,handle(async(_req,res)=>res.json(await locationPolicy(db))))
  app.patch('/api/manage/location-policy',auth.roles('ADMIN'),handle(async(req,res)=>{
    const data=z.object({retentionDays:z.number().int().min(1).max(3650),staleSeconds:z.number().int().min(10).max(86400),note:z.string().trim().min(3).max(1000)}).strict().parse(req.body)
    const {note,...settings}=data
    const policy=await db.$transaction(async tx=>{const p=await tx.locationPolicy.upsert({where:{id:'default'},create:{id:'default',...settings},update:settings});await auth.audit('location.policy_updated',req.auth.userId,'default',{...settings,note},tx);return p})
    res.json(policy)
  }))
  app.post('/api/manage/location-retention',auth.roles('ADMIN'),handle(async(req,res)=>{
    const input=z.object({dryRun:z.boolean().default(true),confirmation:z.literal('PURGE_EXPIRED_LOCATIONS').optional(),note:z.string().trim().min(3).max(1000)}).strict().parse(req.body)
    if(!input.dryRun&&input.confirmation!=='PURGE_EXPIRED_LOCATIONS')fail(400,'Explicit purge confirmation is required')
    const result=await db.$transaction(async tx=>{
      const policy=await locationPolicy(tx),cutoff=new Date(Date.now()-policy.retentionDays*86400000)
      const expired=await tx.locationObservation.count({where:{timestamp:{lt:cutoff}}})
      let deleted=0
      if(!input.dryRun){const rows=await tx.locationObservation.findMany({where:{timestamp:{lt:cutoff}},select:{id:true},take:1000,orderBy:[{timestamp:'asc'},{id:'asc'}]});deleted=(await tx.locationObservation.deleteMany({where:{id:{in:rows.map(r=>r.id)}}})).count}
      await auth.audit(input.dryRun?'location.retention_previewed':'location.retention_purged',req.auth.userId,null,{cutoff:cutoff.toISOString(),expired,deleted,note:input.note},tx)
      return {dryRun:input.dryRun,expired,deleted,cutoff,batchLimit:1000}
    },{isolationLevel:'Serializable'})
    res.json(result)
  }))
}
