<script setup>

import PageHeading from '../components/ui/PageHeading.vue'
import { ref, reactive, onMounted, computed } from 'vue'
import { useAuthStore } from '../stores/auth.js'
const userQuery=ref(''),auditQuery=ref(''),userCursor=ref(''),auditCursor=ref(''),userNext=ref(null),auditNext=ref(null)
const auth = useAuthStore(), users = ref([]), audits = ref([]), error = ref(''), busy = ref(false), editing = ref(null)
const form = reactive({ email:'',name:'',role:'OPERATOR',password:'' })
async function load(){const [u,a]=await Promise.all([auth.request('/api/users?'+new URLSearchParams({q:userQuery.value,limit:25,...(userCursor.value?{cursor:userCursor.value}:{})}),undefined,'GET'),auth.request('/api/audit?'+new URLSearchParams({q:auditQuery.value,limit:25,...(auditCursor.value?{cursor:auditCursor.value}:{})}),undefined,'GET')]);users.value=u.data;userNext.value=u.nextCursor;audits.value=a.data;auditNext.value=a.nextCursor}
async function act(work) { busy.value = true; error.value = ''; try { await work(); await load() } catch(e) { error.value = e.message } finally { busy.value = false } }
function reset() { editing.value = null; Object.assign(form,{email:'',name:'',role:'OPERATOR',password:''}) }
function edit(user) { editing.value = user; Object.assign(form,{email:user.email,name:user.name,role:user.role,password:''}) }
async function save() { await act(async () => { if(editing.value) await auth.request(`/api/users/${editing.value.id}`,{ name:form.name,role:form.role,...(form.password ? { password:form.password } : {}) },'PATCH'); else await auth.request('/api/users',{...form}); reset() }) }
onMounted(() => act(async () => {}))

const tab=ref('users'),roleFilter=ref('ALL'),statusFilter=ref('ALL'),passVisible=ref(false)
const filteredUsers=computed(()=>users.value.filter(u=>(roleFilter.value==='ALL'||u.role===roleFilter.value)&&(statusFilter.value==='ALL'||(statusFilter.value==='ACTIVE'?u.active:!u.active))))
function generatePasscode(){const bytes=crypto.getRandomValues(new Uint8Array(20));form.password='A9!'+Array.from(bytes,b=>String.fromCharCode(33+b%90)).join('')}

</script>
<template>
<main class="flex-1 pt-[68px] bg-surface w-full px-space-md py-space-md reference-page"><p class="bg-error-container text-on-error-container p-space-md rounded-lg" role="alert" v-if="error">{{error}}</p><div class="flex flex-col w-full space-y-space-md">

<div class="flex flex-col md:flex-row items-start md:items-center justify-between gap-space-sm bg-surface-container-high/90 px-space-md py-space-sm rounded-lg shadow-sm">
<div class="flex items-center gap-space-sm">
<span class="flex h-2.5 w-2.5 relative">
<span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-error opacity-75"></span>
<span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-error"></span>
</span>
<span class="font-code-sm text-code-sm tracking-wider uppercase text-error font-semibold">
        Administrative Access Only — Role Management &amp; Security Audit Ledger
      </span>
<span class="hidden lg:inline-block font-code-sm text-code-sm text-outline-variant">|</span>
<span class="hidden lg:inline-block font-code-sm text-code-sm text-on-surface-variant uppercase tracking-wider">Administrator-authorized workspace</span>
</div>
<div class="flex items-center gap-space-xs self-end md:self-auto">
<span class="px-2 py-0.5 rounded bg-tertiary-container/20 text-tertiary font-code-sm text-code-sm uppercase tracking-wider">Role-based authorization</span>
</div>
</div>

<div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-space-md border-b-0">
<div class="flex items-center gap-space-xs bg-surface-container-lowest p-1 rounded-xl shadow-inner">
<button @click="tab='users'" class="flex items-center gap-2 px-space-md py-2 rounded-lg bg-surface-container-high text-primary font-headline-sm text-headline-sm shadow-sm transition-all" id="tab-users-btn" role="tab" :aria-selected="tab==='users'" :class="{'reference-selected-tab':tab==='users'}">
<span class="material-symbols-outlined text-[20px]" style="font-variation-settings: 'FILL' 1;">manage_accounts</span>
<span>User Accounts (Staff Directory)</span>
<span class="ml-1 px-1.5 py-0.5 rounded-full bg-primary/20 text-primary font-code-sm text-code-sm">{{users.filter(u=&gt;u.active).length}} active on this page</span>
</button>
<button @click="tab='audit'" class="flex items-center gap-2 px-space-md py-2 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-all font-headline-sm text-headline-sm" id="tab-audit-btn" role="tab" :aria-selected="tab==='audit'" :class="{'reference-selected-tab':tab==='audit'}">
<span class="material-symbols-outlined text-[20px]">shield_with_heart</span>
<span>Security &amp; Governance Audit Trail</span>
<span class="ml-1 px-1.5 py-0.5 rounded-full bg-surface-container-highest text-on-surface-variant font-code-sm text-code-sm">{{audits.length}} events on this page</span>
</button>
</div>

<div class="hidden xl:flex items-center gap-space-sm font-code-sm text-code-sm">
<div class="flex items-center gap-2 px-space-sm py-1.5 rounded-lg bg-surface-container text-on-surface-variant">
<span class="w-1.5 h-1.5 rounded-full bg-primary"></span>
<span>Active MFA Enforcement: <strong class="text-on-surface font-semibold">Unavailable</strong></span>
</div>
<div class="flex items-center gap-2 px-space-sm py-1.5 rounded-lg bg-surface-container text-on-surface-variant">
<span class="w-1.5 h-1.5 rounded-full bg-tertiary"></span>
<span>Concurrent Sessions: <strong class="text-on-surface font-semibold">Unavailable</strong></span>
</div>
</div>
</div>

<div class="flex flex-col lg:flex-row gap-space-md items-start w-full" id="section-users" v-show="tab==='users'">

<div class="flex-1 flex flex-col w-full space-y-space-md min-w-0">

<div class="bg-surface-container-low p-space-md rounded-xl flex flex-col md:flex-row items-stretch md:items-center justify-between gap-space-md shadow-sm">

<div class="flex flex-wrap items-center gap-space-sm flex-1 min-w-0">
<div class="relative flex-1 min-w-[220px]">
<span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[20px]">search</span>
<input @change="userCursor='';act(async()=&gt;{})" class="w-full bg-surface-container pl-10 pr-space-md py-2 rounded-lg text-on-surface placeholder:text-outline font-body-md text-body-md focus:outline-none focus:ring-1 focus:ring-primary shadow-inner" id="user-search-input" placeholder="Search by name, identifier, or email..." type="text" v-model="userQuery"/>
</div>

<div class="relative">
<select class="appearance-none bg-surface-container text-on-surface pl-3 pr-8 py-2 rounded-lg font-label-md text-label-md focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer shadow-inner" id="role-filter" v-model="roleFilter">
<option value="ALL">Role: All Tiers</option>
<option value="ADMIN">Role: Administrator</option>
<option value="SUPERVISOR">Role: Supervisor</option>
<option value="OPERATOR">Role: Operator</option>
</select>
<span class="material-symbols-outlined absolute right-2.5 top-1/2 -translate-y-1/2 text-outline pointer-events-none text-[18px]">expand_more</span>
</div>

<div class="relative">
<select class="appearance-none bg-surface-container text-on-surface pl-3 pr-8 py-2 rounded-lg font-label-md text-label-md focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer shadow-inner" id="status-filter" v-model="statusFilter">
<option value="ALL">Status: All States</option>
<option value="ACTIVE">Status: Active Only</option>
<option value="INACTIVE">Status: Suspended / Locked</option>
</select>
<span class="material-symbols-outlined absolute right-2.5 top-1/2 -translate-y-1/2 text-outline pointer-events-none text-[18px]">expand_more</span>
</div>
</div>

<button @click="reset();tab='users'" class="shrink-0 flex items-center justify-center gap-2 bg-primary-container hover:bg-primary text-on-primary-container px-space-md py-2.5 rounded-lg font-label-md text-label-md font-semibold transition-colors shadow-md">
<span class="material-symbols-outlined text-[18px]">person_add</span>
<span>+ Create User Account</span>
</button>
</div>

<div class="bg-surface-container-low rounded-xl overflow-hidden shadow-md flex flex-col">
<div class="overflow-x-auto">
<table class="w-full text-left font-body-md text-body-md border-collapse">
<thead>
<tr class="bg-surface-container-high/60 text-outline uppercase font-code-sm text-code-sm tracking-wider">
<th class="py-3.5 px-space-md">Full Name</th>
<th class="py-3.5 px-space-md">Email / SCADA Identifier</th>
<th class="py-3.5 px-space-md">Access Role</th>
<th class="py-3.5 px-space-md">Account Status</th>
<th class="py-3.5 px-space-md">Last Signed In</th>
<th class="py-3.5 px-space-md">Session Security</th>
<th class="py-3.5 px-space-md text-right">Actions</th>
</tr>
</thead>
<tbody class="divide-y-0 text-on-surface"><tr :key="u.id" class="border-b border-outline-variant/20" v-for="u in filteredUsers"><td class="py-3.5 px-space-md"><strong>{{u.name}}</strong><small class="block text-primary" v-if="u.id===auth.user?.id">You</small></td><td class="py-3.5 px-space-md">{{u.email}}</td><td class="py-3.5 px-space-md"><span class="text-primary">{{u.role}}</span></td><td class="py-3.5 px-space-md"><span :class="u.active?'text-primary':'text-error'">{{u.active?"Active":"Inactive"}}</span></td><td class="py-3.5 px-space-md">Unavailable</td><td class="py-3.5 px-space-md">Administrator-managed session</td><td class="py-3.5 px-space-md text-right"><div class="flex gap-2"><button @click="edit(u)" aria-label="Edit account" title="Edit account"><span class="material-symbols-outlined">manage_accounts</span></button><button @click="edit(u)" aria-label="Reset password" title="Reset password"><span class="material-symbols-outlined">lock_reset</span></button><button :aria-label="u.active?'Disable account':'Reactivate account'" :disabled="busy||u.id===auth.user?.id" @click="act(()=&gt;auth.request(`/api/users/${u.id}`,{active:!u.active},'PATCH'))"><span class="material-symbols-outlined">{{u.active?"block":"lock_open"}}</span></button></div></td></tr><tr v-if="!filteredUsers.length"><td class="p-space-lg text-outline" colspan="7">{{busy?"Loading accounts…":"No matching accounts."}}</td></tr></tbody>
</table>
</div>
<div class="p-space-sm bg-surface-container-high/40 flex items-center justify-between font-code-sm text-code-sm text-on-surface-variant px-space-md">
<span>Showing {{filteredUsers.length}} accounts on this page</span>
<span class="text-outline">Persistent account directory</span>
</div>
</div>
</div>

<div class="w-full lg:w-[410px] shrink-0 bg-surface-container-low rounded-xl p-space-md shadow-xl flex flex-col space-y-space-md" id="drawer-panel">

<div class="flex items-center justify-between pb-space-sm">
<div class="flex items-center gap-2">
<span class="material-symbols-outlined text-primary text-[24px]">badge</span>
<div>
<h3 class="font-headline-sm text-headline-sm text-on-surface" id="drawer-title">{{editing?"Edit account":"Provision User Account"}}</h3>
<p class="font-code-sm text-code-sm text-on-surface-variant uppercase tracking-wider">Access Clearance Ledger</p>
</div>
</div>
<button @click="reset" class="p-1 rounded text-outline hover:text-on-surface hover:bg-surface-container transition-colors" title="Clear/Reset Form">
<span class="material-symbols-outlined text-[20px]">refresh</span>
</button>
</div>

<div class="bg-surface-container p-space-sm rounded-lg flex items-start gap-space-xs text-on-surface-variant">
<span class="material-symbols-outlined text-tertiary text-[20px] shrink-0 mt-0.5">verified</span>
<p class="font-code-sm text-code-sm leading-relaxed text-on-surface-variant">
<strong class="text-tertiary">STRICT IDENTITY POLICY:</strong>Access is administrator-managed. Role and password changes invalidate existing sessions.</p>
</div>

<form @submit.prevent="save" class="space-y-space-md flex-1 flex flex-col justify-between" id="account-form">
<div class="space-y-space-sm">

<div>
<label class="block font-label-md text-label-md text-on-surface-variant mb-1">Full Legal Name</label>
<input :disabled="busy" class="w-full bg-surface-container px-3 py-2 rounded-lg text-on-surface placeholder:text-outline font-body-md text-body-md focus:outline-none focus:ring-1 focus:ring-primary shadow-inner" id="form-fullname" placeholder="e.g., Boakai Fahnbulleh" required="" type="text" v-model="form.name"/>
</div>

<div>
<label class="block font-label-md text-label-md text-on-surface-variant mb-1">Corporate Email Address</label>
<input :disabled="busy||!!editing" class="w-full bg-surface-container px-3 py-2 rounded-lg text-on-surface placeholder:text-outline font-body-md text-body-md focus:outline-none focus:ring-1 focus:ring-primary shadow-inner" id="form-email" placeholder="username@dacos.lr" required="" type="email" v-model="form.email"/>
</div>

<div>
<div class="flex items-center justify-between mb-1">
<label class="font-label-md text-label-md text-on-surface-variant">Role Clearance Selector</label>
<span class="font-code-sm text-code-sm text-outline">3 Enforced Tiers</span>
</div>
<div class="space-y-2">

<label class="flex items-start gap-3 p-2.5 rounded-lg bg-surface-container hover:bg-surface-container-high transition-colors cursor-pointer group">
<input class="mt-1 accent-primary" name="role-tier" type="radio" v-model="form.role" value="OPERATOR"/>
<div class="flex flex-col">
<span class="font-label-md text-label-md text-on-surface font-semibold group-hover:text-primary">Tier 1: Operator</span>
<span class="font-code-sm text-code-sm text-on-surface-variant">Monitor mine telemetry &amp; acknowledge active alarm events.</span>
</div>
</label>

<label class="flex items-start gap-3 p-2.5 rounded-lg bg-surface-container hover:bg-surface-container-high transition-colors cursor-pointer group">
<input class="mt-1 accent-primary" name="role-tier" type="radio" v-model="form.role" value="SUPERVISOR"/>
<div class="flex flex-col">
<span class="font-label-md text-label-md text-on-surface font-semibold group-hover:text-primary">Tier 2: Supervisor</span>
<span class="font-code-sm text-code-sm text-on-surface-variant">Shift coordination, manual overrides &amp; hardware provisioning.</span>
</div>
</label>

<label class="flex items-start gap-3 p-2.5 rounded-lg bg-surface-container hover:bg-surface-container-high transition-colors cursor-pointer group">
<input class="mt-1 accent-primary" name="role-tier" type="radio" v-model="form.role" value="ADMIN"/>
<div class="flex flex-col">
<span class="font-label-md text-label-md text-on-surface font-semibold group-hover:text-primary">Tier 3: Administrator</span>
<span class="font-code-sm text-code-sm text-on-surface-variant">Full governance, security audit ledger &amp; identity issuance.</span>
</div>
</label>
</div>
<p class="mt-1 font-code-sm text-code-sm text-outline">Privileges strictly constrained to these 3 discrete role policies.</p>
</div>

<div>
<div class="flex items-center justify-between mb-1">
<label class="font-label-md text-label-md text-on-surface-variant">Initial Temporary Passcode</label>
<button @click="generatePasscode" class="font-code-sm text-code-sm text-primary hover:underline" type="button">Generate passcode</button>
</div>
<div class="relative">
<input :disabled="busy" :required="!editing" :type="passVisible?'text':'password'" autocomplete="new-password" class="w-full bg-surface-container px-3 py-2 pr-10 rounded-lg text-on-surface font-body-md text-body-md focus:outline-none focus:ring-1 focus:ring-primary shadow-inner tracking-widest" id="form-passcode" maxlength="128" minlength="12" placeholder="Minimum 12 characters..." v-model="form.password"/>
<button @click="passVisible=!passVisible" class="absolute right-3 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface" type="button">
<span class="material-symbols-outlined text-[18px]" id="passcode-eye-icon">visibility</span>
</button>
</div>
<span class="font-code-sm text-code-sm text-outline">Minimum length: 12 characters. Keep the passcode private.</span>
</div>

<div class="pt-2">
<p class="text-label-sm text-on-surface-variant">Password resets invalidate existing sessions.</p>
</div>
</div>

<div class="pt-space-md flex items-center gap-space-sm">
<button :disabled="busy" class="flex-1 bg-primary text-on-primary font-headline-sm text-headline-sm py-2.5 rounded-lg font-semibold hover:bg-primary-fixed transition-colors shadow-md flex items-center justify-center gap-2" type="submit">
<span class="material-symbols-outlined text-[20px]">save</span>
<span id="btn-submit-label">{{busy?"Saving…":"Save account"}}</span>
</button>
<button @click="reset" class="px-space-md py-2.5 rounded-lg bg-surface-container-high hover:bg-surface-variant text-on-surface font-headline-sm text-headline-sm transition-colors" type="button">
            Cancel
          </button>
</div>
</form>
</div>
<div class="flex gap-space-sm"><button @click="userCursor='';act(async()=&gt;{})" v-if="userCursor">First account page</button><button :disabled="busy" @click="userCursor=userNext;act(async()=&gt;{})" v-if="userNext">Next account page →</button></div></div>

<div class="w-full flex flex-col space-y-space-sm bg-surface-container-low p-space-md rounded-xl shadow-md" id="section-audit" v-show="tab==='audit'">
<div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-space-xs pb-space-xs">
<div class="flex items-center gap-2">
<span class="material-symbols-outlined text-primary text-[22px]">policy</span>
<h3 class="font-headline-sm text-headline-sm text-on-surface">Immutable Cryptographic Audit Trail (Chronological)</h3>
<span class="px-2 py-0.5 rounded bg-surface-container-high text-on-surface-variant font-code-sm text-code-sm uppercase">Persistent audit records</span>
</div>
<div class="flex items-center gap-2">
<button @click="act(async()=&gt;{})" class="flex items-center gap-1 text-primary hover:text-on-surface font-code-sm text-code-sm px-2.5 py-1 rounded bg-surface-container transition-colors">
<span class="material-symbols-outlined text-[16px]">sync</span>Refresh to load latest</button>
<button class="flex items-center gap-1 text-on-surface-variant hover:text-on-surface font-code-sm text-code-sm px-2.5 py-1 rounded bg-surface-container transition-colors" disabled="" title="Audit CSV export is unavailable">
<span class="material-symbols-outlined text-[16px]">download</span> Export Ledger (.CSV)
        </button>
</div>
</div>


<form @submit.prevent="auditCursor='';act(async()=&gt;{})" class="flex gap-space-sm"><input aria-label="Search audit events" class="flex-1 bg-surface-container rounded-lg px-3 py-2" placeholder="Action, actor or target ID" v-model="auditQuery"/><button class="text-primary">Search audit events</button></form><article :key="a.id" class="flex items-center justify-between gap-space-md bg-surface-container rounded-lg p-space-md" v-for="a in audits"><div class="flex gap-space-md"><span class="material-symbols-outlined text-primary">policy</span><div><strong>{{a.action}}</strong><p class="text-label-sm text-on-surface-variant">Actor {{a.actorId??'Unauthenticated'}} · Target {{a.targetId??'—'}}</p></div></div><time class="text-code-sm text-outline">{{new Date(a.createdAt).toLocaleString()}}</time></article><p class="p-space-md" v-if="!audits.length">No audit events.</p><div class="flex justify-between"><button @click="auditCursor='';act(async()=&gt;{})" v-if="auditCursor">Latest audit page</button><button @click="auditCursor=auditNext;act(async()=&gt;{})" v-if="auditNext">Older audit events →</button></div></div>
</div>
</main>
</template>
