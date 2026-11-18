import { open,mkdir,readdir,readFile,writeFile,rename,unlink,appendFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createHash,randomUUID } from 'node:crypto'
import { devicePacketSchema } from '@dacos/contracts'
export class TelemetrySpool {
  constructor({directory,url,token,fetcher=fetch,maxPackets=1000}) {
    let parsed;try{parsed=new URL(url)}catch{throw new Error('Invalid ingestion URL')}
    if(parsed.username||parsed.password)throw new Error('Credentials must not be embedded in the ingestion URL')
    if(parsed.protocol!=='https:' && !(parsed.protocol==='http:'&&['localhost','127.0.0.1'].includes(parsed.hostname))) throw new Error('Gateway requires HTTPS or laptop loopback HTTP')
    Object.assign(this,{directory:resolve(directory),url,token,fetcher,maxPackets})
  }
  async files(){await mkdir(this.directory,{recursive:true,mode:0o700});return (await readdir(this.directory)).filter(f=>f.endsWith('.packet.json'))}
  async enqueue(input){
    const packet=devicePacketSchema.parse(input)
    const id=createHash('sha256').update(`${packet.deviceId}:${packet.sequence}`).digest('hex')
    const filename=resolve(this.directory,`${id}.packet.json`)
    try {const old=JSON.parse(await readFile(filename,'utf8'));if(JSON.stringify(old)!==JSON.stringify(packet))throw new Error('Sequence already queued with different content');return}catch(e){if(e.code!=='ENOENT')throw e}
    if((await this.files()).length>=this.maxPackets)throw new Error('Gateway spool is full; stop input and investigate')
    const temporary=filename+'.tmp'
    const handle=await open(temporary,'w',0o600)
    try{await handle.writeFile(JSON.stringify(packet));await handle.sync()}finally{await handle.close()}
    await rename(temporary,filename)
    const directory=await open(this.directory,'r');try{await directory.sync()}finally{await directory.close()}
  }
  async flushOne(){
    const packets=[]
    for(const file of await this.files()){
      try{packets.push({file,packet:devicePacketSchema.parse(JSON.parse(await readFile(resolve(this.directory,file),'utf8')))})}
      catch{await rename(resolve(this.directory,file),resolve(this.directory,`${file}.${randomUUID()}.quarantine`));return {quarantined:true}}
    }
    packets.sort((a,b)=>a.packet.deviceId.localeCompare(b.packet.deviceId)||a.packet.sequence-b.packet.sequence)
    const next=packets[0];if(!next)return {empty:true}
    const response=await this.fetcher(this.url,{method:'POST',headers:{'Content-Type':'application/json',Origin:new URL(this.url).origin,Authorization:`Bearer ${this.token}`},body:JSON.stringify(next.packet),signal:AbortSignal.timeout(10000)})
    if(response.ok){const ack=await response.json();if((ack.accepted!==true&&ack.duplicate!==true)||ack.deviceId!==next.packet.deviceId||ack.sequence!==next.packet.sequence)throw new Error('Unrecognized acknowledgement');await unlink(resolve(this.directory,next.file));return {accepted:true}}
    if([400,409,413].includes(response.status)){
      await appendFile(resolve(this.directory,'dead-letter.jsonl'),JSON.stringify({packet:next.packet,status:response.status,at:new Date().toISOString()})+'\n',{mode:0o600})
      await unlink(resolve(this.directory,next.file));return {deadLetter:true,status:response.status}
    }
    throw new Error(`Telemetry delivery failed (${response.status}); queued packet retained`)
  }
}
