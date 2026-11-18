<script setup>

import ZoneSchematic from '../components/ZoneSchematic.vue'
import PageHeading from '../components/ui/PageHeading.vue'
import StatusBadge from '../components/ui/StatusBadge.vue'
import WorkerLocationPanel from '../components/WorkerLocationPanel.vue'
import { useAuthStore } from '../stores/auth.js'
const auth=useAuthStore()
import { computed,ref } from 'vue'
import { useRoute, RouterLink } from 'vue-router'
import { useTelemetryStore } from '../stores/telemetry.js'
import { workerDetail } from '../services/worker-detail.js'
const route = useRoute()
const telemetry = useTelemetryStore()
const detail = computed(() => workerDetail(telemetry.snapshot, route.params.id, telemetry.now))
const position = computed(() => detail.value?.readings.find(r => r.metric === 'position' && r.simulation === true))

const tab=ref('summary')

</script>
<template>
<main class="flex-1 pt-[68px] bg-surface w-full px-space-md py-space-md reference-page dacos_worker_detail_peter_kollie_w_088"><p class="bg-error-container text-on-error-container rounded-lg p-space-md" role="alert" v-if="telemetry.error">{{telemetry.error}} <button @click="telemetry.stop();telemetry.start()">Reconnect</button></p><p class="p-space-lg text-outline" role="status" v-if="!telemetry.snapshot">Loading worker telemetry…</p><p class="p-space-lg text-outline" v-else-if="!detail">Worker not found. Select a valid worker from the directory.</p><div class="flex flex-col w-full gap-space-lg" v-if="detail">

<div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-space-sm px-space-md py-space-xs rounded-lg bg-surface-container-low border border-outline-variant/30 text-on-surface-variant font-code-sm text-code-sm"><RouterLink class="text-primary text-label-sm" to="/workers">← Back to Workers Directory</RouterLink><span class="text-code-sm text-tertiary">{{telemetry.snapshot?.simulation?"SIMULATED TELEMETRY":"HARDWARE VALIDATION PENDING"}}</span></div>

<div class="rounded-xl bg-surface-container-low p-space-md shadow-md flex flex-col xl:flex-row xl:items-center justify-between gap-space-lg relative overflow-hidden"><div class="flex items-center gap-space-md"><span class="w-16 h-16 rounded-xl bg-primary/10 text-primary text-headline-xl flex items-center justify-center">{{detail.worker.name?.charAt(0)}}</span><div><h1 class="text-headline-lg font-semibold">{{detail.worker.name}}</h1><p class="text-code-sm text-primary">{{detail.worker.id}} · {{detail.worker.role}}</p><p class="text-label-sm text-on-surface-variant mt-1">Shift {{detail.worker.shift}} · {{detail.zone?.name??'Zone unavailable'}}</p><p class="text-code-sm text-outline mt-2">{{telemetry.connected?detail.connection:'offline'}} · {{detail.device?.lastSeen??'No device receipt'}}</p></div></div><div class="flex flex-wrap gap-space-sm"><RouterLink :to="{path:'/history',query:{workerId:detail.worker.id}}" class="bg-surface-container-high rounded-lg p-2 text-label-md">Health history →</RouterLink><RouterLink :to="{path:'/operations/incidents',query:{workerId:detail.worker.id}}" class="bg-primary-container text-on-primary-container rounded-lg p-2 text-label-md">Incident console →</RouterLink></div></div>

<div class="flex items-center gap-space-xs overflow-x-auto pb-1 border-b border-outline-variant/30 text-label-md font-label-md"><button :aria-pressed="tab===key" :class="tab===key?'bg-primary/10 text-primary border-b-2 border-primary':'text-on-surface-variant'" :key="key" @click="tab=key" class="px-space-md py-2 whitespace-nowrap text-label-md rounded-t-lg" v-for="(label,key) in {summary:'Summary &amp; telemetry',health:'Health readings',environment:'Zone atmosphere',location:'Received location',incidents:'Incidents &amp; alerts',device:'Assigned wearable'}">{{label}}</button></div>

<div class="grid grid-cols-1 lg:grid-cols-12 gap-space-lg">

<div class="lg:col-span-5 flex flex-col gap-space-md" v-show="['summary','health','device'].includes(tab)"><section class="bg-surface-container rounded-xl p-space-md shadow-sm reference-form space-y-space-md"><div class="flex justify-between gap-space-sm"><h2>Physiological vitals</h2><span class="text-code-sm text-primary">{{detail.device?.source??(telemetry.snapshot.simulation?'SIMULATED':'Unavailable')}}</span></div><div class="bg-surface-container-low rounded-lg p-space-md"><span class="text-code-sm text-outline">Heart rate</span><strong class="block text-telemetry-lg my-space-sm">{{detail.measurement('heartRate')}}</strong><p class="text-code-sm text-outline">Received value and quality · No inferred diagnosis</p></div><div class="grid sm:grid-cols-2 gap-space-sm"><div :key="metric" class="bg-surface-container-low rounded-lg p-space-sm" v-for="(label,metric) in {spo2:'SpO₂',temperature:'Skin temperature',respiration:'Respiration',fatigue:'Fatigue'}"><span class="text-code-sm text-outline">{{label}}</span><strong class="block text-telemetry-md mt-2">{{detail.measurement(metric)}}</strong></div></div><p class="text-code-sm text-outline">Last-known values. Connection and safety status are independent.</p></section><section class="bg-surface-container rounded-xl p-space-md shadow-sm reference-form space-y-space-md"><h2>Assigned wearable</h2><dl class="space-y-space-sm text-label-sm"><div><dt class="text-outline">Device</dt><dd>{{detail.device?.id??telemetry.snapshot.devices.find(d=&gt;d.workerId===detail.worker.id)?.id??'Unavailable'}}</dd></div><div><dt class="text-outline">Method</dt><dd>{{detail.device?.transport??(telemetry.snapshot.simulation?'Backend scenario simulation':'Unavailable')}}</dd></div><div><dt class="text-outline">Connection</dt><dd>{{telemetry.connected?detail.connection:'offline'}}</dd></div><div><dt class="text-outline">Last received</dt><dd>{{detail.device?.lastSeen??'Unavailable'}}</dd></div><div><dt class="text-outline">Battery</dt><dd>{{detail.measurement('battery')}}</dd></div></dl></section></div>

<div class="lg:col-span-4 flex flex-col gap-space-md" v-show="['summary','environment'].includes(tab)"><section class="bg-surface-container rounded-xl p-space-md shadow-sm reference-form space-y-space-md"><h2>Zone atmosphere</h2><p>{{detail.zone?.name??'Zone unavailable'}}</p><p v-if="!detail.environment.length">No environmental measurements received.</p><div :key="r.id" class="bg-surface-container-low rounded-lg p-space-sm" v-for="r in detail.environment"><span class="text-code-sm text-outline">{{r.metric}}</span><strong class="block text-telemetry-md mt-2">{{r.value===null||['offline','unavailable'].includes(r.quality)?'Unavailable':`${r.value} ${r.unit}`}}</strong><span class="block text-code-sm text-primary mt-2">{{r.simulation?'SIMULATED':r.source}} · {{r.quality}}</span></div><p class="text-code-sm text-outline">No ventilation operation or physiological cause is inferred.</p></section></div>

<div class="lg:col-span-3 flex flex-col gap-space-md" v-show="['summary','location'].includes(tab)"><section class="bg-surface-container rounded-xl p-space-md shadow-sm reference-form space-y-space-md"><h2>Received worker location</h2><WorkerLocationPanel :worker-id="detail.worker.id"></WorkerLocationPanel><RouterLink class="text-primary text-label-sm" to="/map">Fictional mine schematic →</RouterLink><details class="text-label-sm mt-space-sm"><summary>Administrative schematic</summary><ZoneSchematic></ZoneSchematic></details></section></div>
</div>

<div class="grid grid-cols-1 lg:grid-cols-12 gap-space-lg" v-show="['summary','incidents'].includes(tab)">

<div class="lg:col-span-5 flex flex-col gap-space-md"><section class="bg-surface-container rounded-xl p-space-md shadow-sm reference-form space-y-space-md"><h2>Current alerts</h2><p v-if="!detail.alerts.length">No current scenario alerts.</p><article :key="a.id" class="bg-surface-container-low rounded-lg p-space-sm" v-for="a in detail.alerts"><span class="text-code-sm text-tertiary">{{a.severity}}</span><p>{{a.message}}</p></article><RouterLink :to="{path:'/operations/incidents',query:{workerId:detail.worker.id}}" class="text-primary text-label-sm">Review incident records →</RouterLink></section></div>

<div class="lg:col-span-7 flex flex-col gap-space-md"><section class="bg-surface-container rounded-xl p-space-md shadow-sm reference-form space-y-space-md"><h2>Incident timeline</h2><p v-if="!detail.events.length">No incident events.</p><p class="text-tertiary" v-if="detail.events.some(e=&gt;e.simulation)">SIMULATED SOS history · No emergency responders contacted.</p><ol><li :key="event.id??i" class="border-l border-outline-variant pl-space-md py-space-sm" v-for="(event,i) in detail.events"><time class="text-code-sm text-outline">{{event.timestamp}}</time><p class="text-label-md">{{event.message}}</p></li></ol></section></div>
</div>
</div>
</main>
</template>
