<script setup>
import { computed } from 'vue'
const props=defineProps({value:[String,Number],tone:String})
const color=computed(()=>props.tone??(/critical|revoked|error|offline|disconnected|rejected|inactive/i.test(String(props.value))?'danger':/stale|pending|simulat|warning|high/i.test(String(props.value))?'warning':/connected|current|approved|active|resolved/i.test(String(props.value))?'accent':'neutral'))
</script>
<template><span class="status-badge" :data-tone="color"><span class="status-point"></span><slot>{{value??'Unavailable'}}</slot></span></template>
