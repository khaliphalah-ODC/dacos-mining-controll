<script setup>

import MetricCard from '../components/ui/MetricCard.vue'
import PageHeading from '../components/ui/PageHeading.vue'
import LocationSummary from '../components/LocationSummary.vue'
import {ref,reactive,onMounted,onBeforeUnmount,watch,computed} from 'vue'
import {RouterLink} from 'vue-router'
import {useAuthStore} from '../stores/auth.js'
import {useTelemetryStore} from '../stores/telemetry.js'
import {isoDate} from '../services/history.js'
import {qualityFor} from '../services/telemetry.js'
import {incidentQuery} from '../services/incidents.js'
const auth=useAuthStore(),telemetry=useTelemetryStore(),data=ref(null),error=ref(''),loading=ref(true),filters=reactive({workerId:'',zoneId:'',status:'',from:'',to:''})
let active=true,generation=0,timer
async function load(){const n=++generation;loading.value=true;try{const result=await auth.request('/api/control-room?'+incidentQuery({...filters,from:isoDate(filters.from),to:isoDate(filters.to)}),undefined,'GET');if(active&&n===generation){data.value=result;error.value=''}}catch(e){if(active)error.value=e.message}finally{if(active&&n===generation)loading.value=false}}
function refresh(){clearTimeout(timer);timer=setTimeout(load,250)}
watch(()=>telemetry.snapshot?.sequence,refresh);onMounted(load);onBeforeUnmount(()=>{active=false;generation++;clearTimeout(timer)})
const quality=r=>qualityFor(r,{connected:telemetry.connected,now:telemetry.now,lastReceived:telemetry.lastReceived})
const value=r=>r.value===null?'Unavailable':`${typeof r.value==='object'?JSON.stringify(r.value):r.value} ${r.unit}`

const search=ref(''),alertsOnly=ref(false),timeWindow=ref('')
const shownWorkers=computed(()=>(data.value?.data??[]).filter(w=>(!search.value||`${w.id} ${w.name}`.toLowerCase().includes(search.value.toLowerCase()))&&(!alertsOnly.value||w.alerts.length)))
const envZones=computed(()=>(telemetry.snapshot?.zones??[]).filter(z=>!filters.zoneId||z.id===filters.zoneId))
const envReadings=id=>(telemetry.snapshot?.readings??[]).filter(r=>r.kind==='environment'&&r.zoneId===id)
const metric=(w,name)=>w.readings.find(r=>r.metric===name)
const measurement=(w,name)=>{const r=metric(w,name);return r&&r.value!==null&&!['unavailable','offline'].includes(quality(r))?r.value:'—'}
const metricQuality=(w,name)=>{const r=metric(w,name);return r?`${r.simulation?'SIMULATED · ':''}${quality(r)}`:'Unavailable'}
function applyWindow(){filters.from=timeWindow.value?new Date(Date.now()-Number(timeWindow.value)*3600000-new Date().getTimezoneOffset()*60000).toISOString().slice(0,16):'';load()}

const zoneValue=(id,name)=>{const r=envReadings(id).find(r=>r.metric===name);return r&&r.value!==null&&!['unavailable','offline'].includes(quality(r))?`${r.value} ${r.unit}`:'Unavailable'}
</script>
<template>
<main class="flex-1 pt-[68px] bg-surface w-full px-space-md py-space-md reference-page dacos_control_room_telemetry"><p class="bg-error-container text-on-error-container p-space-md rounded-lg mb-space-md" role="alert" v-if="error">{{error}}</p><div class="flex flex-col w-full space-y-space-md">
<div class="w-full bg-surface-container-low px-space-md py-2.5 rounded-lg flex flex-wrap items-center justify-between gap-space-sm">
<div class="flex items-center gap-space-sm min-w-0">
<span class="material-symbols-outlined text-tertiary text-[20px] shrink-0" style="font-variation-settings: 'FILL' 1;">shield_with_heart</span>
<div class="flex flex-wrap items-baseline gap-x-2 text-on-surface">
<span class="font-code-sm text-code-sm uppercase tracking-wider text-tertiary font-bold">SUPERVISED OPERATIONAL WORKSPACE</span>
<span class="text-outline font-code-sm text-code-sm">|</span>
<span class="font-code-sm text-code-sm text-on-surface-variant">{{data?.mode==='operational'?'Accepted device readings · Hardware validation pending':'Backend-generated simulated telemetry · Not for emergency dispatch'}}</span>
</div>
</div>
<div class="flex items-center gap-space-sm shrink-0">
<span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-surface-container font-code-sm text-code-sm text-primary">
<span class="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>{{telemetry.connected?"STREAM: CONNECTED":"STREAM: OFFLINE"}}</span>
<span class="font-code-sm text-code-sm text-outline">Latency: Unavailable</span>
</div>
</div>
<div class="w-full bg-surface-container rounded-lg p-space-md space-y-space-sm shadow-sm">
<div class="flex flex-col lg:flex-row lg:items-center justify-between gap-space-md">
<div class="flex flex-1 flex-wrap items-center gap-space-sm min-w-0">
<div class="relative min-w-[240px] flex-1 sm:flex-initial">
<span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px]">search</span>
<input aria-label="Search workers" class="w-full h-11 pl-9 pr-3 rounded bg-surface-container-low text-on-surface placeholder:text-outline font-body-md text-body-md focus:outline-none focus:ring-1 focus:ring-primary" id="workerSearch" maxlength="100" placeholder="Search worker name or ID (e.g. W-104)..." type="text" v-model="search"/>
</div>
<div class="relative min-w-[170px]">
<select @change="load" class="w-full h-11 px-3 appearance-none rounded bg-surface-container-low text-on-surface font-label-md text-label-md cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary pr-8" id="zoneFilter" v-model="filters.zoneId"><option value="">All zones</option><option :key="z.id" :value="z.id" v-for="z in telemetry.snapshot?.zones??[]">{{z.name}}</option></select>
<span class="material-symbols-outlined absolute right-2.5 top-1/2 -translate-y-1/2 text-outline text-[18px] pointer-events-none">expand_more</span>
</div>
<div class="relative min-w-[160px]">
<select @change="load" class="w-full h-11 px-3 appearance-none rounded bg-surface-container-low text-on-surface font-label-md text-label-md cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary pr-8" id="stateFilter" v-model="filters.status"><option value="">All connection states</option><option :key="state" :value="state" v-for="state in ['connected','stale','disconnected','unavailable','revoked','unpaired']">{{state}}</option></select>
<span class="material-symbols-outlined absolute right-2.5 top-1/2 -translate-y-1/2 text-outline text-[18px] pointer-events-none">expand_more</span>
</div>
<div class="relative min-w-[180px]">
<select @change="applyWindow" aria-label="Reading time range" class="w-full h-11 px-3 appearance-none rounded bg-surface-container-low text-on-surface font-label-md text-label-md cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary pr-8" v-model="timeWindow"><option value="">All recorded times</option><option value="1">Last hour</option><option value="24">Last 24 hours</option></select>
<span class="material-symbols-outlined absolute right-2.5 top-1/2 -translate-y-1/2 text-outline text-[18px] pointer-events-none">schedule</span>
</div>
</div>
<div class="flex items-center flex-wrap gap-space-md shrink-0">
<label class="inline-flex items-center gap-2 cursor-pointer select-none px-3 py-2 rounded bg-surface-container-low hover:bg-surface-container-high transition-colors">
<input class="w-4 h-4 rounded text-primary focus:ring-0 bg-surface-variant cursor-pointer" id="toggleAlertsOnly" type="checkbox" v-model="alertsOnly"/>
<span class="font-label-md text-label-md text-tertiary flex items-center gap-1 font-semibold">
<span class="w-2 h-2 rounded-full bg-tertiary"></span>
            Show Only Active Alerts
          </span>
</label>
<div class="flex items-center gap-2 px-3 py-2 rounded bg-surface-container-high">
<span class="w-2 h-2 rounded-full bg-primary animate-ping"></span>
<span class="font-code-sm text-code-sm text-on-surface">Realtime refresh</span>
<span class="font-code-sm text-code-sm text-outline">{{telemetry.connected?"(connected)":"(offline)"}}</span>
</div>
</div>
</div>
</div>
<details class="bg-surface-container rounded-lg p-space-md text-label-sm"><summary class="text-on-surface-variant cursor-pointer">Advanced time filters</summary><form class="reference-form grid grid-cols-1 sm:grid-cols-3 gap-space-sm mt-space-sm" @submit.prevent="load"><label>Latest readings from<input v-model="filters.from" type="datetime-local"/></label><label>Latest readings to<input v-model="filters.to" type="datetime-local"/></label><button :disabled="loading" type="submit" class="self-end">Apply filters</button></form></details>
<div class="grid grid-cols-2 sm:grid-cols-4 gap-space-sm">
<div class="bg-surface-container rounded-lg p-space-md flex flex-col justify-between">
<div class="flex items-center justify-between text-on-surface-variant">
<span class="font-code-sm text-code-sm uppercase tracking-wider">Registered workers</span>
<span class="material-symbols-outlined text-[18px] text-primary">groups</span>
</div>
<div class="flex items-baseline gap-2 mt-2">
<span class="font-telemetry-lg text-telemetry-lg tabular-nums text-on-surface">{{data?.summary.workers??"—"}}</span>
<span class="font-label-sm text-label-sm text-on-surface-variant">Personnel Logged</span>
</div>
<div class="mt-2 w-full bg-surface-container-lowest h-1 rounded-full overflow-hidden">
<div class="bg-primary h-full w-full" style="width:0%"></div>
</div>
</div>
<div class="bg-surface-container rounded-lg p-space-md flex flex-col justify-between">
<div class="flex items-center justify-between text-on-surface-variant">
<span class="font-code-sm text-code-sm uppercase tracking-wider">Telemetry Stream</span>
<span class="material-symbols-outlined text-[18px] text-primary">sensors</span>
</div>
<div class="flex items-baseline gap-2 mt-2">
<span class="font-telemetry-lg text-telemetry-lg tabular-nums text-primary">{{data?.summary.connected??"—"}}</span>
<span class="font-label-sm text-label-sm text-on-surface-variant">Connected devices</span>
</div>
<div class="mt-2 w-full bg-surface-container-lowest h-1 rounded-full overflow-hidden">
<div class="bg-primary h-full w-[87.5%]" style="width:0%"></div>
</div>
</div>
<div class="bg-surface-container rounded-lg p-space-md flex flex-col justify-between relative overflow-hidden">
<div class="absolute left-0 top-0 bottom-0 w-1 bg-tertiary"></div>
<div class="flex items-center justify-between text-on-surface-variant">
<span class="font-code-sm text-code-sm uppercase tracking-wider text-tertiary">Alerts Actionable</span>
<span class="material-symbols-outlined text-[18px] text-tertiary">warning</span>
</div>
<div class="flex items-baseline gap-2 mt-2">
<span class="font-telemetry-lg text-telemetry-lg tabular-nums text-tertiary">{{data?.summary.incidents??"—"}}</span>
<span class="font-label-sm text-label-sm text-on-surface-variant">Requires Dispatcher Triage</span>
</div>
<div class="mt-2 w-full bg-surface-container-lowest h-1 rounded-full overflow-hidden">
<div class="bg-tertiary h-full w-[6%]" style="width:0%"></div>
</div>
</div>
<div class="bg-surface-container rounded-lg p-space-md flex flex-col justify-between relative overflow-hidden">
<div class="absolute left-0 top-0 bottom-0 w-1 bg-error"></div>
<div class="flex items-center justify-between text-on-surface-variant">
<span class="font-code-sm text-code-sm uppercase tracking-wider text-error">Stale / Offline</span>
<span class="material-symbols-outlined text-[18px] text-error">signal_wifi_off</span>
</div>
<div class="flex items-baseline gap-2 mt-2">
<span class="font-telemetry-lg text-telemetry-lg tabular-nums text-error">{{data?.summary.stale??"—"}}</span>
<span class="font-label-sm text-label-sm text-on-surface-variant">Reported connection state</span>
</div>
<div class="mt-2 w-full bg-surface-container-lowest h-1 rounded-full overflow-hidden">
<div class="bg-error h-full w-[12.5%]" style="width:0%"></div>
</div>
</div>
</div>
<div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-space-md">
<div :data-state="w.connectionStatus" :data-worker-id="w.id" :key="w.id" class="bg-surface-container rounded-lg p-space-md flex flex-col justify-between relative shadow-sm hover:shadow-md transition-shadow group" v-for="w in shownWorkers">
<div class="absolute left-0 top-3 bottom-3 w-1 bg-primary rounded-r"></div>
<div class="flex items-start justify-between gap-space-sm">
<div class="flex items-center gap-space-sm min-w-0">
<div class="relative shrink-0">
<span class="w-12 h-12 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-headline-md">{{w.name?.charAt(0)}}</span>
<span class="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-surface-container flex items-center justify-center">
<span class="w-2.5 h-2.5 rounded-full bg-primary animate-pulse"></span>
</span>
</div>
<div class="flex flex-col min-w-0">
<div class="flex items-center gap-2">
<span class="font-headline-sm text-headline-sm text-on-surface truncate">{{w.name}}</span>
<span class="font-code-sm text-code-sm text-primary bg-primary/10 px-1.5 py-0.5 rounded">{{w.id}}</span>
</div>
<div class="flex items-center gap-1.5 mt-0.5">
<span class="font-code-sm text-code-sm uppercase px-1.5 py-0.2 rounded bg-surface-container-high text-on-surface-variant">{{w.role}}</span>
<span class="text-outline text-code-sm">•</span>
<span class="font-code-sm text-code-sm text-outline">{{w.shift}}</span>
</div>
</div>
</div>
<div class="shrink-0 text-right">
<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-primary/15 text-primary font-code-sm text-code-sm font-semibold">
<span class="w-1.5 h-1.5 rounded-full bg-primary"></span>{{telemetry.connected?w.connectionStatus:"OFFLINE"}}</span>
<div class="font-code-sm text-code-sm text-outline mt-1">{{w.device?.lastSeen?new Date(w.device.lastSeen).toLocaleTimeString():"Last seen unavailable"}}</div>
</div>
</div>
<div class="mt-space-sm py-2 px-space-sm rounded bg-surface-container-low flex items-center justify-between gap-2">
<div class="flex items-center gap-1.5 min-w-0">
<span class="material-symbols-outlined text-[16px] text-primary shrink-0">place</span>
<span class="font-label-md text-label-md text-on-surface truncate">{{w.zoneId??"Unassigned"}}</span>
</div>
<div class="flex items-center gap-1.5 shrink-0 text-on-surface-variant">
<span class="material-symbols-outlined text-[14px]">watch</span>
<span class="font-code-sm text-code-sm">{{w.device?.id??"No enrolled device"}}</span>
</div>
</div>
<div class="grid grid-cols-3 gap-2 mt-space-sm">
<div class="p-2 rounded bg-surface-container-low flex flex-col">
<div class="flex items-center justify-between text-outline">
<span class="font-code-sm text-code-sm">PULSE</span>
<span class="material-symbols-outlined text-[14px] text-primary">favorite</span>
</div>
<div class="mt-1 flex items-baseline gap-1">
<span class="font-telemetry-md text-telemetry-md tabular-nums text-on-surface">{{measurement(w,"heartRate")}}</span>
<span class="font-code-sm text-code-sm text-on-surface-variant">BPM</span>
</div>
<span class="font-code-sm text-code-sm text-primary mt-1">{{metricQuality(w,"heartRate")}}</span>
</div>
<div class="p-2 rounded bg-surface-container-low flex flex-col">
<div class="flex items-center justify-between text-outline">
<span class="font-code-sm text-code-sm">SpO2</span>
<span class="material-symbols-outlined text-[14px] text-primary">bloodtype</span>
</div>
<div class="mt-1 flex items-baseline gap-1">
<span class="font-telemetry-md text-telemetry-md tabular-nums text-on-surface">{{measurement(w,"spo2")}}</span>
<span class="font-code-sm text-code-sm text-on-surface-variant">%</span>
</div>
<span class="font-code-sm text-code-sm text-on-surface-variant mt-1">{{metricQuality(w,"spo2")}}</span>
</div>
<div class="p-2 rounded bg-surface-container-low flex flex-col">
<div class="flex items-center justify-between text-outline">
<span class="font-code-sm text-code-sm">SKIN TEMP</span>
<span class="material-symbols-outlined text-[14px] text-primary">device_thermostat</span>
</div>
<div class="mt-1 flex items-baseline gap-1">
<span class="font-telemetry-md text-telemetry-md tabular-nums text-on-surface">{{measurement(w,"temperature")}}</span>
<span class="font-code-sm text-code-sm text-on-surface-variant">°C</span>
</div>
<span class="font-code-sm text-code-sm text-on-surface-variant mt-1">{{metricQuality(w,"temperature")}}</span>
</div>
</div>
<div class="mt-2 flex items-center justify-between px-space-sm py-1.5 rounded bg-surface-container-high font-code-sm text-code-sm">
<div class="flex items-center gap-2 min-w-0">
<span class="material-symbols-outlined text-[14px] text-outline">air</span>
<span class="text-on-surface-variant truncate">Sector Gas: <strong class="text-on-surface">O₂ {{zoneValue(w.zoneId,"o2")}}</strong> | <strong class="text-on-surface">CO {{zoneValue(w.zoneId,"co")}}</strong></span>
</div>
<div class="flex items-center gap-1 shrink-0 text-on-surface">
<span class="material-symbols-outlined text-[14px] text-primary">battery_5_bar</span>
<span>{{measurement(w,"battery")}}%</span>
</div>
</div>
<div class="mt-space-md pt-2 flex items-center justify-between gap-2">
<RouterLink :to="`/workers/${w.id}`" class="flex-1 text-center py-2 px-3 rounded bg-surface-container-high hover:bg-surface-variant text-on-surface font-label-md text-label-md transition-colors">
          View Detail
        </RouterLink>
<RouterLink :to="{path:'/history',query:{workerId:w.id}}" class="py-2 px-3 rounded bg-surface-container-low hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface font-label-md text-label-md transition-colors" type="button">
          History
        </RouterLink>
<RouterLink class="p-2 rounded bg-surface-container-low hover:bg-error/20 text-on-surface-variant hover:text-error transition-colors" title="Flag Incident" to="/operations/incidents" type="button">
<span class="material-symbols-outlined text-[18px]">flag</span>
</RouterLink>
</div>
<details class="text-label-sm text-on-surface-variant mt-space-sm"><summary>Reported location</summary><LocationSummary :location="w.location" :offline="!telemetry.connected||!!error"></LocationSummary></details></div>
<p class="bg-surface-container rounded-lg p-space-lg text-on-surface-variant col-span-full" v-if="!shownWorkers.length">{{loading?"Loading control room…":"No workers match these filters."}}</p></div>
<div class="w-full bg-surface-container rounded-lg p-space-md space-y-space-sm shadow-md">
<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
<div class="flex items-center gap-2">
<span class="material-symbols-outlined text-primary text-[20px]">air</span>
<span class="font-headline-sm text-headline-sm text-on-surface uppercase tracking-wider">Subterranean Sector Atmospheric Telemetry</span>
</div>
<div class="flex items-center gap-space-sm font-code-sm text-code-sm text-outline">
<span>Received backend samples</span>
<span>•</span>
<span class="text-primary font-semibold">Ventilation status unavailable</span>
</div>
</div>
<div class="grid grid-cols-1 md:grid-cols-3 gap-space-sm"><div :key="z.id" class="bg-surface-container-low rounded-lg p-space-sm" v-for="z in envZones"><div class="flex justify-between text-label-md mb-space-sm"><strong>{{z.name}}</strong><span class="text-outline">{{z.id}}</span></div><p class="text-label-sm text-outline" v-if="!envReadings(z.id).length">Unavailable — no environmental readings received.</p><div class="grid grid-cols-2 gap-2"><div :key="r.id" class="bg-surface-container-high rounded p-2" v-for="r in envReadings(z.id)"><p class="text-code-sm text-outline uppercase">{{r.metric}}</p><strong>{{value(r)}}</strong><small class="block text-code-sm text-primary">{{r.simulation?'SIMULATED':r.source}} · {{quality(r)}}</small></div></div></div></div></div>
</div></main>
</template>
