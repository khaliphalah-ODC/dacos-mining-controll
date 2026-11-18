// Explicit production target; never imports fixtures or resets a database.
import {readFile,readdir} from 'node:fs/promises'
import {parseEnv} from 'node:util'
import {spawnSync} from 'node:child_process'
import {resolve} from 'node:path'
import pg from 'pg'
import jwt from 'jsonwebtoken'
const root=resolve(import.meta.dirname,'..'),file=resolve(root,'deploy/.env')
const configured=parseEnv(await readFile(file,'utf8'))
const env={...process.env,...configured}
const valid=value=>{const u=new URL(value);if(!['postgres:','postgresql:'].includes(u.protocol)||!u.hostname.endsWith('.neon.tech')||u.searchParams.get('sslmode')!=='require'||/USER|PASSWORD|YOUR-|REPLACE/.test(value))throw Error('Configure actual Neon URLs with sslmode=require');return u}
const connectConfig=value=>{const u=new URL(value);u.searchParams.delete('sslmode');return {connectionString:u.href,ssl:{rejectUnauthorized:true},connectionTimeoutMillis:60000}}
let client
try{
 const runtime=valid(env.DATABASE_URL),direct=valid(env.DATABASE_URL_UNPOOLED)
 if(runtime.hostname.replace('-pooler','')!==direct.hostname||runtime.username!==direct.username||runtime.password!==direct.password||runtime.pathname!==direct.pathname||(runtime.searchParams.get('schema')??'public')!==(direct.searchParams.get('schema')??'public'))throw Error('Runtime and direct URLs must target the same Neon database and schema')
 if(Buffer.byteLength(env.DACOS_JWT_SECRET??'')<48)throw Error('Signing secret must contain at least 48 bytes')
 client=new pg.Client(connectConfig(env.DATABASE_URL_UNPOOLED))
 await client.connect()
 if(!client.connection.stream.encrypted||!client.connection.stream.authorized)throw Error('Database connection must use TLS')
 const token=jwt.sign({purpose:'configuration-check'},env.DACOS_JWT_SECRET,{algorithm:'HS256',expiresIn:'1m'});jwt.verify(token,env.DACOS_JWT_SECRET,{algorithms:['HS256']});
 console.log('Neon direct connection: authenticated; verified TLS active. URL pair valid; JWT signing and verification successful.')
 if(process.argv[2]==='migrate'){
  const result=spawnSync(process.execPath,[resolve(root,'node_modules/prisma/build/index.js'),'migrate','deploy','--schema',resolve(root,'backend/prisma/schema.prisma')],{cwd:root,env:{...env,DATABASE_URL:env.DATABASE_URL_UNPOOLED},encoding:'utf8',timeout:180000})
  if(result.status!==0){console.error('Migration failed. Diagnostic:',String(result.stderr??'').replace(/postgres(?:ql)?:\/\/\S+/g,'[REDACTED DATABASE URL]').replaceAll(decodeURIComponent(direct.password),'[REDACTED]'));process.exitCode=1;}
  else console.log('Prisma migrate deploy: successful. No seed or data-import command executed.')
 }else if(process.argv[2]!=='check')throw Error('Use check or migrate')
 const tables=await client.query("SELECT tablename FROM pg_tables WHERE schemaname=$1 ORDER BY tablename",[direct.searchParams.get('schema')??'public'])
 const counts={}
 for(const {tablename} of tables.rows){const schema=direct.searchParams.get('schema')??'public';const q=x=>'"'+x.replaceAll('"','""')+'"';const result=await client.query(`SELECT count(*)::text AS count FROM ${q(schema)}.${q(tablename)}`);counts[tablename]=result.rows[0].count}
 const expected=(await readdir(resolve(root,'backend/prisma/migrations'),{withFileTypes:true})).filter(e=>e.isDirectory()).map(e=>e.name)
 let migrationCheck={expected:expected.length,applied:0,pending:expected,unresolved:0}
 if(tables.rows.some(t=>t.tablename==='_prisma_migrations')){const quote=x=>'\"'+x.replaceAll('\"','\"\"')+'\"';const rows=(await client.query(`SELECT migration_name,finished_at,rolled_back_at FROM ${quote(direct.searchParams.get('schema')??'public')}.\"_prisma_migrations\"`)).rows;const applied=rows.filter(r=>r.finished_at&&!r.rolled_back_at).map(r=>r.migration_name);migrationCheck={expected:expected.length,applied:applied.length,pending:expected.filter(n=>!applied.includes(n)),unresolved:rows.filter(r=>!r.finished_at&&!r.rolled_back_at).length};if(migrationCheck.pending.length||migrationCheck.unresolved)process.exitCode=1}
 console.log(JSON.stringify({migrations:migrationCheck,tableRows:counts,applicationRows:Object.entries(counts).filter(([name])=>name!=='_prisma_migrations').reduce((n,[,v])=>n+Number(v),0)},null,2))
 for(let attempt=0;attempt<3;attempt++){const pooled=new pg.Client(connectConfig(env.DATABASE_URL));try{await pooled.connect();await pooled.query('SELECT 1');console.log('Neon pooled runtime connection: authenticated.');break}catch(error){if(attempt===2||!['ETIMEDOUT','ECONNRESET','ECONNREFUSED','ENETUNREACH'].includes(error.code))throw error;console.log('Transient runtime connection failure; retrying.')}finally{await pooled.end()}}
}catch(error){console.error('Production database check failed:',error.code??error.message?.replace(/postgres(?:ql)?:\/\/\S+/g,'[REDACTED DATABASE URL]'));process.exitCode=1}finally{await client?.end()}
