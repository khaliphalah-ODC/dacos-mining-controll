import {it,expect} from 'vitest'
import {createSSRApp} from 'vue'
import {renderToString} from '@vue/server-renderer'
import MetricCard from '../src/components/ui/MetricCard.vue'
import DataState from '../src/components/ui/DataState.vue'
import StatusBadge from '../src/components/ui/StatusBadge.vue'
it('renders truthful missing, loading and provenance states in shared components',async()=>{
 expect(await renderToString(createSSRApp(MetricCard,{label:'Devices'}))).toContain('No data available')
 expect(await renderToString(createSSRApp(DataState,{loading:true}))).toContain('Loading records')
 expect(await renderToString(createSSRApp(StatusBadge,{value:'SIMULATED'}))).toContain('data-tone="warning"')
 expect(await renderToString(createSSRApp(StatusBadge,{value:'revoked'}))).toContain('data-tone="danger"')
})
