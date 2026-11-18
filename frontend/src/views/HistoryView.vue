<script setup>

import StatusBadge from '../components/ui/StatusBadge.vue'

import PageHeading from '../components/ui/PageHeading.vue'
import {ref,reactive,onMounted,onBeforeUnmount,computed} from 'vue'
import {RouterLink,useRoute} from 'vue-router'
import {useAuthStore} from '../stores/auth.js'
import {useTelemetryStore} from '../stores/telemetry.js'
import {incidentQuery} from '../services/incidents.js'
import {isoDate} from '../services/history.js'
import HistoryChart from '../components/HistoryChart.vue'
import {useModalFocus} from '../composables/useModalFocus.js'
const auth=useAuthStore(),telemetry=useTelemetryStore(),route=useRoute(),rows=ref([]),error=ref(''),loading=ref(true),next=ref(null),cursor=ref('')
const initialMetrics=route.query.kind==='environment'?['ch4','co','o2','h2s','pm10','no2','so2','co2','airTemperature','humidity','pressure','airVelocity']:['heartRate','spo2','temperature','respiration','fatigue']
const filters=reactive({kind:route.query.kind==='environment'?'environment':'health',metric:initialMetrics.includes(route.query.metric)?route.query.metric:route.query.kind==='environment'?'ch4':'heartRate',workerId:route.query.workerId??'',zoneId:typeof route.query.zoneId==='string'?route.query.zoneId:'',deviceId:'',source:'',quality:'',from:'',to:''})
const query=()=>incidentQuery({...filters,from:isoDate(filters.from),to:isoDate(filters.to),cursor:cursor.value,limit:200})
let active=true,generation=0
async function load(reset=false){if(reset)cursor.value='';const n=++generation;loading.value=true;error.value='';try{const result=await auth.request('/api/history/readings?'+query(),undefined,'GET');if(active&&n===generation){rows.value=result.data;next.value=result.nextCursor}}catch(e){if(active&&n===generation)error.value=e.message}finally{if(active&&n===generation)loading.value=false}}
onBeforeUnmount(()=>{active=false;generation++})
async function download(){error.value='';try{await auth.download('/api/reports/readings.csv?'+query(),'dacos-readings.csv')}catch(e){error.value=e.message}}
onMounted(()=>load())

const timeWindow=ref('')
function setWindow(){if(timeWindow.value==='custom')return;filters.from=timeWindow.value?new Date(Date.now()-Number(timeWindow.value)*3600000-new Date().getTimezoneOffset()*60000).toISOString().slice(0,16):'';filters.to=''}
const inspected=ref(null),inspectionDialog=ref(null)
useModalFocus(inspected,inspectionDialog,()=>{inspected.value=null})
const numericRows=computed(()=>rows.value.filter(r=>typeof r.value==='number'))
const peak=computed(()=>numericRows.value.length?Math.max(...numericRows.value.map(r=>r.value)):'—')
function resetFilters(){timeWindow.value='';Object.assign(filters,{kind:'health',metric:'heartRate',workerId:'',zoneId:'',deviceId:'',source:'',quality:'',from:'',to:''});load(true)}

</script>
<template>
<main class="flex-1 pt-[68px] bg-surface w-full px-space-md py-space-md reference-page dacos_history_reports"><p class="bg-error-container text-on-error-container p-space-md rounded-lg mb-space-md" role="alert" v-if="error">{{error}}</p><div class="flex flex-col w-full">
<div class="flex flex-col lg:flex-row lg:items-center justify-between gap-space-md pb-space-md">
<div class="flex flex-col space-y-1">
<div class="flex items-center gap-1.5 font-code-sm text-code-sm text-on-surface-variant tracking-wider uppercase">
<span>Analysis</span>
<span class="text-outline">/</span>
<span class="text-primary font-semibold">History &amp; Reports</span>
<span class="text-outline">/</span>
<span class="text-on-surface">Telemetry Logs &amp; Sample Archival</span>
</div>
<h1 class="font-headline-xl text-headline-xl text-on-surface tracking-tight font-bold">Telemetry Archival &amp; Trend Analysis</h1>
<p class="font-body-md text-body-md text-on-surface-variant max-w-4xl">
        Query historical physiological vitals and environmental sensor records. Gaps indicate unrecorded shadow intervals; synthetic simulation packets are explicitly labelled with provenance flags.
      </p>
</div>
<div class="flex items-center gap-space-sm self-start lg:self-center shrink-0">
<button :disabled="loading" @click="download" class="flex items-center gap-2 px-space-md py-2.5 rounded-lg bg-surface-container-high hover:bg-surface-bright text-on-surface transition-all duration-150 font-label-md text-label-md active:scale-95 shadow-sm">
<span class="material-symbols-outlined text-primary text-[18px]">download</span>
<span>Export CSV (Filtered Query)</span>
</button>
<button class="flex items-center gap-2 px-space-md py-2.5 rounded-lg bg-surface-container-high hover:bg-surface-bright text-on-surface transition-all duration-150 font-label-md text-label-md active:scale-95 shadow-sm" disabled="" title="Unavailable in the current backend">
<span class="material-symbols-outlined text-secondary text-[18px]">bookmark_add</span>
<span>Save Preset</span>
</button>
<button class="flex items-center gap-2 px-space-md py-2.5 rounded-lg bg-primary hover:bg-primary-container text-on-primary font-semibold transition-all duration-150 font-label-md text-label-md active:scale-95 shadow-md" disabled="" title="Unavailable in the current backend">
<span class="material-symbols-outlined text-[18px]" style="font-variation-settings: 'FILL' 1;">picture_as_pdf</span>
<span>Export Report PDF (Planned Scope)</span>
</button>
</div>
</div>
<div class="mb-space-md bg-tertiary-container/10 p-space-sm rounded-lg flex items-center justify-between gap-space-md">
<div class="flex items-center gap-space-sm">
<span class="material-symbols-outlined text-tertiary text-[20px] shrink-0">info</span>
<div class="font-code-sm text-code-sm text-tertiary">
<strong class="uppercase font-bold tracking-wider">Persisted backend records retain their source and measurement timestamp. Missing intervals are not interpolated. Retention depends on the configured operational policy.</strong> Unrecorded intervals remain gaps. No sample replacement or certification is implied.
      </div>
</div>
<div class="hidden md:flex items-center gap-2 font-code-sm text-code-sm text-on-surface-variant shrink-0">
<span class="inline-block w-2 h-2 rounded-full bg-primary animate-pulse"></span>
<span>Backend historical store</span>
</div>
</div>
<section class="bg-surface-container-low p-space-md rounded-xl shadow-lg mb-space-lg">
<div class="flex items-center justify-between mb-space-sm pb-space-xs">
<div class="flex items-center gap-2">
<span class="material-symbols-outlined text-primary text-[20px]">tune</span>
<span class="font-headline-sm text-headline-sm uppercase tracking-wider text-on-surface">Archival Query Parameters</span>
</div>
<div class="flex items-center gap-space-sm">
<span class="font-code-sm text-code-sm text-on-surface-variant uppercase tracking-widest">{{loading?"Loading query":"Query ready"}}</span>
<span class="px-2 py-0.5 rounded bg-surface-container-highest text-secondary font-code-sm text-code-sm">PostgreSQL recorded readings</span>
</div>
</div>
<form @submit.prevent="load(true)" class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-space-md reference-form history-query" id="filterForm"><label>Category<div class="relative"><select @change="filters.metric=filters.kind==='environment'?'ch4':filters.kind==='device'?'battery':'heartRate'" v-model="filters.kind"><option value="health">Health</option><option value="environment">Environment</option><option value="device">Device</option></select><span class="material-symbols-outlined absolute right-2.5 top-2.5 pointer-events-none text-on-surface-variant text-[18px]">expand_more</span></div></label><label>Metric<div class="relative"><select v-model="filters.metric"><option :key="m" v-for="m in filters.kind==='environment'?['ch4','co','o2','h2s','pm10','no2','so2','co2','airTemperature','humidity','pressure','airVelocity']:filters.kind==='device'?['battery']:['heartRate','spo2','temperature','respiration','fatigue']">{{m}}</option></select><span class="material-symbols-outlined absolute right-2.5 top-2.5 pointer-events-none text-on-surface-variant text-[18px]">expand_more</span></div></label><label>Worker ID<input maxlength="50" v-model="filters.workerId"/></label><label>Zone ID<input maxlength="100" v-model="filters.zoneId"/></label><label>Source<div class="relative"><select v-model="filters.source"><option value="">All sources</option><option>hardware</option><option>simulator</option><option>dacos-simulator</option></select><span class="material-symbols-outlined absolute right-2.5 top-2.5 pointer-events-none text-on-surface-variant text-[18px]">expand_more</span></div></label><label>Time window<div class="relative"><select @change="setWindow" v-model="timeWindow"><option value="">All recorded time</option><option value="1">Last hour</option><option value="24">Last 24 hours</option><option value="custom">Custom range below</option></select><span class="material-symbols-outlined absolute right-2.5 top-2.5 pointer-events-none text-on-surface-variant text-[18px]">schedule</span></div></label><details class="col-span-full text-label-sm"><summary class="cursor-pointer text-on-surface-variant py-2">Advanced query filters</summary><div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-space-md mt-space-sm"><label>Device ID<input maxlength="100" v-model="filters.deviceId"/></label><label>Quality<div class="relative"><select v-model="filters.quality"><option value="">All quality states</option><option :key="q" v-for="q in ['live','simulated','stale','offline','unavailable']">{{q}}</option></select><span class="material-symbols-outlined absolute right-2.5 top-2.5 pointer-events-none text-on-surface-variant text-[18px]">expand_more</span></div></label><label>From (local time)<input @change="timeWindow='custom'" type="datetime-local" v-model="filters.from"/></label><label>To (local time)<input @change="timeWindow='custom'" type="datetime-local" v-model="filters.to"/></label></div></details><div class="col-span-full flex flex-wrap justify-end items-center gap-space-sm"><button :disabled="loading" type="submit">Apply time filters / refresh</button><button :disabled="loading" @click="download" type="button">Export filtered CSV</button><button @click="resetFilters" type="button">Reset filters</button></div></form>
</section>
<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-md mb-space-md">
<div class="bg-surface-container p-space-md rounded-xl flex flex-col justify-between relative overflow-hidden"><span class="text-code-sm text-outline uppercase">Active query subject</span><strong class="text-telemetry-lg mt-space-sm break-words">{{filters.workerId||filters.zoneId||'All matching records'}}</strong><p class="text-label-sm text-on-surface-variant mt-space-sm">Backend historical query</p></div>
<div class="bg-surface-container p-space-md rounded-xl flex flex-col justify-between relative overflow-hidden"><span class="text-code-sm text-outline uppercase">Peak recorded value</span><strong class="text-telemetry-lg mt-space-sm break-words">{{peak}}</strong><p class="text-label-sm text-on-surface-variant mt-space-sm">{{filters.metric}} · {{numericRows.length}} numeric samples on this page</p></div>
<div class="bg-surface-container p-space-md rounded-xl flex flex-col justify-between relative overflow-hidden"><span class="text-code-sm text-outline uppercase">Recorded samples</span><strong class="text-telemetry-lg mt-space-sm break-words">{{rows.length}}</strong><p class="text-label-sm text-on-surface-variant mt-space-sm">Original timestamps retained · Gaps not interpolated</p></div>
<div class="bg-surface-container p-space-md rounded-xl flex flex-col justify-between relative overflow-hidden"><span class="text-code-sm text-outline uppercase">Recorded provenance</span><strong class="text-telemetry-lg mt-space-sm break-words">{{filters.source||'All sources'}}</strong><p class="text-label-sm text-on-surface-variant mt-space-sm">Simulation labels retained in each record</p></div>
</div>
<section class="bg-surface-container-low rounded-xl p-space-md shadow-xl mb-space-lg"><div class="flex flex-wrap items-center justify-between gap-space-sm mb-space-md"><div><h2 class="text-headline-md font-semibold">Chrono-Synchronized Telemetry Trace</h2><p class="text-label-sm text-outline">Recorded {{filters.metric}} samples · No inferred threshold or interpolation</p></div><span class="text-code-sm text-primary">{{filters.from||'Earliest matching'}} → {{filters.to||'Latest matching'}}</span></div><div class="bg-surface-container-lowest rounded-lg p-space-sm min-h-[280px]"><p role="status" v-if="loading">Loading recorded readings…</p><HistoryChart :metric="filters.metric" :rows="rows" v-else=""></HistoryChart></div></section>
<section class="bg-surface-container-low rounded-xl shadow-xl overflow-hidden mb-space-lg">
<div class="p-space-md flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm">
<div class="flex items-center gap-space-sm">
<span class="material-symbols-outlined text-primary text-[22px]">table_rows</span>
<div>
<h3 class="font-headline-sm text-headline-sm text-on-surface font-semibold">Recorded samples</h3>
<p class="font-label-sm text-label-sm text-on-surface-variant">Unmodified register payload extracts. Original values, sources and quality labels are retained.</p>
</div>
</div>
<div class="flex items-center gap-2 self-start sm:self-center">
<div class="relative">
<span class="material-symbols-outlined absolute left-2 top-2 text-outline text-[18px]">search</span>
</div>
</div>
</div>
<div class="w-full overflow-x-auto">
<table class="w-full text-left font-body-md text-body-md border-collapse">
<thead>
<tr class="bg-surface-container text-outline font-code-sm text-code-sm uppercase tracking-wider h-11">
<th class="px-space-md py-2 font-semibold">Timestamp (UTC)</th>
<th class="px-space-md py-2 font-semibold">Entity / Worker</th>
<th class="px-space-md py-2 font-semibold">Zone Location</th>
<th class="px-space-md py-2 font-semibold">Metric Parameter</th>
<th class="px-space-md py-2 font-semibold text-right">Recorded Value</th>
<th class="px-space-md py-2 font-semibold text-right">Recorded Provenance</th>
<th class="px-space-md py-2 font-semibold">Transport / Gateway</th>
<th class="px-space-md py-2 font-semibold">Quality Status</th>
<th class="px-space-md py-2 font-semibold text-center">Inspect</th>
</tr>
</thead>
<tbody class="font-code-sm text-code-sm divide-y divide-surface-container-high" id="telemetryTableBody"><tr :key="r.id" class="border-b border-outline-variant/20 hover:bg-surface-container-high/40" v-for="r in rows"><td class="px-space-md py-3.5 font-semibold text-on-surface">{{new Date(r.timestamp).toLocaleString()}}</td><td class="px-space-md py-3.5">{{r.workerId??'Unassigned'}}</td><td class="px-space-md py-3.5 text-on-surface-variant">{{r.zoneId??'Unavailable'}}</td><td class="px-space-md py-3.5 text-on-surface">{{r.kind}} · {{r.metric}}</td><td class="px-space-md py-3.5 text-right font-bold text-on-surface text-[13px]"><strong>{{r.value===null?'Unavailable':`${typeof r.value==='object'?JSON.stringify(r.value):r.value} ${r.unit}`}}</strong></td><td class="px-space-md py-3.5 text-right text-primary font-medium">{{r.simulation?'SIMULATED':'Reported'}}</td><td class="px-space-md py-3.5 text-on-surface-variant">{{r.deviceId??'Unavailable'}}<small class="block text-outline">{{r.source}}</small></td><td class="px-space-md py-3.5"><StatusBadge :value="r.quality"></StatusBadge></td><td class="px-space-md py-3.5 text-center"><button @click="inspected=r" aria-label="Inspect recorded sample" class="relative p-2 text-primary"><span class="material-symbols-outlined">terminal</span></button></td></tr><tr v-if="!rows.length"><td class="p-space-lg text-outline" colspan="9">{{loading?"Loading samples…":"No readings for this range."}}</td></tr></tbody>
</table>
</div>
<div class="p-space-md bg-surface-container-lowest flex flex-col md:flex-row items-center justify-between gap-space-sm"><span class="text-code-sm text-outline">{{rows.length}} recorded samples on this page · Original acquisition times retained</span><div class="flex gap-space-sm text-label-sm"><button @click="load(true)" v-if="cursor">Latest page</button><button :disabled="loading" @click="cursor=next;load()" v-if="next">Older page</button></div></div>
</section>
<div class="bg-surface-container-lowest p-space-md rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-space-md">
<div class="flex items-start gap-space-sm">
<span class="material-symbols-outlined text-outline text-[20px] mt-0.5">policy</span>
<div class="flex flex-col">
<span class="font-label-md text-label-md text-on-surface font-semibold">Recorded telemetry retention context</span>
<span class="font-body-md text-body-md text-on-surface-variant max-w-3xl">Persisted backend records retain their source and measurement timestamp. Missing intervals are not interpolated. Retention depends on the configured operational policy.</span>
</div>
</div>
<div class="flex items-center gap-space-sm shrink-0">
<div class="px-3 py-1.5 rounded bg-surface-container-high text-primary font-code-sm text-code-sm uppercase tracking-wider">Integrity certification unavailable</div>
</div>
</div>
</div><div @keydown.esc="inspected=null" aria-label="Recorded sample inspection" aria-modal="true" class="fixed inset-0 bg-surface-container-lowest/80 backdrop-blur-sm z-[80] flex items-center justify-center p-space-md" ref="inspectionDialog" role="dialog" tabindex="-1" v-if="inspected"><div class="bg-surface-container-high rounded-xl max-w-xl w-full max-h-[85vh] overflow-auto p-space-lg"><div class="flex justify-between items-center mb-space-md"><h2 class="text-headline-md">Recorded sample inspection</h2><button @click="inspected=null" aria-label="Close sample inspection" class="p-2">×</button></div><pre class="text-code-sm whitespace-pre-wrap break-all">{{JSON.stringify(inspected,null,2)}}</pre></div></div></main>
</template>
