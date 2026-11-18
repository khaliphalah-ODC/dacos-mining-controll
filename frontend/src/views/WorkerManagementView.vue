<script setup>

import PageHeading from '../components/ui/PageHeading.vue'
import ZoneRegistration from '../components/ZoneRegistration.vue'
import { ref, reactive, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { useAuthStore } from '../stores/auth.js'
const cursor=ref(''),nextCursor=ref(null)
const auth = useAuthStore(), workers = ref([]), zones = ref([]), query = ref(''), error = ref(''), loading = ref(true), busy = ref(false), editing = ref(false)
const form = reactive({ id:'', name:'', role:'', shift:'', zoneId:'' })
async function load() { loading.value = true; try { const result=await auth.request(`/api/manage/workers?q=${encodeURIComponent(query.value)}&limit=25${cursor.value?'&cursor='+encodeURIComponent(cursor.value):''}`,undefined,'GET');workers.value=result.data;nextCursor.value=result.nextCursor; zones.value = (await auth.request('/api/manage/zones', undefined, 'GET')).data } catch(e) { error.value = e.message } finally { loading.value = false } }
function reset() { editing.value = false; Object.assign(form, { id:'',name:'',role:'',shift:'',zoneId:zones.value[0]?.id ?? '' }) }
function edit(w) { editing.value = true; Object.assign(form, { id:w.id, name:w.name, role:w.role, shift:w.shift, zoneId:w.zoneId }) }
async function act(work) { busy.value = true; error.value = ''; try { await work(); await load() } catch(e) { error.value = e.message } finally { busy.value = false } }
async function save() { await act(async () => { const { id, ...profile } = form; await auth.request(editing.value ? `/api/manage/workers/${encodeURIComponent(id)}` : '/api/manage/workers', editing.value ? profile : { id,...profile }, editing.value ? 'PATCH' : 'POST'); reset() }) }
onMounted(async () => { await load(); if(!editing.value)reset() })

import {computed} from 'vue'
import {useTelemetryStore} from '../stores/telemetry.js'
const telemetry=useTelemetryStore(),occupation=ref(''),shiftFilter=ref(''),activeFilter=ref('')
import {useModalFocus} from '../composables/useModalFocus.js'
const pendingDeactivation=ref(null),deactivationDialog=ref(null)
useModalFocus(pendingDeactivation,deactivationDialog,()=>{pendingDeactivation.value=null})
async function deactivate(){const w=pendingDeactivation.value;if(!w)return;await act(()=>auth.request(`/api/manage/workers/${encodeURIComponent(w.id)}`,{active:false},'PATCH'));if(!error.value)pendingDeactivation.value=null}
const shownWorkers=computed(()=>workers.value.filter(w=>(!occupation.value||w.role===occupation.value)&&(!shiftFilter.value||w.shift===shiftFilter.value)&&(!activeFilter.value||w.active===(activeFilter.value==='active'))))

</script>
<template>
<main class="flex-1 pt-[68px] bg-surface w-full px-space-md py-space-md reference-page dacos_worker_management"><p class="bg-error-container text-on-error-container rounded-lg p-space-md" role="alert" v-if="error">{{error}}</p><div class="flex flex-col w-full space-y-space-md">
<div class="w-full bg-surface-container-low px-space-md py-space-sm rounded-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-space-sm">
<div class="flex items-center gap-space-sm">
<span class="inline-flex items-center px-2 py-0.5 rounded text-on-tertiary-container bg-tertiary font-code-sm text-code-sm uppercase tracking-wider font-semibold">
        SUPERVISED DEMO PROTOTYPE
      </span>
<span class="font-code-sm text-code-sm text-on-surface-variant">Personnel records and links use backend data. Simulation and missing measurements remain labelled. Not for emergency dispatch.</span>
</div>
<div class="flex items-center gap-space-sm font-code-sm text-code-sm text-outline">
<span>Registered workspace</span>
<span>•</span>
<span class="text-primary font-semibold">No latency aggregate reported</span>
</div>
</div>
<div class="flex flex-col lg:flex-row lg:items-center justify-between gap-space-md">
<div class="space-y-1 min-w-0">
<div class="flex items-center gap-2 font-code-sm text-code-sm uppercase tracking-wider text-outline">
<span>MANAGEMENT</span>
<span>/</span>
<span>WORKER MANAGEMENT</span>
<span>/</span>
<span class="text-primary font-semibold">PERSONNEL ROSTER</span>
</div>
<h1 class="font-headline-xl text-headline-xl text-on-surface tracking-tight">
        Worker Personnel &amp; Operational Assignment
      </h1>
<p class="font-body-md text-body-md text-on-surface-variant max-w-4xl">
        Administrative personnel directory and credential/device assignment. Personnel profiles reflect occupational roles (Driller, Electrician, Blasting Tech) and are distinct from SCADA software user permissions.
      </p>
</div>
<div class="flex flex-wrap items-center gap-space-sm shrink-0">
<button class="inline-flex items-center gap-2 px-space-md py-2.5 rounded-lg bg-surface-container-high text-on-surface font-label-md text-label-md hover:bg-surface-bright transition-colors" disabled="" title="Unavailable in the current backend" type="button">
<span class="material-symbols-outlined text-[18px]">download</span>
        Export Personnel CSV
      </button>
<button class="inline-flex items-center gap-2 px-space-md py-2.5 rounded-lg bg-surface-container-high text-on-surface font-label-md text-label-md hover:bg-surface-bright transition-colors" disabled="" title="Unavailable in the current backend" type="button">
<span class="material-symbols-outlined text-[18px]">swap_horiz</span>
        Bulk Shift Reassign
      </button>
<button @click="reset" class="inline-flex items-center gap-2 px-space-md py-2.5 rounded-lg bg-primary-container text-on-primary-container font-label-md text-label-md font-semibold hover:opacity-95 shadow-md transition-all" type="button">
<span class="material-symbols-outlined text-[20px]">person_add</span>
        + Register New Worker
      </button>
</div>
</div>
<div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-space-md"><div :key="key" class="bg-surface-container-low p-space-md rounded-xl shadow-sm flex flex-col justify-between" v-for="(label,key) in {total:'Personnel on this page',active:'Active registered workers',gap:'No enrolled wearable',inactive:'Inactive records'}"><span class="text-code-sm text-outline uppercase">{{label}}</span><strong class="text-telemetry-lg my-space-sm">{{key==='total'?workers.length:key==='active'?workers.filter(w=&gt;w.active).length:key==='inactive'?workers.filter(w=&gt;!w.active).length:workers.filter(w=&gt;!(telemetry.snapshot?.deviceSessions??[]).some(d=&gt;d.workerId===w.id)).length}}</strong><small class="text-label-sm text-on-surface-variant">Returned server page · No attendance inference</small></div></div>
<details class="bg-surface-container-low rounded-xl p-space-md reference-form"><summary class="cursor-pointer text-label-md text-primary">Site zone configuration</summary><ZoneRegistration @registered="load"></ZoneRegistration></details><div class="grid grid-cols-1 xl:grid-cols-12 gap-space-md items-start">
<div class="xl:col-span-8 flex flex-col space-y-space-md">
<div class="bg-surface-container-low p-space-md rounded-xl shadow-sm space-y-space-sm">
<div class="flex flex-col lg:flex-row gap-space-sm">
<form @submit.prevent="cursor='';load()" class="relative flex-1 min-w-0"><label class="block min-w-0"><span class="sr-only">Search name, ID or role</span><div class="relative flex-1">
<span class="material-symbols-outlined absolute left-3 top-2.5 text-outline text-[20px]">search</span>
<input @change="cursor='';load()" @keydown.enter.prevent="cursor='';load()" aria-label="Search name, ID or role" class="w-full bg-surface-container rounded-lg pl-10 pr-4 py-2 font-body-md text-body-md text-on-surface placeholder:text-outline focus:outline-none focus:bg-surface-container-high transition-colors" maxlength="100" placeholder="Search by name, ID or occupation…" type="text" v-model="query"/>
</div></label><button class="text-label-sm text-primary mt-2" type="submit">Search / refresh</button></form>
<div class="w-full lg:w-48">
<select class="w-full bg-surface-container rounded-lg px-3 py-2 font-body-md text-body-md text-on-surface focus:outline-none focus:bg-surface-container-high transition-colors" v-model="occupation"><option value="">All occupations on this page</option><option :key="v" v-for="v in [...new Set(workers.map(w=&gt;w.role))]">{{v}}</option></select>
</div>
<div class="w-full lg:w-44">
<select class="w-full bg-surface-container rounded-lg px-3 py-2 font-body-md text-body-md text-on-surface focus:outline-none focus:bg-surface-container-high transition-colors" v-model="shiftFilter"><option value="">All shifts on this page</option><option :key="v" v-for="v in [...new Set(workers.map(w=&gt;w.shift))]">{{v}}</option></select>
</div>
<div class="w-full lg:w-36">
<select class="w-full bg-surface-container rounded-lg px-3 py-2 font-body-md text-body-md text-on-surface focus:outline-none focus:bg-surface-container-high transition-colors" v-model="activeFilter"><option value="">All worker states</option><option value="active">Active</option><option value="inactive">Inactive</option></select>
</div>
</div>
<div class="flex items-center justify-between pt-space-xs font-code-sm text-code-sm text-outline">
<div class="flex items-center gap-space-sm">
<span>FILTERED RESULTS: <strong class="text-on-surface font-semibold">Returned server page · Registry records</strong></span>
<span>•</span>
<span>Administrative directory</span>
</div>
<button @click="query='';occupation='';shiftFilter='';activeFilter='';cursor='';load()" class="text-primary hover:underline uppercase font-semibold" type="button">Reset Filters</button>
</div>
</div>
<div class="bg-surface-container-low rounded-xl shadow-sm overflow-hidden">
<div class="overflow-x-auto">
<table class="w-full text-left font-body-md text-body-md text-on-surface">
<thead>
<tr class="bg-surface-container font-code-sm text-code-sm uppercase tracking-wider text-outline">
<th class="px-space-md py-3.5">Worker &amp; ID</th>
<th class="px-space-md py-3.5">Occupation / Specialty</th>
<th class="px-space-md py-3.5">Assigned Equipment</th>
<th class="px-space-md py-3.5">Shift &amp; Sub-Zone</th>
<th class="px-space-md py-3.5">Status</th>
<th class="px-space-md py-3.5 text-right">Actions</th>
</tr>
</thead>
<tbody class="font-body-md text-body-md"><tr :key="w.id" class="border-b border-outline-variant/20 hover:bg-surface-container-high/40" v-for="w in shownWorkers"><td class="px-space-md py-3.5"><strong>{{w.name}}</strong><small class="block text-primary">{{w.id}}</small></td><td class="px-space-md py-3.5">{{w.role}}<small class="block text-outline">Occupational role · Not software access</small></td><td class="px-space-md py-3.5">{{telemetry.snapshot?.deviceSessions?.find(d=&gt;d.workerId===w.id)?.id??'No wearable bound'}}</td><td class="px-space-md py-3.5">{{w.shift}}<small class="block text-outline">{{zones.find(z=&gt;z.id===w.zoneId)?.name??w.zoneId}}</small></td><td class="px-space-md py-3.5">{{w.active?'Active':'Inactive'}}</td><td class="px-space-md py-3.5 text-right"><div class="flex gap-2"><RouterLink :to="`/workers/${w.id}`" aria-label="Worker detail" class="text-primary p-2" v-if="w.active"><span class="material-symbols-outlined text-[18px]">monitor_heart</span></RouterLink><button :disabled="busy||loading" @click="edit(w)" aria-label="Edit profile" class="text-primary p-2"><span class="material-symbols-outlined text-[18px]">edit</span></button><button :disabled="busy" @click="w.active?pendingDeactivation=w:act(()=&gt;auth.request(`/api/manage/workers/${encodeURIComponent(w.id)}`,{active:true},'PATCH'))" class="text-label-sm">{{w.active?'Deactivate':'Reactivate'}}</button></div></td></tr><tr v-if="!shownWorkers.length"><td class="p-space-lg text-outline" colspan="6">{{loading?"Loading workers…":"No matching workers."}}</td></tr></tbody>
</table>
</div>
<div class="p-space-md bg-surface-container flex flex-col sm:flex-row items-center justify-between gap-space-sm font-code-sm text-code-sm text-outline">
<div class="flex items-center gap-2">
<span>{{shownWorkers.length}} of {{workers.length}} records on this page</span>
<span>•</span>
<span class="text-on-surface-variant">{{cursor?"Cursor page":"First page"}}</span>
</div>
<div class="flex items-center gap-1">
<button :disabled="!cursor||loading" @click="cursor='';load()" aria-label="First worker page" class="px-2.5 py-1 rounded bg-surface-container-high text-outline hover:text-on-surface disabled:opacity-40" type="button">PREV</button>
<button class="px-2.5 py-1 rounded bg-primary-container text-on-primary-container font-semibold" disabled="" type="button">{{cursor?"Cursor page":"First page"}}</button>
<button :disabled="!nextCursor||loading" @click="cursor=nextCursor;load()" class="px-2.5 py-1 rounded bg-surface-container-high text-outline hover:text-on-surface" type="button">NEXT</button>
</div>
</div>
</div>
</div>
<div class="xl:col-span-4 bg-surface-container-low rounded-xl shadow-lg p-space-md flex flex-col space-y-space-md reference-form"><div class="flex justify-between gap-space-sm"><span class="text-code-sm text-primary uppercase">Personnel inspector</span><button @click="reset" class="text-label-sm">Clear form</button></div><h2>{{ editing ? 'Edit worker' : 'Register worker' }}</h2><form @submit.prevent="save"><label>Worker ID<input :disabled="editing" maxlength="50" pattern="[A-Za-z0-9-]{1,50}" required="" v-model="form.id"/></label><label>Name<input maxlength="100" required="" v-model="form.name"/></label><label>Role<input maxlength="100" required="" v-model="form.role"/></label><label>Shift<input maxlength="100" required="" v-model="form.shift"/></label><label>Zone<select required="" v-model="form.zoneId"><option :key="z.id" :value="z.id" v-for="z in zones">{{ z.name }}</option></select></label><button :disabled="busy">{{ editing ? 'Save changes' : 'Register worker' }}</button><button @click="reset" type="button">Clear form</button></form><p class="text-code-sm text-outline">Device assignment and credential controls are managed in Device Management. Private application/medical records are not invented here.</p><RouterLink class="text-primary text-label-sm" to="/manage/devices">Device management →</RouterLink></div>
</div>
</div><div aria-labelledby="deactivation-title" aria-modal="true" class="fixed inset-0 z-[90] flex items-center justify-center bg-surface-dim/80 backdrop-blur-sm p-space-md" ref="deactivationDialog" role="dialog" tabindex="-1" v-if="pendingDeactivation"><div class="bg-surface-container-low max-w-lg w-full rounded-xl shadow-2xl p-space-lg space-y-space-md"><div class="flex items-center gap-space-sm text-tertiary"><span class="material-symbols-outlined">warning</span><h3 class="text-headline-md font-semibold" id="deactivation-title">Confirm worker deactivation</h3></div><p>{{pendingDeactivation.name}} · {{pendingDeactivation.id}}</p><p class="text-label-sm text-on-surface-variant">Deactivate this personnel record. Recorded telemetry and incident history are preserved. No physical zone or safety clearance is established by this action.</p><p class="text-error text-label-sm" role="alert" v-if="error">{{error}}</p><div class="flex justify-end gap-space-sm"><button @click="pendingDeactivation=null" class="bg-surface-container-high rounded-lg p-3 text-label-md" type="button">Cancel &amp; retain active</button><button :disabled="busy" @click="deactivate" aria-label="Confirm worker deactivation" class="bg-error text-on-error rounded-lg p-3 text-label-md" type="button">Authorize deactivation</button></div></div></div></main>
</template>
