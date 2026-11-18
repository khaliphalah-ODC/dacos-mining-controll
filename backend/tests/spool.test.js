import {it,expect,vi} from 'vitest'
import {mkdtemp,readdir,rm,readFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {TelemetrySpool} from '../src/gateway/spool.js'
it('retains packets across network failure/restart, retries duplicates and quarantines rejected samples',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'dacos-spool-'))
 const packet={deviceId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',workerId:'W-014',transport:'wifi',source:'simulator',quality:'simulated',sequence:0,timestamp:new Date().toISOString(),connectionStatus:'connected',metrics:[],sos:false}
 try{
  const fetcher=vi.fn().mockRejectedValueOnce(new Error('network down')).mockResolvedValueOnce({ok:true,json:async()=>({duplicate:true,deviceId:packet.deviceId,sequence:0})}).mockResolvedValueOnce({ok:false,status:400})
  const options={directory,url:'http://127.0.0.1:3001/api/device-telemetry',token:'test-only',fetcher}
  const spool=new TelemetrySpool(options)
  await spool.enqueue(packet);await expect(spool.flushOne()).rejects.toThrow('network down')
  expect((await readdir(directory)).filter(f=>f.endsWith('.packet.json'))).toHaveLength(1)
  const restarted=new TelemetrySpool(options);await restarted.flushOne()
  expect((await readdir(directory)).filter(f=>f.endsWith('.packet.json'))).toHaveLength(0)
  await restarted.enqueue({...packet,sequence:1});expect(await restarted.flushOne()).toMatchObject({deadLetter:true})
  expect(await readFile(join(directory,'dead-letter.jsonl'),'utf8')).not.toContain('test-only')
 }finally{await rm(directory,{recursive:true,force:true})}
})
it('retains packets on mismatched acknowledgement and quarantines malformed files without inventing readings',async()=>{
 const {writeFile}=await import('node:fs/promises')
 const directory=await mkdtemp(join(tmpdir(),'dacos-spool-validation-'))
 const packet={deviceId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',workerId:'W-014',transport:'wifi',source:'simulator',quality:'simulated',sequence:0,timestamp:new Date().toISOString(),connectionStatus:'connected',metrics:[],sos:false}
 try{
  const spool=new TelemetrySpool({directory,url:'http://127.0.0.1:3001/api/device-telemetry',token:'test-only',fetcher:async()=>({ok:true,json:async()=>({accepted:true,deviceId:'wrong',sequence:0})})})
  await spool.enqueue(packet);await expect(spool.flushOne()).rejects.toThrow('acknowledgement')
  expect((await spool.files()).length).toBe(1)
  await writeFile(join(directory,'broken.packet.json'),'{invalid',{mode:0o600})
  expect(await spool.flushOne()).toMatchObject({quarantined:true})
  expect((await readdir(directory)).some(f=>f.endsWith('.quarantine'))).toBe(true)
 }finally{await rm(directory,{recursive:true,force:true})}
})
