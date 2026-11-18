<script setup>

import StatusBadge from '../components/ui/StatusBadge.vue'
import PageHeading from '../components/ui/PageHeading.vue'
import {ref,computed,onMounted,watch,onBeforeUnmount} from 'vue'
import {useRoute,RouterLink} from 'vue-router'
import {useAuthStore} from '../stores/auth.js'
import {useTelemetryStore} from '../stores/telemetry.js'
import {incidentActions} from '../services/incidents.js'
const route=useRoute(),auth=useAuthStore(),telemetry=useTelemetryStore(),incident=ref(null),people=ref([]),note=ref(''),ownerId=ref(''),error=ref(''),loading=ref(true),busy=ref(false)
const actions=computed(()=>incidentActions(incident.value,auth.user))
let active=true,run=0,timer
async function load(){const current=++run;loading.value=true;try{const result=await auth.request(`/api/operations/incidents/${encodeURIComponent(route.params.id)}`,undefined,'GET');if(active&&current===run){incident.value=result;if(!ownerId.value)ownerId.value=result.ownerId??'';error.value=''}}catch(e){if(active&&current===run)error.value=e.message}finally{if(active&&current===run)loading.value=false}}
async function perform(action){busy.value=true;error.value='';try{await auth.request(`/api/operations/incidents/${incident.value.id}/events`,{action,note:note.value,version:incident.value.version,...(action==='assign'?{ownerId:ownerId.value}:{})});note.value='';await load()}catch(e){error.value=e.message+' — refresh detail before retrying.'}finally{busy.value=false}}
function refresh(){clearTimeout(timer);timer=setTimeout(()=>{if(!busy.value)load()},150)}
watch(()=>telemetry.incidentRevision,refresh);watch(()=>telemetry.connected,v=>{if(v)refresh()});watch(()=>route.params.id,()=>{incident.value=null;load()})
onMounted(async()=>{await load();if(auth.canManage())try{people.value=(await auth.request('/api/operations/responders',undefined,'GET')).data}catch(e){error.value=e.message}})
onBeforeUnmount(()=>{active=false;run++;clearTimeout(timer)})

import {qualityFor} from '../services/telemetry.js'
import ZoneSchematic from '../components/ZoneSchematic.vue'
const lifecycle=['OPEN','ACKNOWLEDGED','ASSIGNED','IN_PROGRESS','RESOLVED','CLOSED']
const worker=computed(()=>telemetry.workers.find(w=>w.id===incident.value?.workerId))
const currentReading=metric=>(telemetry.snapshot?.readings??[]).find(r=>incident.value?.workerId&&r.workerId===incident.value.workerId&&r.metric===metric)
const currentQuality=r=>r?qualityFor(r,{connected:telemetry.connected,now:telemetry.now,lastReceived:telemetry.lastReceived}):'unavailable'
const currentValue=metric=>{const r=currentReading(metric);return r?.value!=null&&!['offline','unavailable'].includes(currentQuality(r))?r.value:'—'}

</script>
<template>
<main :data-incident-id="incident?.id" :data-incident-status="incident?.lifecycleStatus" class="flex-1 pt-[68px] bg-surface w-full px-space-md py-space-md reference-page dacos_incident_detail_inc_104"><p class="p-space-lg text-outline" role="status" v-if="loading&amp;&amp;!incident">Loading incident…</p><p class="bg-error-container text-on-error-container p-space-md rounded-lg" role="alert" v-if="error">{{error}}</p><div class="flex flex-col w-full space-y-space-md" v-if="incident">

<div class="bg-tertiary-container/15 rounded-lg p-space-sm flex items-start gap-space-sm">
<span class="material-symbols-outlined text-tertiary text-[20px] shrink-0 mt-0.5">warning</span>
<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between w-full gap-2">
<p class="font-code-sm text-code-sm text-tertiary font-semibold uppercase tracking-wider">
        SUPERVISED DEMONSTRATION PROTOTYPE // SIMULATED INCIDENT DISPATCH — Lifecycle status changes reflect local SCADA workflow state only. No emergency dispatch or rescue deployment is initiated.
      </p>
<span class="font-code-sm text-code-sm text-on-surface-variant shrink-0 bg-surface-container-high px-2 py-0.5 rounded">{{telemetry.snapshot?.mode??"Unavailable"}}</span>
</div>
</div>

<div class="flex items-center justify-between">
<div class="flex items-center gap-2 font-code-sm text-code-sm text-on-surface-variant">
<span class="text-primary font-semibold">RESPONSE</span>
<span class="text-outline">/</span>
<RouterLink class="hover:text-on-surface transition-colors" to="/operations/incidents">INCIDENTS</RouterLink>
<span class="text-outline">/</span>
<span class="text-on-surface font-semibold bg-surface-container-high px-2 py-0.5 rounded">{{incident.id}}</span>
</div>
<div class="flex items-center gap-2 font-code-sm text-code-sm text-on-surface-variant">
<span class="w-2 h-2 rounded-full" :class="['RESOLVED','CLOSED'].includes(incident.lifecycleStatus)?'bg-primary':'bg-error animate-ping'"></span>
<StatusBadge :value="incident.lifecycleStatus"/>
<span class="text-outline">•</span>
<span>{{telemetry.connected?"Realtime connected":"Realtime offline"}}</span>
</div>
</div>

<div class="bg-surface-container rounded-xl p-space-md shadow-md">
<div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-space-md pb-space-sm">
<div class="space-y-1">
<div class="flex flex-wrap items-center gap-space-sm">
<span class="font-code-sm text-code-sm uppercase tracking-wider bg-surface-container-highest px-2 py-0.5 rounded text-on-surface">ID: {{incident.id}}</span>

<div class="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full" :class="['CRITICAL','HIGH'].includes(incident.severityLevel)?'bg-error-container text-on-error-container':incident.severityLevel==='MEDIUM'?'bg-tertiary-container/20 text-tertiary':'bg-primary/10 text-primary'">
<span class="w-2 h-2 rounded-full bg-error animate-pulse"></span>
<span class="font-code-sm text-code-sm font-bold uppercase tracking-wider">{{incident.severityLevel}}</span>
</div>
<span class="font-code-sm text-code-sm text-on-surface-variant">Recorded {{new Date(incident.createdAt).toLocaleString()}} · Updated {{new Date(incident.updatedAt).toLocaleString()}}</span>
<span class="font-code-sm text-code-sm text-outline">|</span>
<span class="font-code-sm text-code-sm text-on-surface-variant">Evaluation time not recorded</span>
</div>
<h1 class="font-headline-lg text-headline-lg text-on-surface font-bold tracking-tight">{{incident.message}}</h1>
</div>

<div class="flex items-center gap-space-xs shrink-0 font-code-sm text-code-sm"><button @click="load" :disabled="loading" aria-label="Refresh incident detail" title="Refresh detail" class="px-3 py-1.5 rounded-lg bg-surface-container-high text-on-surface"><span class="material-symbols-outlined text-[18px]">sync</span></button>
<button class="px-3 py-1.5 rounded-lg bg-surface-container-high hover:bg-surface-variant text-on-surface flex items-center gap-1.5 transition-colors" disabled="" title="Audio hail and printable incident log are not supported" type="button">
<span class="material-symbols-outlined text-[18px]">radio</span>
<span>AUDIO HAIL</span>
</button>
<button class="px-3 py-1.5 rounded-lg bg-surface-container-high hover:bg-surface-variant text-on-surface flex items-center gap-1.5 transition-colors" disabled="" title="Audio hail and printable incident log are not supported" type="button">
<span class="material-symbols-outlined text-[18px]">print</span>
<span>EXPORT LOG</span>
</button>
</div>
</div>

<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-sm pt-space-sm font-code-sm text-code-sm"><div class="bg-surface-container-low p-space-sm rounded-lg"><span class="text-outline uppercase">Worker &amp; assignment</span><strong class="block text-label-md mt-1">{{worker?.name??incident.workerId??'No worker linked'}}</strong><span>{{worker?.role??'Unavailable'}} · {{worker?.shift??'Unavailable'}}</span></div><div class="bg-surface-container-low p-space-sm rounded-lg"><span class="text-outline uppercase">Administrative zone</span><strong class="block text-label-md mt-1">{{worker?.zoneId??'Unavailable'}}</strong><span>Not verified physical positioning</span></div><div class="bg-surface-container-low p-space-sm rounded-lg"><span class="text-outline uppercase">Reported device</span><strong class="block text-label-md mt-1">{{incident.deviceId??'Unavailable'}}</strong><span>Transport and RSSI not recorded here</span></div><div class="bg-surface-container-low p-space-sm rounded-lg"><span class="text-outline uppercase">Responsible person</span><strong class="block text-label-md mt-1">{{people.find(p=&gt;p.id===incident.ownerId)?.name??incident.ownerId??'Unassigned'}}</strong><span>No response countdown reported</span></div></div>

<div class="mt-space-md pt-space-sm bg-surface-container-low p-space-sm rounded-lg"><div class="flex justify-between items-center mb-space-sm"><h2 class="text-label-md font-semibold">Incident lifecycle pipeline</h2><StatusBadge :value="incident.lifecycleStatus"></StatusBadge></div><div class="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-space-sm"><div :class="incident.lifecycleStatus===s?'bg-primary-container text-on-primary-container':'bg-surface-container text-outline'" :key="s" class="rounded-lg p-2 text-code-sm" v-for="(s,index) in lifecycle"><strong>{{index+1}}. {{s}}</strong></div></div></div>
<details class="mt-space-md text-label-sm"><summary class="text-outline cursor-pointer">Record metadata</summary><div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-space-sm mt-space-sm"><dl :key="key" class="bg-surface-container-low rounded p-2" v-for="key in ['id','lifecycleStatus','severityLevel','workerId','deviceId','ownerId','createdAt','updatedAt','resolvedAt','closedAt','version']"><dt class="text-code-sm text-outline">{{key}}</dt><dd class="text-label-sm break-all">{{incident[key]??'Unavailable'}}</dd></dl></div></details></div>

<div class="grid grid-cols-1 lg:grid-cols-12 gap-space-md">

<div class="lg:col-span-8 space-y-space-md min-w-0">

<div class="bg-surface-container rounded-xl p-space-md shadow-md space-y-space-md"><div class="flex flex-wrap justify-between gap-space-sm"><h2 class="text-headline-sm font-semibold">Physiological &amp; Environmental Telemetry</h2><span class="text-code-sm text-outline">Current received values · Not a trigger-time snapshot</span></div><p class="text-label-sm text-on-surface-variant">The incident API does not store a trigger-time physiological or environmental reading snapshot. Current linked-worker observations below retain their measurement time and source.</p><div class="grid grid-cols-1 sm:grid-cols-3 gap-space-sm"><div :key="metric" class="bg-surface-container-low p-space-sm rounded-lg" v-for="(label,metric) in {heartRate:'Heart rate (BPM)',spo2:'Blood oxygen (%)',temperature:'Skin temperature (°C)'}"><span class="text-code-sm text-outline uppercase">{{label}}</span><strong class="block text-telemetry-lg mt-2">{{currentValue(metric)}}</strong><span class="text-code-sm text-primary">{{currentReading(metric)?.simulation?'SIMULATED':currentQuality(currentReading(metric))}}</span><time class="block text-code-sm text-outline mt-2">{{currentReading(metric)?.timestamp??'No reading received'}}</time></div></div><p class="text-code-sm text-outline">Trigger-time environmental context, baseline and threshold comparisons are unavailable unless recorded in the incident message or audit events.</p></div>

<div class="bg-surface-container rounded-xl p-space-md shadow-md space-y-space-sm"><h2 class="text-headline-sm font-semibold">Administrative spatial context</h2><ZoneSchematic></ZoneSchematic><p class="text-label-sm text-outline">No verified worker coordinates, blast clearance, evacuation route or refuge proximity is established by this diagram.</p><RouterLink :to="`/workers/${incident.workerId}/movement`" class="text-primary text-label-sm" v-if="incident.workerId">Received worker movement history →</RouterLink></div>

<div class="bg-surface-container rounded-xl p-space-md shadow-md space-y-space-sm"><div class="flex items-center justify-between"><h2 class="text-headline-sm font-semibold">Activity history</h2><span class="text-code-sm text-outline">{{incident.events.length}} recorded events</span></div><article :key="event.id" class="bg-surface-container-low p-space-md rounded-lg mt-space-sm" v-for="event in incident.events"><div class="flex justify-between gap-space-sm"><strong class="text-label-md">{{event.action}}</strong><time class="text-code-sm text-outline">{{new Date(event.createdAt).toLocaleString()}}</time></div><p class="text-code-sm text-outline mt-1">{{event.actorId}} · {{event.fromStatus??'—'}} → {{event.toStatus??'—'}} · Owner {{event.ownerId??'Unassigned'}}</p><p class="text-label-sm mt-space-sm">{{event.note}}</p></article></div>
</div>

<div class="lg:col-span-4 space-y-space-md">

<div class="bg-surface-container rounded-xl p-space-md shadow-md space-y-space-md"><div class="flex items-center justify-between mb-space-md"><h2 class="text-headline-sm font-semibold">Response Command</h2><span class="text-code-sm text-primary">{{auth.user?.role}}</span></div><div class="reference-form response-actions" v-if="actions.length"><h2>Response activity</h2><label>Required response note<textarea maxlength="2000" v-model="note"></textarea></label><label v-if="actions.includes('assign')">Responsible person<select v-model="ownerId"><option value="">Choose an active responder</option><option :key="p.id" :value="p.id" v-for="p in people">{{p.name}} · {{p.role}}</option></select></label><button :disabled="busy||loading||!note.trim()||(action==='assign'&amp;&amp;!ownerId)" :key="action" @click="perform(action)" v-for="action in actions">{{action}}</button><p>Escalation records an internal demonstration action. No external dispatcher is connected.</p></div><p class="text-label-sm text-outline" v-else="">No mutations are available for this account and lifecycle state.</p></div>






<div class="bg-surface-container rounded-xl p-space-md space-y-space-sm"><h3 class="text-headline-sm font-semibold">Authority &amp; concurrency</h3><p class="text-label-sm text-on-surface-variant">Allowed actions are determined by the authenticated role, ownership and lifecycle state. Required notes and the record version are submitted to the server.</p><p class="text-code-sm text-outline">Record version: {{incident.version}} · Closed records are read-only.</p></div></div>
</div>

<div class="bg-surface-container-lowest p-space-sm rounded-lg flex flex-col md:flex-row items-center justify-between text-code-sm font-code-sm text-outline gap-2">
<div class="flex items-center gap-2">
<span class="w-1.5 h-1.5 rounded-full bg-tertiary"></span>
<span>DACOS INDUSTRIAL TELEMETRY PROTOCOL v0.9.4 // NON-PROD SCADA NODE LIBERIA</span>
</div>
<div class="flex items-center gap-4 text-on-surface-variant">
<span>Persistent event ledger · No cryptographic hash certification</span>
<span>Backend incident record</span>
</div>
</div>
</div>
</main>
</template>
