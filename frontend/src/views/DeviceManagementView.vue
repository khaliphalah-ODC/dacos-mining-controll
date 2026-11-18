<script setup>

import PageHeading from '../components/ui/PageHeading.vue'
import {useTelemetryStore} from '../stores/telemetry.js'
import StatusBadge from '../components/ui/StatusBadge.vue'
import MetricCard from '../components/ui/MetricCard.vue'
const telemetry=useTelemetryStore(),cursor=ref(''),nextCursor=ref(null)
import { ref, reactive, computed, onMounted, onBeforeUnmount } from 'vue'
import { RouterLink } from 'vue-router'
import { useAuthStore } from '../stores/auth.js'
const auth = useAuthStore(), devices = ref([]), workers = ref([]), query = ref(''), error = ref(''), loading = ref(true), busy = ref(false), selected = ref(null), workerId = ref(''), credential = ref(null), history = ref([])
const form = reactive({ model:'',serialNumber:'',firmwareVersion:'',transport:'wifi',source:'simulator' })
const available = computed(() => workers.value.filter(w => w.active && !(telemetry.snapshot?.deviceSessions??devices.value).some(d => d.id !== selected.value?.id && d.workerId === w.id && d.connectionStatus !== 'revoked')))
let timer, active = true
async function load() { try { const list = await auth.request(`/api/manage/devices?q=${encodeURIComponent(query.value)}&limit=25${cursor.value?'&cursor='+encodeURIComponent(cursor.value):''}`, undefined, 'GET'); if (!active) return; devices.value = list.data; nextCursor.value=list.nextCursor; workers.value = (await auth.request('/api/manage/workers', undefined, 'GET')).data; if (selected.value) selected.value = devices.value.find(d => d.id === selected.value.id) ?? selected.value } catch(e) { error.value = e.message } finally { loading.value = false } }
function reset() { selected.value = null; credential.value = null; history.value = []; workerId.value = ''; Object.assign(form,{model:'',serialNumber:'',firmwareVersion:'',transport:'wifi',source:'simulator'}) }
function select(d) { selected.value = d; workerId.value = d.workerId ?? ''; credential.value = null; history.value = []; Object.assign(form,{model:d.model,serialNumber:d.serialNumber ?? '',firmwareVersion:d.firmwareVersion,transport:d.transport,source:d.source}) }
async function act(work) { busy.value = true; error.value = ''; try { await work(); await load() } catch(e) { error.value = e.message } finally { busy.value = false } }
async function save() { await act(async () => { if (selected.value) await auth.request(`/api/manage/devices/${selected.value.id}`, {model:form.model,serialNumber:form.serialNumber,firmwareVersion:form.firmwareVersion},'PATCH'); else { await auth.request('/api/manage/devices',{...form}); reset() } }) }
async function credentials(action) { await act(async () => { credential.value = null; const result = await auth.request(`/api/manage/devices/${selected.value.id}/${action}`,{}); if (result.token) credential.value = { token:result.token,nextSequence:result.nextSequence } }) }
onMounted(async () => { await load(); if(!active)return; timer = setInterval(() => { if (!busy.value) load() },5000) })
onBeforeUnmount(() => { active = false; clearInterval(timer) })

const transportFilter=ref(''),stateFilter=ref(''),powerFilter=ref(''),modelFilter=ref('')
const visibleDevices=computed(()=>devices.value.filter(d=>(!transportFilter.value||d.transport===transportFilter.value)&&(!stateFilter.value||d.connectionStatus===stateFilter.value)&&(!modelFilter.value||d.model===modelFilter.value)&&(!powerFilter.value||(d.battery!=null&&(powerFilter.value==='low'?d.battery<20:powerFilter.value==='caution'?d.battery>=20&&d.battery<=50:d.battery>50)))))

</script>
<template>
<main class="flex-1 pt-[68px] bg-surface w-full px-space-md py-space-md reference-page dacos_device_management"><p class="bg-error-container text-on-error-container p-space-md rounded-lg mb-space-md" role="alert" v-if="error">{{error}}</p><div class="flex flex-col w-full space-y-space-lg">
<div class="flex flex-col xl:flex-row xl:items-start justify-between gap-space-md">
<div class="space-y-space-xs max-w-4xl">
<div class="flex items-center gap-2 font-code-sm text-code-sm text-outline uppercase tracking-wider">
<span class="text-primary hover:underline cursor-pointer">Management</span>
<span>/</span>
<span class="text-on-surface-variant">Device Management</span>
<span>/</span>
<span class="text-on-surface font-semibold">Hardware Inventory</span>
</div>
<h1 class="font-headline-xl text-headline-xl text-on-surface tracking-tight">
        IoT Wearables &amp; Gateway Infrastructure Inventory
      </h1>
<p class="font-body-md text-body-md text-on-surface-variant leading-relaxed">
        Provision, assign, and audit subterranean telemetry hardware. Device inventory registration proves tracking assignment, not physical connectivity or hardware certification.
      </p>
</div>
<div class="flex flex-wrap items-center gap-space-xs xl:justify-end shrink-0 pt-1">
<button @click="reset" class="inline-flex items-center gap-2 px-space-md py-2.5 rounded-lg bg-primary-container text-on-primary-container font-label-md text-label-md font-semibold hover:bg-primary transition-all shadow-md shadow-primary-container/20 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-surface">
<span class="material-symbols-outlined text-[18px]">add_circle</span>
<span>+ Register New Device</span>
</button>
<RouterLink class="inline-flex items-center gap-2 px-space-md py-2.5 rounded-lg bg-surface-container-high text-on-surface font-label-md text-label-md font-medium hover:bg-surface-bright hover:text-primary transition-all shadow-sm" data-path="ble-gateway" to="/ble-gateway">
<span class="material-symbols-outlined text-[18px] text-primary">sensors</span>
<span>Device Lab Pairing</span>
</RouterLink>
<button class="inline-flex items-center gap-2 px-space-sm py-2.5 rounded-lg bg-surface-container text-on-surface-variant font-label-md text-label-md hover:bg-surface-container-high hover:text-on-surface transition-all" disabled="" title="Unavailable in the current backend">
<span class="material-symbols-outlined text-[18px]">vpn_key</span>
<span>Rotate Shift Keys</span>
</button>
<button class="inline-flex items-center gap-1.5 px-space-sm py-2.5 rounded-lg bg-surface-container text-on-surface-variant font-label-md text-label-md hover:bg-surface-container-high hover:text-on-surface transition-all" disabled="" title="Unavailable in the current backend">
<span class="material-symbols-outlined text-[18px]">download</span>
<span>Export</span>
</button>
</div>
</div>
<div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-space-sm">
<div class="relative overflow-hidden bg-surface-container p-space-md rounded-xl shadow-sm flex flex-col justify-between">
<div class="flex items-center justify-between text-outline">
<span class="font-code-sm text-code-sm uppercase tracking-wider text-on-surface-variant">Enrolled Units</span>
<span class="material-symbols-outlined text-[20px] text-primary">developer_board</span>
</div>
<div class="mt-space-sm flex items-baseline gap-2">
<span class="font-telemetry-lg text-telemetry-lg text-on-surface">{{devices.length}}</span>
<span class="font-code-sm text-code-sm text-outline uppercase">On this page</span>
</div>
<div class="mt-2 w-full bg-surface-container-highest h-1 rounded-full overflow-hidden">
<div :style="{width: `${devices.length?(devices.length)/devices.length*100:0}%` }" class="bg-primary h-full w-full"></div>
</div>
</div>
<div class="relative overflow-hidden bg-surface-container p-space-md rounded-xl shadow-sm flex flex-col justify-between">
<div class="flex items-center justify-between text-outline">
<span class="font-code-sm text-code-sm uppercase tracking-wider text-on-surface-variant">Connected Link</span>
<span class="inline-flex items-center justify-center w-2 h-2 rounded-full bg-primary animate-ping"></span>
</div>
<div class="mt-space-sm flex items-baseline gap-2">
<span class="font-telemetry-lg text-telemetry-lg text-primary">{{devices.filter(d=&gt;d.connectionStatus==='connected').length}}</span>
<span class="font-code-sm text-code-sm text-primary uppercase">Receipts on this page</span>
</div>
<div class="mt-2 w-full bg-surface-container-highest h-1 rounded-full overflow-hidden">
<div :style="{width: `${devices.length?(devices.filter(d=&gt;d.connectionStatus==='connected').length)/devices.length*100:0}%` }" class="bg-primary h-full"></div>
</div>
</div>
<div class="relative overflow-hidden bg-surface-container p-space-md rounded-xl shadow-sm flex flex-col justify-between">
<div class="flex items-center justify-between text-outline">
<span class="font-code-sm text-code-sm uppercase tracking-wider text-tertiary">Stale &gt;120s</span>
<span class="material-symbols-outlined text-[20px] text-tertiary">history_toggle_off</span>
</div>
<div class="mt-space-sm flex items-baseline gap-2">
<span class="font-telemetry-lg text-telemetry-lg text-tertiary">{{devices.filter(d=&gt;d.connectionStatus==='stale').length}}</span>
<span class="font-code-sm text-code-sm text-outline uppercase">Reported stale</span>
</div>
<div class="mt-2 w-full bg-surface-container-highest h-1 rounded-full overflow-hidden">
<div :style="{width: `${devices.length?(devices.filter(d=&gt;d.connectionStatus==='stale').length)/devices.length*100:0}%` }" class="bg-tertiary h-full"></div>
</div>
</div>
<div class="relative overflow-hidden bg-surface-container p-space-md rounded-xl shadow-sm flex flex-col justify-between">
<div class="flex items-center justify-between text-outline">
<span class="font-code-sm text-code-sm uppercase tracking-wider text-on-surface-variant">Unassigned / Depot</span>
<span class="material-symbols-outlined text-[20px] text-secondary">inventory_2</span>
</div>
<div class="mt-space-sm flex items-baseline gap-2">
<span class="font-telemetry-lg text-telemetry-lg text-secondary">{{devices.filter(d=&gt;!d.workerId).length}}</span>
<span class="font-code-sm text-code-sm text-outline uppercase">Unassigned on this page</span>
</div>
<div class="mt-2 w-full bg-surface-container-highest h-1 rounded-full overflow-hidden">
<div :style="{width: `${devices.length?(devices.filter(d=&gt;!d.workerId).length)/devices.length*100:0}%` }" class="bg-secondary h-full"></div>
</div>
</div>
<div class="relative overflow-hidden bg-surface-container p-space-md rounded-xl shadow-sm col-span-2 md:col-span-1 flex flex-col justify-between">
<div class="flex items-center justify-between text-outline">
<span class="font-code-sm text-code-sm uppercase tracking-wider text-error">Revoked / Retired</span>
<span class="material-symbols-outlined text-[20px] text-error">gpp_bad</span>
</div>
<div class="mt-space-sm flex items-baseline gap-2">
<span class="font-telemetry-lg text-telemetry-lg text-error">{{devices.filter(d=&gt;d.connectionStatus==='revoked').length}}</span>
<span class="font-code-sm text-code-sm text-outline uppercase">Revoked on this page</span>
</div>
<div class="mt-2 w-full bg-surface-container-highest h-1 rounded-full overflow-hidden">
<div :style="{width: `${devices.length?(devices.filter(d=&gt;d.connectionStatus==='revoked').length)/devices.length*100:0}%` }" class="bg-error h-full"></div>
</div>
</div>
</div>
<div class="grid grid-cols-1 lg:grid-cols-12 gap-space-md items-start">
<div class="lg:col-span-7 xl:col-span-8 flex flex-col space-y-space-md min-w-0">
<div class="bg-surface-container p-space-md rounded-xl shadow-sm space-y-space-sm">
<div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-space-sm">
<form @submit.prevent="cursor='';load()" class="flex-1 min-w-0 flex items-center gap-space-sm"><label class="flex-1 min-w-0" for="inventory-search"><span class="sr-only">Search ID, model, serial or worker</span><div class="relative flex-1">
<span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-outline">search</span>
<input @change="cursor='';load()" aria-label="Search ID, model, serial or worker" class="w-full bg-surface-container-low text-on-surface font-body-md text-body-md pl-10 pr-4 py-2 rounded-lg outline-none focus:ring-1 focus:ring-primary placeholder:text-outline/70" id="inventory-search" maxlength="100" placeholder="Search by Device ID (e.g. DACOS-BAND-042), Model, UID, or Worker..." type="text" v-model="query"/>
</div></label><button class="bg-surface-container-high text-primary rounded-lg px-3 py-2 text-label-sm" type="submit">Search / refresh</button></form>
<div class="flex items-center gap-2">
<span class="font-code-sm text-code-sm text-outline uppercase px-1">VIEW:</span>
<button @click="stateFilter='connected'" class="px-2.5 py-1.5 rounded-lg bg-surface-container-high text-primary font-label-md text-label-md">Connected ({{devices.filter(d=&gt;d.connectionStatus==='connected').length}})</button>
<button @click="stateFilter=''" class="px-2.5 py-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container-high font-label-md text-label-md" title="Use the connection-state filter">All ({{devices.length}})</button>
</div>
</div>
<div class="grid grid-cols-2 md:grid-cols-4 gap-2 pt-1 font-label-sm text-label-sm">
<div>
<label class="block font-code-sm text-code-sm uppercase tracking-wider text-outline mb-1">Hardware Type</label>
<select aria-label="modelFilter" class="w-full bg-surface-container-low text-on-surface px-2.5 py-1.5 rounded-lg outline-none focus:ring-1 focus:ring-primary text-label-sm" v-model="modelFilter"><option value="">All models on this page</option><option :key="model" v-for="model in [...new Set(devices.map(d=&gt;d.model))]">{{model}}</option></select>
</div>
<div>
<label class="block font-code-sm text-code-sm uppercase tracking-wider text-outline mb-1">Transport</label>
<select aria-label="transportFilter" class="w-full bg-surface-container-low text-on-surface px-2.5 py-1.5 rounded-lg outline-none focus:ring-1 focus:ring-primary text-label-sm" v-model="transportFilter"><option value="">All transports</option><option value="wifi">Wi-Fi</option><option value="ble-gateway">BLE gateway</option></select>
</div>
<div>
<label class="block font-code-sm text-code-sm uppercase tracking-wider text-outline mb-1">Link Status</label>
<select aria-label="stateFilter" class="w-full bg-surface-container-low text-on-surface px-2.5 py-1.5 rounded-lg outline-none focus:ring-1 focus:ring-primary text-label-sm" v-model="stateFilter"><option value="">All connection states</option><option :key="s" v-for="s in ['connected','stale','disconnected','unpaired','revoked','unavailable']">{{s}}</option></select>
</div>
<div>
<label class="block font-code-sm text-code-sm uppercase tracking-wider text-outline mb-1">Battery Threshold</label>
<select aria-label="powerFilter" class="w-full bg-surface-container-low text-on-surface px-2.5 py-1.5 rounded-lg outline-none focus:ring-1 focus:ring-primary text-label-sm" v-model="powerFilter"><option value="">All battery levels</option><option value="nominal">Above 50%</option><option value="caution">20%–50%</option><option value="low">Below 20%</option></select>
</div>
</div>
</div>
<div class="bg-surface-container rounded-xl shadow-md overflow-hidden flex flex-col">
<div class="overflow-x-auto">
<table class="w-full text-left font-body-md text-body-md border-collapse">
<thead>
<tr class="bg-surface-container-low text-outline font-code-sm text-code-sm uppercase tracking-wider">
<th class="py-3 px-space-md">Device / Model</th>
<th class="py-3 px-space-md">Hardware UID &amp; Serial</th>
<th class="py-3 px-space-md">Transport Link</th>
<th class="py-3 px-space-md">Assignment / Zone</th>
<th class="py-3 px-space-md text-center">Battery</th>
<th class="py-3 px-space-md">State</th>
<th class="py-3 px-space-md text-right">Actions</th>
</tr>
</thead>
<tbody class="divide-y-0 text-on-surface font-body-md"><tr :key="d.id" class="border-b border-outline-variant/20 hover:bg-surface-container-high/50" v-for="d in visibleDevices"><td class="py-3 px-space-md"><strong>{{d.model}}</strong><small class="block text-outline">{{d.firmwareVersion}}</small></td><td class="py-3 px-space-md font-code-sm text-code-sm"><span class="text-primary">{{d.id}}</span><small class="block text-outline">{{d.serialNumber??'Unavailable'}}</small></td><td class="py-3 px-space-md">{{d.transport}}<small class="block text-primary">{{d.source}}</small></td><td class="py-3 px-space-md">{{workers.find(w=&gt;w.id===d.workerId)?.name??'Unassigned'}}<small class="block text-outline">{{d.workerId??'No worker bound'}}</small></td><td class="py-3 px-space-md text-center">{{d.battery==null?'Unavailable':`${d.battery}%`}}</td><td class="py-3 px-space-md"><StatusBadge :value="d.connectionStatus"></StatusBadge></td><td class="py-3 px-space-md text-right"><button :disabled="busy" @click="select(d)" aria-label="Manage device" class="text-primary p-1.5" title="Manage device"><span class="material-symbols-outlined text-[18px]">tune</span><span class="sr-only">Manage device</span></button></td></tr><tr v-if="!visibleDevices.length"><td class="p-space-lg text-outline" colspan="7">{{loading?"Loading devices…":"No matching devices."}}</td></tr></tbody>
</table>
</div>
<div class="bg-surface-container-low px-space-md py-space-sm flex flex-col sm:flex-row items-center justify-between gap-space-sm text-outline font-code-sm text-code-sm">
<div class="flex items-center gap-2">
<span>Showing {{visibleDevices.length}} of {{devices.length}} records on this page</span>
<span class="text-outline/50">•</span>
<span class="text-primary font-semibold">Last-seen receipts per device</span>
</div>
<div class="flex items-center gap-1">
<button :disabled="!cursor||loading" @click="cursor='';load()" aria-label="First device page" class="p-1 rounded bg-surface-container hover:bg-surface-bright text-on-surface disabled:opacity-40">
<span class="material-symbols-outlined text-[16px]">chevron_left</span>
</button>
<span class="px-2 py-0.5 rounded bg-surface-container-high text-on-surface">{{cursor?"Cursor page":"First page"}}</span>
<button :disabled="!nextCursor||loading" @click="cursor=nextCursor;load()" aria-label="Next device page" class="p-1 rounded bg-surface-container hover:bg-surface-bright text-on-surface">
<span class="material-symbols-outlined text-[16px]">chevron_right</span>
</button>
</div>
</div>
</div>
<div class="p-space-md rounded-xl bg-surface-container-low flex flex-col sm:flex-row items-start sm:items-center justify-between gap-space-md">
<div class="flex items-center gap-3">
<div class="w-10 h-10 rounded-lg bg-surface-container-highest flex items-center justify-center text-primary shrink-0">
<span class="material-symbols-outlined text-[24px]">hub</span>
</div>
<div>
<h4 class="font-headline-sm text-headline-sm text-on-surface">Gateway transport context</h4>
<p class="font-body-md text-body-md text-on-surface-variant">Inventory records do not establish physical mesh topology or automatic gateway failover.</p>
</div>
</div>
<div class="shrink-0 flex items-center gap-2">
<span class="px-2.5 py-1 rounded bg-primary/10 text-primary font-code-sm text-code-sm font-semibold uppercase">BLE Transport ≠ Verified Provenance</span>
</div>
</div>
</div>
<div class="lg:col-span-5 xl:col-span-4 flex flex-col space-y-space-md">
<div class="bg-surface-container rounded-xl shadow-xl overflow-hidden flex flex-col reference-inspector"><div class="bg-surface-container-high p-space-md flex items-center gap-2"><span class="material-symbols-outlined text-primary">devices</span><div><span class="text-code-sm text-outline uppercase">Hardware provisioning</span><h3 class="text-headline-md font-semibold">{{selected?.id??"Register inventory device"}}</h3></div></div><div class="p-space-md reference-form space-y-space-md"><h2>{{ selected ? 'Edit device' : 'Register inventory device' }}</h2><form @submit.prevent="save"><label>Model<input maxlength="100" required="" v-model="form.model"/></label><label>Serial number<input maxlength="100" required="" v-model="form.serialNumber"/></label><label>Firmware version<input maxlength="100" required="" v-model="form.firmwareVersion"/></label><label>Transport<select :disabled="!!selected" v-model="form.transport"><option value="wifi">Wi-Fi</option><option value="ble-gateway">BLE gateway</option></select></label><label>Provenance<select :disabled="!!selected" v-model="form.source"><option value="simulator">Simulator</option><option value="hardware">Hardware</option></select></label><button :disabled="busy">{{ selected ? 'Save metadata' : 'Register device' }}</button><button @click="reset" type="button">New device</button></form><template v-if="selected"><h2>Assignment and credentials</h2><p>{{ selected.id }} · {{ selected.connectionStatus }}</p><label>Assign worker<select v-model="workerId"><option value="">Unassigned</option><option :key="w.id" :value="w.id" v-for="w in available">{{ w.id }} · {{ w.name }}</option></select></label><button :disabled="busy" @click="act(() =&gt; auth.request(`/api/manage/devices/${selected.id}/assignment`, { workerId:workerId || null }))">Save assignment</button><p>Rotation invalidates the old credential immediately. Reprovisioning creates a new credential for an unpaired or revoked device. Sequence history is retained.</p><button :disabled="busy || ['unpaired','revoked'].includes(selected.connectionStatus)" @click="credentials('rotate')">Rotate credential</button><button :disabled="busy" @click="credentials('reprovision')">Reprovision</button><button :disabled="busy || selected.connectionStatus === 'revoked'" @click="credentials('revoke')">Revoke credential</button><div role="status" v-if="credential"><p>Shown once. Transfer securely to your device. Never include this token in logs or source code.</p><code class="credential-secret">{{ credential.token }}</code><p>Next sequence: {{ credential.nextSequence }}</p><button @click="credential = null">Hide credential</button></div><button :disabled="busy" @click="act(async () =&gt; history = (await auth.request(`/api/manage/devices/${selected.id}/assignments`, undefined, 'GET')).data)">Load assignment history</button><p :key="h.id" v-for="h in history">{{ h.workerId }} · {{ h.assignedAt }} → {{ h.endedAt ?? 'Current' }}</p></template></div></div>
<div class="bg-surface-container p-space-md rounded-xl space-y-space-xs">
<div class="flex items-center gap-2 text-tertiary">
<span class="material-symbols-outlined text-[20px]">warning</span>
<h4 class="font-headline-sm text-headline-sm font-semibold">Subterranean Attenuation Warning</h4>
</div>
<p class="font-body-md text-body-md text-on-surface-variant">
          Hardware bands rely on mesh gateway nodes. Loss of line-of-sight in drift stopes may freeze heartbeats. Dispatched search-and-rescue teams must rely on physical acoustic locators, not pure SCADA display coordinates.
        </p>
</div>
</div>
</div>
<div class="p-space-md rounded-xl bg-surface-container-low flex flex-col md:flex-row items-center justify-between gap-space-sm text-center md:text-left">
<div class="flex items-center gap-3">
<span class="material-symbols-outlined text-tertiary text-[24px]">shield</span>
<div class="text-on-surface-variant font-code-sm text-code-sm">
<strong class="text-tertiary uppercase tracking-wider">DACOS SCADA Liberia Demonstration Platform:</strong>Readings retain their backend provenance. Inventory registration does not certify physical hardware or worker safety.</div>
</div>
<div class="shrink-0 font-code-sm text-code-sm text-outline">Hardware validation pending</div>
</div>
</div>
</main>
</template>
