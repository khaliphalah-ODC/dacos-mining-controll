import { describe, it, expect, vi } from 'vitest'
import { createSSRApp } from 'vue'
import { renderToString } from '@vue/server-renderer'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import { routeAccess } from '../src/services/access.js'
import { useAuthStore } from '../src/stores/auth.js'
import LoginView from '../src/views/LoginView.vue'
import WorkerManagementView from '../src/views/WorkerManagementView.vue'
import DeviceManagementView from '../src/views/DeviceManagementView.vue'
describe('authentication and management UI', () => {
  it('protects routes for every role', () => {
    expect(routeAccess({path:'/welcome',meta:{public:true}},null)).toBeUndefined()
    expect(routeAccess({path:'/workers'},null)).toBe('/login')
    expect(routeAccess({path:'/login'},null)).toBeUndefined()
    expect(routeAccess({path:'/manage/devices',meta:{manage:true}},{role:'OPERATOR'})).toBe('/overview')
    expect(routeAccess({path:'/manage/devices',meta:{manage:true}},{role:'SUPERVISOR'})).toBeUndefined()
    expect(routeAccess({path:'/manage/users',meta:{admin:true}},{role:'SUPERVISOR'})).toBe('/overview')
    expect(routeAccess({path:'/manage/users',meta:{admin:true}},{role:'ADMIN'})).toBeUndefined()
  })
  it('keeps session credentials in HTTP-only cookies and sends CSRF for mutations', async () => {
    setActivePinia(createPinia())
    const fetch = vi.fn().mockResolvedValue({ ok:true,status:200,json:async () => ({user:{id:'test',role:'SUPERVISOR'},csrfToken:'test-csrf'}) })
    vi.stubGlobal('fetch',fetch)
    try {
      const auth = useAuthStore()
      await auth.login('test@example.test','password')
      expect(auth.canManage()).toBe(true)
      await auth.request('/api/manage/workers',{name:'Example'})
      expect(fetch.mock.calls[1][1].headers['x-csrf-token']).toBe('test-csrf')
      expect(fetch.mock.calls[1][1].headers.Authorization).toBeUndefined()
      await auth.logout(); expect(auth.user).toBeNull(); expect(auth.csrfToken).toBe('')
    } finally { vi.unstubAllGlobals() }
  })
  it('renders login, worker forms and inventory loading states', async () => {
    for (const [component, text] of [[LoginView,'Authenticate Session'],[WorkerManagementView,'Register worker'],[DeviceManagementView,'Register inventory device']]) {
      const router = createRouter({ history:createMemoryHistory(),routes:[{path:'/',component}] })
      const app = createSSRApp(component).use(createPinia()).use(router)
      await router.push('/'); await router.isReady()
      const html = await renderToString(app)
      expect(html).toContain(text)
      if (component === LoginView) expect(html).toContain('autocomplete="current-password"')
      else expect(html).toContain('Loading')
    }
  })
})
it('does not restore a stale user response after logout',async()=>{
 setActivePinia(createPinia())
 let deliver
 vi.stubGlobal('fetch',vi.fn(path=>path==='/api/auth/session'?new Promise(resolve=>{deliver=resolve}):Promise.resolve({ok:true,status:200,json:async()=>({loggedOut:true})})))
 try{
  const auth=useAuthStore();auth.user={id:'old',role:'OPERATOR'};auth.csrfToken='old-csrf'
  const restoring=auth.restore();await auth.logout()
  deliver({ok:true,status:200,json:async()=>({user:{id:'old',role:'OPERATOR'},csrfToken:'old-csrf'})})
  await restoring
  expect(auth.user).toBeNull();expect(auth.csrfToken).toBe('')
 }finally{vi.unstubAllGlobals()}
})
it('passes cancellation through the shared client and invalidates expired sessions on protected reads',async()=>{
 setActivePinia(createPinia());const auth=useAuthStore();auth.user={id:'staff',role:'OPERATOR'}
 const controller=new AbortController(),fetch=vi.fn(async()=>({ok:false,status:401,json:async()=>({error:'Sign in required'})}))
 vi.stubGlobal('fetch',fetch)
 try{await expect(auth.request('/api/workers',undefined,'GET',{signal:controller.signal})).rejects.toMatchObject({status:401});expect(fetch.mock.calls[0][1].signal).toBe(controller.signal);expect(auth.user).toBeNull()}finally{vi.unstubAllGlobals()}
})
