<script setup>

import StatusBadge from '../components/ui/StatusBadge.vue'
import PageHeading from '../components/ui/PageHeading.vue'
import {ref,reactive,onMounted,watch,onBeforeUnmount,computed} from 'vue'
import {RouterLink,useRouter,useRoute} from 'vue-router'
import {useAuthStore} from '../stores/auth.js'
import {useTelemetryStore} from '../stores/telemetry.js'
import {isoDate} from '../services/history.js'
import {incidentStatuses,incidentSeverities,incidentQuery} from '../services/incidents.js'
import {useModalFocus} from '../composables/useModalFocus.js'
const auth=useAuthStore(),telemetry=useTelemetryStore(),router=useRouter(),route=useRoute(),items=ref([]),error=ref(''),loading=ref(true),busy=ref(false),next=ref(null),cursor=ref('')
const filters=reactive({q:'',status:'',severity:'',workerId:typeof route.query.workerId==='string'?route.query.workerId:'',simulation:'',from:'',to:''})
const form=reactive({message:'',workerId:'',severity:'MEDIUM',simulation:true})
let active=true,generation=0,timer
async function load(reset=false){if(reset)cursor.value='';const run=++generation;loading.value=true;error.value='';try{const data=await auth.request('/api/operations/incidents?'+incidentQuery({...filters,from:isoDate(filters.from),to:isoDate(filters.to),cursor:cursor.value,limit:25}),undefined,'GET');if(active&&run===generation){items.value=data.data;next.value=data.nextCursor}}catch(e){if(active&&run===generation)error.value=e.message}finally{if(active&&run===generation)loading.value=false}}
async function create(){busy.value=true;error.value='';try{const data=await auth.request('/api/operations/incidents',{...form,...(!form.workerId?{workerId:undefined}:{})});await router.push(`/operations/incidents/${data.id}`)}catch(e){error.value=e.message}finally{busy.value=false}}
async function download(){error.value='';try{await auth.download('/api/reports/incidents.csv?'+incidentQuery({...filters,from:isoDate(filters.from),to:isoDate(filters.to)}),'dacos-incidents.csv')}catch(e){error.value=e.message}}
function refresh(){clearTimeout(timer);timer=setTimeout(()=>load(),150)}
watch(()=>telemetry.incidentRevision,refresh)
watch(()=>telemetry.connected,value=>{if(value)refresh()})
onMounted(()=>load());onBeforeUnmount(()=>{active=false;generation++;clearTimeout(timer)})

const reportOpen=ref(false),reportDialog=ref(null)
useModalFocus(reportOpen,reportDialog,closeReport)
const pageCount=status=>items.value.filter(i=>i.lifecycleStatus===status).length
function resetFilters(){Object.assign(filters,{q:'',status:'',severity:'',workerId:'',simulation:'',from:'',to:''});load(true)}
function closeReport(){reportOpen.value=false}

</script>
<template>
<main class="flex-1 pt-[68px] bg-surface w-full px-space-md py-space-md reference-page dacos_incident_management_console"><p class="bg-error-container text-on-error-container p-space-md rounded-lg mb-space-md" role="alert" v-if="error">{{error}}</p><div class="flex flex-col w-full">
<div class="bg-surface-container-high rounded-lg p-space-md mb-space-md">
<div class="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-space-sm">
<div class="flex items-center gap-space-sm">
<span class="material-symbols-outlined text-tertiary text-[22px] shrink-0 animate-pulse">shield_with_heart</span>
<div>
<span class="font-code-sm text-code-sm text-tertiary uppercase tracking-wider block">Supervised Demonstration Workspace // Operational Incident Triage</span>
<p class="font-body-md text-body-md text-on-surface-variant">
            Simulates real-time extraction site triage and escalation workflows. No automatic public rescue, external emergency dispatch, or verified life-safety routing.
          </p>
</div>
</div>
<div class="flex items-center gap-space-sm shrink-0 self-end lg:self-center">
<span class="inline-flex items-center px-2 py-0.5 rounded bg-surface-variant font-code-sm text-code-sm text-primary uppercase">
<span class="w-1.5 h-1.5 rounded-full bg-primary mr-1.5"></span>{{telemetry.snapshot?.mode??"Awaiting backend"}}</span>
<span class="font-code-sm text-code-sm text-outline">Latency measurement unavailable</span>
</div>
</div>
</div>
<div class="flex flex-col md:flex-row md:items-center justify-between gap-space-md mb-space-lg">
<div>
<div class="flex items-center gap-2 font-code-sm text-code-sm text-on-surface-variant mb-1">
<span class="text-primary font-semibold uppercase">Response</span>
<span class="text-outline">/</span>
<span class="text-secondary font-medium uppercase">Incident Management</span>
<span class="text-outline">/</span>
<span class="text-on-surface uppercase">Live Incident Register</span>
</div>
<h1 class="font-headline-lg text-headline-lg text-on-surface tracking-tight">Active &amp; Archived Incidents</h1>
</div>
<div class="flex items-center gap-space-sm flex-wrap">
<button @click="reportOpen=true" aria-label="Report an incident" class="h-11 px-4 rounded-lg bg-primary font-headline-sm text-headline-sm text-on-primary flex items-center gap-2 transition-colors" id="openReportModalBtn" v-if="auth.canManage()">
<span class="material-symbols-outlined text-[20px]">add_alert</span>
<span>+ Report Incident</span>
</button>
<button :disabled="loading" @click="download" class="h-11 px-4 rounded-lg bg-surface-container-high text-on-surface font-label-md text-label-md flex items-center gap-2 hover:bg-surface-variant transition-colors">
<span class="material-symbols-outlined text-[18px] text-secondary">file_download</span>
<span>Export Ledger (.CSV)</span>
</button>
<button @click="load()" aria-label="Refresh incidents" class="h-11 w-11 rounded-lg bg-surface-container-high text-on-surface-variant flex items-center justify-center hover:text-on-surface hover:bg-surface-variant transition-colors" title="Sync Register">
<span class="material-symbols-outlined text-[20px]">sync</span>
</button>
</div>
</div>
<div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-space-sm mb-space-lg">
<div class="bg-surface-container p-space-md rounded-lg relative overflow-hidden"><span class="text-code-sm text-outline uppercase">Logged on this page</span><strong class="block text-telemetry-lg my-space-sm">{{items.length}}</strong><small class="text-label-sm text-on-surface-variant">Server-paginated incident register</small></div>
<div class="bg-surface-container p-space-md rounded-lg relative overflow-hidden"><span class="text-code-sm text-outline uppercase">Unacknowledged</span><strong class="block text-telemetry-lg my-space-sm">{{pageCount('OPEN')}}</strong><small class="text-label-sm text-on-surface-variant">Recorded open incidents</small></div>
<div class="bg-surface-container p-space-md rounded-lg relative overflow-hidden"><span class="text-code-sm text-outline uppercase">In progress</span><strong class="block text-telemetry-lg my-space-sm">{{pageCount('IN_PROGRESS')}}</strong><small class="text-label-sm text-on-surface-variant">Internal workflow only</small></div>
<div class="bg-surface-container p-space-md rounded-lg relative overflow-hidden"><span class="text-code-sm text-outline uppercase">Resolved &amp; closed</span><strong class="block text-telemetry-lg my-space-sm">{{pageCount('RESOLVED')+pageCount('CLOSED')}}</strong><small class="text-label-sm text-on-surface-variant">Recorded lifecycle status</small></div>
<div class="bg-surface-container p-space-md rounded-lg col-span-2 md:col-span-1 relative overflow-hidden"><span class="text-code-sm text-outline uppercase">Mean acknowledgement</span><strong class="block text-telemetry-lg my-space-sm">{{'Unavailable'}}</strong><small class="text-label-sm text-on-surface-variant">No duration aggregate reported</small></div>
</div>
<div class="bg-surface-container-high rounded-lg p-space-md mb-space-md"><form @submit.prevent="load(true)" class="incident-filter-form"><div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-12 gap-space-sm"><div class="xl:col-span-4 relative"><span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[20px]">search</span><input @change="load(true)" @keydown.enter.prevent="load(true)" aria-label="Search incident ID, summary or worker" class="w-full h-11 pl-10 pr-3 rounded bg-surface-container-low text-on-surface placeholder:text-outline font-body-md text-body-md focus:outline-none focus:ring-1 focus:ring-primary" id="incidentSearchInput" maxlength="200" placeholder="Search incident ID, summary or worker…" v-model="filters.q"/></div><div class="xl:col-span-2"><select @change="load(true)" aria-label="Incident status" class="w-full h-11 px-3 rounded bg-surface-container-low text-on-surface font-body-md text-body-md" v-model="filters.status"><option value="">Status: All lifecycles</option><option :key="s" v-for="s in incidentStatuses">{{s}}</option></select></div><div class="xl:col-span-2"><select @change="load(true)" aria-label="Incident severity" class="w-full h-11 px-3 rounded bg-surface-container-low text-on-surface font-body-md text-body-md" v-model="filters.severity"><option value="">Severity: All tiers</option><option :key="s" v-for="s in incidentSeverities">{{s}}</option></select></div><div class="xl:col-span-2"><input @change="load(true)" @keydown.enter.prevent="load(true)" aria-label="Worker ID filter" class="w-full h-11 px-3 rounded bg-surface-container-low text-on-surface font-body-md text-body-md" maxlength="50" placeholder="Worker: All personnel" v-model="filters.workerId"/></div><div class="xl:col-span-2 flex gap-space-xs"><select @change="load(true)" aria-label="Incident provenance" class="w-full h-11 px-3 rounded bg-surface-container-low text-on-surface font-body-md text-body-md" v-model="filters.simulation"><option value="">All provenance</option><option value="true">Simulated</option><option value="false">Non-simulated</option></select><button @click="resetFilters" aria-label="Reset incident filters" class="h-11 px-3 bg-surface-container text-on-surface-variant rounded flex items-center justify-center shrink-0" title="Reset filters" type="button"><span class="material-symbols-outlined text-[18px]">filter_alt_off</span></button></div></div><details class="text-label-sm mt-space-sm"><summary class="cursor-pointer text-on-surface-variant py-1">Advanced incident filters</summary><div class="reference-form grid grid-cols-1 md:grid-cols-4 gap-space-sm mt-space-sm"><label>Created from<input type="datetime-local" v-model="filters.from"/></label><label>Created to<input type="datetime-local" v-model="filters.to"/></label><button :disabled="loading" type="submit">Apply filters / refresh</button><button :disabled="loading" @click="download" type="button">Export filtered incident CSV</button></div></details></form></div>
<div class="bg-surface-container rounded-lg overflow-hidden shadow-sm mb-space-md">
<div class="overflow-x-auto">
<table class="w-full text-left border-collapse min-w-[1080px]">
<thead>
<tr class="bg-surface-container-low font-code-sm text-code-sm text-outline uppercase tracking-wider">
<th class="py-3 px-4">Identifier &amp; Tier</th>
<th class="py-3 px-4">Status &amp; Elapsed</th>
<th class="py-3 px-4">Summary &amp; Root Violation</th>
<th class="py-3 px-4">Subject Personnel / Target</th>
<th class="py-3 px-4">Location Sector</th>
<th class="py-3 px-4">Source Gateway</th>
<th class="py-3 px-4">Assignee</th>
<th class="py-3 px-4 text-right">Triage Actions</th>
</tr>
</thead>
<tbody class="divide-y-0 font-body-md text-body-md text-on-surface"><tr :key="i.id" class="border-b border-outline-variant/20 hover:bg-surface-container-high/40" v-for="i in items"><td class="py-3.5 px-4"><RouterLink :to="`/operations/incidents/${i.id}`" class="text-primary font-semibold">{{i.id}}</RouterLink><small class="block text-code-sm">{{i.severityLevel}}</small></td><td class="py-3.5 px-4"><StatusBadge :value="i.lifecycleStatus"></StatusBadge><time class="block text-code-sm text-outline">{{new Date(i.createdAt).toLocaleString()}}</time></td><td class="py-3.5 px-4 max-w-xs"><strong>{{i.message}}</strong><small class="block text-outline">{{i.simulation?'SIMULATED · NO DISPATCH':i.kind}}</small></td><td class="py-3.5 px-4">{{telemetry.workers.find(w=&gt;w.id===i.workerId)?.name??i.workerId??'No worker linked'}}<small class="block text-outline">{{i.workerId}}</small></td><td class="py-3.5 px-4">{{telemetry.workers.find(w=&gt;w.id===i.workerId)?.zoneId??'Unavailable'}}</td><td class="py-3.5 px-4">{{i.deviceId??'Unavailable'}}</td><td class="py-3.5 px-4">{{i.ownerId??'Unassigned'}}</td><td class="py-3.5 px-4 text-right"><RouterLink :to="`/operations/incidents/${i.id}`" class="text-primary text-label-sm">Inspect Detail →</RouterLink></td></tr><tr v-if="!items.length"><td class="p-space-lg text-outline" colspan="8">{{loading?"Loading incidents…":"No incidents match these filters."}}</td></tr></tbody>
</table>
</div>
<div class="bg-surface-container-low px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-space-sm border-t border-surface-variant"><span class="text-code-sm text-outline">{{items.length}} incidents on this page</span><div class="flex gap-space-sm text-label-sm"><button @click="load(true)" v-if="cursor">Latest page</button><button :disabled="loading" @click="cursor=next;load()" v-if="next">Next page</button></div></div>
</div>
<div class="grid grid-cols-1 lg:grid-cols-3 gap-space-md mb-space-md">
<div class="bg-surface-container rounded-lg p-space-md flex flex-col"><h2 class="text-headline-sm font-semibold">Sector incident context</h2><div class="bg-surface-container-lowest rounded-lg min-h-40 flex items-center justify-center p-space-md my-space-sm text-label-sm text-outline">Surveyed GIS incident density is unavailable.</div><RouterLink class="text-primary text-label-sm" to="/map">Open fictional administrative schematic →</RouterLink></div>
<div class="bg-surface-container rounded-lg p-space-md flex flex-col"><h2 class="text-headline-sm font-semibold">Triage pipeline distribution</h2><p class="text-code-sm text-outline mb-space-sm">Current returned page · Not a shift aggregate</p><div :key="s" class="mb-space-sm" v-for="s in ['OPEN','ACKNOWLEDGED','ASSIGNED','IN_PROGRESS','RESOLVED','CLOSED']"><div class="flex justify-between text-code-sm"><span>{{s}}</span><span>{{pageCount(s)}}</span></div><div class="h-1 rounded-full bg-surface-container-low mt-1"><div :style="{width:`${items.length?pageCount(s)/items.length*100:0}%`}" class="h-full rounded-full bg-primary"></div></div></div></div>
<div class="bg-surface-container rounded-lg p-space-md flex flex-col justify-between"><span class="text-code-sm text-outline uppercase">Response command context</span><h2 class="text-headline-md font-semibold mt-space-sm">{{auth.user?.name}}</h2><p class="text-code-sm text-primary">{{auth.user?.role}}</p><p class="text-label-sm text-on-surface-variant my-space-md">Incident actions record internal workflow state. No public rescue, external dispatch or ventilation-control provider is connected.</p><span class="text-code-sm text-primary">{{telemetry.connected?'REALTIME CONNECTED':'REALTIME OFFLINE'}}</span></div>
</div>
<div aria-label="Report an incident" aria-modal="true" class="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm items-center justify-center p-4 flex" id="reportModal" ref="reportDialog" role="dialog" tabindex="-1" v-if="reportOpen">
<div class="bg-surface-container-high border-0 rounded-xl w-full max-w-xl shadow-2xl p-space-lg flex flex-col gap-space-md"><div class="flex items-center justify-between"><div><h2 class="text-headline-md font-semibold">Submit Supervisor Field Incident</h2><p class="text-label-sm text-outline">Manual incident log · No external dispatch</p></div><button @click="closeReport" aria-label="Close incident report" class="p-2">×</button></div><form @submit.prevent="create" class="reference-form"><label>Message<textarea maxlength="2000" required="" v-model="form.message"></textarea></label><label>Worker ID (optional)<input maxlength="50" v-model="form.workerId"/></label><label>Severity<select v-model="form.severity"><option :key="s" v-for="s in incidentSeverities">{{s}}</option></select></label><label><input type="checkbox" v-model="form.simulation"/> SIMULATED report</label><button :disabled="busy">Create incident</button></form><button @click="closeReport" class="text-label-sm text-outline p-2">Cancel</button></div>
</div>
</div></main>
</template>
