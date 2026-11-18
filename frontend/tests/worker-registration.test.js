import { describe, it, expect } from 'vitest'
import { createSSRApp } from 'vue'
import { renderToString } from '@vue/server-renderer'
import { createPinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import QRCode from 'qrcode'
import { workerApplicationSchema, registrationPrivacyVersion } from '@dacos/contracts'
import { workerRegistrationUrl } from '../src/services/worker-registration.js'
import { routeAccess } from '../src/services/access.js'
import WorkerRegisterView from '../src/views/WorkerRegisterView.vue'
import WorkerApplicationsView from '../src/views/WorkerApplicationsView.vue'
describe('worker registration UI and shared contract',()=>{
  it('allows public registration and limits reviews to supervisors/admins',()=>{
    expect(routeAccess({path:'/worker-register',meta:{public:true}},null)).toBeUndefined()
    for(const role of ['ADMIN','SUPERVISOR'])expect(routeAccess({path:'/manage/worker-applications',meta:{manage:true}},{role})).toBeUndefined()
    expect(routeAccess({path:'/manage/worker-applications',meta:{manage:true}},{role:'OPERATOR'})).toBe('/overview')
    expect(routeAccess({path:'/manage/worker-applications',meta:{manage:true}},null)).toBe('/login')
  })
  it('constructs credential-free registration links and generates a local QR PNG',async()=>{
    const url=workerRegistrationUrl('https://dacos.example')
    expect(url).toBe('https://dacos.example/worker-register')
    expect(workerRegistrationUrl('http://localhost:5173')).toBe('http://localhost:5173/worker-register')
    for(const invalid of ['javascript:alert(1)','https://a:b@dacos.example','https://dacos.example/?code=pairing','https://dacos.example/#token','http://public.example','https://dacos.example/login'])expect(()=>workerRegistrationUrl(invalid)).toThrow()
    expect(await QRCode.toDataURL(url,{margin:4})).toMatch(/^data:image\/png;base64,/)
  })
  it('uses the same privacy and validation contract on client/server',()=>{
    const input={fullName:'Example Worker',phone:'+231 770 123 456',employeeNumber:'',jobTitle:'Electrician',workArea:'UNDERGROUND',site:'Fictional Site',shift:'Day',emergencyContact:'',acknowledgement:true,privacyVersion:registrationPrivacyVersion}
    expect(workerApplicationSchema.safeParse(input).success).toBe(true)
    for(const invalid of [{phone:'abc'},{acknowledgement:false},{workArea:'precise BLE'},{privacyVersion:'old'},{active:true},{jobTitle:' '.repeat(10)}])expect(workerApplicationSchema.safeParse({...input,...invalid}).success).toBe(false)
  })
  it('renders public privacy/acknowledgement and protected review loading states',async()=>{
    for(const [component,text] of [[WorkerRegisterView,'Privacy &amp; application review'],[WorkerApplicationsView,'Loading applications']]){
      const router=createRouter({history:createMemoryHistory(),routes:[{path:'/',component}]})
      const app=createSSRApp(component).use(createPinia()).use(router)
      await router.push('/');await router.isReady()
      const html=await renderToString(app)
      expect(html).toContain(text)
      if(component===WorkerRegisterView){expect(html).toContain('type="checkbox"');expect(html).toContain('Emergency contact (optional)');expect(html).toContain('does not enroll you in location tracking')}
    }
  })
})
