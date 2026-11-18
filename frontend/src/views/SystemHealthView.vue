<script setup>
import {useApiQuery} from '../composables/useApiQuery.js'
import {useTelemetryStore} from '../stores/telemetry.js'
import PageHeading from '../components/ui/PageHeading.vue'
import MetricCard from '../components/ui/MetricCard.vue'
import DataState from '../components/ui/DataState.vue'
import StatusBadge from '../components/ui/StatusBadge.vue'
const telemetry=useTelemetryStore(),status=useApiQuery('/api/operations/status',{realtime:true}),health=useApiQuery('/api/health')
function refresh(){status.load();health.load()}
</script>
<template><main class="connectivity-page"><PageHeading eyebrow="SYSTEM / HEALTH" title="System health" description="Reported server and connection state. Connectivity does not establish sensor accuracy or worker safety."><button @click="refresh">Refresh health</button></PageHeading><DataState :error="status.error.value||health.error.value" :loading="status.loading.value&&!status.data.value" @retry="refresh"/><div class="metric-grid"><MetricCard label="Persistence" :value="status.data.value?.persistence" detail="Backend-reported persistence state" icon="shield"/><MetricCard label="Database" :value="health.data.value?.database" detail="Health endpoint database check" icon="grid"/><MetricCard label="Server uptime" :value="status.data.value?`${status.data.value.uptimeSeconds} s`:undefined" detail="Current process uptime, not availability percentage" icon="history"/><MetricCard label="Realtime" :value="telemetry.connected?'Connected':'Offline'" detail="This browser's authenticated socket" icon="signal"/></div><section><h2>Telemetry pipeline</h2><dl><dt>Workspace mode</dt><dd>{{status.data.value?.mode??'Unavailable'}}</dd><dt>Last snapshot</dt><dd>{{status.data.value?.snapshotTimestamp??'Unavailable'}}</dd><dt>Snapshot sequence</dt><dd>{{status.data.value?.sequence??'Unavailable'}}</dd></dl><h3>Enrolled device states</h3><p v-if="!Object.keys(status.data.value?.devices??{}).length">No devices registered.</p><p v-for="(count,state) in status.data.value?.devices" :key="state"><StatusBadge :value="state"/> {{count}} devices</p></section></main></template>
