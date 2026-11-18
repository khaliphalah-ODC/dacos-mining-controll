<script setup>
import PageHeading from '../components/ui/PageHeading.vue'
import {ref,computed,onMounted,onBeforeUnmount,watch} from 'vue'
import {RouterLink} from 'vue-router'
import {useAuthStore} from '../stores/auth.js'
import {useTelemetryStore} from '../stores/telemetry.js'
import LocationSummary from '../components/LocationSummary.vue'
const auth=useAuthStore(),telemetry=useTelemetryStore(),rows=ref([]),query=ref(''),error=ref(''),loading=ref(true)
const filtered=computed(()=>rows.value.filter(w=>`${w.name} ${w.id} ${w.location.status} ${w.location.lastKnown?.source??''}`.toLowerCase().includes(query.value.toLowerCase())))
let active=true,timer,generation=0
async function load(){const n=++generation;try{const result=await auth.request('/api/locations/current',undefined,'GET');if(active&&n===generation){rows.value=result.data;error.value=''}}catch(e){if(active)error.value=e.message}finally{loading.value=false}}
watch(()=>telemetry.snapshot?.sequence,()=>{clearTimeout(timer);timer=setTimeout(load,300)})
onMounted(load);onBeforeUnmount(()=>{active=false;generation++;clearTimeout(timer)})
</script>
<template><main class="connectivity-page"><nav><RouterLink to="/map">Fictional mine schematic</RouterLink><RouterLink to="/control-room">Control room</RouterLink><RouterLink v-if="auth.user?.role==='ADMIN'" to="/manage/location-policy">Location retention settings</RouterLink></nav><PageHeading title="Hybrid worker tracking" eyebrow="DACOS / OPERATIONS"/><p>Only authenticated device-reported observations appear here. Administrative zones and fictional map coordinates never create a position. Hardware integration and accuracy validation remain pending.</p><p v-if="!telemetry.connected" role="status">Realtime disconnected. Retained observations are not current.</p><p v-if="error" role="alert">{{error}}</p><label>Search worker, source or tracking status<input v-model="query" maxlength="100"></label><p v-if="loading">Loading last-known observations…</p><p v-else-if="!filtered.length">No matching workers.</p><div class="detail-grid"><section v-for="w in filtered" :key="w.id"><h2>{{w.name}} · {{w.id}}</h2><p>Administrative zone {{w.zoneId}} — not a measured location</p><LocationSummary :location="w.location" :offline="!telemetry.connected||!!error"/><RouterLink :to="`/workers/${w.id}`">Worker detail →</RouterLink><RouterLink v-if="auth.canManage()" :to="`/workers/${w.id}/movement`">Movement history →</RouterLink></section></div></main></template>
