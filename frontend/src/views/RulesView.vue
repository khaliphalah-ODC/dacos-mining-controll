<script setup>

import PageHeading from '../components/ui/PageHeading.vue'
import {ref,reactive,onMounted,nextTick} from 'vue'
import AlertRules from '../components/AlertRules.vue'
import {useAuthStore} from '../stores/auth.js'
const auth=useAuthStore(),rules=ref([]),error=ref(''),busy=ref(false),result=ref(null)
const form=reactive({name:'',afterMinutes:5,targetSeverity:'HIGH',enabled:false})
async function act(fn){busy.value=true;error.value='';try{await fn();rules.value=(await auth.request('/api/operations/escalation-rules',undefined,'GET')).data}catch(e){error.value=e.message}finally{busy.value=false}}
onMounted(()=>act(async()=>{}))

import {RouterLink} from 'vue-router'
const tab=ref('demo')
async function newRule(){tab.value='demo';await nextTick();const el=document.getElementById('escalation-rule-form');el?.scrollIntoView({block:'nearest'});el?.querySelector('input')?.focus()}

</script>
<template>
<main class="flex-1 pt-[68px] bg-surface w-full px-space-md py-space-md reference-page dacos_operational_threshold_rules"><p class="bg-error-container text-on-error-container rounded-lg p-space-md" role="alert" v-if="error">{{error}}</p><div class="flex flex-col w-full space-y-space-md">
<div class="flex flex-col xl:flex-row xl:items-center justify-between gap-space-sm pb-space-sm border-b border-outline-variant/30">
<div class="flex flex-col min-w-0">
<div class="flex items-center gap-2 font-code-sm text-code-sm text-outline uppercase tracking-wider mb-1">
<span class="text-primary font-semibold">OPERATIONS</span>
<span>/</span>
<span>RULES &amp; LOGIC</span>
<span>/</span>
<span class="text-on-surface">THRESHOLD ENGINE</span>
</div>
<div class="flex flex-wrap items-center gap-3">
<h1 class="font-headline-lg text-headline-lg text-on-surface tracking-tight">Operational Rules &amp; Alert Thresholds Engine</h1>
<span class="px-2.5 py-0.5 rounded bg-surface-container-high border border-outline-variant/60 font-code-sm text-code-sm text-secondary tracking-widest font-mono">SYS-REV // 4.19-LBR</span>
</div>
<p class="font-body-md text-body-md text-on-surface-variant mt-1 max-w-4xl">
        Configure demonstration escalation rules and evaluate telemetry threshold logic. Rules apply to simulated incidents and demo telemetry; hardware threshold changes require Administrator clearance.
      </p>
</div>
<div class="flex flex-wrap items-center gap-2 shrink-0 pt-2 xl:pt-0">
<RouterLink class="h-10 px-3.5 rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-label-md text-label-md flex items-center gap-2 transition-all border border-outline-variant/40 hover:border-outline focus:outline-none" id="btn-audit-log" to="/manage/users" v-if="auth.user?.role==='ADMIN'">
<span class="material-symbols-outlined text-[18px] text-on-surface-variant">history_toggle_off</span>
<span>Audit Trigger Log</span>
</RouterLink>
<button :disabled="busy" @click="act(async()=&gt;result=await auth.request('/api/operations/incidents-escalate-due',{}))" class="h-10 px-3.5 rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-primary font-label-md text-label-md flex items-center gap-2 transition-all border border-primary/30 hover:border-primary focus:outline-none shadow-sm" id="btn-simulate-all">
<span class="material-symbols-outlined text-[18px]">play_circle</span>
<span>Simulate Rule Run</span>
</button>
<button @click="newRule" class="h-10 px-4 rounded-lg bg-primary hover:bg-primary-container text-on-primary font-label-md text-label-md font-semibold flex items-center gap-2 transition-all shadow-md focus:outline-none" id="btn-new-rule" v-if="auth.user?.role==='ADMIN'">
<span class="material-symbols-outlined text-[20px]">add</span>
<span>New Demo Escalation Rule</span>
</button>
</div>
</div>
<div class="grid grid-cols-1 lg:grid-cols-12 gap-space-sm">
<div class="lg:col-span-8 p-3 rounded-lg bg-surface-container-low border-l-4 border-primary flex items-center justify-between gap-3">
<div class="flex items-center gap-3 min-w-0">
<span class="material-symbols-outlined text-primary text-[22px] shrink-0">badge</span>
<div class="flex flex-col min-w-0">
<span class="font-code-sm text-code-sm uppercase tracking-wider text-primary font-bold">ROLE: {{auth.user?.role}}</span>
<span class="font-body-md text-body-md text-on-surface truncate">Demonstration evaluation is explicit. Hardware rule changes require administrator review.</span>
</div>
</div>
<span class="px-2 py-1 rounded bg-primary/10 text-primary font-code-sm text-code-sm tracking-wider uppercase font-semibold shrink-0">Authenticated role enforcement</span>
</div>
<div class="lg:col-span-4 p-3 rounded-lg bg-surface-container-low border-l-4 border-tertiary flex items-center gap-3">
<span class="material-symbols-outlined text-tertiary text-[22px] shrink-0">verified_user</span>
<div class="flex flex-col">
<span class="font-code-sm text-code-sm uppercase tracking-wider text-tertiary font-bold">ADMIN CLEARANCE REQUIRED</span>
<span class="font-code-sm text-code-sm text-on-surface-variant font-mono">{{auth.user?.role==='ADMIN'?'ADMIN REVIEW AVAILABLE':'READ-ONLY FOR THIS ROLE'}}</span>
</div>
</div>
</div>
<div class="flex border-b border-outline-variant/40 gap-2">
<button :aria-pressed="tab==='demo'" @click="tab='demo'" class="px-4 py-2.5 font-label-md text-label-md font-semibold text-primary border-b-2 border-primary flex items-center gap-2 focus:outline-none transition-colors" id="tab-demo-btn">
<span class="material-symbols-outlined text-[18px]">rule</span>
<span>Demonstration Escalation Rules</span>
<span class="ml-1 px-1.5 py-0.5 rounded-full bg-primary/15 text-primary text-[10px] font-mono">{{rules.length}} configured</span>
</button>
<button :aria-pressed="tab==='hardware'" @click="tab='hardware'" class="px-4 py-2.5 font-label-md text-label-md font-semibold text-on-surface-variant hover:text-on-surface border-b-2 border-transparent flex items-center gap-2 focus:outline-none transition-colors" id="tab-hardware-btn">
<span class="material-symbols-outlined text-[18px]">lock_clock</span>
<span>Protected Hardware Telemetry Thresholds</span>
<span class="ml-1 px-1.5 py-0.5 rounded bg-surface-container-high text-outline text-[10px] font-mono">REVIEW REQUIRED</span>
</button>
</div>
<div class="grid grid-cols-1 xl:grid-cols-12 gap-space-md items-start">
<div class="xl:col-span-8 flex flex-col space-y-space-md"><section class="bg-surface-container rounded-xl p-space-md shadow-sm reference-form space-y-space-md" v-show="tab==='demo'"><p class="text-code-sm text-tertiary">Explicit evaluation applies only to simulated incidents. No notifications or hardware actuation are sent.</p><form @submit.prevent="act(()=&gt;auth.request('/api/operations/escalation-rules',{...form}))" id="escalation-rule-form" v-if="auth.user?.role==='ADMIN'"><h2>New demonstration escalation rule</h2><label>Name<input maxlength="100" required="" v-model="form.name"/></label><div class="grid sm:grid-cols-2 gap-space-md"><label>Minutes since incident creation<input max="10080" min="1" required="" type="number" v-model.number="form.afterMinutes"/></label><label>Target severity<select v-model="form.targetSeverity"><option>LOW</option><option>MEDIUM</option><option>HIGH</option><option>CRITICAL</option></select></label></div><button :disabled="busy" type="submit">Create disabled rule</button></form><p class="text-outline" v-if="!rules.length">No demonstration escalation rules configured.</p><article :key="r.id" class="bg-surface-container-low rounded-lg p-space-md" v-for="r in rules"><div class="flex items-start justify-between gap-space-sm"><h3 class="text-headline-sm font-semibold">{{r.name}}</h3><span class="text-code-sm text-primary">{{r.enabled?'ENABLED':'DISABLED'}}</span></div><p class="text-code-sm text-outline">{{r.id}}</p><div class="grid sm:grid-cols-2 gap-space-sm my-space-md"><div class="bg-surface-container-high rounded p-space-sm"><span class="text-code-sm text-outline">Trigger condition</span><p>{{r.afterMinutes}} minutes since simulated incident creation</p></div><div class="bg-surface-container-high rounded p-space-sm"><span class="text-code-sm text-outline">Target action</span><p>Record severity {{r.targetSeverity}}</p></div></div><button :disabled="busy" @click="act(()=&gt;auth.request(`/api/operations/escalation-rules/${r.id}`,{enabled:!r.enabled},'PATCH'))" v-if="auth.user?.role==='ADMIN'">{{r.enabled?'Disable':'Enable'}}</button></article></section><div class="reference-form bg-surface-container rounded-xl p-space-md" v-show="tab==='hardware'"><AlertRules></AlertRules></div></div>
<div class="xl:col-span-4 flex flex-col space-y-space-sm"><section class="bg-surface-container rounded-xl p-space-md shadow-sm reference-form space-y-space-md"><div class="flex items-center justify-between"><h2>Rule evaluation console</h2><span class="text-code-sm text-primary">DEMONSTRATION</span></div><p>Evaluate enabled demonstration escalation rules against stored simulated incidents. The backend returns the actual evaluated and changed counts.</p><button :disabled="busy" @click="act(async()=&gt;result=await auth.request('/api/operations/incidents-escalate-due',{}))">Evaluate demonstration rules</button><div class="bg-surface-container-lowest rounded-lg p-space-md min-h-40"><p role="status" v-if="result">Evaluated {{result.evaluated}} · Changed {{result.changed}}</p><p class="text-outline" v-else="">No evaluation requested in this page session.</p></div></section></div>
</div>
<div class="mt-space-md p-3.5 rounded-lg bg-surface-container-low border border-outline-variant/30 flex flex-col sm:flex-row items-center justify-between gap-3 text-on-surface-variant font-code-sm text-code-sm">
<div class="flex items-center gap-2">
<span class="material-symbols-outlined text-tertiary text-[18px]">verified</span>
<span class="text-on-surface font-semibold">DACOS LIBERIA TELEMETRY PROTOTYPE // SUPERVISED DEMO MODE</span>
<span class="hidden md:inline text-outline">•</span>
<span class="hidden md:inline">Hardware changes require administrator review; no firmware interlock control is connected.</span>
</div>
<div class="flex items-center gap-2 font-mono text-outline">
<span>NON-PROD EVALUATION</span>
<span>//</span>
<span>LIB-RULES-SEC-08</span>
</div>
</div>
</div></main>
</template>
