import { describe, it, expect } from 'vitest'
import { createSSRApp } from 'vue'
import { renderToString } from '@vue/server-renderer'
import { createPinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import WorkerDetailView from '../src/views/WorkerDetailView.vue'
import { useTelemetryStore } from '../src/stores/telemetry.js'
import { SimulationAdapter } from '../../backend/src/simulation/adapter.js'
async function render(id, snapshot = null, error = '') {
  const pinia = createPinia()
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/workers/:id', component: WorkerDetailView }] })
  const app = createSSRApp(WorkerDetailView).use(pinia).use(router)
  const store = useTelemetryStore(pinia)
  store.snapshot = snapshot; store.error = error; store.connected = true
  await router.push(`/workers/${id}`); await router.isReady()
  return renderToString(app)
}
describe('Worker Detail UI', () => {
  it('renders loading, errors and unknown workers', async () => {
    expect(await render('W-014')).toContain('Loading worker telemetry')
    expect(await render('W-014', null, 'Database unavailable')).toContain('Database unavailable')
    expect(await render('unknown', new SimulationAdapter().advance())).toContain('Worker not found')
  })
  it('renders live store readings, unavailable metrics, location and simulated SOS', async () => {
    const snapshot = new SimulationAdapter().advance()
    snapshot.deviceSessions = [{ id: 'test', workerId: 'W-014', transport: 'wifi', source: 'simulator', lastSeen: snapshot.timestamp, timestamp: snapshot.timestamp, connectionStatus: 'connected', metrics: [{ metric: 'heartRate', value: 81, unit: 'bpm' }] }]
    snapshot.deviceEvents = [{ id: 'sos', workerId: 'W-014', timestamp: snapshot.timestamp, simulation: true, message: 'SIMULATED SOS — no responders contacted' }]
    const html = await render('W-014', snapshot)
    for (const text of ['Amina Johnson', '81 bpm', 'Unavailable', 'wifi', 'connected', 'SIMULATED SOS', 'Received worker location']) expect(html).toContain(text)
  })
})
