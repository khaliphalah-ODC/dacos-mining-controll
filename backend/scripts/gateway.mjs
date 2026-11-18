import {createInterface} from 'node:readline'
import {TelemetrySpool} from '../src/gateway/spool.js'
if(!process.env.DACOS_DEVICE_TOKEN)throw new Error('DACOS_DEVICE_TOKEN is required; do not use a human session')
const spool=new TelemetrySpool({directory:process.env.DACOS_GATEWAY_SPOOL??'.data/gateway-spool',url:process.env.DACOS_INGEST_URL??'http://127.0.0.1:3001/api/device-telemetry',token:process.env.DACOS_DEVICE_TOKEN})
let stopping=false,timer,delay=1000
async function deliver(){if(stopping)return;try{const result=await spool.flushOne();delay=1000;if(result.quarantined)console.error('Malformed queued packet quarantined; original file retained for inspection');if(result.deadLetter)console.error('Packet moved to protected dead-letter file; inspect its timestamp/sequence')}catch(e){console.error(e.message);delay=Math.min(delay*2,30000)}finally{if(!stopping)timer=setTimeout(deliver,delay)}}
process.on('SIGINT',()=>{stopping=true;clearTimeout(timer);lines.close();process.exitCode=0})
process.on('SIGTERM',()=>{stopping=true;clearTimeout(timer);lines.close();process.exitCode=0})
deliver()
const lines=createInterface({input:process.stdin,crlfDelay:Infinity})
try{for await(const line of lines){if(stopping)break;if(line.trim()){const packet=JSON.parse(line);await spool.enqueue(packet);console.log(JSON.stringify({event:'gateway.queued',deviceId:packet.deviceId,sequence:packet.sequence}))}}}catch(e){console.error(`Gateway input stopped: ${e.message}`);process.exitCode=1;stopping=true;clearTimeout(timer)}
