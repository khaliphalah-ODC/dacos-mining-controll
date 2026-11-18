import { currentLocations } from './locations.js'
import {incidentListFilters,incidentWhere} from './incidents.js'
import {z} from 'zod'
import {connectionStatus} from './devices.js'
export function csvText(rows,columns){
 const escape=value=>{let s=value==null?'':typeof value==='object'?JSON.stringify(value):String(value);if(/^[\s]*[=+@-]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"'}
 return [columns.map(escape).join(','),...rows.map(row=>columns.map(c=>escape(row[c])).join(','))].join('\r\n')
}
const filters=z.object({workerId:z.string().max(50).optional(),zoneId:z.string().max(100).optional(),deviceId:z.string().max(100).optional(),metric:z.string().max(100).optional(),kind:z.enum(['health','environment','device','location']).optional(),quality:z.enum(['live','simulated','stale','offline','unavailable']).optional(),source:z.enum(['hardware','simulator','dacos-simulator']).optional(),from:z.string().datetime().optional(),to:z.string().datetime().optional(),cursor:z.string().max(200).optional(),limit:z.coerce.number().int().min(1).max(200).default(100)}).strict().refine(p=>!p.from||!p.to||Date.parse(p.from)<=Date.parse(p.to),'Invalid date range')
export function mountReporting(app,{repository,service}){
 const db=repository.db,handle=fn=>async(req,res,next)=>{try{await fn(req,res)}catch(e){next(e)}}
 const where=p=>Object.fromEntries([...['workerId','zoneId','deviceId','metric','kind','quality','source'].filter(k=>p[k]).map(k=>[k,p[k]]),...(p.from||p.to?[['timestamp',{...(p.from?{gte:new Date(p.from)}:{}),...(p.to?{lte:new Date(p.to)}:{})}]]:[])])
 app.get('/api/history/readings',handle(async(req,res)=>{
  const p=filters.parse(req.query),rows=await db.readingHistory.findMany({where:where(p),take:p.limit+1,...(p.cursor?{cursor:{id:p.cursor},skip:1}:{}),orderBy:[{timestamp:'desc'},{id:'desc'}]})
  res.json({data:rows.slice(0,p.limit),nextCursor:rows.length>p.limit?rows[p.limit-1].id:null})
 }))
 app.get('/api/reports/readings.csv',handle(async(req,res)=>{
  const p=filters.parse(req.query),rows=await db.readingHistory.findMany({where:where(p),take:10001,orderBy:[{timestamp:'desc'},{id:'desc'}]})
  if(rows.length>10000)return res.status(400).json({error:'Narrow filters: reports are limited to 10000 rows'})
  res.set({'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="dacos-readings.csv"'}).send(csvText(rows.map(r=>({...r,timestamp:r.timestamp.toISOString(),receivedAt:r.receivedAt.toISOString()})),['timestamp','receivedAt','workerId','zoneId','deviceId','kind','metric','value','unit','source','simulation','quality','sequence']))
 }))
 app.get('/api/reports/incidents.csv',handle(async(req,res)=>{
  const p=incidentListFilters.parse(req.query)
  const rows=await db.operationalIncident.findMany({where:incidentWhere(p),take:10001,orderBy:[{createdAt:'desc'},{id:'desc'}]})
  if(rows.length>10000)return res.status(400).json({error:'Narrow filters: reports are limited to 10000 rows'})
  res.set({'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="dacos-incidents.csv"'}).send(csvText(rows.map(r=>({...r,createdAt:r.createdAt.toISOString()})),['id','createdAt','lifecycleStatus','severityLevel','kind','simulation','workerId','deviceId','ownerId','message']))
 }))
 app.get('/api/control-room',handle(async(req,res)=>{
  const p=z.object({workerId:z.string().max(50).optional(),zoneId:z.string().max(100).optional(),status:z.enum(['connected','stale','disconnected','unavailable','revoked','unpaired']).optional(),from:z.string().datetime().optional(),to:z.string().datetime().optional()}).strict().refine(p=>!p.from||!p.to||Date.parse(p.from)<=Date.parse(p.to),'Invalid date range').parse(req.query)
  const snapshot=service.snapshot(),workers=snapshot.workers.filter(w=>(!p.workerId||w.id===p.workerId)&&(!p.zoneId||w.zoneId===p.zoneId))
  const locations=await currentLocations(db,workers)
  const data=workers.map(w=>{const device=snapshot.deviceSessions?.find(d=>d.workerId===w.id);return {...w,location:locations.get(w.id),connectionStatus:connectionStatus(device),device:device??null,readings:snapshot.readings.filter(r=>r.workerId===w.id&&(!p.from||Date.parse(r.timestamp)>=Date.parse(p.from))&&(!p.to||Date.parse(r.timestamp)<=Date.parse(p.to))),alerts:snapshot.alerts.filter(a=>a.workerId===w.id)}}).filter(w=>(!p.status||w.connectionStatus===p.status)&&(!(p.from||p.to)||w.readings.length))
  res.json({mode:snapshot.mode,timestamp:snapshot.timestamp,data,summary:{workers:data.length,connected:data.filter(w=>w.connectionStatus==='connected').length,stale:data.filter(w=>w.connectionStatus==='stale').length,incidents:await db.operationalIncident.count({where:{lifecycleStatus:{notIn:['RESOLVED','CLOSED']},...(p.workerId?{workerId:p.workerId}:{}),...(p.zoneId?{workerId:{in:workers.map(w=>w.id)}}:{})}})}})
 }))
}
