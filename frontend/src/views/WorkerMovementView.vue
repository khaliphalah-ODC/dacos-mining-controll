<script setup>
import PageHeading from '../components/ui/PageHeading.vue'
import {ref,reactive,onMounted,onBeforeUnmount,watch} from 'vue'
import {useRoute,RouterLink} from 'vue-router'
import {useAuthStore} from '../stores/auth.js'
import {locationDescription} from '../services/locations.js'
import {isoDate} from '../services/history.js'
const auth=useAuthStore(),route=useRoute(),rows=ref([]),events=ref([]),error=ref(''),loading=ref(false),nextCursor=ref(null),eventCursor=ref(null),retentionDays=ref(90)
const filters=reactive({source:'',from:'',to:''})
let generation=0,active=true
async function load(append=false,kind='locations'){
  if(!active)return
  const n=++generation;error.value='';loading.value=true
  try{
    const p=new URLSearchParams();if(filters.source)p.set('source',filters.source);if(filters.from)p.set('from',isoDate(filters.from));if(filters.to)p.set('to',isoDate(filters.to))
    const cursor=kind==='locations'?nextCursor.value:eventCursor.value;if(append&&cursor)p.set('cursor',cursor)
    const result=await auth.request(`/api/workers/${encodeURIComponent(route.params.id)}/${kind}?${p}`,undefined,'GET')
    if(!active||n!==generation)return
    if(kind==='locations'){rows.value=append?[...rows.value,...result.data]:result.data;nextCursor.value=result.nextCursor}else{events.value=append?[...events.value,...result.data]:result.data;eventCursor.value=result.nextCursor}
    retentionDays.value=result.retentionDays
  }catch(e){error.value=e.message}finally{if(n===generation)loading.value=false}
}
async function refresh(){await load();await load(false,'movements')}
onMounted(refresh);watch(()=>route.params.id,()=>{rows.value=[];events.value=[];refresh()});onBeforeUnmount(()=>{active=false;generation++})
</script>
<template><main class="connectivity-page"><nav><RouterLink :to="`/workers/${route.params.id}`">← Worker detail</RouterLink><RouterLink to="/tracking">Tracking overview</RouterLink></nav><PageHeading title="Worker movement history" eyebrow="DACOS / OPERATIONS"/><p>{{route.params.id}} · Restricted personnel location history · Current retention window: {{retentionDays}} days</p><p>Zone entries/exits are inferred between observations, not verified crossing times. Gaps indicate unobserved movement. Simulation-to-hardware transitions do not establish a physical route.</p><form class="detail-grid" @submit.prevent="refresh"><label>Source<select v-model="filters.source"><option value="">All sources</option><option v-for="s in ['GNSS','BLE','UWB','SIMULATED']" :key="s">{{s}}</option></select></label><label>From (local time)<input v-model="filters.from" type="datetime-local"></label><label>To (local time)<input v-model="filters.to" type="datetime-local"></label><button :disabled="loading">Apply filters / refresh</button></form><p v-if="error" role="alert">{{error}}</p><p v-if="loading" role="status">Loading movement history…</p><div class="detail-grid"><section><h2>Position observations</h2><p v-if="!loading&&!rows.length">Location Unavailable — no observations in this period.</p><ol class="movement-timeline"><li v-for="r in rows" :key="r.id"><strong>{{new Date(r.timestamp).toLocaleString()}} · {{r.source}}</strong><p>{{locationDescription(r)}}</p><p>{{r.simulation?'SIMULATED — fictional movement':'Device-reported; hardware validation pending'}} · Sequence {{r.sequence}}</p><p>Device {{r.deviceId}} · Accuracy {{r.accuracyMeters==null?'not reported':`${r.accuracyMeters} m`}}</p></li></ol><button v-if="nextCursor" :disabled="loading" @click="load(true)">Older observations</button></section><section><h2>Zone entry / exit & source transitions</h2><p v-if="!loading&&!events.length">No recorded transitions in this period.</p><ol class="movement-timeline"><li v-for="e in events" :key="e.id"><strong>{{e.type.replaceAll('_',' ')}}</strong><p>{{new Date(e.timestamp).toLocaleString()}} · {{e.zoneId??`${e.previousSource} → ${e.source}`}}</p><p>{{e.source}} · {{e.simulation?'Includes simulated movement':'Inferred from device observations'}}</p></li></ol><button v-if="eventCursor" :disabled="loading" @click="load(true,'movements')">Older transitions</button></section></div></main></template>
<style scoped>.movement-timeline{list-style:none;padding-left:16px;border-left:1px solid #395365;margin-top:20px}.movement-timeline li{padding:0 0 24px 10px;font-size:12px;overflow-wrap:anywhere}.movement-timeline p{margin:7px 0;color:#acbdcb}</style>
