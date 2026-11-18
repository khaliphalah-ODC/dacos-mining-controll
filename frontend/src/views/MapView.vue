<script setup>

import {computed,ref} from 'vue'
import {RouterLink} from 'vue-router'
import {useTelemetryStore} from '../stores/telemetry.js'
import {qualityFor} from '../services/telemetry.js'
const telemetry=useTelemetryStore(),zoneId=ref(''),workerId=ref(''),zoom=ref(1),showPersonnel=ref(true),showZones=ref(true),showArtwork=ref(true)
const zones=computed(()=>telemetry.snapshot?.zones??[])
const workers=computed(()=>telemetry.workers.filter(w=>!zoneId.value||w.zoneId===zoneId.value))
const worker=computed(()=>telemetry.workers.find(w=>w.id===workerId.value)??null)
const reading=metric=>(telemetry.snapshot?.readings??[]).find(r=>r.workerId===worker.value?.id&&r.metric===metric)
const currentQuality=r=>r?qualityFor(r,{connected:telemetry.connected,now:telemetry.now,lastReceived:telemetry.lastReceived}):'unavailable'
const currentValue=metric=>{const r=reading(metric);return r&&r.value!==null&&!['unavailable','offline'].includes(currentQuality(r))?r.value:'—'}
const positions=computed(()=>telemetry.snapshot?.mode==='operational'?[]:(telemetry.snapshot?.readings??[]).filter(r=>r.metric==='position'&&r.simulation===true&&r.value&&typeof r.value==='object'&&!['unavailable','offline'].includes(r.quality)&&(!zoneId.value||r.zoneId===zoneId.value)))
const mapBox=computed(()=>{const z=zones.value.filter(z=>!zoneId.value||z.id===zoneId.value);if(!z.length)return '0 0 800 600';const xs=z.map(z=>z.geometry.x),ys=z.map(z=>z.geometry.y),w=Math.max(200,Math.max(...xs)-Math.min(...xs)+200),h=Math.max(160,Math.max(...ys)-Math.min(...ys)+160);const cx=(Math.min(...xs)+Math.max(...xs))/2,cy=(Math.min(...ys)+Math.max(...ys))/2;return `${cx-w/2/zoom.value} ${cy-h/2/zoom.value} ${w/zoom.value} ${h/zoom.value}`})

</script>
<template>
<main class="flex-1 pt-[68px] bg-surface w-full px-space-md py-space-md reference-page dacos_fictional_mine_map"><div class="flex flex-col w-full space-y-space-md">

<div class="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-space-sm px-space-md py-space-sm bg-tertiary-container/15 rounded-lg shadow-sm">
<div class="flex items-center gap-space-sm text-tertiary font-code-sm text-code-sm uppercase tracking-wider">
<span class="material-symbols-outlined text-[18px] text-tertiary animate-pulse">crisis_alert</span>
<span class="font-bold">FICTIONAL MINE SCHEMATIC // ADMINISTRATIVE ZONE GEOMETRY // NOT VERIFIED GPS // NO EMERGENCY EVACUATION ROUTING</span>
</div>
<div class="flex items-center gap-space-md font-code-sm text-code-sm text-on-surface-variant">
<span class="flex items-center gap-1.5"><span class="w-1.5 h-1.5 rounded-full bg-primary animate-ping"></span>{{telemetry.connected?"REALTIME CONNECTED":"REALTIME OFFLINE"}}</span>
<span>{{telemetry.snapshot?.mode??"Awaiting data"}}</span>
</div>
</div>

<div class="flex flex-col lg:flex-row lg:items-end justify-between gap-space-md">
<div class="space-y-space-xs">
<div class="flex items-center gap-2 font-code-sm text-code-sm text-on-surface-variant uppercase tracking-wider">
<span class="text-primary">Monitoring</span>
<span>/</span>
<span>Mine Map</span>
<span>/</span>
<span class="text-on-surface font-semibold">Subterranean Corridors &amp; Stopes</span>
</div>
<h1 class="font-headline-lg text-headline-lg text-on-surface tracking-tight">Subterranean Corridor Map &amp; Simulated Positioning</h1>
</div>

<div class="flex flex-wrap items-center gap-space-sm font-code-sm text-code-sm">
<div class="flex items-center gap-2 px-space-sm py-1.5 rounded-lg bg-surface-container-high text-on-surface">
<span class="w-2 h-2 rounded-full bg-primary"></span>
<span class="text-on-surface-variant">Mesh status:</span>
<span class="text-primary font-semibold">Unavailable</span>
</div>
<div class="flex items-center gap-2 px-space-sm py-1.5 rounded-lg bg-surface-container-high text-on-surface">
<span class="material-symbols-outlined text-[15px] text-primary">groups</span>
<span class="text-on-surface-variant">Registered personnel:</span>
<span class="font-semibold text-on-surface">{{telemetry.workers.length}} personnel</span>
</div>
<div class="flex items-center gap-2 px-space-sm py-1.5 rounded-lg bg-surface-container-high text-on-surface">
<span class="material-symbols-outlined text-[15px] text-tertiary">layers</span>
<span class="text-on-surface-variant">Active Layer:</span>
<span class="text-tertiary font-semibold">{{zoneId||"All configured zones"}}</span>
</div>
</div>
</div>

<div class="grid grid-cols-1 xl:grid-cols-12 gap-space-md min-h-[760px]">

<div class="xl:col-span-3 flex flex-col gap-space-md">

<div class="bg-surface-container-low rounded-xl p-space-md space-y-space-md shadow-sm">
<div class="flex items-center justify-between">
<div class="flex items-center gap-2">
<span class="material-symbols-outlined text-primary text-[20px]">stairs</span>
<span class="font-headline-sm text-headline-sm text-on-surface">Sub-Surface Strata</span>
</div>
<span class="font-code-sm text-code-sm text-primary uppercase">Z-Axis</span>
</div>

<div class="space-y-space-xs"><button :class="zoneId?'bg-surface-container':'bg-primary-container text-on-primary-container'" @click="zoneId=''" class="w-full text-left p-space-sm rounded-lg text-label-md">All registered zones</button><button :class="zoneId===z.id?'bg-primary-container text-on-primary-container':'bg-surface-container text-on-surface-variant'" :key="z.id" @click="zoneId=z.id" class="w-full flex justify-between gap-space-sm text-left p-space-sm rounded-lg text-label-md" v-for="z in zones"><span>{{z.name}}<small class="block text-code-sm">{{z.id}}</small></span><span>{{z.depth}} m</span></button><p class="text-label-sm text-outline" v-if="!zones.length">No zone configuration available.</p></div></div>

<div class="bg-surface-container-low rounded-xl p-space-md space-y-space-md shadow-sm">
<div class="flex items-center justify-between">
<div class="flex items-center gap-2">
<span class="material-symbols-outlined text-primary text-[20px]">layers_clear</span>
<span class="font-headline-sm text-headline-sm text-on-surface">Vector Overlays</span>
</div>
<span class="font-code-sm text-code-sm text-on-surface-variant uppercase">Filter</span>
</div>

<label class="flex gap-2 items-center text-label-sm"><input type="checkbox" v-model="showPersonnel"/>Backend simulated personnel ({{positions.length}})</label><label class="flex gap-2 items-center text-label-sm"><input type="checkbox" v-model="showZones"/>Administrative zone markers ({{zones.length}})</label><label class="flex gap-2 items-center text-label-sm"><input type="checkbox" v-model="showArtwork"/>Illustrative corridor artwork</label><p class="text-code-sm text-outline">Gateway, ventilation, exclusion and refuge layers have no verified data source.</p></div>

<div class="bg-surface-container-low rounded-xl p-space-md space-y-space-sm shadow-sm flex-1">
<div class="font-code-sm text-code-sm text-outline uppercase tracking-wider">SCADA Symbology Legend</div>
<div class="space-y-2 pt-1 font-label-sm text-label-sm text-on-surface-variant">
<div class="flex items-center gap-2.5">
<span class="w-3 h-3 rounded-full bg-primary inline-block"></span>
<span>Nominal Worker Telemetry (Active Beacon)</span>
</div>
<div class="flex items-center gap-2.5">
<span class="relative flex h-3 w-3">
<span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-error opacity-75"></span>
<span class="relative inline-flex rounded-full h-3 w-3 bg-error"></span>
</span>
<span class="text-error font-medium">Critical Metric / Threshold Violation</span>
</div>
<div class="flex items-center gap-2.5">
<span class="w-3 h-3 rounded-full bg-tertiary inline-block"></span>
<span>Stale Beacon Ping (&gt;60s Delay)</span>
</div>
<div class="flex items-center gap-2.5">
<span class="w-3 h-3 rounded-sm bg-surface-bright border-dashed border-2 border-primary inline-block"></span>
<span>Fixed Repeater Mesh / Gateway Node</span>
</div>
<div class="flex items-center gap-2.5">
<span class="w-3 h-3 rounded-sm bg-secondary inline-block"></span>
<span>Illustrative refuge symbol · Not certified</span>
</div>
</div>
</div>
</div>

<div class="xl:col-span-6 flex flex-col gap-space-sm bg-surface-container-lowest rounded-xl p-space-sm shadow-xl relative overflow-hidden">

<div class="flex items-center justify-between bg-surface-container-low px-space-md py-2 rounded-lg z-20">
<div class="flex items-center gap-space-md font-code-sm text-code-sm">
<div class="flex items-center gap-2">
<span class="text-primary font-bold">GRID:</span>
<span class="text-on-surface">Administrative geometry · Not geographic</span>
</div>
<div class="hidden sm:flex items-center gap-2 text-on-surface-variant">
<span>ELEV:</span>
<span class="text-tertiary font-semibold">Unverified</span>
</div>
</div>

<div class="flex items-center gap-1">
<button @click="zoom=Math.min(4,zoom*1.25)" aria-label="Zoom in" class="p-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface transition-colors" title="Zoom In">
<span class="material-symbols-outlined text-[18px]">add</span>
</button>
<button @click="zoom=Math.max(.5,zoom/1.25)" aria-label="Zoom out" class="p-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface transition-colors" title="Zoom Out">
<span class="material-symbols-outlined text-[18px]">remove</span>
</button>
<button @click="zoom=1;zoneId=''" aria-label="Reset map view" class="p-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface transition-colors" title="Fit to Extents">
<span class="material-symbols-outlined text-[18px]">crop_free</span>
</button>
<button @click="zoom=1;zoneId=''" aria-label="Reset map view" class="px-2 py-1 rounded-lg bg-surface-container hover:bg-surface-container-high text-primary font-code-sm text-code-sm transition-colors ml-1">
            RESET 2D
          </button>
</div>
</div>

<div class="relative flex-1 w-full min-h-[560px] bg-[#020b14] rounded-lg overflow-hidden flex items-center justify-center select-none">

<div class="absolute inset-0 opacity-20 pointer-events-none" style="background-image: radial-gradient(#4bdbcb 1px, transparent 1px); background-size: 32px 32px;"></div>

<svg aria-hidden="true" class="w-full h-full absolute inset-0 z-0 reference-map-artwork" :style="{transform:`scale(${zoom})`,transformOrigin:'center'}" fill="none" v-show="showArtwork" viewBox="0 0 800 600" xmlns="http://www.w3.org/2000/svg">
<defs>

<pattern height="12" id="blastHatch" patterntransform="rotate(45 0 0)" patternUnits="userSpaceOnUse" width="12">
<line opacity="0.65" stroke="#ffb4ab" stroke-width="2.5" x1="0" x2="0" y1="0" y2="12"></line>
</pattern>

<marker id="ventArrow" markerheight="6" markerwidth="6" orient="auto-start-reverse" refx="5" refy="5" viewBox="0 0 10 10">
<path d="M 0 0 L 10 5 L 0 10 z" fill="#4bdbcb"></path>
</marker>
</defs>


<path d="M 80 80 L 260 220 L 460 220 L 720 380" stroke="#192b3f" stroke-linecap="round" stroke-linejoin="round" stroke-width="48"></path>
<path d="M 80 80 L 260 220 L 460 220 L 720 380" stroke="#0d2134" stroke-linecap="round" stroke-linejoin="round" stroke-width="40"></path>

<path d="M 260 220 L 260 480 L 520 480" stroke="#192b3f" stroke-linecap="round" stroke-linejoin="round" stroke-width="40"></path>
<path d="M 260 220 L 260 480 L 520 480" stroke="#0d2134" stroke-linecap="round" stroke-linejoin="round" stroke-width="32"></path>

<path d="M 460 220 L 460 80 L 680 80" stroke="#192b3f" stroke-linecap="round" stroke-linejoin="round" stroke-width="40"></path>
<path d="M 460 220 L 460 80 L 680 80" stroke="#0d2134" stroke-linecap="round" stroke-linejoin="round" stroke-width="32"></path>

<path d="M 520 480 L 680 540" stroke="#192b3f" stroke-linecap="round" stroke-linejoin="round" stroke-width="32"></path>
<path d="M 520 480 L 680 540" stroke="#0d2134" stroke-linecap="round" stroke-linejoin="round" stroke-width="24"></path>

<path d="M 80 80 L 260 220 L 460 220 L 720 380" fill="none" stroke="#24364a" stroke-dasharray="6 4" stroke-width="1.5"></path>
<path d="M 260 220 L 260 480 L 520 480" fill="none" stroke="#24364a" stroke-dasharray="6 4" stroke-width="1.5"></path>
<path d="M 460 220 L 460 80 L 680 80" fill="none" stroke="#24364a" stroke-dasharray="6 4" stroke-width="1.5"></path>








<rect fill="#3a4a5f" height="40" rx="4" stroke="#4bdbcb" stroke-width="1.5" width="40" x="620" y="60"></rect>
<text fill="#4bdbcb" font-family="Inter" font-size="12" font-weight="700" text-anchor="middle" x="640" y="85">R-1</text>
<rect fill="#3a4a5f" height="40" rx="4" stroke="#4bdbcb" stroke-width="1.5" width="40" x="490" y="460"></rect>
<text fill="#4bdbcb" font-family="Inter" font-size="12" font-weight="700" text-anchor="middle" x="510" y="485">R-4</text>
</svg>























<svg :viewBox="mapBox" aria-label="Administrative zone markers and explicitly simulated backend movement; no verified physical positioning" class="absolute inset-0 w-full h-full z-10" role="img"><g v-if="showZones"><g :key="z.id" v-for="z in zones.filter(z=&gt;!zoneId||z.id===zoneId)"><rect :x="z.geometry.x-8" :y="z.geometry.y-8" fill="#192b3f" height="16" rx="3" stroke="#4bdbcb" width="16"></rect><text :x="z.geometry.x+13" :y="z.geometry.y" fill="#d1e4fe" font-size="8">{{z.name}}</text><text :x="z.geometry.x+13" :y="z.geometry.y+12" fill="#859491" font-size="6">{{z.depth}} m assigned · Not surveyed</text></g></g><g v-if="showPersonnel"><g :key="r.id" @click="workerId=r.workerId" class="cursor-pointer" v-for="r in positions"><circle :cx="r.value.x" :cy="r.value.y" fill="#ffb95f" r="4"></circle><text :x="r.value.x+6" :y="r.value.y+6" fill="#ffb95f" font-size="7">{{r.workerId}} · SIMULATED</text></g></g></svg><span class="absolute bottom-3 left-3 right-3 text-code-sm text-outline z-20 bg-surface-container-lowest/90 p-2 rounded">Illustrative corridor artwork. Registered coordinates do not establish physical worker positions.</span></div>

<div class="flex items-center justify-between px-space-md py-1.5 bg-surface-container-low rounded-lg text-on-surface-variant font-code-sm text-code-sm">
<div class="flex items-center gap-space-md">
<span>Administrative and backend simulation layers</span>
<span class="text-outline">|</span>
<span>Position accuracy: Unverified</span>
</div>
<div class="flex items-center gap-2 text-primary">
<span class="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
<span>Physical locations available through Hybrid Tracking</span>
</div>
</div>
</div>

<div class="xl:col-span-3 flex flex-col gap-space-md">

<div class="bg-surface-container-low rounded-xl p-space-md space-y-space-md shadow-sm relative overflow-hidden"><div class="flex items-center justify-between"><span class="text-code-sm text-primary uppercase">Worker inspector</span><span class="text-code-sm text-outline">Backend records</span></div><label class="block text-label-sm">Registered worker<select class="w-full bg-surface-container rounded-lg p-2 mt-2" v-model="workerId"><option value="">Select a worker</option><option :key="w.id" :value="w.id" v-for="w in workers">{{w.name}} · {{w.id}}</option></select></label><template v-if="worker"><div class="flex gap-space-sm items-center"><span class="w-12 h-12 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-headline-lg">{{worker.name?.charAt(0)}}</span><div><h2 class="text-headline-md font-semibold">{{worker.name}}</h2><p class="text-code-sm text-outline">{{worker.id}} · {{worker.role}}</p></div></div><div class="bg-surface-container rounded-lg p-space-sm text-label-sm space-y-2"><p>Assigned zone: {{worker.zoneId??'Unassigned'}}</p><p class="text-outline">Administrative assignment does not establish a physical position.</p><p>Associated gateway: Unavailable</p><p>RSSI / accuracy: Unavailable</p></div><h3 class="text-label-md font-semibold">Received physiological telemetry</h3><div class="grid grid-cols-3 gap-2"><div v-for="(label,metric) in {heartRate:'BPM',spo2:'SpO₂ %',temperature:'°C TEMP'}" :key="metric" class="bg-surface-container rounded-lg p-2"><span class="material-symbols-outlined text-primary text-[18px]">{{metric==='heartRate'?'favorite':metric==='spo2'?'vital_signs':'device_thermostat'}}</span><strong class="block text-telemetry-md">{{currentValue(metric)}}</strong><span class="block text-code-sm text-outline">{{label}}</span><span class="block text-code-sm text-on-surface-variant">{{reading(metric)?.simulation?'SIMULATED':currentQuality(reading(metric))}}</span></div></div><div class="flex flex-wrap gap-2 text-label-sm"><RouterLink :to="`/workers/${worker.id}`" class="bg-primary-container text-on-primary-container rounded-lg p-2">Full dossier</RouterLink><RouterLink :to="`/workers/${worker.id}/movement`" class="bg-surface-container-high rounded-lg p-2">Movement history</RouterLink></div></template><p class="text-label-sm text-outline py-space-lg" v-else="">Select a registered worker to inspect received telemetry.</p></div>

<div class="bg-surface-container-low rounded-xl p-space-md space-y-space-sm shadow-sm"><div class="flex gap-2 items-center text-tertiary"><span class="material-symbols-outlined">notification_important</span><h3 class="text-label-md font-semibold">Positioning context</h3></div><p class="text-label-sm text-on-surface-variant">No surveyed mine plan, evacuation route, blast clearance or refuge certification is established by this schematic.</p><RouterLink class="text-primary text-label-sm" to="/tracking">Device-reported locations →</RouterLink></div>
</div>
</div>
</div></main>
</template>
