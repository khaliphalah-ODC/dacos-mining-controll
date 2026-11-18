// Isolated browser smoke test. Requires npm run build and an installed Chrome.
import {spawn,spawnSync} from 'node:child_process'
import {resolve,resolve as resolvePath} from 'node:path'
import {randomUUID,randomBytes} from 'node:crypto'
import {mkdtemp,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {createServer} from 'node:http'
import {startDatabase} from '../../backend/scripts/database.mjs'
import {createRepository} from '../../backend/src/repositories/postgres.js'
import {SimulationAdapter} from '../../backend/src/simulation/adapter.js'
import {OperationalAdapter} from '../../backend/src/services/operational.js'
import {TelemetryService} from '../../backend/src/services/telemetry.js'
import {createApp} from '../../backend/src/app.js'
import {attachRealtime} from '../../backend/src/realtime/index.js'
process.env.NODE_ENV='development';delete process.env.DEVICE_TLS_CERT
const pause=ms=>new Promise(r=>setTimeout(r,ms))
let database,repository,service,realtime,chrome,socket,profile
const unique=randomUUID(),email=`pilot-${unique}@example.test`,password=randomBytes(24).toString('hex'),workerId=`P-${unique}`,zoneId=`Z-${unique}`
try{
 database=await startDatabase({directory:`/tmp/dacos-phase10-${unique}`,port:55439,database:'dacos_phase10_check'})
 const migrated=spawnSync(process.execPath,[resolve('node_modules/prisma/build/index.js'),'migrate','deploy','--schema','backend/prisma/schema.prisma'],{env:{...process.env,DATABASE_URL:database.url},encoding:'utf8'})
 if(migrated.status)throw new Error('Pilot test migration failed')
 repository=createRepository(database.url);service=new TelemetryService({repository,adapter:process.env.DACOS_UI_DEMO==='true'?new SimulationAdapter():new OperationalAdapter(repository)})
 await repository.db.loginThrottle.deleteMany();await service.update()
 const app=createApp({repository,service,allowSimulationControl:false,frontendDirectory:resolve('frontend/dist')})
 await repository.db.zone.create({data:{id:zoneId,name:'Fictional browser test zone',origin:'registered',depth:0,geometry:{x:10,y:10}}})
 const admin=await app.locals.auth.createUser({email,password,name:'Browser pilot administrator',role:'ADMIN'})
 const server=createServer(app);realtime=attachRealtime(server,service,app.locals.auth)
 await new Promise(r=>server.listen(0,'127.0.0.1',r));service.start(1000)
 const base=`http://127.0.0.1:${server.address().port}`

 profile=await mkdtemp(resolve(tmpdir(),'dacos-pilot-chrome-'))
 chrome=spawn(process.env.CHROME_BIN??'google-chrome',['--headless=new','--no-sandbox','--disable-gpu','--remote-debugging-address=127.0.0.1','--remote-debugging-port=9337',`--user-data-dir=${profile}`,'about:blank'],{stdio:'ignore'})
 chrome.on('error',()=>{})
 let tabs
 for(let i=0;i<100;i++){try{tabs=await(await fetch('http://127.0.0.1:9337/json')).json();break}catch{await pause(100)}}
 if(!tabs)throw new Error('Isolated Chrome unavailable; set CHROME_BIN')
 socket=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl)
 await new Promise(r=>socket.addEventListener('open',r,{once:true}))
 let id=0;const pending=new Map(),exceptions=[]
 socket.addEventListener('message',({data})=>{const m=JSON.parse(data);if(m.method==='Runtime.exceptionThrown')exceptions.push(m.params);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result)}})
 const send=(method,params={})=>new Promise((resolve,reject)=>{const n=++id;pending.set(n,{resolve,reject});socket.send(JSON.stringify({id:n,method,params}))})
 const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error('Browser evaluation failed');return r.result.value}
 const until=async expression=>{for(let i=0;i<100;i++){if(await evaluate(expression))return;await pause(100)}throw new Error('Browser condition timed out: '+expression)}
 const navigate=async path=>{await send('Page.navigate',{url:base+path});await pause(400)}
 const click=label=>evaluate(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.getAttribute('aria-label')===${JSON.stringify(label)}||b.textContent.trim()===${JSON.stringify(label)});if(!b||b.disabled)throw Error('Button unavailable');b.click()})()`)
 const fill=async(button,fields)=>{
  await evaluate(`(()=>{const form=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(button)}).closest('form');for(const [label,value] of Object.entries(${JSON.stringify(fields)})){const el=[...form.querySelectorAll('label')].find(l=>l.textContent.trim().startsWith(label)).querySelector('input,select,textarea');el.value=String(value);el.dispatchEvent(new Event(el.tagName==='SELECT'?'change':'input',{bubbles:true}))}})()`)
 }
 socket.addEventListener('message',({data})=>{const m=JSON.parse(data);if(m.method==='Page.javascriptDialogOpening')send('Page.handleJavaScriptDialog',{accept:true})})
 await send('Page.enable');await send('Runtime.enable')

 await navigate('/worker-register');await until("document.body.innerText.includes('Worker registration')")
 for(const width of [1440,1024,768,390]){await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});await pause(100);if(await evaluate(`document.documentElement.scrollWidth>${width}`))throw new Error('Public registration overflow')}
 await evaluate(`(()=>{const values={fullName:'Synthetic browser applicant',phone:'+231770123456',jobTitle:'Browser test technician',site:'Fictional browser test site',shift:'Day'};for(const [key,value] of Object.entries(values)){const el=document.querySelector('[name='+key+']');el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}))}document.querySelector('input[type=checkbox]').click()})()`)
 await click('Submit for review →');await until("document.body.innerText.includes('Application received')")
 await navigate('/login');await until("!!document.querySelector('input[autocomplete=username]')")
 await evaluate(`(()=>{const e=document.querySelector('input[type=email]'),p=document.querySelector('input[type=password]');e.value=${JSON.stringify(email)};p.value=${JSON.stringify(password)};e.dispatchEvent(new Event('input',{bubbles:true}));p.dispatchEvent(new Event('input',{bubbles:true}))})()`)
 await evaluate("document.querySelector('#login-form').requestSubmit()");await until(process.env.DACOS_UI_DEMO==='true'?"document.body.textContent.includes('Live Demo Telemetry Active')":"document.body.textContent.includes('Hardware telemetry workspace')")
 if(await evaluate("document.body.innerText.includes('Sarah Jenkins')||document.body.innerText.includes('Peter Kollie')"))throw new Error('Stitch sample identity leaked')
 if(process.env.DACOS_UI_DEMO!=='true'&&await evaluate("document.body.innerText.includes('Marcus Brody')"))throw new Error('Demo identity leaked into operational mode')
 await navigate('/manage/worker-applications');await until("document.body.innerText.includes('Synthetic browser applicant')")
 await evaluate("document.querySelector('.registration-qr').open=true")
 await until("document.querySelector('.qr-grid img')?.naturalWidth>0")
 const qrTarget=await evaluate("document.querySelector('.qr-link').href")
 if(qrTarget!==base+'/worker-register')throw new Error('Unexpected QR target')
 await click('Review application');await until("document.body.innerText.includes('Review decision')")
 await evaluate("(()=>{const el=document.querySelector('textarea');el.value='Browser test identity and duplicate review complete';el.dispatchEvent(new Event('input',{bubbles:true}))})()")
 await click('Approve application');await until("document.body.innerText.includes('Review outcome')")
 const application=await repository.db.workerApplication.findFirstOrThrow({where:{fullName:'Synthetic browser applicant'}})
 if(application.status!=='APPROVED'||!application.approvedWorkerId)throw new Error('UI approval failed')
 const approvedWorker=application.approvedWorkerId
 await navigate(`/workers/${approvedWorker}`);await until("document.body.innerText.includes('Location Unavailable')")
 await navigate('/tracking');await until("document.body.innerText.includes('Location Unavailable')")
 await navigate(`/workers/${approvedWorker}/movement`);await until("document.body.innerText.includes('no observations in this period')")
 await navigate('/manage/location-policy');await until("document.body.innerText.includes('Location privacy & retention')")
 const freshApplication=await repository.db.workerApplication.create({data:{id:randomUUID(),fullName:'Synthetic pending UI record',nameKey:'synthetic pending ui record',phone:'+231770000001',phoneKey:'231770000001',jobTitle:'Test only',workArea:'OUTDOOR',site:'Fictional site',siteKey:'fictional site',shift:'Day',privacyVersion:'2026-11-17-v1',acknowledgedAt:new Date(),fingerprint:randomUUID()}})
 for(const path of ['/manage/worker-applications',`/workers/${approvedWorker}`,'/tracking',`/workers/${approvedWorker}/movement`,'/manage/location-policy','/control-room','/workers','/map','/environmental','/system-health','/account','/device-simulator','/ble-gateway','/manage/users','/operations/rules','/history','/welcome']){
  await navigate(path);await until("!!document.querySelector('main')");await pause(300)
  if(path==='/manage/worker-applications'){await until("document.body.innerText.includes('Synthetic pending UI record')");await click('Review application');await until("document.body.innerText.includes('Review decision')")}
  for(const width of [1440,1024,768,390]){await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});await pause(100);if(await evaluate(`document.documentElement.scrollWidth>${width}`))throw new Error(`Overflow on ${path}`)}
 }
 await navigate('/control-room');await until("!!document.querySelector('#workerSearch')")
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:1000,deviceScaleFactor:1,mobile:false})
 await evaluate("document.querySelector('.shell-toggle').click()")
 await until("document.querySelector('.app-rail').classList.contains('is-open')")
 await evaluate("document.querySelector('.rail-close').click()")
 await until("!document.querySelector('.app-rail').classList.contains('is-open')")
 await evaluate("document.querySelector('.shell-toggle').click()")
 await until("document.querySelector('.app-rail').classList.contains('is-open')")
 await click('Sign out');await until("!!document.querySelector('input[autocomplete=username]')")
 await navigate('/worker-register');await until("document.body.innerText.includes('Worker registration')")
 if(exceptions.length)throw new Error('Browser runtime exception detected')
 console.log('PASS Phase 10 built-app public submission, login, QR PNG/link, review approval, unavailable-position semantics, tracking/history/retention routes, responsive 1440/1024/768/390 layouts and mobile navigation and logout/public access')
}finally{
 socket?.close();chrome?.kill('SIGTERM');await service?.stop();await realtime?.close();await repository?.close();await database?.stop()
 if(profile){await pause(1000);await rm(profile,{recursive:true,force:true}).catch(()=>{})}
 await rm(`/tmp/dacos-phase10-${unique}`,{recursive:true,force:true});await rm(`/tmp/dacos-phase10-${unique}.credential`,{force:true})
}
