<script setup>
import UiIcon from './UiIcon.vue'
defineProps({label:String,value:[String,Number],detail:String,icon:{type:String,default:'pulse'},tone:{type:String,default:'accent'}})
</script>
<template><article class="metric-card" :data-tone="tone"><div><span>{{label}}</span><UiIcon :name="icon"/></div><strong>{{value??'—'}}</strong><p>{{detail||'No data available'}}</p></article></template>
