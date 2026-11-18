import { describe, it, expect, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { snapshotSchema } from '@dacos/contracts'
import fixture from '../src/preview/snapshot.json'
import { useTelemetryStore } from '../src/stores/telemetry.js'

describe('explicit static frontend preview', () => {
  it('uses a valid fictional frozen fixture without claiming a socket connection', async () => {
    vi.stubEnv('VITE_STATIC_PREVIEW', 'true')
    setActivePinia(createPinia())
    const store = useTelemetryStore()
    try {
      expect(snapshotSchema.safeParse(fixture).success).toBe(true)
      expect(fixture.workers).toHaveLength(8)
      expect(fixture.readings).toHaveLength(104)
      store.start()
      await vi.waitFor(() => expect(store.snapshot).not.toBeNull())
      expect(store.preview).toBe(true)
      expect(store.connected).toBe(false)
      expect(store.state).toBe('simulated')
      expect(store.metric('ch4', 'S-304', 2)).toBe('0.85')
      expect(store.metric('fatigue', 'TAG-884')).toBe('—')
      await store.setScenario('normal')
      expect(store.snapshot.scenario).toBe('critical')
      expect(store.snapshot.timestamp).toBe('2026-11-13T12:00:00.000Z')
    } finally { store.stop(); vi.unstubAllEnvs() }
  })
})
