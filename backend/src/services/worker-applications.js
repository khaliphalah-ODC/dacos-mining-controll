import { randomUUID, createHash } from 'node:crypto'
import { z } from 'zod'
import { workerApplicationSchema, applicationReviewSchema, phoneKey, identityKey } from '@dacos/contracts'
const fail = (status, message) => { throw Object.assign(new Error(message), { status }) }
const digest = value => createHash('sha256').update(value).digest('hex')
const receipt = { message:'Application received for review. Submission does not activate a worker or create a login account.' }
const handle = fn => async (req, res, next) => { try { await fn(req, res) } catch (error) { next(error) } }
const listSchema = z.object({ status:z.enum(['PENDING','APPROVED','REJECTED']).default('PENDING'), cursor:z.string().uuid().optional(), limit:z.coerce.number().int().min(1).max(50).default(20) }).strict()

export async function throttleRegistration(db, ip, now = new Date()) {
  // Atomic PostgreSQL buckets remain effective across processes and restarts.
  for (const [period, limit] of [[15 * 60 * 1000, 5], [24 * 60 * 60 * 1000, 30]]) {
    const id = digest(`worker-registration:${period}:${ip}`), resetAt = new Date(now.getTime() + period)
    const [bucket] = await db.$queryRaw`INSERT INTO "RegistrationThrottle" ("id","hits","resetAt") VALUES (${id},1,${resetAt}) ON CONFLICT ("id") DO UPDATE SET "hits"=CASE WHEN "RegistrationThrottle"."resetAt"<=${now} THEN 1 ELSE "RegistrationThrottle"."hits"+1 END,"resetAt"=CASE WHEN "RegistrationThrottle"."resetAt"<=${now} THEN ${resetAt} ELSE "RegistrationThrottle"."resetAt" END RETURNING "hits","resetAt"`
    if (bucket.hits > limit) fail(429, 'Too many submissions from this connection. Please try again later or contact your supervisor.')
  }
}

const applicationSelect = { id:true,fullName:true,jobTitle:true,site:true,shift:true,workArea:true,status:true,createdAt:true,reviewedAt:true,approvedWorkerId:true }
const duplicateWhere = a => ({ OR:[{phoneKey:a.phoneKey},{nameKey:a.nameKey},...(a.employeeKey ? [{siteKey:a.siteKey,employeeKey:a.employeeKey}] : [])] })
export async function applicationDuplicates(db, a) {
  const [applications, profiles, workers] = await Promise.all([
    db.workerApplication.findMany({where:{id:{not:a.id},...duplicateWhere(a)},select:{...applicationSelect,phoneKey:true,nameKey:true,employeeKey:true,siteKey:true},take:51,orderBy:[{createdAt:'desc'},{id:'desc'}]}),
    db.workerPrivateProfile.findMany({where:{OR:[{phoneKey:a.phoneKey},...(a.employeeKey?[{siteKey:a.siteKey,employeeKey:a.employeeKey}]:[])]},select:{workerId:true,phoneKey:true,siteKey:true,employeeKey:true},take:51}),
    db.worker.findMany({where:{name:{equals:a.fullName,mode:'insensitive'}},select:{id:true,name:true,active:true},take:51}),
  ])
  const reasons = v => [...(v.phoneKey===a.phoneKey?['phone']:[]),...(v.nameKey===a.nameKey?['name']:[]),...(a.employeeKey&&v.employeeKey===a.employeeKey&&v.siteKey===a.siteKey?['site employee number']:[])]
  return {
    applications:applications.slice(0,50).map(v=>({...Object.fromEntries(Object.entries(v).filter(([key])=>!['phoneKey','nameKey','employeeKey','siteKey'].includes(key))),reasons:reasons(v)})),
    workers:profiles.slice(0,50).map(v=>({workerId:v.workerId,reasons:reasons(v)})),
    nameMatches:workers.slice(0,50),
    hasMatches:!!(applications.length||profiles.length||workers.length),
    truncated:applications.length>50||profiles.length>50||workers.length>50,
  }
}

export function mountPublicWorkerApplications(app, { auth, repository }) {
  const db=repository.db
  app.post('/api/public/worker-applications', auth.sameOrigin, handle(async(req,res)=>{
    await throttleRegistration(db, req.ip ?? 'unknown')
    const input=workerApplicationSchema.parse(req.body)
    // Bots receive the same receipt; nothing is stored for the honeypot path.
    if(input.website) return res.status(202).json(receipt)
    const { acknowledgement, website, ...fields }=input
    const normalized={...fields,employeeNumber:fields.employeeNumber||null,emergencyContact:fields.emergencyContact||null,nameKey:identityKey(fields.fullName),phoneKey:phoneKey(fields.phone),siteKey:identityKey(fields.site),employeeKey:fields.employeeNumber?identityKey(fields.employeeNumber):null}
    const fingerprint=digest(JSON.stringify(normalized))
    try {
      await db.$transaction(async tx=>{
        const application=await tx.workerApplication.create({data:{...normalized,id:randomUUID(),fingerprint,acknowledgedAt:new Date()}})
        // No contact data in general audit feeds or realtime broadcasts.
        await auth.audit('worker.application_submitted',null,application.id,{privacyVersion:input.privacyVersion},tx)
      })
    } catch(error) {
      // Partial unique index coalesces exact pending retries, including concurrent submissions.
      if(error.code!=='P2002'||!await db.workerApplication.findFirst({where:{fingerprint,status:'PENDING'},select:{id:true}})) throw error
    }
    res.status(202).json(receipt)
  }))
}

export function mountWorkerApplicationReview(app, { auth, repository, service }) {
  const db=repository.db, guard=auth.roles('ADMIN','SUPERVISOR')
  app.get('/api/manage/worker-applications',guard,handle(async(req,res)=>{
    const p=listSchema.parse(req.query)
    const rows=await db.workerApplication.findMany({where:{status:p.status},select:applicationSelect,take:p.limit+1,...(p.cursor?{cursor:{id:p.cursor},skip:1}:{}),orderBy:[{createdAt:'desc'},{id:'desc'}]})
    res.json({data:rows.slice(0,p.limit),nextCursor:rows.length>p.limit?rows[p.limit-1].id:null})
  }))
  app.get('/api/manage/worker-applications/:id',guard,handle(async(req,res)=>{
    const id=z.string().uuid().parse(req.params.id)
    const a=await db.workerApplication.findUnique({where:{id}})
    if(!a)fail(404,'Application not found')
    const {fingerprint,nameKey,phoneKey,siteKey,employeeKey,...application}=a
    const [duplicates,events]=await Promise.all([
      applicationDuplicates(db,a),
      db.auditEvent.findMany({where:{targetId:id,action:{startsWith:'worker.application_'}},orderBy:[{createdAt:'asc'},{id:'asc'}],take:100}),
    ])
    await auth.audit('worker.application_viewed',req.auth.userId,id)
    res.json({application,duplicates,events})
  }))
  app.post('/api/manage/worker-applications/:id/review',guard,handle(async(req,res)=>{
    const id=z.string().uuid().parse(req.params.id),input=applicationReviewSchema.parse(req.body)
    const result=await db.$transaction(async tx=>{
      const a=await tx.workerApplication.findUnique({where:{id}})
      if(!a)fail(404,'Application not found')
      if(a.status!=='PENDING')fail(409,'This application was already reviewed. Refresh to see the decision.')
      let workerId=null
      if(input.action==='approve') {
        const duplicates=await applicationDuplicates(tx,a)
        if(duplicates.hasMatches&&!input.duplicateAcknowledged)fail(409,'Review potential duplicates and acknowledge them before approval.')
        if(input.mode==='create') {
          if(!await tx.zone.findUnique({where:{id:input.zoneId}}))fail(400,'Select an existing zone')
          const w=await tx.worker.create({data:{id:`WK-${randomUUID()}`,name:a.fullName,role:a.jobTitle,shift:a.shift,zoneId:input.zoneId,origin:'registered'}})
          workerId=w.id
        } else {
          const w=await tx.worker.findUnique({where:{id:input.workerId}})
          if(!w?.active)fail(409,'Select an existing active worker. Linking never reactivates a worker.')
          workerId=w.id
          // An employee identity already attached elsewhere must never be silently moved.
          if(a.employeeKey&&await tx.workerPrivateProfile.findFirst({where:{siteKey:a.siteKey,employeeKey:a.employeeKey,workerId:{not:workerId}}}))fail(409,'This site employee number belongs to another worker. Link the matching worker or reject the application.')
        }
        const existing=await tx.workerPrivateProfile.findUnique({where:{workerId}})
        // Linking retains existing personnel details. Applicant details remain in the reviewed application.
        if(!existing)await tx.workerPrivateProfile.create({data:{workerId,phone:a.phone,phoneKey:a.phoneKey,employeeNumber:a.employeeNumber,employeeKey:a.employeeKey,workArea:a.workArea,site:a.site,siteKey:a.siteKey,emergencyContact:a.emergencyContact}})
        await auth.audit(input.mode==='create'?'worker.created':'worker.application_linked',req.auth.userId,workerId,{applicationId:id},tx)
      }
      const update=await tx.workerApplication.updateMany({where:{id,status:'PENDING'},data:{status:input.action==='approve'?'APPROVED':'REJECTED',reviewedAt:new Date(),reviewedBy:req.auth.userId,reviewNote:input.note,approvedWorkerId:workerId}})
      if(!update.count)fail(409,'Another reviewer has already processed this application.')
      await auth.audit(`worker.application_${input.action==='approve'?'approved':'rejected'}`,req.auth.userId,id,{workerId,mode:input.mode??null,duplicateAcknowledged:input.duplicateAcknowledged??false},tx)
      return {status:input.action==='approve'?'APPROVED':'REJECTED',workerId}
    },{isolationLevel:'Serializable'})
    // Approval is committed; a transient telemetry refresh failure must not invite duplicate review.
    if(result.workerId)try{await service.refreshDevices()}catch{service.lastError=new Error('Worker approved; monitoring refresh pending')}
    res.json(result)
  }))
}
