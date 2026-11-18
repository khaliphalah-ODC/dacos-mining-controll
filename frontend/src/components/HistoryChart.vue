<script setup>
import {computed} from 'vue'
import {historySeries} from '../services/history.js'
const props=defineProps({rows:{type:Array,default:()=>[]},metric:{type:String,default:''}})
const series=computed(()=>historySeries(props.rows)),points=computed(()=>series.value.flatMap(s=>s.points))
const bounds=computed(()=>{const p=points.value;if(!p.length)return null;const minX=Math.min(...p.map(p=>p.time)),maxX=Math.max(...p.map(p=>p.time)),minY=Math.min(...p.map(p=>p.value)),maxY=Math.max(...p.map(p=>p.value));return {minX,maxX,minY,maxY}})
const x=p=>50+(p.time-bounds.value.minX)/Math.max(1,bounds.value.maxX-bounds.value.minX)*550
const y=p=>175-(p.value-bounds.value.minY)/Math.max(1,bounds.value.maxY-bounds.value.minY)*145
</script>
<template><div class="history-chart"><p v-if="!points.length">Unavailable — no numeric recorded readings match these filters.</p><template v-else><svg viewBox="0 0 640 220" role="img" :aria-label="`${metric} historical readings; gaps are not interpolated`"><path d="M50 20 V175 H615" fill="none" stroke="#64748b"/><text x="2" y="30" fill="#cbd5e1" font-size="12">{{bounds.maxY.toFixed(2)}}</text><text x="2" y="175" fill="#cbd5e1" font-size="12">{{bounds.minY.toFixed(2)}}</text><g v-for="(s,i) in series" :key="i"><polyline :points="s.points.map(p=>`${x(p)},${y(p)}`).join(' ')" fill="none" :stroke="s.source==='hardware'?'#22d3ee':'#fbbf24'" stroke-width="2"/><circle v-for="(p,j) in s.points" :key="j" :cx="x(p)" :cy="y(p)" r="2.5" :fill="s.source==='hardware'?'#22d3ee':'#fbbf24'"/></g><text x="50" y="205" fill="#cbd5e1" font-size="11">{{new Date(bounds.minX).toISOString()}}</text><text x="615" y="205" text-anchor="end" fill="#cbd5e1" font-size="11">{{new Date(bounds.maxX).toISOString()}}</text></svg><p>Cyan: declared hardware · Amber: simulated · Units: {{[...new Set(series.map(s=>s.unit))].join(', ')}}. Only this page's recorded samples are plotted; gaps over 30 seconds (hardware/relay) or two minutes (sampled fixtures) are left open.</p></template></div></template>

<style scoped>.history-chart svg{display:block;width:100%;height:auto;min-height:160px}.history-chart>p{font-size:11px;line-height:1.8}</style>
