<script setup>

import {computed} from 'vue'
import {RouterLink} from 'vue-router'
import {useTelemetryStore} from '../stores/telemetry.js'
import {useApiQuery} from '../composables/useApiQuery.js'
import PageHeading from '../components/ui/PageHeading.vue'
import MetricCard from '../components/ui/MetricCard.vue'
import StatusBadge from '../components/ui/StatusBadge.vue'
import ZoneSchematic from '../components/ZoneSchematic.vue'
import ReadingTile from '../components/ReadingTile.vue'
import DataState from '../components/ui/DataState.vue'
const telemetry=useTelemetryStore(),control=useApiQuery('/api/control-room',{realtime:true}),status=useApiQuery('/api/operations/status',{realtime:true}),incidents=useApiQuery('/api/operations/incidents?limit=5',{realtime:true})
const environment=computed(()=>(telemetry.snapshot?.readings??[]).filter(r=>r.kind==='environment'))
const sample=computed(()=>telemetry.workers.slice(0,3)),reading=(id,metric)=>telemetry.snapshot?.readings.find(r=>r.workerId===id&&r.metric===metric)

const zones=computed(()=>telemetry.snapshot?.zones??[])
function value(id,metric){const r=reading(id,metric);return r&&!['unavailable','offline'].includes(r.quality)?`${r.value??'Unavailable'} ${r.unit??''}`:'Unavailable'}
const online=computed(()=>Object.values(status.data.value?.devices??{}).reduce((a,b)=>a+b,0))

</script>
<template>
<main class="flex-1 pt-[68px] bg-surface w-full px-space-md py-space-md reference-page"><DataState :error="control.error.value||incidents.error.value" @retry="control.load();incidents.load()"></DataState><div class="flex flex-col w-full space-y-space-md">

<div class="w-full bg-tertiary-container/15 rounded-lg px-space-md py-2.5 flex flex-col md:flex-row items-start md:items-center justify-between gap-space-sm shadow-sm">
<div class="flex items-center gap-space-sm min-w-0">
<span class="material-symbols-outlined text-tertiary shrink-0 animate-pulse text-[20px]">warning</span>
<div class="flex flex-wrap items-center gap-x-2">
<span class="font-code-sm text-code-sm text-tertiary font-bold tracking-wider uppercase">{{telemetry.snapshot?.mode==='operational'?'Hardware telemetry workspace':'Live Demo Telemetry Active'}}</span>
<span class="text-on-surface-variant/40 hidden sm:inline">•</span>
<span class="font-body-md text-label-sm text-on-surface-variant">{{telemetry.snapshot?.mode==='operational'?'Accepted device readings only. Hardware validation pending.':'Synthetically generated readings for testing and validation. Hardware integration pending.'}}</span>
</div>
</div>
<div class="flex items-center gap-space-sm shrink-0 self-end md:self-auto">
<span class="px-2 py-0.5 rounded bg-surface-container-high font-code-sm text-code-sm text-primary uppercase font-medium">{{telemetry.snapshot?.mode==='operational'?'HARDWARE STREAM':'SIMULATED STREAM'}}</span>
<span class="font-code-sm text-code-sm text-outline">LATENCY: Unavailable</span>
</div>
</div>

<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-md">

<div class="bg-surface-container rounded-xl p-space-md shadow-md flex flex-col justify-between relative overflow-hidden group hover:bg-surface-container-high transition-colors">
<div class="absolute top-0 left-0 w-1.5 h-full bg-primary"></div>
<div class="flex items-center justify-between">
<span class="font-code-sm text-code-sm text-on-surface-variant uppercase tracking-wider">Active Workers</span>
<span class="material-symbols-outlined text-primary text-[20px]">group</span>
</div>
<div class="my-space-sm">
<div class="flex items-baseline gap-2">
<span class="font-telemetry-lg text-telemetry-lg text-on-surface">{{control.data.value?.summary.workers??"—"}}</span>
<span class="font-label-md text-label-md text-on-surface-variant uppercase">Tracked</span>
</div>
<p class="font-label-sm text-label-sm text-on-surface-variant mt-1">Active registered personnel</p>
</div>
<div class="flex items-center gap-2 pt-space-xs font-code-sm text-code-sm">
<span class="text-primary font-semibold">{{status.data.value?.devices.connected??0}} Online</span>
<span class="text-outline">•</span>
<span class="text-tertiary font-semibold">{{status.data.value?.devices.stale??0}} Stale</span>
<span class="text-outline">•</span>
<span class="text-error font-semibold">{{status.data.value?.devices.disconnected??0}} Offline</span>
</div>
</div>

<div class="bg-surface-container rounded-xl p-space-md shadow-md flex flex-col justify-between relative overflow-hidden group hover:bg-surface-container-high transition-colors">
<div class="absolute top-0 left-0 w-1.5 h-full bg-primary-container"></div>
<div class="flex items-center justify-between">
<span class="font-code-sm text-code-sm text-on-surface-variant uppercase tracking-wider">Device Health</span>
<span class="material-symbols-outlined text-primary text-[20px]">sensors</span>
</div>
<div class="my-space-sm">
<div class="flex items-baseline gap-2">
<span class="font-telemetry-lg text-telemetry-lg text-on-surface">{{status.data.value?.devices.connected??"—"}}</span>
<span class="font-label-md text-label-md text-on-surface-variant uppercase">Linked</span>
</div>
<p class="font-label-sm text-label-sm text-on-surface-variant mt-1">Smart helmets &amp; gas monitors</p>
</div>
<div class="flex items-center gap-2 pt-space-xs font-code-sm text-code-sm">
<span class="text-primary font-semibold">Battery: —</span>
<span class="text-outline">•</span>
<span class="text-tertiary font-semibold">Low: —</span>
<span class="text-outline">•</span>
<span class="text-error font-semibold">{{status.data.value?.devices.revoked??0}} revoked</span>
</div>
</div>

<div class="bg-surface-container rounded-xl p-space-md shadow-md flex flex-col justify-between relative overflow-hidden group hover:bg-surface-container-high transition-colors">
<div class="absolute top-0 left-0 w-1.5 h-full bg-error"></div>
<div class="flex items-center justify-between">
<span class="font-code-sm text-code-sm text-on-surface-variant uppercase tracking-wider">Active Incidents</span>
<span class="material-symbols-outlined text-error text-[20px] animate-pulse">crisis_alert</span>
</div>
<div class="my-space-sm">
<div class="flex items-baseline gap-2">
<span class="font-telemetry-lg text-telemetry-lg text-error">{{control.data.value?.summary.incidents??"—"}}</span>
<span class="font-label-md text-label-md text-error uppercase font-semibold">Open Alerts</span>
</div>
<p class="font-label-sm text-label-sm text-on-surface-variant mt-1">Requires immediate supervisory review</p>
</div>
<div class="flex items-center gap-2 pt-space-xs font-code-sm text-code-sm">
<span class="text-error font-bold">Recorded alerts</span>
<span class="text-outline">•</span>
<span class="text-tertiary font-semibold">Review console</span>
</div>
</div>

<div class="bg-surface-container rounded-xl p-space-md shadow-md flex flex-col justify-between relative overflow-hidden group hover:bg-surface-container-high transition-colors">
<div class="absolute top-0 left-0 w-1.5 h-full bg-primary"></div>
<div class="flex items-center justify-between">
<span class="font-code-sm text-code-sm text-on-surface-variant uppercase tracking-wider">Environmental Status</span>
<span class="material-symbols-outlined text-primary text-[20px]">air</span>
</div>
<div class="my-space-sm">
<div class="flex items-baseline gap-2">
<span class="font-telemetry-md text-telemetry-md text-on-surface">{{environment.length?"Received":"Unavailable"}}</span>
<span class="font-label-md text-label-md text-primary font-medium">Received samples</span>
</div>
<p class="font-label-sm text-label-sm text-on-surface-variant mt-1">Ventilation control unavailable</p>
</div>
<div class="flex items-center gap-2 pt-space-xs font-code-sm text-code-sm text-on-surface-variant">
<span>Avg {{environment.find(r=>r.metric==='oxygen')?.value??'—'}} O₂</span>
<span class="text-outline">•</span>
<span class="text-on-surface">{{environment.find(r=>r.metric==='carbonMonoxide')?.value??'—'}} ppm CO</span>
</div>
</div>
</div>

<div class="grid grid-cols-1 lg:grid-cols-12 gap-space-md items-start">

<div class="lg:col-span-8 space-y-space-md">

<div class="bg-surface-container rounded-xl p-space-md shadow-md flex flex-col">
<div class="flex flex-col sm:flex-row sm:items-center justify-between pb-space-md gap-space-sm">
<div>
<div class="flex items-center gap-2">
<span class="font-headline-sm text-headline-sm text-on-surface">Mine Corridors &amp; Subterranean Nodes</span>
<span class="px-2 py-0.5 rounded bg-surface-variant font-code-sm text-code-sm text-primary uppercase">Registered zones</span>
</div>
<p class="font-label-sm text-label-sm text-on-surface-variant mt-0.5">Administrative zone schematic · Positioning validation pending</p>
</div>
<div class="flex items-center gap-2 shrink-0">
<span class="px-2.5 py-1 rounded bg-surface-container-high font-code-sm text-code-sm text-outline uppercase">Not surveyed · No verified GPS inferred</span>
</div>
</div>

<div class="relative w-full h-[360px] bg-surface-container-lowest rounded-lg p-space-md overflow-hidden flex flex-col justify-between">

<svg class="absolute inset-0 w-full h-full opacity-20 pointer-events-none" xmlns="http://www.w3.org/2000/svg">
<defs>
<pattern height="32" id="scada-grid" patternUnits="userSpaceOnUse" width="32">
<path class="text-outline-variant" d="M 32 0 L 0 0 0 32" fill="none" stroke="currentColor" stroke-width="0.75"></path>
</pattern>
</defs>
<rect fill="url(#scada-grid)" height="100%" width="100%"></rect>

<path class="text-surface-variant" d="M 60 80 L 320 80 L 520 180 L 780 180" fill="none" stroke="currentColor" stroke-dasharray="6,4" stroke-width="2"></path>
<path class="text-surface-variant" d="M 320 80 L 320 280 L 680 280" fill="none" stroke="currentColor" stroke-width="2"></path>
</svg>

<div class="relative z-10 flex items-center justify-between text-on-surface-variant font-code-sm text-code-sm">
<div class="flex items-center gap-3">
<span class="flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-primary animate-ping"></span>REGISTERED MINE ZONES</span>
<span class="text-outline">/</span>
<span>PRESSURE: Unavailable</span>
</div>
<div class="flex items-center gap-2">
<span class="text-outline">AIR VELOCITY:</span>
<span class="text-primary font-semibold">Unavailable</span>
</div>
</div>

<div class="relative z-10 grid grid-cols-2 md:grid-cols-4 gap-space-sm my-auto">

<div :key="z.id" class="bg-surface-container/90 hover:bg-surface-container-high transition-colors p-3 rounded-lg shadow-md cursor-pointer group" v-for="z in zones">
<div class="flex items-center justify-between mb-2">
<span class="font-code-sm text-code-sm text-on-surface font-bold">{{z.name}}</span>
<span class="w-2 h-2 rounded-full bg-primary"></span>
</div>
<div class="font-headline-sm text-headline-sm text-on-surface flex items-baseline gap-1">{{telemetry.workers.filter(w=&gt;w.zoneId===z.id).length}}<span class="font-label-sm text-label-sm text-on-surface-variant font-normal">workers</span>
</div>
<div class="mt-2 pt-2 bg-surface-container-low/60 rounded px-1.5 py-1 flex items-center justify-between font-code-sm text-code-sm">
<span class="text-on-surface-variant">Received samples</span>
<span class="text-primary font-semibold">Unavailable</span>
</div>
</div>






<p class="text-outline col-span-full" v-if="!zones.length">No zone configuration available.</p></div>

<div class="relative z-10 flex flex-wrap items-center justify-between pt-2 text-on-surface-variant font-code-sm text-code-sm bg-surface-container-low/80 backdrop-blur px-space-sm py-1.5 rounded">
<div class="flex items-center gap-4">
<span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-full bg-primary"></span>Nominal Gateway</span>
<span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-full bg-tertiary"></span>Atmospheric Alert</span>
<span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-full bg-error"></span>SOS Emergency</span>
</div>
<div class="flex items-center gap-2">
<span class="text-outline">GEODETIC DATUM:</span>
<span class="text-on-surface">Administrative schematic</span>
</div>
</div>
</div>
</div>

<div class="bg-surface-container rounded-xl p-space-md shadow-md flex flex-col">
<div class="flex items-center justify-between mb-space-md">
<div class="flex items-center gap-2">
<span class="font-headline-sm text-headline-sm text-on-surface">Operational Incident Log</span>
<span class="px-2 py-0.5 rounded bg-error-container text-on-error-container font-code-sm text-code-sm uppercase font-bold">{{control.data.value?.summary.incidents??0}} recorded</span>
</div>
<RouterLink class="font-label-md text-label-md text-primary hover:underline flex items-center gap-1" data-path="incidents" to="/operations/incidents">
<span>View Full Incident Console</span>
<span class="material-symbols-outlined text-[16px]">arrow_forward</span>
</RouterLink>
</div>

<div class="overflow-x-auto">
<table class="w-full text-left border-collapse">
<thead>
<tr class="bg-surface-container-low text-on-surface-variant font-code-sm text-code-sm uppercase tracking-wider">
<th class="py-2.5 px-3">Timestamp</th>
<th class="py-2.5 px-3">Incident ID</th>
<th class="py-2.5 px-3">Worker / Identity</th>
<th class="py-2.5 px-3">Location Sector</th>
<th class="py-2.5 px-3">Severity</th>
<th class="py-2.5 px-3">Status</th>
<th class="py-2.5 px-3 text-right">Action</th>
</tr>
</thead>
<tbody class="divide-y divide-surface-container-high font-body-md text-label-md"><tr :key="i.id" class="bg-surface-container hover:bg-surface-container-high/60" v-for="i in incidents.data.value?.data"><td class="py-3 px-3 text-code-sm whitespace-nowrap">{{new Date(i.createdAt).toLocaleTimeString()}}</td><td class="py-3 px-3 text-primary text-code-sm">{{i.id}}</td><td class="py-3 px-3">{{telemetry.workers.find(w=&gt;w.id===i.workerId)?.name??i.workerId??'No worker linked'}}<small class="block text-outline">{{i.simulation?'SIMULATED':'Reported'}}</small></td><td class="py-3 px-3 text-on-surface-variant">{{i.zoneId??'Unavailable'}}</td><td class="py-3 px-3"><StatusBadge :value="i.severityLevel"></StatusBadge></td><td class="py-3 px-3"><StatusBadge :value="i.lifecycleStatus"></StatusBadge></td><td class="py-3 px-3 text-right"><RouterLink :to="`/operations/incidents/${i.id}`" class="px-3 py-1.5 rounded-lg bg-primary-container text-on-primary-container">Review</RouterLink></td></tr><tr v-if="!incidents.data.value?.data?.length"><td class="p-space-lg text-outline" colspan="7">{{incidents.loading.value?'Loading incidents…':'No incidents recorded'}}</td></tr></tbody>
</table>
</div>
</div>
</div>

<div class="lg:col-span-4 space-y-space-md">

<div class="bg-surface-container rounded-xl p-space-md shadow-md flex flex-col">
<div class="flex items-center justify-between pb-space-sm">
<div>
<span class="font-headline-sm text-headline-sm text-on-surface">Vitals Telemetry</span>
<p class="font-code-sm text-code-sm text-outline uppercase tracking-wider">Field personnel sample ({{sample.length}})</p>
</div>
<span class="material-symbols-outlined text-primary text-[20px]">monitor_heart</span>
</div>
<div class="space-y-space-sm mt-space-sm">

<div :key="w.id" class="bg-surface-container-low rounded-lg p-space-sm shadow-sm space-y-2" v-for="w in sample">
<div class="flex items-center justify-between">
<div class="flex items-center gap-2">
<span class="w-2 h-2 rounded-full bg-error animate-ping"></span>
<span class="font-label-md text-label-md font-semibold text-on-surface">{{w.name}}</span>
<span class="font-code-sm text-code-sm text-outline">{{w.id}}</span>
</div>
<span class="font-code-sm text-code-sm text-error font-semibold">{{reading(w.id,'heartRate')?.quality??'Unavailable'}}</span>
</div>

<div class="flex items-center justify-between pt-1">
<div>
<div class="font-telemetry-md text-telemetry-md text-error leading-none">{{value(w.id,'heartRate')}}<span class="font-label-sm text-label-sm text-on-surface-variant font-normal">BPM</span></div>
<div class="flex items-center gap-2 mt-1.5 font-code-sm text-code-sm text-on-surface-variant">
<span>SpO₂: <strong class="text-on-surface">{{value(w.id,'spo2')}}</strong></span>
<span>Temp: <strong class="text-on-surface">{{value(w.id,'temperature')}}</strong></span>
</div>
</div>

<RouterLink :to="`/workers/${w.id}`" class="text-primary text-label-sm">Worker detail →</RouterLink>
</div>
<div class="pt-1 flex items-center justify-between font-code-sm text-code-sm text-outline">
<span>{{reading(w.id,'heartRate')?.measuredAt??'No reading received'}}</span>
<span class="text-primary font-medium">{{reading(w.id,'heartRate')?.simulation?'SIMULATED':'Reported'}}</span>
</div>
</div>




<p class="text-outline py-space-lg" v-if="!sample.length">No workers registered.</p></div>
</div>

<div class="bg-surface-container rounded-xl p-space-md shadow-md flex flex-col">
<div class="flex items-center justify-between mb-space-sm">
<div>
<span class="font-headline-sm text-headline-sm text-on-surface">Atmospheric Conditions</span>
<p class="font-code-sm text-code-sm text-outline uppercase tracking-wider">Multi-Gas Sensor Array</p>
</div>
<span class="material-symbols-outlined text-primary text-[20px]">airware</span>
</div>
<div class="space-y-space-md mt-space-xs"><div :key="r.id" class="space-y-1.5" v-for="r in environment.slice(0,6)"><div class="flex justify-between text-code-sm"><span>{{r.zoneId}} · {{r.metric}}</span><span class="text-primary">{{r.simulation?'SIMULATED':'Reported'}}</span></div><ReadingTile :label="r.metric" :reading="r"></ReadingTile></div><p class="text-outline py-space-lg" v-if="!environment.length">No environmental data available. Awaiting supported device connection.</p></div>
</div>

<div class="bg-surface-container rounded-xl p-space-md shadow-md flex flex-col">
<div class="flex items-center justify-between mb-space-sm">
<span class="font-code-sm text-code-sm text-outline uppercase tracking-wider">Protocol Pipeline Health</span>
<span class="flex items-center gap-1.5 font-code-sm text-code-sm text-primary">
<span class="w-2 h-2 rounded-full bg-primary animate-ping"></span>{{telemetry.connected?"CONNECTED":"OFFLINE"}}</span>
</div>
<div class="grid grid-cols-3 gap-2 font-code-sm text-code-sm text-center">
<div class="bg-surface-container-low p-2 rounded">
<span class="text-outline block mb-1">LATENCY</span>
<span class="font-telemetry-md text-telemetry-md text-on-surface">—</span>
</div>
<div class="bg-surface-container-low p-2 rounded">
<span class="text-outline block mb-1">BUFFER</span>
<span class="font-telemetry-md text-telemetry-md text-on-surface">—</span>
</div>
<div class="bg-surface-container-low p-2 rounded">
<span class="text-outline block mb-1">BLE GW</span>
<span class="font-telemetry-md text-telemetry-md text-primary">{{status.data.value?.devices.connected??0}} UP</span>
</div>
</div>
</div>
</div>
</div>
</div></main>
</template>
