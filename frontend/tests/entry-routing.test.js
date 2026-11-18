import { beforeEach, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

vi.mock('vue-router', async importOriginal => {
  const actual = await importOriginal()
  return { ...actual, createWebHistory: actual.createMemoryHistory, createWebHashHistory: actual.createMemoryHistory }
})

import router from '../src/router.js'
import { useAuthStore } from '../src/stores/auth.js'

beforeEach(() => setActivePinia(createPinia()))

it('opens the public landing page at the root and preserves the welcome link without session requests', async () => {
  const restore = vi.spyOn(useAuthStore(), 'restore')
  for (const path of ['/', '/welcome']) {
    // Leave the alias record so the next navigation is not considered a duplicate.
    await router.push('/worker-register')
    await router.push(path)
    expect(router.currentRoute.value.path).toBe(path)
    expect(router.currentRoute.value.meta.public).toBe(true)
    expect(router.currentRoute.value.matched[0].components.default.__file).toContain('LandingView.vue')
  }
  expect(restore).not.toHaveBeenCalled()
})

it('keeps the monitoring overview protected and sends signed-in users there from login', async () => {
  const auth = useAuthStore()
  vi.spyOn(auth, 'restore').mockResolvedValue()
  await router.push('/overview')
  expect(router.currentRoute.value.path).toBe('/login')
  auth.user = { id: 'test', role: 'OPERATOR' }
  await router.push('/')
  await router.push('/login')
  expect(router.currentRoute.value.path).toBe('/overview')
})
