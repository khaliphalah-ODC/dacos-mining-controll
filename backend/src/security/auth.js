import { randomBytes, randomUUID, createHash, scrypt as derive, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import bcrypt from 'bcrypt'
import {allowedOrigin,configuredOrigins} from './origins.js'
import jwt from 'jsonwebtoken'
import { z } from 'zod'
const scrypt = promisify(derive)
const digest = value => createHash('sha256').update(value).digest('hex')
const secret = () => randomBytes(32).toString('hex')
export const passwordSchema = z.string().min(12).max(128).refine(value => Buffer.byteLength(value, 'utf8') <= 72, 'Password must fit within 72 UTF-8 bytes')
const developmentKey = randomBytes(48)
const issuer = 'dacos-auth'
const audience = 'dacos-operations'
const sessionSeconds = 8 * 3600
export const publicUser = ({ id, email, name, role, active }) => ({ id, email, name, role, active })
export async function hashPassword(password) {
  passwordSchema.parse(password)
  return bcrypt.hash(password, 12)
}
export async function verifyPassword(password, encoded) {
  if (/^\$2[aby]\$/.test(encoded)) return Buffer.byteLength(password, 'utf8') <= 72 && bcrypt.compare(password, encoded)
  const [algorithm, salt, expected] = encoded.split(':')
  if (algorithm !== 'scrypt' || !salt || !/^[a-f0-9]{128}$/.test(expected ?? '')) return false
  const actual = await scrypt(password, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 })
  return timingSafeEqual(actual, Buffer.from(expected, 'hex'))
}
const denied = (status, message) => Object.assign(new Error(message), { status })
export class AuthService {
  constructor(db, { secure = process.env.NODE_ENV === 'production' || Boolean(process.env.DEVICE_TLS_CERT), clock = () => new Date(), jwtSecret = process.env.DACOS_JWT_SECRET } = {}) {
    if (jwtSecret && Buffer.byteLength(jwtSecret) < 48) throw new Error('DACOS_JWT_SECRET must contain at least 48 bytes of random key material')
    if (process.env.NODE_ENV === 'production' && !jwtSecret) throw new Error('DACOS_JWT_SECRET is required in production')
    this.origins=configuredOrigins()
    this.jwtKey = jwtSecret ?? developmentKey
    this.db = db; this.secure = secure; this.clock = clock
    this.cookieName = secure ? '__Host-dacos_session' : 'dacos_session'
    this.dummy = hashPassword(secret())
  }
  audit(action, actorId = null, targetId = null, details = {}, db = this.db) {
    return db.auditEvent.create({ data: { id: randomUUID(), action, actorId, targetId, details } })
  }
  cookie(res, token, expiresAt) {
    res.cookie(this.cookieName, token, { httpOnly: true, secure: this.secure, sameSite: 'strict', path: '/', expires: expiresAt })
  }
  async session(cookie = '') {
    const token = cookie.split(';').map(s => s.trim()).find(s => s.startsWith(`${this.cookieName}=`))?.slice(this.cookieName.length + 1)
    if (!token || token.length > 2048) return null
    let claims
    try {
      claims = jwt.verify(token, this.jwtKey, { algorithms:['HS256'],issuer,audience,clockTimestamp:Math.floor(this.clock().getTime()/1000),maxAge:sessionSeconds })
    } catch { return null }
    if (typeof claims !== 'object' || typeof claims.sub !== 'string' || !/^[a-f0-9]{64}$/.test(claims.jti ?? '') || !Number.isInteger(claims.exp) || !Number.isInteger(claims.iat)) return null
    const session = await this.db.session.findUnique({ where: { id: digest(claims.jti) }, include: { user: true } })
    return session?.user.active && session.userId === claims.sub && session.user.role === claims.role && session.expiresAt > this.clock() ? {...session,expiresAt:new Date(Math.min(session.expiresAt.getTime(),claims.exp*1000))} : null
  }
  middleware = async (req, res, next) => {
    try { req.auth = await this.session(req.headers.cookie); if (!req.auth) throw denied(401, 'Sign in required'); next() } catch (e) { next(e) }
  }
  roles(...roles) { return (req, res, next) => roles.includes(req.auth?.user.role) ? next() : next(denied(403, 'Insufficient permission')) }
  csrf = (req, res, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next()
    if (!req.auth || req.get('x-csrf-token') !== req.auth.csrfToken) return next(denied(403, 'Invalid CSRF token'))
    next()
  }
  sameOrigin = (req, res, next) => {
    const origin = req.get('origin')
    if (!allowedOrigin(origin,req.get('host'),this.origins)) return next(denied(403, 'Same-origin request required'))
    if (this.secure && !origin.startsWith('https://')) return next(denied(403, 'HTTPS required'))
    next()
  }
  async createUser(input, actorId = null) {
    const data = z.object({ email: z.string().email().max(254).transform(s => s.toLowerCase()), name: z.string().trim().min(1).max(100), role: z.enum(['ADMIN','SUPERVISOR','OPERATOR']), password: passwordSchema }).strict().parse(input)
    const passwordHash = await hashPassword(data.password)
    return this.db.$transaction(async tx => {
      const { password, ...profile } = data
      const user = await tx.user.create({ data: { ...profile, id: randomUUID(), passwordHash } })
      await this.audit('user.created', actorId, user.id, { role: user.role }, tx)
      return publicUser(user)
    })
  }
  async login(req, res) {
    const { email, password } = z.object({ email: z.string().email().max(254).transform(s => s.toLowerCase()), password: z.string().min(1).max(128) }).strict().parse(req.body)
    const now=this.clock().getTime(),key=digest(req.ip ?? req.socket.remoteAddress ?? 'unknown')
    const resetAt=new Date(now+900000),at=new Date(now)
    const [bucket]=await this.db.$queryRaw`INSERT INTO "LoginThrottle" ("id","hits","resetAt") VALUES (${key},1,${resetAt}) ON CONFLICT ("id") DO UPDATE SET "hits"=CASE WHEN "LoginThrottle"."resetAt"<=${at} THEN 1 ELSE "LoginThrottle"."hits"+1 END,"resetAt"=CASE WHEN "LoginThrottle"."resetAt"<=${at} THEN ${resetAt} ELSE "LoginThrottle"."resetAt" END RETURNING "hits"`
    if(bucket.hits>10)throw denied(429,'Too many login attempts; try again later')
    const user = await this.db.user.findUnique({ where: { email } })
    const valid = await verifyPassword(password, user?.passwordHash ?? await this.dummy)
    if (!valid || !user?.active) { await this.audit('auth.login_failed'); throw denied(401, 'Invalid email or password') }
    const nonce = secret(), csrfToken = secret(), expiresAt = new Date(now + sessionSeconds * 1000)
    const token = jwt.sign({ role:user.role,iat:Math.floor(now/1000) }, this.jwtKey, { algorithm:'HS256',issuer,audience,subject:user.id,jwtid:nonce,expiresIn:sessionSeconds })
    const upgradedHash = user.passwordHash.startsWith('scrypt:') && Buffer.byteLength(password,'utf8') <= 72 ? await hashPassword(password) : null
    await this.db.$transaction(async tx => {
      const current = await tx.user.findUnique({where:{id:user.id}})
      if (!current?.active || current.passwordHash !== user.passwordHash || current.role !== user.role) throw denied(401,'Account changed; sign in again')
      if (upgradedHash) {
        const upgraded = await tx.user.updateMany({where:{id:user.id,passwordHash:user.passwordHash,active:true},data:{passwordHash:upgradedHash}})
        if (!upgraded.count) throw denied(401,'Account changed; sign in again')
        await this.audit('auth.password_hash_upgraded',user.id,user.id,{},tx)
      }
      await tx.session.create({ data: { id: digest(nonce), userId: user.id, csrfToken, expiresAt } })
      await this.audit('auth.login', user.id, user.id, {}, tx)
    })
    this.cookie(res, token, expiresAt)
    return { user: publicUser(user), csrfToken, expiresAt }
  }
  async redeemSocketTicket(token){
    if(typeof token!=='string'||!/^[a-f0-9]{64}$/.test(token))return null
    return this.db.$transaction(async tx=>{
      const result=await tx.socketTicket.updateMany({where:{id:digest(token),usedAt:null,expiresAt:{gt:this.clock()}},data:{usedAt:this.clock()}})
      if(!result.count)return null
      const ticket=await tx.socketTicket.findUnique({where:{id:digest(token)},include:{session:{include:{user:true}}}})
      const session=ticket?.session
      if(!session?.user.active||session.expiresAt<=this.clock()||ticket.sessionExpiresAt<=this.clock())return null
      return {...session,expiresAt:new Date(Math.min(session.expiresAt.getTime(),ticket.sessionExpiresAt.getTime()))}
    })
  }
  async activeSession(id){
    const session=await this.db.session.findUnique({where:{id},include:{user:true}})
    return session?.user.active&&session.expiresAt>this.clock()?session:null
  }
  mount(app) {
    app.post('/api/auth/socket-ticket',this.middleware,this.sameOrigin,this.csrf,async(req,res,next)=>{
      try{
        if(await this.db.socketTicket.count({where:{sessionId:req.auth.id,usedAt:null,expiresAt:{gt:this.clock()}}})>=10)throw denied(429,'Too many pending socket tickets')
        const ticket=secret(),expiresAt=new Date(this.clock().getTime()+30000)
        await this.db.socketTicket.create({data:{id:digest(ticket),sessionId:req.auth.id,expiresAt,sessionExpiresAt:req.auth.expiresAt}})
        res.json({ticket,expiresAt})
      }catch(e){next(e)}
    })
    app.post('/api/auth/login', this.sameOrigin, async (req, res, next) => { try { res.json(await this.login(req, res)) } catch (e) { next(e) } })
    app.get('/api/auth/session', this.middleware, (req, res) => res.json({ user: publicUser(req.auth.user), csrfToken: req.auth.csrfToken, expiresAt: req.auth.expiresAt }))
    app.post('/api/auth/logout', this.middleware, this.sameOrigin, this.csrf, async (req, res, next) => {
      try {
        await this.db.$transaction(async tx => { await tx.session.deleteMany({ where: { id: req.auth.id } }); await this.audit('auth.logout', req.auth.userId, null, {}, tx) })
        this.cookie(res, '', new Date(0)); res.json({ loggedOut: true })
      } catch (e) { next(e) }
    })
    app.post('/api/auth/password', this.middleware, this.sameOrigin, this.csrf, async (req, res, next) => {
      try {
        const { currentPassword, password } = z.object({ currentPassword: z.string().max(128), password: passwordSchema }).strict().parse(req.body)
        if (!await verifyPassword(currentPassword, req.auth.user.passwordHash)) throw denied(401, 'Current password is incorrect')
        const passwordHash = await hashPassword(password)
        await this.db.$transaction(async tx => {
          await tx.user.update({ where: { id: req.auth.userId }, data: { passwordHash } })
          await tx.session.deleteMany({ where: { userId: req.auth.userId } })
          await this.audit('auth.password_changed', req.auth.userId, req.auth.userId, {}, tx)
        })
        this.cookie(res, '', new Date(0)); res.json({ signInRequired: true })
      } catch (e) { next(e) }
    })
    app.get('/api/users', this.middleware, this.roles('ADMIN'), async (req,res,next)=>{try{
      const p=z.object({q:z.string().max(100).default(''),limit:z.coerce.number().int().min(1).max(100).optional(),cursor:z.string().uuid().optional()}).strict().parse(req.query)
      const rows=await this.db.user.findMany({where:{OR:[{name:{contains:p.q,mode:'insensitive'}},{email:{contains:p.q,mode:'insensitive'}}]},orderBy:{id:'asc'},...(p.limit?{take:p.limit+1}:{}),...(p.cursor?{cursor:{id:p.cursor},skip:1}:{})})
      res.json({data:(p.limit?rows.slice(0,p.limit):rows).map(publicUser),nextCursor:p.limit&&rows.length>p.limit?rows[p.limit-1].id:null})
    }catch(e){next(e)}})
    app.post('/api/users', this.middleware, this.roles('ADMIN'), this.sameOrigin, this.csrf, async (req, res, next) => { try { res.status(201).json(await this.createUser(req.body, req.auth.userId)) } catch (e) { next(e) } })
    app.patch('/api/users/:id', this.middleware, this.roles('ADMIN'), this.sameOrigin, this.csrf, async (req, res, next) => {
      try {
        const input = z.object({ name:z.string().trim().min(1).max(100).optional(), role:z.enum(['ADMIN','SUPERVISOR','OPERATOR']).optional(), active:z.boolean().optional(), password:passwordSchema.optional() }).strict().parse(req.body)
        if (req.params.id === req.auth.userId && (input.active === false || input.role && input.role !== 'ADMIN' || input.password)) throw denied(409, 'Use account settings for your password; another admin must change your access')
        const { password, ...data } = input
        if (password) data.passwordHash = await hashPassword(password)
        const user = await this.db.$transaction(async tx => {
          const user = await tx.user.update({ where: { id:req.params.id }, data })
          if (!await tx.user.count({ where: { role:'ADMIN', active:true } })) throw denied(409, 'At least one active administrator is required')
          if (password || input.role || input.active === false) await tx.session.deleteMany({ where: { userId:user.id } })
          await this.audit('user.updated',req.auth.userId,user.id,{ ...Object.fromEntries(Object.entries(input).filter(([key]) => key !== 'password')), passwordReset:!!password },tx)
          return user
        }, { isolationLevel:'Serializable' })
        res.json(publicUser(user))
      } catch(e) { next(e) }
    })
    app.get('/api/audit', this.middleware, this.roles('ADMIN'), async(req,res,next)=>{try{
      const p=z.object({q:z.string().max(100).default(''),limit:z.coerce.number().int().min(1).max(100).default(100),cursor:z.string().uuid().optional()}).strict().parse(req.query)
      const rows=await this.db.auditEvent.findMany({where:{OR:['action','actorId','targetId'].map(key=>({[key]:{contains:p.q,mode:'insensitive'}}))},take:p.limit+1,orderBy:[{createdAt:'desc'},{id:'desc'}],...(p.cursor?{cursor:{id:p.cursor},skip:1}:{})})
      res.json({data:rows.slice(0,p.limit),nextCursor:rows.length>p.limit?rows[p.limit-1].id:null})
    }catch(e){next(e)}})
  }
}
