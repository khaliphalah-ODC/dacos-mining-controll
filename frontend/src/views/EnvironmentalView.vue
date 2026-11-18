<script setup>

import {ref,computed,watch} from 'vue'
import {RouterLink} from 'vue-router'
import {useTelemetryStore} from '../stores/telemetry.js'
import PageHeading from '../components/ui/PageHeading.vue'
import ReadingTile from '../components/ReadingTile.vue'
import DataState from '../components/ui/DataState.vue'
const telemetry=useTelemetryStore(),zoneId=ref(''),query=ref('')
const zones=computed(()=>(telemetry.snapshot?.zones??[]).filter(z=>!zoneId.value||z.id===zoneId.value))
const readings=id=>(telemetry.snapshot?.readings??[]).filter(r=>r.kind==='environment'&&r.zoneId===id&&r.metric.toLowerCase().includes(query.value.toLowerCase()))

import {useApiQuery} from '../composables/useApiQuery.js'
import {useAuthStore} from '../stores/auth.js'
import {qualityFor} from '../services/telemetry.js'
import HistoryChart from '../components/HistoryChart.vue'
const auth=useAuthStore(),historyMetric=ref('co'),exportError=ref('')
const historyUrl=()=>'/api/history/readings?'+new URLSearchParams({kind:'environment',metric:historyMetric.value,limit:'200',...(zoneId.value?{zoneId:zoneId.value}:{})})
const history=useApiQuery(historyUrl)
watch([zoneId,historyMetric],()=>history.load())
const envSamples=computed(()=>(telemetry.snapshot?.readings??[]).filter(r=>r.kind==='environment'))
const labels={o2:'Oxygen (O₂)',co:'Carbon monoxide',ch4:'Methane (CH₄)',airVelocity:'Air velocity',airTemperature:'Ambient temperature',humidity:'Relative humidity'}
function tiles(id){const received=readings(id);const names=[...new Set([...Object.keys(labels),...received.map(r=>r.metric)])].filter(k=>k.toLowerCase().includes(query.value.toLowerCase()));return names.map(metric=>({metric,label:labels[metric]??metric,reading:received.find(r=>r.metric===metric)}))}
const sampleQuality=r=>r?qualityFor(r,{connected:telemetry.connected,now:telemetry.now,lastReceived:telemetry.lastReceived}):'unavailable'
const sampleValue=r=>r&&r.value!==null&&!['unavailable','offline'].includes(sampleQuality(r))?r.value:'—'
async function exportCsv(){exportError.value='';try{await auth.download('/api/reports/readings.csv?'+new URLSearchParams({kind:'environment',...(zoneId.value?{zoneId:zoneId.value}:{}),...(query.value?{metric:query.value}:{})}),'dacos-environment.csv')}catch(e){exportError.value=e.message}}

</script>
<template>
<main class="flex-1 pt-[68px] bg-surface w-full px-space-md py-space-md reference-page dacos_environmental_monitoring"><p class="bg-error-container p-space-md rounded-lg text-on-error-container" role="alert" v-if="exportError||history.error.value">{{exportError||history.error.value}}</p><div class="flex flex-col w-full space-y-space-md">

<div class="flex flex-col lg:flex-row lg:items-center justify-between gap-space-md">
<div>
<div class="flex items-center gap-space-xs font-code-sm text-code-sm text-outline tracking-wider uppercase">
<span class="text-on-surface-variant">Monitoring</span>
<span>/</span>
<span class="text-on-surface-variant">Environmental Monitoring</span>
<span>/</span>
<span class="text-primary font-semibold">Zone Atmospheric Arrays</span>
</div>
<div class="flex items-center gap-space-sm mt-1">
<h1 class="font-headline-lg text-headline-lg text-on-surface tracking-tight">Subterranean Environmental &amp; Gas Telemetry</h1>
<span class="inline-flex items-center px-2 py-0.5 rounded bg-primary/10 text-primary font-code-sm text-code-sm uppercase">Environmental workspace</span>
</div>
</div>

<div class="flex items-center gap-space-sm">
<div class="hidden sm:flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-container-high text-on-surface-variant font-code-sm text-code-sm">
<span class="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
<span>{{telemetry.connected?"REALTIME CONNECTED":"REALTIME OFFLINE"}}</span>
</div>
<button class="flex items-center gap-space-xs px-space-md py-2.5 rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-primary font-label-md text-label-md transition-all shadow-sm" disabled="" id="btn-calibration-check" title="Physical calibration is not supported">
<span class="material-symbols-outlined text-[18px]">build</span>
<span>Trigger Calibration Check (Demo)</span>
</button>
<button @click="exportCsv" aria-label="Export environmental readings" class="p-2 rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-on-surface-variant transition-colors" title="Export Environmental Audit Log">
<span class="material-symbols-outlined text-[20px]">download</span>
</button>
</div>
</div>

<div class="w-full rounded-xl bg-tertiary-container/15 px-space-md py-3 flex items-center justify-between gap-space-md shadow-sm">
<div class="flex items-center gap-space-sm min-w-0">
<span class="material-symbols-outlined text-tertiary text-[22px] shrink-0">warning</span>
<div class="min-w-0">
<div class="font-code-sm text-code-sm uppercase tracking-wider text-tertiary font-bold truncate">SUPERVISED DEMO PROTOTYPE // NOT A CERTIFIED LIFE-SAFETY SENSOR SUITE</div>
<div class="font-body-md text-body-md text-on-surface-variant truncate">{{telemetry.snapshot?.mode==='operational'?'Accepted environmental device readings only. Hardware validation pending.':'Backend-generated simulated environmental readings. Hardware validation pending.'}}</div>
</div>
</div>
<div class="hidden md:flex items-center gap-2 shrink-0 font-code-sm text-code-sm text-tertiary uppercase">
<span class="inline-block w-2 h-2 rounded-full bg-tertiary animate-ping"></span>
<span>{{telemetry.snapshot?.mode==='operational'?'HARDWARE VALIDATION PENDING':'SIMULATED TELEMETRY'}}</span>
</div>
</div>

<div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-space-md">

<div class="rounded-xl bg-surface-container p-space-md shadow-md flex flex-col justify-between">
<div class="flex items-start justify-between">
<div>
<span class="font-code-sm text-code-sm uppercase tracking-wider text-on-surface-variant">Atmospheric Sectors</span>
<div class="font-telemetry-lg text-telemetry-lg text-on-surface mt-1">{{zones.length}} configured</div>
</div>
<div class="w-10 h-10 rounded-lg bg-surface-container-high flex items-center justify-center text-primary">
<span class="material-symbols-outlined text-[22px]">radar</span>
</div>
</div>
<div class="mt-space-md flex items-center justify-between pt-space-sm font-label-sm text-label-sm text-on-surface-variant">
<span class="flex items-center gap-1.5 text-primary">
<span class="w-1.5 h-1.5 rounded-full bg-primary"></span>{{envSamples.length}} received samples</span>
<span class="font-code-sm text-code-sm text-outline">{{telemetry.connected?"NET LINK: UP":"NET LINK: OFFLINE"}}</span>
</div>
</div>

<div class="rounded-xl bg-surface-container p-space-md shadow-md flex flex-col justify-between relative overflow-hidden">
<div class="absolute -right-6 -bottom-6 w-24 h-24 bg-error-container/20 rounded-full blur-xl pointer-events-none"></div>
<div class="flex items-start justify-between">
<div>
<span class="font-code-sm text-code-sm uppercase tracking-wider text-on-surface-variant">Recorded zone alerts</span>
<div class="font-telemetry-lg text-telemetry-lg text-error mt-1 flex items-center gap-2">
<span>{{telemetry.alerts.filter(a=&gt;a.zoneId&amp;&amp;!a.workerId).length}} recorded</span>
<span class="font-label-sm text-label-sm px-1.5 py-0.5 rounded bg-error/20 text-error uppercase font-semibold">Backend records</span>
</div>
</div>
<div class="w-10 h-10 rounded-lg bg-error-container/30 flex items-center justify-center text-error">
<span class="material-symbols-outlined text-[22px]">warning</span>
</div>
</div>
<div class="mt-space-md flex items-center justify-between pt-space-sm font-label-sm text-label-sm text-error">
<span class="truncate">Review the incident console</span>
<span class="font-code-sm text-code-sm text-outline">No safety inference</span>
</div>
</div>

<div class="rounded-xl bg-surface-container p-space-md shadow-md flex flex-col justify-between">
<div class="flex items-start justify-between">
<div>
<span class="font-code-sm text-code-sm uppercase tracking-wider text-on-surface-variant">Ventilation Delivery</span>
<div class="font-telemetry-lg text-telemetry-lg text-on-surface mt-1">—<span class="font-label-md text-label-md text-on-surface-variant uppercase">CFM</span></div>
</div>
<div class="w-10 h-10 rounded-lg bg-surface-container-high flex items-center justify-center text-primary">
<span class="material-symbols-outlined text-[22px]">mode_fan</span>
</div>
</div>
<div class="mt-space-md flex items-center justify-between pt-space-sm font-label-sm text-label-sm text-on-surface-variant">
<span class="flex items-center gap-1.5 text-primary">
<span class="w-1.5 h-1.5 rounded-full bg-primary"></span>Fan telemetry unavailable</span>
<span class="font-code-sm text-code-sm text-outline">No control integration</span>
</div>
</div>

<div class="rounded-xl bg-surface-container p-space-md shadow-md flex flex-col justify-between">
<div class="flex items-start justify-between">
<div>
<span class="font-code-sm text-code-sm uppercase tracking-wider text-on-surface-variant">Gateway Telemetry Sync</span>
<div class="font-telemetry-lg text-telemetry-lg text-primary mt-1">{{telemetry.connected?"Live":"Offline"}}<span class="font-label-md text-label-md text-on-surface-variant uppercase">SOCKET</span></div>
</div>
<div class="w-10 h-10 rounded-lg bg-surface-container-high flex items-center justify-center text-secondary">
<span class="material-symbols-outlined text-[22px]">sensors</span>
</div>
</div>
<div class="mt-space-md flex items-center justify-between pt-space-sm font-label-sm text-label-sm text-on-surface-variant">
<span class="text-on-surface-variant">This browser’s authenticated connection</span>
<span class="font-code-sm text-code-sm text-primary font-semibold">Loss metrics unavailable</span>
</div>
</div>
</div>



<div class="bg-surface-container rounded-xl p-space-md flex flex-wrap items-end gap-space-md reference-form"><label>Zone<select v-model="zoneId"><option value="">All zones</option><option :key="z.id" :value="z.id" v-for="z in telemetry.snapshot?.zones??[]">{{z.name}}</option></select></label><label>Filter received metric<input maxlength="100" placeholder="For example, co or temperature" v-model="query"/></label><RouterLink class="text-primary text-label-md py-2" to="/history?kind=environment">Recorded environmental history →</RouterLink></div><div class="space-y-space-md">



<div :key="z.id" class="rounded-xl bg-surface-container p-space-md shadow-md flex flex-col space-y-space-md relative overflow-hidden" v-for="z in zones">
<div class="absolute left-0 top-0 bottom-0 w-1.5 bg-primary"></div>
<div class="flex flex-col lg:flex-row lg:items-center justify-between gap-space-sm pl-2">
<div class="flex flex-wrap items-center gap-space-sm">
<div class="px-2 py-0.5 rounded bg-primary/20 text-primary font-code-sm text-code-sm uppercase font-bold tracking-wider flex items-center gap-1.5">
<span class="w-2 h-2 rounded-full bg-primary"></span>{{z.id}} · {{z.depth}} m assigned depth</div>
<span class="font-headline-md text-headline-md text-on-surface">{{z.name}}</span>
<span class="text-outline text-label-sm font-code-sm">Administrative zone geometry</span>
</div>
<div class="flex items-center gap-space-md font-code-sm text-code-sm text-on-surface-variant">
<span>NODE: <strong class="text-on-surface">{{readings(z.id)[0]?.deviceId??"Unavailable"}}</strong></span>
<span>LAST PING: <strong class="text-primary">{{readings(z.id)[0]?.timestamp?new Date(readings(z.id)[0].timestamp).toLocaleTimeString():"Unavailable"}}</strong></span>
<span class="px-2 py-0.5 rounded bg-primary/15 text-primary uppercase font-bold text-code-sm">{{readings(z.id).length?"RECEIVED SAMPLES":"NO DATA"}}</span>
</div>
</div>
<div class="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-space-sm">

<div :key="t.metric" class="rounded-lg bg-surface-container-high p-3 flex flex-col justify-between" v-for="t in tiles(z.id)">
<div class="flex flex-wrap gap-1 items-center justify-between text-on-surface-variant font-code-sm text-code-sm uppercase">
<span>{{t.label}}</span>
<span class="text-primary">{{t.reading?sampleQuality(t.reading):"—"}}</span>
</div>
<div class="my-2">
<span class="font-telemetry-lg text-telemetry-lg text-primary">{{sampleValue(t.reading)}}</span>
<span class="font-label-sm text-label-sm text-on-surface-variant ml-1">{{t.reading?.unit??""}}</span>
</div>
<div class="w-full h-7 flex items-end gap-1"><span class="text-code-sm text-outline">{{t.reading?.timestamp?new Date(t.reading.timestamp).toLocaleTimeString():"No reading received"}}</span></div>
<div class="mt-2 text-right font-code-sm text-code-sm text-outline">{{t.reading?.simulation?"SIMULATED":t.reading?.source??"Awaiting measurement"}}</div>
</div>










</div>
</div>






<p class="bg-surface-container rounded-xl p-space-lg text-outline" v-if="!zones.length">No zones configured for these filters.</p></div>

<div class="grid grid-cols-1 lg:grid-cols-3 gap-space-md pt-space-xs">

<div class="lg:col-span-2 rounded-xl bg-surface-container p-space-md shadow-md flex flex-col justify-between"><div class="flex flex-wrap justify-between items-center gap-space-sm mb-space-md"><div><h2 class="text-headline-md font-semibold">Recorded atmospheric trends</h2><p class="text-label-sm text-outline">Persisted readings · Source and gaps retained</p></div><label class="text-label-sm">Metric<select class="ml-2 bg-surface-container-high rounded p-2" v-model="historyMetric"><option :key="key" :value="key" v-for="(label,key) in labels">{{label}}</option></select></label></div><div class="bg-surface-container-high rounded-lg p-space-sm min-h-52"><p class="text-outline" role="status" v-if="history.loading.value">Loading recorded readings…</p><p class="text-error" role="alert" v-else-if="history.error.value">{{history.error.value}}</p><HistoryChart :metric="historyMetric" :rows="history.data.value?.data??[]" v-else=""></HistoryChart></div><RouterLink :to="{path:'/history',query:{kind:'environment',metric:historyMetric,zoneId}}" class="text-primary text-label-sm mt-space-sm">View recorded history →</RouterLink></div>

<div class="rounded-xl bg-surface-container p-space-md shadow-md flex flex-col justify-between"><div><p class="text-code-sm text-outline uppercase">Surface infrastructure</p><h2 class="text-headline-md font-semibold">Forced air vent stacks</h2><span class="text-code-sm text-outline">Hardware integration unavailable</span><div :key="label" class="flex items-center justify-between bg-surface-container-high rounded-lg p-space-md mt-space-sm" v-for="label in ['Fan operating state','Measured airflow','Controller feedback']"><div class="flex items-center gap-space-sm"><span class="material-symbols-outlined text-primary">cyclone</span><span class="text-label-md">{{label}}</span></div><span class="text-code-sm text-outline">Unavailable</span></div></div><div class="pt-space-sm mt-space-sm border-t border-outline-variant/30 flex items-center justify-between"><span class="text-code-sm text-outline">No ventilation control endpoint</span><button class="bg-surface-container-high rounded-lg p-2 text-label-sm" disabled="">Manual Fan Override</button></div></div>
</div>


</div></main>
</template>
