<script setup>
import { watch, onUnmounted } from 'vue'
import { RouterView, useRoute, useRouter } from 'vue-router'
import { useAuthStore } from './stores/auth.js'
import { useTelemetryStore } from './stores/telemetry.js'
import AppShell from './components/AppShell.vue'
const route=useRoute(),router=useRouter(),telemetry=useTelemetryStore(),auth=useAuthStore()
watch(()=>auth.user,user=>{if(user||telemetry.preview)telemetry.start();else{telemetry.stop();telemetry.snapshot=null;if(auth.ready&&!route.meta.public)router.replace('/login')}},{immediate:true})
onUnmounted(()=>telemetry.stop())
</script>
<template><RouterView v-if="route.meta.public||route.path==='/login'"/><AppShell v-else><RouterView/></AppShell></template>
