import {createInterface} from 'node:readline/promises'
import {stdin,stdout} from 'node:process'
import {existsSync} from 'node:fs'
import {readFile} from 'node:fs/promises'
import {createConnection} from 'node:net'
import {randomUUID,createHash} from 'node:crypto'
import {z} from 'zod'
import {createRepository} from '../src/repositories/postgres.js'
import {hashPassword,passwordSchema} from '../src/security/auth.js'
import {startDatabase} from './database.mjs'
if(existsSync('.env'))process.loadEnvFile('.env')
const password=process.env.DACOS_RESET_PASSWORD
if(!password)throw new Error('Set DACOS_RESET_PASSWORD privately in your terminal first. See docs/PASSWORD_RECOVERY.md.')
passwordSchema.parse(password)
let database,repository
const input=createInterface({input:stdin,output:stdout})
try{
 let url=process.env.DATABASE_URL
 if(!url){
  const running=await new Promise(resolve=>{const socket=createConnection({host:'127.0.0.1',port:55432});socket.setTimeout(1000);socket.once('connect',()=>{socket.destroy();resolve(true)});for(const event of ['error','timeout'])socket.once(event,()=>{socket.destroy();resolve(false)})})
  if(running){
   if(!existsSync('.data/postgres.credential'))throw new Error('Local database is running but project credentials are unavailable')
   const credential=await readFile('.data/postgres.credential','utf8')
   url=`postgresql://dacos:${encodeURIComponent(credential)}@127.0.0.1:55432/dacos`
  }else{database=await startDatabase();url=database.url}
 }
 let target;try{target=new URL(url)}catch{throw new Error('Invalid database configuration')}
 if(!['localhost','127.0.0.1','[::1]'].includes(target.hostname)||target.pathname!=='/dacos')throw new Error('Recovery is limited to the local dacos database. External database changes require separate approval.')
 repository=createRepository(url);await repository.health()
 const email=z.string().trim().email().max(254).parse(process.env.DACOS_RESET_EMAIL??await input.question('DACOS login email: ')).toLowerCase()
 const passwordHash=await hashPassword(password)
 await repository.db.$transaction(async tx=>{
  const user=await tx.user.findUnique({where:{email}})
  if(!user?.active)throw new Error('No active account matches that email. No account or role was changed.')
  await tx.user.update({where:{id:user.id},data:{passwordHash}})
  await tx.session.deleteMany({where:{userId:user.id}})
  await tx.auditEvent.create({data:{id:randomUUID(),action:'auth.local_password_recovery',targetId:user.id,details:{method:'local-terminal'}}})
  const addresses=['127.0.0.1','::ffff:127.0.0.1','::1'].map(ip=>createHash('sha256').update(ip).digest('hex'))
  await tx.loginThrottle.deleteMany({where:{id:{in:addresses}}})
 })
 console.log('Password reset successfully. Sign in again with your existing email and new password. Clear DACOS_RESET_PASSWORD from your terminal environment.')
}catch(error){console.error(error instanceof z.ZodError?'Invalid email or password format. Use at least 12 characters and at most 72 UTF-8 bytes.':error.message?.startsWith('No active account')?error.message:'Password recovery failed. Check local database availability and apply local migrations before retrying.');process.exitCode=1}
finally{input.close();delete process.env.DACOS_RESET_PASSWORD;await repository?.close();await database?.stop()}
