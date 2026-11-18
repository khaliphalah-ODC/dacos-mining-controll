// Isolated browser smoke test. Requires npm run build and an installed Chrome.
import {spawn,spawnSync} from 'node:child_process'
import {resolve,resolve as resolvePath} from 'node:path'
import {randomUUID,randomBytes} from 'node:crypto'
import {mkdtemp,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {createServer} from 'node:http'
import {startDatabase} from '../../backend/scripts/database.mjs'
import {createRepository} from '../../backend/src/repositories/postgres.js'
import {OperationalAdapter} from '../../backend/src/services/operational.js'
import {TelemetryService} from '../../backend/src/services/telemetry.js'
import {createApp} from '../../backend/src/app.js'
import {attachRealtime} from '../../backend/src/realtime/index.js'
process.env.NODE_ENV='development';delete process.env.DEVICE_TLS_CERT
const pause=ms=>new Promise(r=>setTimeout(r,ms))
let database,repository,service,realtime,chrome,socket,profile
const unique=randomUUID(),email=`pilot-${unique}@example.test`,password=randomBytes(24).toString('hex'),workerId=`P-${unique}`,zoneId=`Z-${unique}`
try{
 database=await startDatabase({directory:'.data/pilot-check-postgres',port:55435,database:'dacos_pilot_check'})
 const migrated=spawnSync(process.execPath,[resolve('node_modules/prisma/build/index.js'),'migrate','deploy','--schema','backend/prisma/schema.prisma'],{env:{...process.env,DATABASE_URL:database.url},encoding:'utf8'})
 if(migrated.status)throw new Error('Pilot test migration failed')
 repository=createRepository(database.url);service=new TelemetryService({repository,adapter:new OperationalAdapter(repository)})
 await repository.db.loginThrottle.deleteMany();await service.update()
 const app=createApp({repository,service,allowSimulationControl:false,frontendDirectory:resolve('frontend/dist')})
 const admin=await app.locals.auth.createUser({email,password,name:'Browser pilot administrator',role:'ADMIN'})
 const server=createServer(app);realtime=attachRealtime(server,service,app.locals.auth)
 await new Promise(r=>server.listen(0,'127.0.0.1',r));service.start(1000)
 const base=`http://127.0.0.1:${server.address().port}`
 await new Promise((resolve,reject)=>{const smoke=spawn(process.execPath,[resolvePath('scripts/smoke.mjs')],{env:{...process.env,DACOS_SMOKE_URL:base,DACOS_SMOKE_ORIGIN:base,DACOS_SMOKE_EMAIL:email,DACOS_SMOKE_PASSWORD:password},stdio:'ignore'});smoke.on('error',reject);smoke.on('exit',code=>code===0?resolve():reject(new Error('Local smoke procedure failed')))})
 profile=await mkdtemp(resolve(tmpdir(),'dacos-pilot-chrome-'))
 chrome=spawn(process.env.CHROME_BIN??'google-chrome',['--headless=new','--no-sandbox','--disable-gpu','--remote-debugging-address=127.0.0.1','--remote-debugging-port=9226',`--user-data-dir=${profile}`,'about:blank'],{stdio:'ignore'})
 chrome.on('error',()=>{})
 let tabs
 for(let i=0;i<100;i++){try{tabs=await(await fetch('http://127.0.0.1:9226/json')).json();break}catch{await pause(100)}}
 if(!tabs)throw new Error('Isolated Chrome unavailable; set CHROME_BIN')
 socket=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl)
 await new Promise(r=>socket.addEventListener('open',r,{once:true}))
 let id=0;const pending=new Map(),exceptions=[]
 socket.addEventListener('message',({data})=>{const m=JSON.parse(data);if(m.method==='Runtime.exceptionThrown')exceptions.push(m.params);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result)}})
 const send=(method,params={})=>new Promise((resolve,reject)=>{const n=++id;pending.set(n,{resolve,reject});socket.send(JSON.stringify({id:n,method,params}))})
 const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error('Browser evaluation failed');return r.result.value}
 const until=async expression=>{for(let i=0;i<100;i++){if(await evaluate(expression))return;await pause(100)}throw new Error('Browser condition timed out: '+expression)}
 const navigate=async path=>{await send('Page.navigate',{url:base+path});await pause(400)}
 const click=label=>until(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.getAttribute('aria-label')===${JSON.stringify(label)}||b.textContent.trim()===${JSON.stringify(label)});if(!b||b.disabled)return false;b.click();return true})()`)
 const fill=async(button,fields)=>{
  await evaluate(`(()=>{const form=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(button)}).closest('form');for(const [label,value] of Object.entries(${JSON.stringify(fields)})){const el=[...form.querySelectorAll('label')].find(l=>l.textContent.trim().startsWith(label)).querySelector('input,select,textarea');el.value=String(value);el.dispatchEvent(new Event(el.tagName==='SELECT'?'change':'input',{bubbles:true}))}})()`)
 }
 await send('Page.enable');await send('Runtime.enable')
 await navigate('/manage/devices');await until("!!document.querySelector('input[autocomplete=username]')")
 await evaluate(`(()=>{const e=document.querySelector('input[type=email]'),p=document.querySelector('input[type=password]');e.value=${JSON.stringify(email)};p.value=${JSON.stringify(password)};e.dispatchEvent(new Event('input',{bubbles:true}));p.dispatchEvent(new Event('input',{bubbles:true}))})()`)
 await evaluate("document.querySelector('#login-form').requestSubmit()");await until("document.body.textContent.includes('Hardware telemetry workspace')")
 if(await evaluate("document.body.innerText.includes('Marcus Brody')"))throw new Error('Fixture worker leaked into operational view')
 await navigate('/manage/workers');await until("!!document.querySelector('details')");await evaluate("document.querySelector('details').open=true");await until("document.body.innerText.includes('Register zone')")
 await fill('Register zone',{'Zone ID':zoneId,Name:'Browser test zone',Depth:-100,'Diagram X':10,'Diagram Y':20});await click('Register zone')
 await until(`!!document.querySelector('option[value="${zoneId}"]')`)
 await fill('Register worker',{'Worker ID':workerId,Name:'Browser test worker',Role:'Pilot tester',Shift:'A',Zone:zoneId});await click('Register worker')
 await pause(500);await fill('Search / refresh',{'Search name, ID or role':workerId});await click('Search / refresh')
 await until(`document.body.innerText.includes(${JSON.stringify(workerId)})`)
 await navigate('/manage/devices');await until("document.body.innerText.includes('Register inventory device')")
 await fill('Register device',{Model:'Browser test gateway','Serial number':unique,'Firmware version':'test-1',Transport:'wifi',Provenance:'hardware'});await click('Register device')
 await pause(500);await fill('Search / refresh',{'Search ID, model, serial or worker':unique});await click('Search / refresh')
 await until(`document.body.innerText.includes(${JSON.stringify(unique)})`)
 await evaluate(`(()=>{const a=[...document.querySelectorAll('tbody tr')].find(a=>a.textContent.includes(${JSON.stringify(unique)}));a.querySelector('button').click()})()`)
 await until("document.body.innerText.includes('Save assignment')")
 await evaluate(`(()=>{const select=[...document.querySelectorAll('label')].find(l=>l.textContent.trim().startsWith('Assign worker')).querySelector('select');select.value=${JSON.stringify(workerId)};select.dispatchEvent(new Event('change',{bubbles:true}))})()`)
 await click('Save assignment');await pause(400);await click('Reprovision');await until("!!document.querySelector('.credential-secret')")
 const token=await evaluate("document.querySelector('.credential-secret').textContent.trim()")
 const device=await repository.db.deviceRegistration.findUnique({where:{serialNumber:unique}})
 const response=await fetch(base+'/api/device-telemetry',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({deviceId:device.id,workerId,transport:'wifi',source:'hardware',timestamp:new Date().toISOString(),sequence:0,connectionStatus:'connected',quality:'live',metrics:[{metric:'heartRate',value:83,unit:'bpm'}],sos:false})})
 if(!response.ok)throw new Error('Isolated test packet failed')
 await navigate(`/workers/${workerId}`);await until("document.body.innerText.includes('83 bpm')")
 // Create through the UI, acknowledge from an independent REST session, then
 // finish through the UI: this proves authenticated realtime recovery of detail.
 await navigate('/operations/incidents');await until("!!document.querySelector('#openReportModalBtn')");await evaluate("document.querySelector('#openReportModalBtn').click()");await until("!!document.querySelector('#reportModal textarea')")
 await fill('Create incident',{Message:`SIMULATED browser incident ${unique}`,'Worker ID':workerId,Severity:'LOW'})
 await click('Create incident');await until("document.body.innerText.includes('Response activity')")
 const incidentId=await evaluate("document.querySelector('main').dataset.incidentId")
 const nodeLogin=await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify({email,password})})
 if(!nodeLogin.ok)throw new Error('Independent test session failed')
 const nodeSession=await nodeLogin.json(),nodeCookie=nodeLogin.headers.get('set-cookie').split(';')[0]
 const acknowledged=await fetch(base+`/api/operations/incidents/${incidentId}/events`,{method:'POST',headers:{'Content-Type':'application/json',Origin:base,Cookie:nodeCookie,'x-csrf-token':nodeSession.csrfToken},body:JSON.stringify({action:'acknowledge',note:'Independent browser-test session acknowledged'})})
 if(!acknowledged.ok)throw new Error('Independent incident action failed')
 const state=status=>until(`document.querySelector('main')?.dataset.incidentStatus===${JSON.stringify(status)}`)
 await state('ACKNOWLEDGED')
 for(const [action,status] of [['assign','ASSIGNED'],['start','IN_PROGRESS'],['resolve','RESOLVED'],['close','CLOSED']]){
  await evaluate(`(()=>{const el=document.querySelector('textarea');el.value=${JSON.stringify('Browser test response')};el.dispatchEvent(new Event('input',{bubbles:true}))})()`)
  if(action==='assign')await until(`!!document.querySelector('select option[value="${admin.id}"]')`)
  if(action==='assign')await evaluate(`(()=>{const el=document.querySelector('select');el.value=${JSON.stringify(admin.id)};el.dispatchEvent(new Event('change',{bubbles:true}))})()`)
  await until(`(()=>{const b=[...document.querySelectorAll('.response-actions button')].find(b=>b.textContent.trim()===${JSON.stringify(action)});if(!b||b.disabled)return false;b.click();return true})()`)
  await state(status)
 }
 await navigate('/history');await until("document.body.innerText.includes('Recorded samples')")
 await evaluate(`(()=>{const label=[...document.querySelectorAll('label')].find(l=>l.textContent.trim().startsWith('Worker ID'));const el=label.querySelector('input');el.value=${JSON.stringify(workerId)};el.dispatchEvent(new Event('input',{bubbles:true}))})()`)
 await click('Apply time filters / refresh');await until("document.body.innerText.includes('83 bpm')")
 for(const path of [`/workers/${workerId}`,'/manage/workers','/manage/devices','/operations/incidents','/control-room','/history']){
  await navigate(path);await until("!!document.querySelector('main')")
  for(const width of [1440,1024,768,390]){await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});await pause(100);if(await evaluate(`document.documentElement.scrollWidth>${width}`))throw new Error(`Overflow on ${path} at ${width}px`)}
 }
 await click('Sign out');await until("!!document.querySelector('input[autocomplete=username]')")
 await navigate('/manage/workers');await until("!!document.querySelector('input[autocomplete=username]')")
 if(exceptions.length)throw new Error('Browser runtime exception detected')
 console.log('PASS built-app login/logout, protected redirects, fixture-free operational view, zone/worker/device UI registration, assignment, credential issuance, test-packet Worker Detail, independent-session realtime incident updates, full UI lifecycle, history chart and responsive layouts')
}finally{
 socket?.close();chrome?.kill('SIGTERM');await service?.stop();await realtime?.close();await repository?.close();await database?.stop()
 if(profile){await pause(1000);await rm(profile,{recursive:true,force:true}).catch(()=>{})}
}
