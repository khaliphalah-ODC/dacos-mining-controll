import { it, expect } from 'vitest'
import { createSSRApp } from 'vue'
import { renderToString } from '@vue/server-renderer'
import { locationObservationSchema } from '@dacos/contracts'
import { locationDescription } from '../src/services/locations.js'
import { locationStatus } from '../../backend/src/services/locations.js'
import LocationSummary from '../src/components/LocationSummary.vue'
it('validates positioning source semantics and never invents missing coordinates',()=>{
  const base={deviceId:'00000000-0000-4000-8000-000000000001',workerId:'W-TEST',source:'BLE',simulation:false,sequence:0,timestamp:new Date().toISOString(),zoneId:'TEST-ZONE'}
  expect(locationObservationSchema.safeParse(base).success).toBe(true)
  expect(locationObservationSchema.safeParse({...base,latitude:1,longitude:2}).success).toBe(false)
  expect(locationObservationSchema.safeParse({...base,source:'GNSS'}).success).toBe(false)
  expect(locationObservationSchema.safeParse({...base,source:'SIMULATED',simulation:false}).success).toBe(false)
  expect(locationDescription(null)).toBe('Location Unavailable')
  expect(locationDescription({source:'BLE',zoneId:'Z-1'})).toBe('Zone Z-1')
  expect(locationDescription({latitude:0,longitude:0})).toContain('0.000000, 0.000000')
})
it('separates current simulated, stale and unavailable tracking',()=>{
  const observation={workerId:'W',source:'SIMULATED',simulation:true,timestamp:new Date().toISOString()},device={workerId:'W',connectionStatus:'connected'}
  expect(locationStatus(null,device).status).toBe('UNAVAILABLE')
  expect(locationStatus(observation,device).status).toBe('SIMULATED')
  expect(locationStatus(observation,device,undefined,Date.now()+180000).status).toBe('STALE')
  expect(locationStatus(observation,{...device,connectionStatus:'revoked'}).status).toBe('UNAVAILABLE')
  expect(locationStatus(observation,{...device,workerId:'OTHER'}).status).toBe('UNAVAILABLE')
})
it('renders location unavailable and explicit simulation/offline labelling',async()=>{
  expect(await renderToString(createSSRApp(LocationSummary))).toContain('Location Unavailable')
  const html=await renderToString(createSSRApp(LocationSummary,{offline:true,location:{status:'SIMULATED',reason:'Fictional position',lastKnown:{source:'SIMULATED',simulation:true,zoneId:'TEST-ZONE',timestamp:new Date().toISOString(),receivedAt:new Date().toISOString(),deviceId:'test'}}}))
  expect(html).toContain('OFFLINE');expect(html).toContain('not a physical worker position');expect(html).toContain('Accuracy not reported')
})
