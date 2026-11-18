import {connectionStatus} from './devices.js'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
const paging=z.object({cursor:z.string().max(200).optional(),limit:z.coerce.number().int().min(1).max(100).default(25),deviceId:z.string().max(100).optional()}).strict()
export function mountOperations(app,{auth,repository,service}) {
  const db=repository.db
  const handle=fn=>async(req,res,next)=>{try{await fn(req,res)}catch(e){next(e)}}
  app.get('/api/operations/status',handle(async(req,res)=>{
    const devices=await db.deviceRegistration.findMany({select:{lastSeen:true,connectionStatus:true}})
    const statuses={}
    for(const device of devices){const status=connectionStatus(device);statuses[status]=(statuses[status]??0)+1}
    res.json({mode:service.adapter.mode??'demo',persistence:service.lastError?'degraded':'ok',snapshotTimestamp:service.current?.timestamp??null,sequence:service.current?.sequence??null,uptimeSeconds:Math.floor(process.uptime()),devices:statuses,openIncidents:await db.operationalIncident.count({where:{lifecycleStatus:{notIn:['RESOLVED','CLOSED']}}})})
  }))
  app.get('/api/operations/rules',handle(async(req,res)=>res.json({data:await db.alertRule.findMany({orderBy:{createdAt:'desc'}})})))
  app.post('/api/operations/rules',auth.roles('ADMIN'),handle(async(req,res)=>{
    const data=z.object({metric:z.enum(['heartRate','spo2','temperature','battery']),comparator:z.enum(['gte','lte']),threshold:z.number().finite(),severity:z.enum(['warning','critical'])}).strict().parse(req.body)
    const rule=await db.$transaction(async tx=>{const rule=await tx.alertRule.create({data:{id:randomUUID(),...data,createdBy:req.auth.userId}});await auth.audit('rule.created',req.auth.userId,rule.id,data,tx);return rule})
    res.status(201).json(rule)
  }))
  app.post('/api/operations/rules/:id/review',auth.roles('ADMIN'),handle(async(req,res)=>{
    const {enabled,note}=z.object({enabled:z.boolean(),note:z.string().trim().min(1).max(1000)}).strict().parse(req.body)
    const rule=await db.$transaction(async tx=>{const rule=await tx.alertRule.update({where:{id:req.params.id},data:{enabled,reviewedBy:req.auth.userId,reviewNote:note}});await auth.audit('rule.reviewed',req.auth.userId,rule.id,{enabled,note},tx);return rule})
    res.json(rule)
  }))
  app.get('/api/history/sos',handle(async(req,res)=>{
    const {cursor,limit,deviceId}=paging.parse(req.query)
    const rows=await db.incidentEvent.findMany({where:deviceId?{deviceId}:{},take:limit+1,...(cursor?{cursor:{id:cursor},skip:1}:{}),orderBy:[{receivedAt:'desc'},{id:'desc'}]})
    res.json({data:rows.slice(0,limit),nextCursor:rows.length>limit?rows[limit-1].id:null})
  }))
  app.get('/api/history/telemetry',handle(async(req,res)=>{
    const {cursor,limit,deviceId}=paging.parse(req.query)
    const rows=await db.deviceTelemetry.findMany({where:deviceId?{deviceId}:{},take:limit+1,...(cursor?{cursor:{id:cursor},skip:1}:{}),orderBy:[{receivedAt:'desc'},{id:'desc'}]})
    res.json({data:rows.slice(0,limit),nextCursor:rows.length>limit?rows[limit-1].id:null})
  }))
}
