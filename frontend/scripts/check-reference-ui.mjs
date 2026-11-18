// Isolated browser smoke test. Requires npm run build and an installed Chrome.
import {spawn,spawnSync} from 'node:child_process'
import {resolve,resolve as resolvePath} from 'node:path'
import {randomUUID,randomBytes} from 'node:crypto'
import {mkdtemp,rm,mkdir,writeFile} from 'node:fs/promises'
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
const unique=randomUUID(),email=`pilot-${unique}@example.test`,password=randomBytes(24).toString('hex'),workerId=`UI-${unique.slice(0,6)}`,zoneId=`Z-${unique.slice(0,6)}`,incidentId=`UI-INC-${unique.slice(0,6)}`
try{
 database=await startDatabase({directory:`/tmp/dacos-phase10-${unique}`,port:55439,database:'dacos_phase10_check'})
 const migrated=spawnSync(process.execPath,[resolve('node_modules/prisma/build/index.js'),'migrate','deploy','--schema','backend/prisma/schema.prisma'],{env:{...process.env,DATABASE_URL:database.url},encoding:'utf8'})
 if(migrated.status)throw new Error('Pilot test migration failed')
 repository=createRepository(database.url);service=new TelemetryService({repository,adapter:process.env.DACOS_UI_DEMO==='true'?new SimulationAdapter():new OperationalAdapter(repository)})
 await repository.db.loginThrottle.deleteMany();await service.update()
 const app=createApp({repository,service,allowSimulationControl:false,frontendDirectory:resolve('frontend/dist')})
 await repository.db.zone.create({data:{id:zoneId,name:'Fictional browser test zone',origin:'registered',depth:0,geometry:{x:10,y:10}}})
 const admin=await app.locals.auth.createUser({email,password,name:'Browser pilot administrator',role:'ADMIN'})
 await repository.db.worker.create({data:{id:workerId,name:'Registered UI verification worker',role:'Test technician',shift:'Day',zoneId,origin:'registered'}})
 await repository.db.operationalIncident.create({data:{id:incidentId,workerId,severity:'warning',severityLevel:'LOW',kind:'ALERT',simulation:true,message:'Simulated UI verification incident',events:{create:{id:randomUUID(),actorId:admin.id,action:'created',note:'Synthetic browser verification incident. No dispatch.',toStatus:'OPEN'}}}})
 await repository.db.readingHistory.createMany({data:[0,1,2].map(i=>({id:randomUUID(),workerId,zoneId,deviceId:'UI-SIMULATED-RECORD',kind:'health',metric:'heartRate',value:80+i,unit:'bpm',timestamp:new Date(Date.now()-(2-i)*1000),source:'dacos-simulator',simulation:true,quality:'simulated',sequence:i}))})
 await service.update()
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
 const until=async expression=>{for(let i=0;i<100;i++){if(await evaluate(expression))return;await pause(100)}console.log(await evaluate('document.body.innerText.slice(0,2000)'));console.log(JSON.stringify(exceptions));throw new Error('Browser condition timed out: '+expression)}
 const navigate=async path=>{await send('Page.navigate',{url:base+path});await pause(400)}
 const click=label=>until(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.getAttribute('aria-label')===${JSON.stringify(label)}||b.textContent.trim()===${JSON.stringify(label)});if(!b||b.disabled)return false;b.click();return true})()`)
 const fill=async(button,fields)=>{
  await evaluate(`(()=>{const form=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(button)}).closest('form');for(const [label,value] of Object.entries(${JSON.stringify(fields)})){const el=[...form.querySelectorAll('label')].find(l=>l.textContent.trim().startsWith(label)).querySelector('input,select,textarea');el.value=String(value);el.dispatchEvent(new Event(el.tagName==='SELECT'?'change':'input',{bubbles:true}))}})()`)
 }
 socket.addEventListener('message',({data})=>{const m=JSON.parse(data);if(m.method==='Page.javascriptDialogOpening')send('Page.handleJavaScriptDialog',{accept:true})})
 await send('Page.enable');await send('Runtime.enable')

 const visualMetrics={}
 const shots=resolve('/tmp/dacos-reference-check');await mkdir(shots,{recursive:true})
 await navigate('/login');await until("!!document.querySelector('#login-form')")

 await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false})
 let shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(resolve(shots,'login-1440.png'),Buffer.from(shot.data,'base64'))
 await evaluate(`(()=>{const e=document.querySelector('input[type=email]'),p=document.querySelector('input[type=password]');e.value=${JSON.stringify(email)};p.value=${JSON.stringify(password)};e.dispatchEvent(new Event('input',{bubbles:true}));p.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('#login-form').requestSubmit()})()`)
 await until("document.body.innerText.includes('Operational Incident Log')")

 for(const [name,path,ready] of [['overview','/overview',"document.body.innerText.includes('Operational Incident Log')"],['accounts','/manage/users',"document.body.innerText.includes('Browser pilot administrator')"],['ble','/ble-gateway',"document.body.innerText.includes('Target Worker')"],['control-room','/control-room',"!!document.querySelector('#workerSearch')"],['devices','/manage/devices',"document.body.innerText.includes('Register inventory device')"],['environmental','/environmental',"document.body.innerText.includes('Subterranean Environmental')"],['map','/map',"document.body.innerText.includes('Subterranean Corridor Map')"],['history','/history',"document.body.innerText.includes('Telemetry Archival')"],['incidents','/operations/incidents',"!!document.querySelector('#openReportModalBtn')"],['incident-detail',`/operations/incidents/${incidentId}`,"document.querySelector('main')?.dataset.incidentStatus==='OPEN'"],['workers','/workers',"!!document.querySelector('#search-input')"],['account','/account',"!!document.querySelector('#password-form')"],['rules','/operations/rules',"!!document.querySelector('#tab-demo-btn')"],['simulator','/device-simulator',"document.body.innerText.includes('Create single-use code')"],['worker-detail',`/workers/${workerId}`,"document.body.innerText.includes('Physiological vitals')"],['worker-management','/manage/workers',"document.body.innerText.includes('Register worker')"]]){
  await navigate(path);await until(ready);await pause(500)
  if(path==='/control-room'){await until("document.body.textContent.includes('Test technician')");if(await evaluate("document.body.innerText.includes('Face Crew 01')"))throw new Error('Sample worker role leaked')}
  if(path==='/map'){await evaluate(`(()=>{const s=[...document.querySelectorAll('select')].find(s=>[...s.options].some(o=>o.value===${JSON.stringify(workerId)}));s.value=${JSON.stringify(workerId)};s.dispatchEvent(new Event('change',{bubbles:true}))})()`)}
  for(const width of [1440,1024,768,390]){
   await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});await pause(150)
   if(await evaluate('document.documentElement.scrollWidth>innerWidth+1')){console.log(await evaluate("[...document.querySelectorAll('main *')].filter(e=>e.getBoundingClientRect().right>innerWidth+1).slice(0,15).map(e=>({tag:e.tagName,cls:e.className,text:e.textContent.slice(0,50),right:e.getBoundingClientRect().right}))"));throw new Error(`${name} overflows at ${width}`)}
   if(width===1440)visualMetrics[name]=await evaluate("(()=>{const main=document.querySelector('main'),c=getComputedStyle(main),header=document.querySelector('header'),rail=document.querySelector('aside');return {background:c.backgroundColor,paddingLeft:c.paddingLeft,paddingRight:c.paddingRight,paddingTop:c.paddingTop,fontFamily:c.fontFamily.split(',')[0],headerHeight:header?.getBoundingClientRect().height,railWidth:rail?.getBoundingClientRect().width}})()");
   const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(resolve(shots,`${name}-${width}.png`),Buffer.from(shot.data,'base64'))
  }
 }
 await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false})
 await navigate('/operations/rules');await until("!!document.querySelector('#escalation-rule-form')")
 await evaluate("document.querySelector('#tab-hardware-btn').click()")
 await until("document.body.innerText.includes('Reviewed hardware rules')")
 await evaluate("document.querySelector('#btn-new-rule').click()")
 await until("document.activeElement===document.querySelector('#escalation-rule-form input')")
 const ruleName='UI verification rule '+unique.slice(0,6)
 await evaluate(`(()=>{const e=document.querySelector('#escalation-rule-form input');e.value=${JSON.stringify(ruleName)};e.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('#escalation-rule-form').requestSubmit()})()`)
 await until(`document.body.textContent.includes(${JSON.stringify(ruleName)})`)
 await until("(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Evaluate demonstration rules');if(!b||b.disabled)return false;b.click();return true})()")
 await until("document.body.innerText.includes('Evaluated')")
 await navigate('/manage/workers');await until(`document.body.textContent.includes(${JSON.stringify(workerId)})`)
 await until(`(()=>{const r=[...document.querySelectorAll('tbody tr')].find(r=>r.textContent.includes(${JSON.stringify(workerId)}));const b=r?.querySelector('[aria-label="Edit profile"]');if(!b||b.disabled)return false;b.click();return true})()`)
 await until("document.body.innerText.includes('Save changes')")
 await fill('Save changes',{Name:'UI edited verification worker'});await click('Save changes')
 await until("document.body.innerText.includes('UI edited verification worker')")
 await evaluate(`(()=>{const r=[...document.querySelectorAll('tbody tr')].find(r=>r.textContent.includes(${JSON.stringify(workerId)}));const b=[...r.querySelectorAll('button')].find(b=>b.textContent.trim()==='Deactivate');b.focus();b.click()})()`)
 await until("!!document.querySelector('[aria-label=\"Confirm worker deactivation\"]')")
 await click('Confirm worker deactivation')
 await until("!document.querySelector('[role=dialog]')")
 if((await repository.db.worker.findUnique({where:{id:workerId}})).active)throw new Error('Worker deactivation was not persisted')
 await evaluate(`(()=>{const r=[...document.querySelectorAll('tbody tr')].find(r=>r.textContent.includes(${JSON.stringify(workerId)}));[...r.querySelectorAll('button')].find(b=>b.textContent.trim()==='Reactivate').click()})()`)
 await until(`document.querySelector('tbody').textContent.includes('Deactivate')`)
 if(process.env.DACOS_UI_DEMO==='true'){
  await navigate('/device-simulator');await until("document.body.innerText.includes('Create single-use code')")
  await click('Create single-use code');await until("!!document.querySelector('code')")
  const pairingCode=await evaluate("document.querySelector('code').textContent.trim()")
  const simWorker=await evaluate(`(()=>{const select=document.querySelector('select');const id=[...select.options].some(o=>o.value===${JSON.stringify(workerId)})?${JSON.stringify(workerId)}:[...select.options].find(o=>o.value&&!o.disabled).value;select.value=id;select.dispatchEvent(new Event('change',{bubbles:true}));const input=[...document.querySelectorAll('label')].find(l=>l.textContent.trim().startsWith('Pairing code')).querySelector('input');input.value=${JSON.stringify(pairingCode)};input.dispatchEvent(new Event('input',{bubbles:true}));return id})()`)
  await until("(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Pair test device');if(!b||b.disabled)return false;b.click();return true})()")
  await until("document.body.innerText.includes('Start transmission')")
  await click('Start transmission');await until("document.body.innerText.includes('Server acknowledgement:')")
  const simulatedDevice=await repository.db.deviceRegistration.findFirstOrThrow({where:{workerId:simWorker,source:'simulator'},orderBy:{createdAt:'desc'}})
  await until("(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='SIMULATED SOS');if(!b||b.disabled)return false;b.click();return true})()")
  let sos
  for(let i=0;i<80;i++){sos=await repository.db.operationalIncident.findFirst({where:{deviceId:simulatedDevice.id,kind:'SIMULATED_SOS'}});if(sos)break;await pause(100)}
  if(!sos?.simulation)throw new Error('Simulator SOS was not recorded as simulated')
  await until("(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Stop safely');if(!b||b.disabled)return false;b.click();return true})()")
  for(let i=0;i<80;i++){if((await repository.db.deviceRegistration.findUnique({where:{id:simulatedDevice.id}})).connectionStatus==='disconnected')break;await pause(100)}
  if((await repository.db.deviceRegistration.findUnique({where:{id:simulatedDevice.id}})).connectionStatus!=='disconnected')throw new Error('Simulator did not disconnect safely')
 }
 await navigate('/workers');await until(`document.body.textContent.includes(${JSON.stringify(workerId)})`)
 await evaluate("document.querySelector('#view-grid-btn').click()")
 await until("document.querySelector('#view-grid-btn').getAttribute('aria-pressed')==='true'&&getComputedStyle(document.querySelector('#table-view-container')).display==='none'")
 await evaluate("document.querySelector('#view-table-btn').click()")
 await until("getComputedStyle(document.querySelector('#table-view-container')).display!=='none'")
 await navigate('/history');await until("!!document.querySelector('[aria-label=\"Inspect recorded sample\"]')")
 await evaluate("document.querySelector('[aria-label=\"Inspect recorded sample\"]').click()")
 await until("!!document.querySelector('[role=dialog]')&&document.querySelector('[role=dialog]').contains(document.activeElement)")
 await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape'})
 await until("!document.querySelector('[role=dialog]')")
 await navigate('/operations/incidents');await until("!!document.querySelector('#openReportModalBtn')")
 await evaluate("(()=>{const b=document.querySelector('#openReportModalBtn');b.focus();b.click()})()")
 await until("!!document.querySelector('#reportModal')&&document.querySelector('#reportModal').contains(document.activeElement)")
 await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape'})
 await until("!document.querySelector('#reportModal')&&document.activeElement.id==='openReportModalBtn'")
 await navigate(`/history?kind=environment&metric=co&zoneId=${encodeURIComponent(zoneId)}`);await until("document.body.innerText.includes('Telemetry Archival')")
 const historySelection=await evaluate("({metric:[...document.querySelectorAll('label')].find(l=>l.textContent.trim().startsWith('Metric')).querySelector('select').value,zone:[...document.querySelectorAll('label')].find(l=>l.textContent.trim().startsWith('Zone ID')).querySelector('input').value})")
 if(historySelection.metric!=='co'||historySelection.zone!==zoneId)throw new Error('Environmental history filters were not preserved')
 await navigate('/manage/users');await until("document.body.innerText.includes('Browser pilot administrator')")
 await evaluate(`(()=>{for(const [id,value] of Object.entries({'form-fullname':'Integrated UI test account','form-email':'ui-'+${JSON.stringify(unique)}+'@example.test','form-passcode':${JSON.stringify(password)}})){const el=document.getElementById(id);el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}))}document.querySelector('#account-form').requestSubmit()})()`)
 await until("document.body.innerText.includes('Integrated UI test account')")
 const created=await repository.db.user.findUnique({where:{email:`ui-${unique}@example.test`}})
 if(!created||created.role!=='OPERATOR')throw new Error('Integrated account form failed to persist')
 await evaluate("document.querySelector('#tab-audit-btn').click()")
 await until("document.querySelector('#section-audit').offsetHeight>0")
 if(!(await evaluate("[...document.querySelectorAll('#section-audit article')].length>0")))throw new Error('Persistent audit records missing')
 await navigate('/account');await until("!!document.querySelector('#password-form')")
 const setPasswords=async(current,next,confirm)=>evaluate(`(()=>{for(const [id,value] of Object.entries({'current-pwd':${JSON.stringify(current)},'new-pwd':${JSON.stringify(next)},'confirm-pwd':${JSON.stringify(confirm)}})){const el=document.getElementById(id);el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}))}})()`)
 await setPasswords(password,'Confirmation-check-123','Different-confirmation-123');await pause(100)
 if(!(await evaluate("document.querySelector('#btn-update-pwd').disabled")))throw new Error('Mismatched passwords enabled submission')
 await setPasswords(password,'🙂'.repeat(30),'🙂'.repeat(30));await pause(100)
 if(!(await evaluate("document.querySelector('#btn-update-pwd').disabled&&document.querySelector('#byte-counter').textContent.includes('120')")))throw new Error('UTF-8 password limit was not enforced')
 const newPassword='Verified-UI-'+randomBytes(20).toString('hex')
 await setPasswords(password,newPassword,newPassword)
 await until("!document.querySelector('#btn-update-pwd').disabled")
 await evaluate("document.querySelector('#password-form').requestSubmit()")
 await until("!!document.querySelector('#login-form')")
 if(await evaluate("fetch('/api/auth/session').then(r=>r.status)")!==401)throw new Error('Password change did not invalidate the browser session')
 await evaluate(`(()=>{for(const [selector,value] of Object.entries({'input[type=email]':${JSON.stringify(email)},'input[type=password]':${JSON.stringify(newPassword)}})){const el=document.querySelector(selector);el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}))}document.querySelector('#login-form').requestSubmit()})()`)
 await until("document.body.innerText.includes('Operational Incident Log')")
 await navigate('/account');await until("!!document.querySelector('#password-form')")
 await evaluate("document.querySelector('[aria-label=\"Open account signout confirmation\"]').click()")
 await until("!!document.querySelector('#signout-dialog')&&document.querySelector('#signout-dialog').contains(document.activeElement)")
 await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape'})
 await until("!document.querySelector('#signout-dialog')")
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:1000,deviceScaleFactor:1,mobile:false})
 await evaluate("document.querySelector('.shell-toggle').click()")
 await until("document.querySelector('.app-rail').classList.contains('is-open')")
 await evaluate("document.querySelector('.rail-close').click()")
 await until("!document.querySelector('.app-rail').classList.contains('is-open')")
 await evaluate("document.querySelector('[aria-label=\"Open account signout confirmation\"]').click()")
 await until("!!document.querySelector('#signout-dialog')")
 await click('Confirm account signout');await until("!!document.querySelector('#login-form')")
 if(exceptions.length)throw new Error('Browser runtime exception detected')
 await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false})
 for(const name of ['dacos_monitoring_overview','dacos_accounts_security_audit','dacos_ble_gateway','dacos_control_room_login','dacos_control_room_telemetry','dacos_device_management','dacos_environmental_monitoring','dacos_fictional_mine_map','dacos_history_reports','dacos_incident_detail_inc_104','dacos_incident_management_console','dacos_live_workers_directory','dacos_my_account_security_profile','dacos_operational_threshold_rules','dacos_wi_fi_device_simulator','dacos_worker_detail_peter_kollie_w_088','dacos_worker_management']){
  await navigate('/extracted-ui/'+name+'.html');await pause(400)
  const originalMetrics=await evaluate("(()=>{const c=getComputedStyle(document.querySelector('main'));return {background:c.backgroundColor,paddingLeft:c.paddingLeft,paddingRight:c.paddingRight,paddingTop:c.paddingTop,fontFamily:c.fontFamily.split(',')[0],headerHeight:document.querySelector('header')?.getBoundingClientRect().height,railWidth:document.querySelector('aside')?.getBoundingClientRect().width}})()");
  const key={dacos_control_room_telemetry:'control-room',dacos_device_management:'devices',dacos_environmental_monitoring:'environmental',dacos_fictional_mine_map:'map',dacos_history_reports:'history',dacos_incident_detail_inc_104:'incident-detail',dacos_incident_management_console:'incidents',dacos_live_workers_directory:'workers',dacos_my_account_security_profile:'account',dacos_operational_threshold_rules:'rules',dacos_wi_fi_device_simulator:'simulator',dacos_worker_detail_peter_kollie_w_088:'worker-detail',dacos_worker_management:'worker-management'}[name];if(key){visualMetrics[key+'-reference']=originalMetrics;for(const field of Object.keys(originalMetrics)){if(visualMetrics[key][field]!==originalMetrics[field])throw new Error(`${key} reference mismatch: ${field}`)}}
  const original=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(resolve(shots,'reference-'+name+'.png'),Buffer.from(original.data,'base64'))
 }
 await writeFile(resolve(shots,'layout-metrics.json'),JSON.stringify(visualMetrics,null,2))
 console.log('PASS all seventeen integrated reference routes, persistent audit tab and responsive screenshots: '+shots)

}finally{
 socket?.close();chrome?.kill('SIGTERM');await service?.stop();await realtime?.close();await repository?.close();await database?.stop()
 if(profile){await pause(1000);await rm(profile,{recursive:true,force:true}).catch(()=>{})}
 await rm(`/tmp/dacos-phase10-${unique}`,{recursive:true,force:true});await rm(`/tmp/dacos-phase10-${unique}.credential`,{force:true})
}
