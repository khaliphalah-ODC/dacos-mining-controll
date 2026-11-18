import { routeAccess } from './services/access.js'
import { useAuthStore } from './stores/auth.js'
import { createRouter, createWebHistory, createWebHashHistory } from 'vue-router'
const router = createRouter({
  history: import.meta.env.VITE_STATIC_PREVIEW === 'true' ? createWebHashHistory() : createWebHistory(),
  routes: [
    {path:'/system-health',component:()=>import('./views/SystemHealthView.vue'),meta:{title:'System Health'}},
    { path: '/tracking', component: () => import('./views/TrackingView.vue') },
    { path: '/workers/:id/movement', component: () => import('./views/WorkerMovementView.vue'), meta:{manage:true} },
    { path: '/manage/location-policy', component: () => import('./views/LocationPolicyView.vue'), meta:{admin:true} },
    { path: '/worker-register', component: () => import('./views/WorkerRegisterView.vue'), meta: { public:true, title:'Worker registration' } },
    { path: '/manage/worker-applications', component: () => import('./views/WorkerApplicationsView.vue'), meta: { manage:true, title:'Worker applications' } },
    { path: '/', alias: '/welcome', component: () => import('./views/LandingView.vue'), meta: { public: true, title: 'DACOS — Smarter Mining. Safer Workers.' } },
    {path:'/control-room',component:()=>import('./views/ControlRoomView.vue')},
    {path:'/history',component:()=>import('./views/HistoryView.vue')},
    {path:'/operations/incidents/:id',component:()=>import('./views/IncidentDetailView.vue')},
    {path:'/operations/rules',component:()=>import('./views/RulesView.vue'),meta:{manage:true}},
    { path:'/operations/incidents',component:()=>import('./views/IncidentsView.vue') },
    { path: '/manage/users', component: () => import('./views/UserManagementView.vue'), meta: { admin:true } },
    { path: '/manage/workers', component: () => import('./views/WorkerManagementView.vue'), meta: { manage:true } },
    { path: '/manage/devices', component: () => import('./views/DeviceManagementView.vue'), meta: { manage:true } },
    { path: '/login', component: () => import('./views/LoginView.vue') },
    { path: '/account', component: () => import('./views/AccountView.vue') },
    { path: '/overview', component: () => import('./views/OverviewView.vue'), meta: { title: 'Live Mine Telemetry' } },
    { path: '/workers', component: () => import('./views/WorkersView.vue'), meta: { title: 'Personnel Telemetry' } },
    { path: '/workers/:id', component: () => import('./views/WorkerDetailView.vue'), meta: { title: 'Worker Detail' } },
    { path: '/ble-gateway', component: () => import('./views/BleGatewayView.vue'), meta: { title: 'BLE Gateway', manage:true } },
    { path: '/device-simulator', component: () => import('./views/DeviceSimulatorView.vue'), meta: { title: 'Device Simulator', manage:true } },
    { path: '/map', component: () => import('./views/MapView.vue'), meta: { title: 'Mine Map' } },
    { path: '/environmental', component: () => import('./views/EnvironmentalView.vue'), meta: { title: 'Environmental Monitoring' } },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
  scrollBehavior: () => ({ top: 0 }),
})

router.beforeEach(async to => {
  if (import.meta.env.VITE_STATIC_PREVIEW === 'true') return
  if (to.meta.public) return
  const auth = useAuthStore()
  await auth.restore()
  return routeAccess(to, auth.user)
})
export default router
