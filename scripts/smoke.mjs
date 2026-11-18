// Read-only unless optional login credentials are explicitly supplied.
const target=process.env.DACOS_SMOKE_URL??'http://127.0.0.1:3001'
let url;try{url=new URL(target)}catch{throw new Error('Invalid smoke-test URL')}
if(url.username||url.password)throw new Error('Do not embed credentials in the URL')
if(!['127.0.0.1','localhost'].includes(url.hostname)&&process.env.DACOS_EXTERNAL_SMOKE_APPROVED!=='true')throw new Error('External smoke testing requires prior approval and DACOS_EXTERNAL_SMOKE_APPROVED=true')
const origin=process.env.DACOS_SMOKE_ORIGIN??url.origin
for(const [path,expected] of [['/api/live',200],['/api/ready',200],['/api/telemetry/snapshot',401]]){
 const response=await fetch(new URL(path,url),{signal:AbortSignal.timeout(10000)})
 if(response.status!==expected)throw new Error(`Smoke check failed: ${path} returned ${response.status}`)
 await response.json();console.log(`PASS ${path}`)
}
if(process.env.DACOS_SMOKE_EMAIL&&process.env.DACOS_SMOKE_PASSWORD){
 const login=await fetch(new URL('/api/auth/login',url),{method:'POST',headers:{'Content-Type':'application/json',Origin:origin},body:JSON.stringify({email:process.env.DACOS_SMOKE_EMAIL,password:process.env.DACOS_SMOKE_PASSWORD})})
 if(!login.ok)throw new Error('Smoke login failed')
 const session=await login.json(),cookie=login.headers.get('set-cookie')?.split(';')[0]
 const result=await fetch(new URL('/api/auth/session',url),{headers:{Cookie:cookie}})
 if(!result.ok)throw new Error('Cookie-session smoke failed')
 await fetch(new URL('/api/auth/logout',url),{method:'POST',headers:{'Content-Type':'application/json',Origin:origin,Cookie:cookie,'x-csrf-token':session.csrfToken},body:'{}'})
 console.log('PASS login/session/logout (credentials omitted)')
}
