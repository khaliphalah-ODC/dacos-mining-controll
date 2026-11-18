import { describe, it, expect } from 'vitest'
import { createSnapshotGate, qualityFor } from '../src/services/telemetry.js'
import { SimulationAdapter } from '../../backend/src/simulation/adapter.js'
const clock = () => new Date('2026-11-13T12:00:00Z')
describe('frontend telemetry validation and freshness', () => {
  it('rejects duplicates, older packets, retired sessions and invalid external data', () => {
    const gate = createSnapshotGate()
    const adapter = new SimulationAdapter({ clock })
    const first = adapter.advance(), second = adapter.advance()
    expect(gate(second)).toBeTruthy()
    expect(gate(first)).toBeNull()
    expect(gate(second)).toBeNull()
    const restarted = new SimulationAdapter({ clock }).advance()
    expect(gate(restarted)).toBeTruthy()
    expect(gate(adapter.advance())).toBeNull()
    expect(gate({ ...restarted, readings: 'invalid' })).toBeNull()
  })
  it('marks transport loss offline and aged readings stale', () => {
    const reading = { value: 1, timestamp: clock().toISOString(), quality: 'simulated' }
    expect(qualityFor(reading, { connected: false })).toBe('offline')
    expect(qualityFor(reading, { connected: true, now: clock().getTime() + 10000, lastReceived: clock().getTime() })).toBe('stale')
    expect(qualityFor(null, { connected: true })).toBe('unavailable')
  })
})

import {applyTelemetryDelta} from '../src/services/deltas.js'
it('applies validated deltas only to their exact baseline and rejects missing/out-of-order state',()=>{
 const first=new SimulationAdapter({clock}).advance()
 const packet={streamId:first.streamId,baseSequence:first.sequence,sequence:first.sequence+1,timestamp:first.timestamp,changes:{scenario:'normal'}}
 expect(applyTelemetryDelta(first,packet)?.scenario).toBe('normal')
 expect(applyTelemetryDelta(null,packet)).toBeNull()
 expect(applyTelemetryDelta(first,{...packet,baseSequence:0})).toBeNull()
 expect(applyTelemetryDelta(first,{...packet,changes:{csrfToken:'unexpected'}})).toBeNull()
})

import {createPinia,setActivePinia} from 'pinia'
import {useTelemetryStore} from '../src/stores/telemetry.js'
it('does not call empty or disconnected operational sensor data live just because the socket is connected',()=>{
 setActivePinia(createPinia())
 const store=useTelemetryStore(),fixture=new SimulationAdapter().advance()
 store.snapshot={...fixture,mode:'operational',simulation:false,readings:[]};store.connected=true;store.now=Date.now();store.lastReceived=store.now
 expect(store.state).toBe('unavailable')
 store.snapshot.readings=[{...fixture.readings[0],source:'hardware',simulation:false,quality:'offline'}]
 expect(store.state).toBe('offline')
 store.snapshot.readings[0].quality='live';store.snapshot.readings[0].timestamp=new Date(store.now).toISOString()
 expect(store.state).toBe('live')
 store.now+=11000
 expect(store.state).toBe('stale')
})
