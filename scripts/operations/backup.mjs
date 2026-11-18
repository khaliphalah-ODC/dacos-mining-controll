import {spawn} from 'node:child_process'
import {mkdir,writeFile,readFile} from 'node:fs/promises'
import {createReadStream} from 'node:fs'
import {resolve} from 'node:path'
import {createHash} from 'node:crypto'
import {PrismaClient} from '@prisma/client'
process.umask(0o077)
const mode=process.argv[2],input=process.argv[3]
if(!['backup','verify-restore'].includes(mode))throw new Error('Use backup or verify-restore <trusted backup path>')
function environment(value){if(!value)throw new Error('An explicit database URL is required');let u;try{u=new URL(value)}catch{throw new Error('Invalid database URL')}return {...process.env,PGSSLMODE:u.searchParams.get('sslmode')??(['localhost','127.0.0.1'].includes(u.hostname)?'prefer':'verify-full'),PGHOST:u.hostname,PGPORT:u.port||'5432',PGUSER:decodeURIComponent(u.username),PGPASSWORD:decodeURIComponent(u.password),PGDATABASE:decodeURIComponent(u.pathname.slice(1))}}
async function run(command,args,env){await new Promise((resolve,reject)=>{const p=spawn(command,args,{env,stdio:['ignore','ignore','inherit']});p.on('error',reject);p.on('exit',c=>c===0?resolve():reject(new Error(`${command} failed (${c})`)))})}
async function checksum(path){const hash=createHash('sha256');for await(const chunk of createReadStream(path))hash.update(chunk);return hash.digest('hex')}
if(mode==='backup'){
 const env=environment(process.env.DATABASE_URL_UNPOOLED??process.env.DATABASE_URL),directory=resolve('.data/backups');await mkdir(directory,{recursive:true,mode:0o700})
 const file=resolve(directory,`dacos-${new Date().toISOString().replaceAll(':','-')}.dump`)
 await run('pg_dump',['--format=custom','--file',file],env)
 await writeFile(file+'.json',JSON.stringify({sha256:await checksum(file),createdAt:new Date().toISOString()}),{mode:0o600})
 console.log(`Backup saved: ${file}`)
}else{
 if(!input)throw new Error('Supply a trusted backup path')
 const file=resolve(input),target=process.env.RESTORE_DATABASE_URL,env=environment(target)
 if(!env.PGDATABASE.endsWith('_restore_check'))throw new Error('Restore verification requires a separate database ending in _restore_check')
 if(process.env.DATABASE_URL){const source=environment(process.env.DATABASE_URL);if(['PGHOST','PGPORT','PGDATABASE'].every(k=>source[k]===env[k]))throw new Error('Restore target must differ from source')}
 const metadata=JSON.parse(await readFile(file+'.json','utf8'));if(metadata.sha256!==await checksum(file))throw new Error('Backup checksum mismatch')
 const db=new PrismaClient({datasources:{db:{url:target}}})
 try{
  const tables=await db.$queryRaw`SELECT table_name FROM information_schema.tables WHERE table_schema='public'`
  if(tables.length)throw new Error('Restore verification target must be empty; no existing records will be removed')
  await run('pg_restore',['--no-owner','--no-acl','--single-transaction','--dbname',env.PGDATABASE,file],env)
  console.log(JSON.stringify({workers:await db.worker.count(),users:await db.user.count(),telemetry:await db.deviceTelemetry.count(),auditEvents:await db.auditEvent.count()}))
 }finally{await db.$disconnect()}
}
