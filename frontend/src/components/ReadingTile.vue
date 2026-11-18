<script setup>
import {computed} from 'vue'
import {useTelemetryStore} from '../stores/telemetry.js'
import {qualityFor} from '../services/telemetry.js'
import StatusBadge from './ui/StatusBadge.vue'
const props=defineProps({reading:Object,label:String}),telemetry=useTelemetryStore()
const quality=computed(()=>qualityFor(props.reading,{connected:telemetry.connected||telemetry.preview,now:telemetry.preview?Date.parse(telemetry.snapshot?.timestamp):telemetry.now,lastReceived:telemetry.preview?Date.parse(telemetry.snapshot?.timestamp):telemetry.lastReceived}))
const value=computed(()=>!props.reading||props.reading.value===null||['unavailable','offline'].includes(quality.value)?'Unavailable':typeof props.reading.value==='number'?`${props.reading.value} ${props.reading.unit}`:'Unsupported measurement')
</script>
<template><div class="reading-tile"><span class="stat-label">{{label||reading?.metric||'Measurement'}}</span><strong>{{value}}</strong><StatusBadge :value="quality"/><small v-if="reading" style="display:block;margin-top:10px">{{reading.simulation?'SIMULATED':reading.source}} · {{new Date(reading.timestamp).toLocaleTimeString()}}</small></div></template>
