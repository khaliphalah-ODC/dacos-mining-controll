<script setup>

import {ref,reactive,watch,computed} from 'vue'
import {RouterLink} from 'vue-router'
import {useTelemetryStore} from '../stores/telemetry.js'
import {useApiQuery} from '../composables/useApiQuery.js'
import {incidentQuery} from '../services/incidents.js'
import {qualityFor} from '../services/telemetry.js'
import {deviceConnection} from '../services/worker-detail.js'
import PageHeading from '../components/ui/PageHeading.vue'
import DataState from '../components/ui/DataState.vue'
import StatusBadge from '../components/ui/StatusBadge.vue'
const telemetry=useTelemetryStore(),cursor=ref(''),filters=reactive({q:'',zoneId:'',status:''})
const {data,loading,error,load}=useApiQuery(()=>'/api/workers?'+incidentQuery({...filters,cursor:cursor.value,limit:25}),{realtime:true})
function search(){cursor.value='';load()}
const reading=(w,metric)=>{const r=w.readings.find(r=>r.metric===metric),quality=qualityFor(r,{connected:telemetry.connected,now:telemetry.now,lastReceived:telemetry.lastReceived});return r?.value!=null&&!['offline','unavailable'].includes(quality)?`${r.value} ${r.unit} · ${quality}`:'Unavailable'}

const view=ref('table'),network=ref(''),anomalyOnly=ref(false)
const connection=w=>telemetry.connected?deviceConnection(telemetry.snapshot?.deviceSessions?.find(d=>d.workerId===w.id),telemetry.now):'offline'
const device=w=>telemetry.snapshot?.deviceSessions?.find(d=>d.workerId===w.id)
const anomalous=w=>['warning','critical'].includes(w.status)||(telemetry.snapshot?.alerts??[]).some(a=>a.workerId===w.id)
const shownWorkers=computed(()=>(data.value?.data??[]).filter(w=>(!network.value||connection(w)===network.value)&&(!anomalyOnly.value||anomalous(w))))
function resetFilters(){Object.assign(filters,{q:'',zoneId:'',status:''});network.value='';anomalyOnly.value=false;search()}

</script>
<template>
<main class="flex-1 pt-[68px] bg-surface w-full px-space-md py-space-md reference-page dacos_live_workers_directory"><p class="bg-error-container text-on-error-container p-space-md rounded-lg mb-space-md" role="alert" v-if="error">{{error}}</p><div class="flex flex-col w-full">

<div class="flex flex-col lg:flex-row lg:items-center justify-between gap-space-md mb-space-md">
<div class="flex flex-col gap-1 min-w-0">
<div class="flex items-center gap-2 font-code-sm text-code-sm uppercase tracking-wider text-outline">
<span>Monitoring</span>
<span>/</span>
<span class="text-primary font-semibold">Live Workers Directory</span>
<span class="text-outline">/</span>
<span class="px-2 py-0.5 rounded bg-surface-container-high text-on-surface-variant font-code-sm">Actual personnel records</span>
</div>
<p class="font-body-md text-body-md text-on-surface-variant">Searchable personnel telemetry directory. Actual records with received readings and explicit unavailable states.<span class="inline-block text-tertiary font-code-sm uppercase tracking-wider ml-1 bg-tertiary-container/10 px-1.5 py-0.25 rounded">DEMO PROTOTYPE</span>
</p>
</div>

<div class="flex items-center gap-space-sm shrink-0 flex-wrap">
<div class="flex items-center gap-1.5 bg-surface-container-high px-3 py-1.5 rounded-lg text-on-surface">
<span class="material-symbols-outlined text-[18px] text-primary">schedule</span>
<span class="font-code-sm text-code-sm tracking-wider text-on-surface uppercase">Registered workspace</span>
</div>
<button class="flex items-center gap-1.5 bg-surface-container-high hover:bg-surface-variant px-3 py-1.5 rounded-lg text-on-surface font-label-md text-label-md transition-colors shadow-sm" disabled="" title="Directory export is unavailable; recorded readings can be exported from History">
<span class="material-symbols-outlined text-[16px] text-outline">download</span>
<span>Export CSV (Demo Export)</span>
</button>
<div class="flex items-center bg-surface-container-low p-0.5 rounded-lg shadow-sm">
<button @click="view='table'" class="flex items-center gap-1 px-2.5 py-1 rounded font-label-md text-label-md font-semibold transition-colors" id="view-table-btn" :aria-pressed="view==='table'" :class="view==='table'?'bg-primary-container text-on-primary-container':'text-on-surface-variant'">
<span class="material-symbols-outlined text-[16px]">table_rows</span>
<span>Table</span>
</button>
<button @click="view='grid'" class="flex items-center gap-1 px-2.5 py-1 rounded text-on-surface-variant hover:text-on-surface font-label-md text-label-md transition-colors" id="view-grid-btn" :aria-pressed="view==='grid'" :class="view==='grid'?'bg-primary-container text-on-primary-container':'text-on-surface-variant'">
<span class="material-symbols-outlined text-[16px]">grid_view</span>
<span>Grid</span>
</button>
</div>
</div>
</div>

<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-sm mb-space-md">

<div class="bg-surface-container-low p-space-md rounded-xl shadow-sm flex flex-col justify-between relative overflow-hidden"><span class="text-code-sm text-outline uppercase">Personnel on this page</span><strong class="text-telemetry-lg my-space-sm">{{data?.data.length??0}}</strong><p class="text-label-sm text-on-surface-variant">Server-paginated directory</p></div>

<div class="bg-surface-container-low p-space-md rounded-xl shadow-sm flex flex-col justify-between relative overflow-hidden"><span class="text-code-sm text-outline uppercase">Workers with recorded alerts</span><strong class="text-telemetry-lg my-space-sm">{{(data?.data??[]).filter(anomalous).length}}</strong><p class="text-label-sm text-on-surface-variant">Backend alerts · Not a medical diagnosis</p></div>

<div class="bg-surface-container-low p-space-md rounded-xl shadow-sm flex flex-col justify-between"><span class="text-code-sm text-outline uppercase">Vitals latency</span><strong class="text-telemetry-lg my-space-sm">{{'Unavailable'}}</strong><p class="text-label-sm text-on-surface-variant">No aggregate latency measurement</p></div>

<div class="bg-surface-container-low p-space-md rounded-xl shadow-sm flex flex-col justify-between"><span class="text-code-sm text-outline uppercase">Assigned zones on this page</span><strong class="text-telemetry-lg my-space-sm">{{new Set((data?.data??[]).map(w=&gt;w.zoneId)).size}}</strong><p class="text-label-sm text-on-surface-variant">Administrative assignment · No positioning inference</p></div>
</div>

<div class="bg-surface-container-low p-space-md rounded-xl shadow-sm mb-space-md flex flex-col gap-space-md">
<div class="grid grid-cols-1 md:grid-cols-12 gap-space-sm items-center">

<div class="md:col-span-4 relative">
<span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px]">search</span>
<input @change="search" aria-label="Search name, ID or occupation" class="w-full bg-surface-container-high text-on-surface pl-9 pr-3 py-2 rounded-lg font-body-md text-body-md placeholder:text-outline focus:outline-none focus:ring-1 focus:ring-primary shadow-sm" id="search-input" maxlength="100" placeholder="Search by worker name, ID or occupation..." type="text" v-model="filters.q"/>
</div>

<div class="md:col-span-2 relative">
<select @change="search" class="w-full appearance-none bg-surface-container-high text-on-surface px-3 py-2 rounded-lg font-label-md text-label-md focus:outline-none focus:ring-1 focus:ring-primary shadow-sm pr-8 cursor-pointer" id="zone-filter" v-model="filters.zoneId"><option value="">All zones</option><option :key="z.id" :value="z.id" v-for="z in telemetry.snapshot?.zones??[]">{{z.name}}</option></select>
<span class="material-symbols-outlined absolute right-2.5 top-1/2 -translate-y-1/2 text-outline pointer-events-none text-[18px]">arrow_drop_down</span>
</div>

<div class="md:col-span-2 relative">
<select class="w-full appearance-none bg-surface-container-high text-on-surface px-3 py-2 rounded-lg font-label-md text-label-md focus:outline-none focus:ring-1 focus:ring-primary shadow-sm pr-8 cursor-pointer" id="link-filter" v-model="network"><option value="">All connection states on this page</option><option :key="s" v-for="s in ['connected','stale','offline','disconnected','unpaired','revoked','unavailable']">{{s}}</option></select>
<span class="material-symbols-outlined absolute right-2.5 top-1/2 -translate-y-1/2 text-outline pointer-events-none text-[18px]">arrow_drop_down</span>
</div>

<div class="md:col-span-2 relative">
<select @change="search" class="w-full appearance-none bg-surface-container-high text-on-surface px-3 py-2 rounded-lg font-label-md text-label-md focus:outline-none focus:ring-1 focus:ring-primary shadow-sm pr-8 cursor-pointer" id="alert-filter" v-model="filters.status"><option value="">All scenario alert states</option><option :key="s" v-for="s in ['normal','warning','critical','offline','stale']">{{s}}</option></select>
<span class="material-symbols-outlined absolute right-2.5 top-1/2 -translate-y-1/2 text-outline pointer-events-none text-[18px]">arrow_drop_down</span>
</div>

<div class="md:col-span-2 flex items-center justify-end gap-2">
<button @click="resetFilters" class="flex items-center gap-1 px-3 py-2 rounded-lg text-outline hover:text-on-surface hover:bg-surface-container-high font-label-md text-label-md transition-colors" id="reset-filters">
<span class="material-symbols-outlined text-[16px]">filter_alt_off</span>
<span>Reset</span>
</button>
</div>
</div>

<div class="flex items-center justify-between pt-2 text-on-surface-variant font-code-sm text-code-sm">
<div class="flex items-center gap-2 flex-wrap">
<span class="text-outline uppercase">Active Stream Triage:</span>
<span class="px-2 py-0.5 rounded bg-surface-container-high text-on-surface flex items-center gap-1.5">
<span>{{shownWorkers.length}} records on this page</span>
</span>
<label class="flex items-center gap-2 cursor-pointer ml-2 select-none">
<input class="rounded bg-surface-container-high text-primary focus:ring-0 focus:ring-offset-0 cursor-pointer" id="anomaly-only-toggle" type="checkbox" v-model="anomalyOnly"/>
<span class="text-on-surface font-label-md text-label-md">Show Only Active Anomalies</span>
</label>
</div>
<div class="hidden sm:flex items-center gap-1.5 text-outline">
<span class="inline-block w-2 h-2 rounded-full bg-primary animate-pulse"></span>
<span>{{telemetry.connected?"REALTIME CONNECTED":"REALTIME OFFLINE"}}</span>
</div>
</div>
</div>

<div class="bg-surface-container-low rounded-xl shadow-sm overflow-hidden flex flex-col" id="table-view-container" v-show="view==='table'">
<div class="overflow-x-auto w-full">
<table class="w-full text-left font-body-md text-body-md divide-y-0">

<thead>
<tr class="bg-surface-container-high text-on-surface-variant font-code-sm text-code-sm uppercase tracking-wider">
<th class="py-3 px-space-md" scope="col">Worker Identity</th>
<th class="py-3 px-space-md" scope="col">Subterranean Zone</th>
<th class="py-3 px-space-md" scope="col">Assigned Device &amp; Transp.</th>
<th class="py-3 px-space-md" scope="col">Network Link State</th>
<th class="py-3 px-space-md" scope="col">Vitals Telemetry (BPM / SpO₂ / °C)</th>
<th class="py-3 px-space-md" scope="col">Telemetry Provenance</th>
<th class="py-3 px-space-md text-right" scope="col">Actions</th>
</tr>
</thead>

<tbody class="divide-y divide-outline-variant/10 text-on-surface"><tr :key="w.id" class="border-b border-outline-variant/20 hover:bg-surface-container-high/40" v-for="w in shownWorkers"><td class="py-3 px-space-md"><div class="flex items-center gap-space-sm"><span class="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">{{w.name?.charAt(0)}}</span><div><strong>{{w.name}}</strong><small class="block text-primary">{{w.id}}</small><small class="block text-outline">{{w.role}} · {{w.shift}}</small></div></div></td><td class="py-3 px-space-md">{{telemetry.snapshot?.zones?.find(z=&gt;z.id===w.zoneId)?.name??w.zoneId}}<small class="block text-outline">Administrative assignment</small></td><td class="py-3 px-space-md">{{device(w)?.id??'No enrolled device'}}<small class="block text-outline">{{device(w)?.transport??'Unavailable'}}</small></td><td class="py-3 px-space-md"><StatusBadge :value="connection(w)"></StatusBadge><small class="block text-outline">Connection does not establish safety</small></td><td class="py-3 px-space-md"><strong>{{reading(w,'heartRate')}}</strong><small class="block text-outline">SpO₂ {{reading(w,'spo2')}}</small><small class="block text-outline">Temp {{reading(w,'temperature')}}</small></td><td class="py-3 px-space-md"><span class="text-code-sm text-primary">{{w.readings.some(r=&gt;r.simulation)?'Includes SIMULATED readings':'Device-reported / unavailable'}}</span></td><td class="py-3 px-space-md text-right"><RouterLink :to="`/workers/${w.id}`" class="text-primary text-label-sm">Inspect Detail →</RouterLink><RouterLink :to="{path:'/history',query:{workerId:w.id}}" aria-label="Worker reading history" class="inline-block p-2"><span class="material-symbols-outlined text-[18px]">history</span></RouterLink></td></tr><tr v-if="!shownWorkers.length"><td class="p-space-lg text-outline" colspan="7">{{loading?"Loading workers…":"No workers match these filters"}}</td></tr></tbody>
</table>
</div>

<div class="p-space-md bg-surface-container-low flex flex-col sm:flex-row items-center justify-between gap-space-sm"><span class="text-code-sm text-outline">{{shownWorkers.length}} of {{data?.data.length??0}} records on this page</span><div class="flex gap-space-sm text-label-sm"><button @click="search" v-if="cursor">First page</button><button :disabled="loading" @click="cursor=data.nextCursor;load()" v-if="data?.nextCursor">Next page →</button></div></div>
</div><div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-space-md" v-if="view==='grid'"><article :key="w.id" class="bg-surface-container-low rounded-xl p-space-md space-y-space-sm" v-for="w in shownWorkers"><div class="flex justify-between gap-space-sm"><strong>{{w.name}}</strong><StatusBadge :value="connection(w)"></StatusBadge></div><p class="text-label-sm text-outline">{{w.id}} · {{w.role}} · {{w.zoneId}}</p><p>{{reading(w,'heartRate')}}</p><p class="text-label-sm text-outline">SpO₂ {{reading(w,'spo2')}}</p><RouterLink :to="`/workers/${w.id}`" class="text-primary">Inspect Detail →</RouterLink></article><p class="text-outline" v-if="!shownWorkers.length">No workers match these filters</p><button @click="search" v-if="cursor">First page</button><button @click="cursor=data.nextCursor;load()" v-if="data?.nextCursor">Next page →</button></div>

<div class="mt-space-md p-space-md rounded-xl bg-surface-container-low shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-space-md">
<div class="flex items-center gap-3">
<span class="material-symbols-outlined text-tertiary text-[24px] shrink-0">engineering</span>
<div class="flex flex-col">
<span class="font-label-md text-label-md font-semibold text-tertiary uppercase tracking-wider">Supervised Prototype Evaluation Disclaimer</span>
<p class="font-code-sm text-code-sm text-on-surface-variant">
          Not a certified life-safety system. Physical hardware mesh integration pending field validation. Do not use for actual subterranean evacuation dispatch or medical clearances.
        </p>
</div>
</div>
<div class="flex items-center gap-3 shrink-0">
<span class="font-code-sm text-code-sm text-outline">Hardware validation pending</span>
<span class="px-2 py-0.5 rounded bg-surface-container-high font-code-sm text-code-sm text-primary">{{telemetry.snapshot?.mode??"Awaiting data"}}</span>
</div>
</div>
</div>
</main>
</template>
