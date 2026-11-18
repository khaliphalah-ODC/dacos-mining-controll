import {it,expect} from 'vitest'
import {createSSRApp} from 'vue'
import {renderToString} from '@vue/server-renderer'
import {createPinia} from 'pinia'
import {createRouter,createMemoryHistory} from 'vue-router'
import {useTelemetryStore} from '../src/stores/telemetry.js'
import MapView from '../src/views/MapView.vue'
import EnvironmentalView from '../src/views/EnvironmentalView.vue'
import {SimulationAdapter} from '../../backend/src/simulation/adapter.js'
async function render(component,snapshot){const pinia=createPinia(),router=createRouter({history:createMemoryHistory(),routes:[{path:'/',component}]});const app=createSSRApp(component).use(pinia).use(router),telemetry=useTelemetryStore(pinia);telemetry.snapshot=snapshot;telemetry.connected=true;telemetry.now=Date.now();telemetry.lastReceived=telemetry.now;await router.push('/');await router.isReady();return renderToString(app)}
it('operational map/environment never populate fictional workers, positions or sensor readings',async()=>{
 const snapshot={...new SimulationAdapter().advance(),mode:'operational',simulation:false,workers:[],zones:[],readings:[],deviceSessions:[]}
 const map=await render(MapView,snapshot),environment=await render(EnvironmentalView,snapshot)
 expect(map).toContain('No zone configuration available');expect(environment).toContain('No zones configured')
 for(const html of [map,environment]){expect(html).not.toContain('Marcus Brody');expect(html).not.toContain('Olympic Dam');expect(html).not.toContain('101.4')}
})
it('labels backend-generated simulation positions and readings explicitly',async()=>{
 const snapshot=new SimulationAdapter().advance()
 expect(await render(MapView,snapshot)).toContain('SIMULATED')
 expect(await render(EnvironmentalView,snapshot)).toContain('SIMULATED')
})
