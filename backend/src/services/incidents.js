import {randomUUID} from 'node:crypto'
import {z} from 'zod'
const statuses=['OPEN','ACKNOWLEDGED','ASSIGNED','IN_PROGRESS','RESOLVED','CLOSED']
const levels=['LOW','MEDIUM','HIGH','CRITICAL']
const rank=value=>levels.indexOf(value)
const fail=(status,message)=>{throw Object.assign(new Error(message),{status})}
const noteSchema=z.string().trim().min(1).max(2000)
export const severityLevel=value=>({low:'LOW',warning:'MEDIUM',medium:'MEDIUM',high:'HIGH',critical:'CRITICAL'})[value]??value
export const legacySeverity=value=>value==='CRITICAL'?'critical':'warning'
const legacyStatus=value=>value.toLowerCase()
export const incidentListFilters=z.object({cursor:z.string().max(200).optional(),limit:z.coerce.number().int().min(1).max(100).default(25),q:z.string().max(200).optional(),status:z.enum(statuses).optional(),severity:z.enum(levels).optional(),workerId:z.string().max(50).optional(),ownerId:z.string().max(100).optional(),kind:z.enum(['ALERT','SIMULATED_SOS','HARDWARE_RULE']).optional(),simulation:z.enum(['true','false']).optional(),from:z.string().datetime().optional(),to:z.string().datetime().optional()}).strict().refine(v=>!v.from||!v.to||Date.parse(v.from)<=Date.parse(v.to),'Invalid date range')
export function incidentWhere(p){return {...(p.status?{lifecycleStatus:p.status}:{}),...(p.severity?{severityLevel:p.severity}:{}),...(p.workerId?{workerId:p.workerId}:{}),...(p.ownerId?{ownerId:p.ownerId}:{}),...(p.kind?{kind:p.kind}:{}),...(p.simulation?{simulation:p.simulation==='true'}:{}),...(p.from||p.to?{createdAt:{...(p.from?{gte:new Date(p.from)}:{}),...(p.to?{lte:new Date(p.to)}:{})}}:{}),...(p.q?{OR:[{message:{contains:p.q,mode:'insensitive'}},{id:{contains:p.q,mode:'insensitive'}},{workerId:{contains:p.q,mode:'insensitive'}}]}:{})}}
export function mountIncidents(app,{auth,repository,service}){
 const db=repository.db
 const elevated=user=>['ADMIN','SUPERVISOR'].includes(user.role)
 const handle=fn=>async(req,res,next)=>{try{await fn(req,res)}catch(e){next(e)}}

 app.get('/api/operations/responders',auth.roles('ADMIN','SUPERVISOR'),handle(async(req,res)=>res.json({data:await db.user.findMany({where:{active:true},select:{id:true,name:true,role:true},orderBy:{name:'asc'}})})))
 app.get('/api/operations/incidents',handle(async(req,res)=>{
  const p=incidentListFilters.parse(req.query)
  const where=incidentWhere(p)
  const rows=await db.operationalIncident.findMany({where,take:p.limit+1,...(p.cursor?{cursor:{id:p.cursor},skip:1}:{}),orderBy:[{createdAt:'desc'},{id:'desc'}],include:{events:{orderBy:[{createdAt:'asc'},{id:'asc'}]}}})
  res.json({data:rows.slice(0,p.limit),nextCursor:rows.length>p.limit?rows[p.limit-1].id:null})
 }))
 app.get('/api/operations/incidents/:id',handle(async(req,res)=>{
  const incident=await db.operationalIncident.findUnique({where:{id:req.params.id},include:{events:{orderBy:[{createdAt:'asc'},{id:'asc'}]}}})
  if(!incident)fail(404,'Incident not found')
  res.json(incident)
 }))
 app.post('/api/operations/incidents',auth.roles('ADMIN','SUPERVISOR'),handle(async(req,res)=>{
  const input=z.object({workerId:z.string().min(1).max(50).optional(),severity:z.enum([...levels,'warning','critical','low','medium','high']).transform(severityLevel),message:noteSchema,simulation:z.boolean()}).strict().parse(req.body)
  const incident=await db.$transaction(async tx=>{
   if(input.workerId&&!await tx.worker.findUnique({where:{id:input.workerId}}))fail(400,'Unknown worker')
   const incident=await tx.operationalIncident.create({data:{id:randomUUID(),...input,severity:legacySeverity(input.severity),severityLevel:input.severity,events:{create:{id:randomUUID(),actorId:req.auth.userId,action:'created',note:input.message,toStatus:'OPEN'}}}})
   await auth.audit('incident.created',req.auth.userId,incident.id,{simulation:input.simulation,severityLevel:input.severity},tx)
   return incident
  })
  await service.refreshDevices();service.publishIncident(incident);res.status(201).json(incident)
 }))
 app.post('/api/operations/incidents/:id/events',handle(async(req,res)=>{
  const {action,note,ownerId,version}=z.object({action:z.enum(['acknowledge','assign','start','resolve','close','note','escalate']),note:noteSchema,ownerId:z.string().min(1).max(100).optional(),version:z.number().int().nonnegative().optional()}).strict().superRefine((v,ctx)=>{if(v.action==='assign'&&!v.ownerId)ctx.addIssue({code:'custom',message:'Assignment requires ownerId'});if(v.action!=='assign'&&v.ownerId)ctx.addIssue({code:'custom',message:'ownerId is assignment-only'})}).parse(req.body)
  const incident=await db.$transaction(async tx=>{
   const current=await tx.operationalIncident.findUnique({where:{id:req.params.id}})
   if(!current)fail(404,'Incident not found')
   if(version!==undefined&&version!==current.version)fail(409,'Incident changed; refresh before retrying')
   const from=current.lifecycleStatus
   if(from==='CLOSED')fail(409,'Closed incidents are immutable')
   const manager=elevated(req.auth.user),owner=current.ownerId===req.auth.userId
   if(['assign','close','escalate'].includes(action)&&!manager)fail(403,'Supervisor or administrator required')
   if(['start','resolve'].includes(action)&&!manager&&!owner)fail(403,'Only the assigned responder or a supervisor may perform this action')
   let to=from,newLevel=current.severityLevel
   const next={acknowledge:['OPEN','ACKNOWLEDGED'],start:['ASSIGNED','IN_PROGRESS'],resolve:['IN_PROGRESS','RESOLVED'],close:['RESOLVED','CLOSED']}[action]
   if(next){if(from!==next[0])fail(409,`Cannot ${action} an incident in ${from}`);to=next[1]}
   if(action==='assign'){
    if(!['ACKNOWLEDGED','ASSIGNED'].includes(from))fail(409,'Acknowledge before assigning; in-progress work cannot be silently reassigned')
    if(!await tx.user.findFirst({where:{id:ownerId,active:true}}))fail(400,'Assignee must be an active user')
    if(from==='ASSIGNED'&&ownerId===current.ownerId)fail(409,'Already assigned to this user')
    to='ASSIGNED'
   }
   if(action==='escalate'){
    if(['RESOLVED','CLOSED'].includes(from))fail(409,'Cannot escalate a completed incident')
    if(rank(newLevel)===3)fail(409,'Already at CRITICAL severity')
    newLevel=levels[rank(newLevel)+1]
   }
   const now=new Date()
   const incident=await tx.operationalIncident.update({where:{id:current.id},data:{lifecycleStatus:to,status:legacyStatus(to),severityLevel:newLevel,severity:legacySeverity(newLevel),version:{increment:1},updatedAt:now,...(action==='assign'?{ownerId}:{}),...(action==='resolve'?{resolvedAt:now,dedupKey:null}:{}),...(action==='close'?{closedAt:now}:{}),events:{create:{id:randomUUID(),actorId:req.auth.userId,action,note,fromStatus:from,toStatus:to,ownerId:action==='assign'?ownerId:current.ownerId}}}})
   await auth.audit(`incident.${action}`,req.auth.userId,current.id,{fromStatus:from,toStatus:to,ownerId:incident.ownerId,severityLevel:newLevel},tx)
   return incident
  },{isolationLevel:'Serializable'})
  await service.refreshDevices();service.publishIncident(incident);res.json(incident)
 }))
 app.get('/api/operations/escalation-rules',auth.roles('ADMIN','SUPERVISOR'),handle(async(req,res)=>res.json({data:await db.incidentEscalationRule.findMany({orderBy:{createdAt:'desc'}})})))
 app.post('/api/operations/escalation-rules',auth.roles('ADMIN'),handle(async(req,res)=>{
  const data=z.object({name:z.string().trim().min(1).max(100),afterMinutes:z.number().int().min(1).max(10080),targetSeverity:z.enum(levels),enabled:z.boolean().default(false)}).strict().parse(req.body)
  const rule=await db.$transaction(async tx=>{const rule=await tx.incidentEscalationRule.create({data:{id:randomUUID(),...data,createdBy:req.auth.userId}});await auth.audit('incident.escalation_rule_created',req.auth.userId,rule.id,data,tx);return rule})
  res.status(201).json(rule)
 }))
 app.patch('/api/operations/escalation-rules/:id',auth.roles('ADMIN'),handle(async(req,res)=>{
  const data=z.object({enabled:z.boolean()}).strict().parse(req.body)
  const rule=await db.$transaction(async tx=>{const rule=await tx.incidentEscalationRule.update({where:{id:req.params.id},data});await auth.audit('incident.escalation_rule_updated',req.auth.userId,rule.id,data,tx);return rule})
  res.json(rule)
 }))
 // Explicit bounded demonstration evaluation. No heavy timer or external notification.
 app.post('/api/operations/incidents-escalate-due',auth.roles('ADMIN','SUPERVISOR'),handle(async(req,res)=>{
  z.object({}).strict().parse(req.body)
  const result=await db.$transaction(async tx=>{
   const rules=await tx.incidentEscalationRule.findMany({where:{enabled:true},orderBy:{afterMinutes:'asc'}})
   const candidates=await tx.operationalIncident.findMany({where:{simulation:true,lifecycleStatus:{notIn:['RESOLVED','CLOSED']},OR:rules.map(r=>({severityLevel:{in:levels.filter(level=>rank(level)<rank(r.targetSeverity))},createdAt:{lte:new Date(Date.now()-r.afterMinutes*60000)}}))},take:100,orderBy:{createdAt:'asc'}})
   let changed=0
   for(const incident of candidates){
    const eligible=rules.filter(r=>Date.now()-incident.createdAt.getTime()>=r.afterMinutes*60000&&rank(r.targetSeverity)>rank(incident.severityLevel)).sort((a,b)=>rank(b.targetSeverity)-rank(a.targetSeverity))
    const rule=eligible[0];if(!rule)continue
    await tx.operationalIncident.update({where:{id:incident.id},data:{severityLevel:rule.targetSeverity,severity:legacySeverity(rule.targetSeverity),version:{increment:1},updatedAt:new Date(),events:{create:{id:randomUUID(),actorId:req.auth.userId,action:'escalation_rule',note:`DEMONSTRATION escalation: ${rule.name}. No responder notified.`,fromStatus:incident.lifecycleStatus,toStatus:incident.lifecycleStatus,ownerId:incident.ownerId,escalationRuleId:rule.id}}}})
    await auth.audit('incident.escalation_rule_applied',req.auth.userId,incident.id,{ruleId:rule.id,targetSeverity:rule.targetSeverity},tx);changed++
   }
   return {changed,evaluated:candidates.length}
  },{isolationLevel:'Serializable'})
  await service.refreshDevices();res.json(result)
 }))
}
