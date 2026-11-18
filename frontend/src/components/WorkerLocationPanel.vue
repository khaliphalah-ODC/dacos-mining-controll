<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { useAuthStore } from '../stores/auth.js'
import { useTelemetryStore } from '../stores/telemetry.js'
import LocationSummary from './LocationSummary.vue'
const props=defineProps({workerId:{type:String,required:true}}),auth=useAuthStore(),telemetry=useTelemetryStore(),location=ref(null),error=ref('')
let active=true,timer,generation=0
async function load(){const n=++generation;try{const value=await auth.request(`/api/workers/${encodeURIComponent(props.workerId)}/location`,undefined,'GET');if(active&&n===generation){location.value=value;error.value=''}}catch(e){if(active&&n===generation)error.value=e.message}}
watch(()=>props.workerId,()=>{location.value=null;load()})
watch(()=>telemetry.snapshot?.sequence,()=>{clearTimeout(timer);timer=setTimeout(load,300)})
onMounted(load);onBeforeUnmount(()=>{active=false;generation++;clearTimeout(timer)})
</script>
<template><section><h2>Hybrid positioning</h2><p v-if="error" role="alert">{{error}} · Retained location is not current.</p><LocationSummary :location="location" :offline="!telemetry.connected||!!error"/><RouterLink v-if="auth.canManage()" :to="`/workers/${workerId}/movement`">Movement & zone history →</RouterLink><p v-else>Detailed movement history is restricted to supervisors and administrators.</p></section></template>
