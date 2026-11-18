<script setup>
import {ref} from 'vue'
import {useAuthStore} from '../stores/auth.js'
import {useTelemetryStore} from '../stores/telemetry.js'
const auth=useAuthStore(),telemetry=useTelemetryStore(),scenario=ref('normal')
</script>
<template><section v-if="auth.canManage()&&telemetry.snapshot?.mode!=='operational'"><h2>Backend demonstration scenario</h2><p>Changes the real backend simulator. Generated readings remain explicitly simulated.</p><form class="list-toolbar" @submit.prevent="telemetry.setScenario(scenario)"><label>Scenario<select v-model="scenario"><option v-for="s in ['normal','warning','critical','disconnected','stale']" :key="s">{{s}}</option></select></label><button :disabled="telemetry.busy||telemetry.preview">Apply simulated scenario</button></form><p v-if="telemetry.error" role="alert">{{telemetry.error}}</p></section></template>
