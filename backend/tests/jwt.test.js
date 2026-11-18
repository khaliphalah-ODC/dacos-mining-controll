import { describe,it,expect,vi } from 'vitest'
import jwt from 'jsonwebtoken'
import { scryptSync } from 'node:crypto'
import { AuthService,hashPassword,verifyPassword,passwordSchema } from '../src/security/auth.js'
const key = 'jwt-test-key-material-only-'.repeat(3)
describe('bcrypt and revocable JWT sessions', () => {
  it('hashes with bcrypt cost 12, rejects byte truncation, and verifies legacy scrypt', async () => {
    const password = 'A-test-password-2026'
    const hash = await hashPassword(password)
    expect(hash).toMatch(/^\$2b\$12\$/)
    expect(await verifyPassword(password,hash)).toBe(true)
    expect(await verifyPassword('wrong',hash)).toBe(false)
    expect(passwordSchema.safeParse('é'.repeat(37)).success).toBe(false)
    expect(await verifyPassword('a'.repeat(73),hash)).toBe(false)
    const legacy = `scrypt:legacy-test-salt:${scryptSync(password,'legacy-test-salt',64,{N:32768,r:8,p:1,maxmem:64*1024*1024}).toString('hex')}`
    expect(await verifyPassword(password,legacy)).toBe(true)
  })
  it('verifies signature, algorithm, issuer, audience, subject, role and expiration against persisted sessions', async () => {
    const user = {id:'user-test',role:'OPERATOR',active:true}
    const row = {id:'hashed-jti',userId:user.id,user,expiresAt:new Date(Date.now()+3600000)}
    const db = {session:{findUnique:vi.fn(async () => row)}}
    const auth = new AuthService(db,{jwtSecret:key})
    const sign = (payload={},options={}) => jwt.sign({role:'OPERATOR',...payload},key,{algorithm:'HS256',issuer:'dacos-auth',audience:'dacos-operations',subject:user.id,jwtid:'a'.repeat(64),expiresIn:3600,...options})
    const cookie = token => `${auth.cookieName}=${token}`
    const verified=await auth.session(cookie(sign()))
    expect(verified.id).toBe(row.id);expect(verified.user).toBe(user)
    expect(verified.expiresAt.getTime()).toBeLessThanOrEqual(row.expiresAt.getTime())
    for (const token of [sign({role:'ADMIN'}),sign({}, {issuer:'other'}),sign({}, {audience:'other'}),sign({}, {subject:'other'}),sign({}, {expiresIn:-1}),sign({}, {algorithm:'HS384'}),sign()+'changed']) expect(await auth.session(cookie(token))).toBeNull()
    db.session.findUnique.mockResolvedValue(null)
    expect(await auth.session(cookie(sign()))).toBeNull()
  })
})
