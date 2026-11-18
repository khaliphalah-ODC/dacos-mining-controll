<script setup>

import PageHeading from '../components/ui/PageHeading.vue'
import { ref, computed, onBeforeUnmount } from 'vue'
import { RouterLink } from 'vue-router'
import { useTelemetryStore } from '../stores/telemetry.js'
import { BleGateway, DEMO_SERVICE, DEMO_CHARACTERISTIC } from '../services/ble-gateway.js'
import { deviceRequest, createDeviceSender } from '../services/device-client.js'
const telemetry = useTelemetryStore()
const supported = window.isSecureContext && !!navigator.bluetooth
const code = ref(''), workerId = ref(''), demo = ref(false), service = ref(DEMO_SERVICE), characteristic = ref(DEMO_CHARACTERISTIC)
const error = ref(''), status = ref({ connected: false }), ack = ref(null), busy = ref(false), registration = ref(null), selected = ref(false)
const available = computed(() => telemetry.workers.filter(w => !(telemetry.snapshot?.deviceSessions ?? []).some(d => d.workerId === w.id && d.connectionStatus !== 'revoked')))
let send
const gateway = new BleGateway({ bluetooth: navigator.bluetooth, secure: window.isSecureContext,
  onReading: async metrics => { ack.value = await send(metrics); lastMetrics.value=metrics },
  onStatus: value => { status.value = value }, onError: e => { error.value = e.message },
})
async function act(work) { busy.value = true; error.value = ''; try { await work() } catch (e) { error.value = e.message } finally { busy.value = false } }
async function pair() { await act(async () => { registration.value = await deviceRequest('/api/devices/register', { code: code.value.trim(), workerId: workerId.value, transport: 'ble-gateway', source: demo.value ? 'simulator' : 'hardware' }); send = createDeviceSender(registration.value); code.value = '' }) }
async function choose() { await act(async () => { await gateway.choose({ demo: demo.value, service: service.value, characteristic: characteristic.value }); selected.value = true }) }
async function stop() { gateway.disconnect(); await act(async () => { ack.value = await send([], { connectionStatus: 'disconnected' }) }) }
onBeforeUnmount(() => gateway.disconnect())

const lastMetrics=ref([])
const latest=(metric)=>{const r=lastMetrics.value.find(r=>r.metric===metric);return r?`${r.value} ${r.unit}`:"Unavailable"}

</script>
<template>
<main class="flex-1 pt-[68px] bg-surface w-full px-space-md py-space-md reference-page"><p class="bg-error-container text-on-error-container rounded-lg p-space-md mb-space-md" role="alert" v-if="error">{{error}}</p><div class="flex flex-col w-full">

<div class="w-full bg-surface-container-high rounded-xl p-space-md mb-space-md shadow-md flex flex-col md:flex-row md:items-center justify-between gap-space-sm">
<div class="flex items-center gap-space-sm">
<div class="p-2 rounded-lg bg-tertiary-container/30 text-tertiary flex items-center justify-center shrink-0">
<span class="material-symbols-outlined text-[20px]">science</span>
</div>
<div class="flex flex-col min-w-0">
<div class="flex items-center gap-2 flex-wrap">
<span class="font-code-sm text-code-sm text-tertiary tracking-wider uppercase font-semibold">WEB BLUETOOTH DEMONSTRATION GATEWAY</span>
<span class="px-2 py-0.5 rounded bg-surface-variant text-on-surface-variant font-code-sm text-code-sm">EXPERIMENTAL LAB // HARDWARE PROBING</span>
</div>
<p class="font-body-md text-body-md text-on-surface-variant truncate">
          BROWSER-ASSISTED HARDWARE PROBING — DEMO CHARACTERISTICS STAY LABELLED SIMULATED • NEVER USE AS CERTIFIED DISPATCH
        </p>
</div>
</div>
<div class="flex items-center gap-2 shrink-0">
<span class="inline-block w-2 h-2 rounded-full bg-primary animate-ping"></span>
<span class="font-code-sm text-code-sm text-primary uppercase font-semibold">DACOS BLE GATEWAY</span>
</div>
</div>

<div class="w-full bg-surface-container rounded-xl p-space-md mb-space-lg shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-space-md">
<div class="flex items-start sm:items-center gap-space-md min-w-0">
<div class="p-3 rounded-xl bg-primary/10 text-primary shrink-0">
<span class="material-symbols-outlined text-[24px]">bluetooth_searching</span>
</div>
<div class="flex flex-col">
<div class="flex items-center gap-space-sm flex-wrap">
<span class="font-headline-sm text-headline-sm text-on-surface">Web Bluetooth API Status</span>
<span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-primary/15 text-primary font-code-sm text-code-sm font-semibold">
<span class="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>{{supported?"SUPPORTED IN THIS BROWSER":"WEB BLUETOOTH UNAVAILABLE"}}</span>
</div>
<p class="font-body-md text-body-md text-on-surface-variant mt-1">A supported secure browser reads explicitly approved GATT peripherals and relays accepted packets to the DACOS telemetry API.</p>
</div>
</div>
<div class="flex items-center gap-2 self-start lg:self-center shrink-0">
<div class="px-3 py-1.5 rounded-lg bg-surface-container-high font-code-sm text-code-sm text-on-surface-variant">
        WS BRIDGE: <span class="text-primary font-semibold">Authenticated HTTPS ingestion</span>
</div>
<button @click='error=supported?"":"Web Bluetooth is unavailable in this browser or context."' class="px-3 py-1.5 rounded-lg bg-surface-variant text-on-surface hover:bg-surface-bright transition-colors font-label-md text-label-md flex items-center gap-1.5">
<span class="material-symbols-outlined text-[16px]">sync</span>
        Check Driver
      </button>
</div>
</div>

<div class="grid grid-cols-1 xl:grid-cols-12 gap-space-lg mb-space-lg">

<div class="xl:col-span-7 flex flex-col gap-space-lg">

<section class="bg-surface-container rounded-xl p-space-md shadow-sm">
<div class="flex items-center justify-between mb-space-md">
<div class="flex items-center gap-space-sm">
<span class="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-on-primary font-code-sm text-code-sm font-bold">1</span>
<h2 class="font-headline-sm text-headline-sm text-on-surface">Target Worker &amp; Ingestion Context</h2>
</div>
<span class="font-code-sm text-code-sm text-primary uppercase tracking-wider flex items-center gap-1">
<span class="material-symbols-outlined text-[14px]">verified</span>{{registration?"Gateway registered":"Registration required"}}</span>
</div>
<div class="grid grid-cols-1 sm:grid-cols-3 gap-space-md bg-surface-container-low rounded-lg p-space-md"><label class="flex flex-col text-code-sm text-outline uppercase">Target Personnel<select :disabled="!!registration" aria-label="Target worker" class="mt-2 bg-surface-container text-on-surface rounded-lg p-2" v-model="workerId"><option disabled="" value="">Select a registered worker</option><option :key="w.id" :value="w.id" v-for="w in available">{{w.id}} · {{w.name}}</option></select></label><div class="flex flex-col"><span class="text-code-sm text-outline uppercase">Target Wearable ID</span><span class="text-primary text-label-md mt-2">{{registration?.deviceId??'Not registered'}}</span><span class="text-code-sm text-outline mt-1">{{registration?.source??'Awaiting registration'}}</span></div><label class="flex flex-col text-code-sm text-outline uppercase">Pairing code from laptop<input :disabled="!!registration" autocomplete="off" class="mt-2 bg-surface-container text-on-surface rounded-lg p-2" v-model="code"/><button :disabled="!supported||busy||!!registration||!code||!workerId" @click="pair" class="mt-2 bg-primary-container text-on-primary-container rounded-lg p-2">Register gateway</button></label></div>
<label class="flex items-center gap-2 mt-space-md text-label-sm"><input :disabled="!!registration" type="checkbox" v-model="demo"/>DACOS demo peripheral (simulated data)</label><div class="grid sm:grid-cols-2 gap-space-sm mt-space-sm" v-if="demo"><label class="text-label-sm">Demo service UUID<input :disabled="!!registration" class="w-full bg-surface-container-low rounded p-2" v-model="service"/></label><label class="text-label-sm">Demo characteristic UUID<input :disabled="!!registration" class="w-full bg-surface-container-low rounded p-2" v-model="characteristic"/></label></div></section>

<section class="bg-surface-container rounded-xl p-space-md shadow-sm flex flex-col flex-1">
<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm mb-space-md">
<div class="flex items-center gap-space-sm">
<span class="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-on-primary font-code-sm text-code-sm font-bold">2</span>
<h2 class="font-headline-sm text-headline-sm text-on-surface">Peripheral Scanner &amp; GATT Explorer</h2>
</div>
<div class="flex items-center gap-2">
<button :disabled="!supported||busy||!registration||status.connected" @click="choose" class="px-space-md py-2 rounded-lg bg-primary-container text-on-primary-container hover:bg-primary font-label-md text-label-md font-semibold transition-all flex items-center gap-2 shadow-sm" id="scanBtn">
<span class="material-symbols-outlined text-[18px]" id="scanIcon">bluetooth_searching</span>
<span id="scanText">Scan for Nearby BLE Peripherals</span>
</button>
</div>
</div>






<div class="h-12 bg-surface-container-lowest rounded-lg mb-space-md px-space-md flex items-center justify-between text-code-sm"><span>Browser-mediated peripheral selection</span><span class="text-primary">{{status.connected?'CONNECTED':'DISCONNECTED'}}</span></div><div class="bg-surface-container-low rounded-lg p-space-md flex items-center justify-between gap-space-sm"><div class="flex gap-space-sm"><span class="material-symbols-outlined text-primary">watch</span><div class="text-label-md">{{status.deviceId??'No peripheral selected'}}<p class="text-code-sm text-outline mt-1">{{selected?'Approved browser peripheral':'Choose a compatible GATT device to begin'}}</p></div></div><span class="text-code-sm text-primary">{{status.connected?'LINKED':'AWAITING LINK'}}</span></div><div class="mt-space-md pt-space-md border-t border-outline-variant/40"><p class="text-code-sm text-outline uppercase">GATT Services &amp; UUID Registry</p><div class="bg-surface-container-low rounded-lg p-space-sm mt-space-sm text-label-sm"><p class="text-primary">{{demo?service:'0x180D · Heart Rate Service'}}</p><p class="text-on-surface-variant mt-2">Characteristic: {{demo?characteristic:'0x2A37 · Heart Rate Measurement'}}</p><p class="text-outline mt-2">{{status.connected?'Subscribed to supported characteristic':'Notifications unavailable until connected'}}</p></div></div></section>
</div>

<div class="xl:col-span-5 flex flex-col gap-space-lg">

<section class="bg-surface-container rounded-xl p-space-md shadow-sm flex flex-col flex-1">
<div class="flex items-center justify-between mb-space-md">
<div class="flex items-center gap-space-sm">
<span class="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-on-primary font-code-sm text-code-sm font-bold">3</span>
<h2 class="font-headline-sm text-headline-sm text-on-surface">Dual Link Ingestion Matrix</h2>
</div>
<span class="px-2 py-0.5 rounded bg-primary-container/20 text-primary font-code-sm text-code-sm font-semibold">{{status.connected&amp;&amp;ack?"RELAY ACTIVE":"AWAITING DATA"}}</span>
</div>

<div class="p-space-sm bg-error-container/20 rounded-lg mb-space-md">
<div class="flex items-start gap-2">
<span class="material-symbols-outlined text-[18px] text-error shrink-0 mt-0.5">warning</span>
<p class="font-code-sm text-code-sm text-error leading-relaxed">
              OPERATIONAL PROTOCOL: A physical Bluetooth radio link does NOT establish verified worker medical safety. Packets remain labeled <strong>SIMULATED</strong>A physical Bluetooth connection does not establish worker safety. Demo packets are labelled simulated; supported standard peripheral readings are labelled hardware. Hardware validation is pending.</p>
</div>
</div>
<div class="space-y-space-md">

<div class="bg-surface-container-high rounded-xl p-space-md shadow-sm">
<div class="flex items-center justify-between mb-2">
<span class="font-code-sm text-code-sm uppercase tracking-wider text-outline flex items-center gap-1.5">
<span class="material-symbols-outlined text-[14px]">settings_input_antenna</span>
                Physical BLE Link Layer
              </span>
<span class="px-2 py-0.5 rounded bg-primary/20 text-primary font-code-sm text-code-sm font-semibold">{{status.connected?"RADIO LINK: UP":"RADIO LINK: DOWN"}}</span>
</div>
<div class="grid grid-cols-3 gap-2 text-center py-2 bg-surface-container rounded-lg">
<div class="flex flex-col">
<span class="font-code-sm text-code-sm text-outline">Negotiated MTU</span>
<span class="font-telemetry-md text-telemetry-md text-on-surface font-mono" id="mtuDisplay">Unavailable</span>
</div>
<div class="flex flex-col">
<span class="font-code-sm text-code-sm text-outline">PHY Bandwidth</span>
<span class="font-telemetry-md text-telemetry-md text-primary font-mono">Unavailable</span>
</div>
<div class="flex flex-col">
<span class="font-code-sm text-code-sm text-outline">Link RSSI</span>
<span class="font-telemetry-md text-telemetry-md text-tertiary font-mono" id="rssiDisplay">Unavailable</span>
</div>
</div>
<div class="flex items-center justify-between text-on-surface-variant font-code-sm text-code-sm mt-3 pt-2">
<span>Connection interval: Unavailable</span>
<span>Slave latency: Unavailable</span>
<span>Supervision: Unavailable</span>
</div>
</div>

<div class="bg-surface-container-high rounded-xl p-space-md shadow-sm">
<div class="flex items-center justify-between mb-2">
<span class="font-code-sm text-code-sm uppercase tracking-wider text-outline flex items-center gap-1.5">
<span class="material-symbols-outlined text-[14px]">cloud_sync</span>
                Backend SCADA Ingestion Stream
              </span>
<span class="px-2 py-0.5 rounded bg-primary-container/20 text-primary font-code-sm text-code-sm font-semibold">{{ack?"SERVER ACKNOWLEDGED":"NO ACKNOWLEDGEMENT"}}</span>
</div>
<div class="grid grid-cols-3 gap-2 text-center py-2 bg-surface-container rounded-lg">
<div class="flex flex-col">
<span class="font-code-sm text-code-sm text-outline">Stream Freshness</span>
<span class="font-telemetry-md text-telemetry-md text-primary font-mono" id="freshnessDisplay">{{status.lastSeen??"Unavailable"}}</span>
</div>
<div class="flex flex-col">
<span class="font-code-sm text-code-sm text-outline">Ingest Frequency</span>
<span class="font-telemetry-md text-telemetry-md text-on-surface font-mono">Unavailable</span>
</div>
<div class="flex flex-col">
<span class="font-code-sm text-code-sm text-outline">Dropped Frames</span>
<span class="font-telemetry-md text-telemetry-md text-primary font-mono">Unavailable</span>
</div>
</div>
<div class="flex items-center justify-between text-on-surface-variant font-code-sm text-code-sm mt-3 pt-2">
<span>Ingest target: DACOS telemetry API</span>
<span>Queue buffer: Unavailable</span>
</div>
</div>

<div class="bg-surface-container-lowest rounded-xl p-space-md">
<div class="flex items-center justify-between mb-2">
<span class="font-code-sm text-code-sm text-outline uppercase">Stream Latency (Last 60s)</span>
<span class="font-code-sm text-code-sm text-primary font-mono">Not measured</span>
</div>
<div class="h-16 w-full flex items-end">
<svg aria-label="Latency measurements unavailable" class="w-full h-full text-primary" preserveaspectratio="none" viewbox="0 0 100 30"></svg>
</div>
</div>
</div>
</section>
</div>
</div>

<section class="bg-surface-container rounded-xl p-space-md shadow-lg flex flex-col">

<div class="flex flex-col lg:flex-row lg:items-center justify-between gap-space-md pb-space-md mb-space-md">
<div>
<div class="flex items-center gap-space-sm flex-wrap">
<h2 class="font-headline-sm text-headline-sm text-on-surface">Raw GATT Characteristic Stream &amp; Decoded Packets</h2>
<span class="px-2 py-0.5 rounded bg-surface-variant text-on-surface-variant font-code-sm text-code-sm font-mono">Accepted supported measurements</span>
</div>
<p class="font-body-md text-body-md text-on-surface-variant">
          Live dissection of incoming binary payloads transmitted over Web Bluetooth GATT notification sockets.
        </p>
</div>
<div class="flex items-center gap-2 flex-wrap">
<button class="px-3 py-2 rounded-lg bg-surface-variant hover:bg-surface-bright text-on-surface transition-colors font-label-md text-label-md flex items-center gap-1.5" disabled="" title="Not supported by the current gateway">
<span class="material-symbols-outlined text-[16px]">tune</span>
          Re-negotiate MTU
        </button>
<button class="px-3 py-2 rounded-lg bg-surface-variant hover:bg-surface-bright text-on-surface transition-colors font-label-md text-label-md flex items-center gap-1.5" disabled="" title="Not supported by the current gateway">
<span class="material-symbols-outlined text-[16px]">download</span>
          Export GATT Log
        </button>
<button :disabled="busy||!status.connected" @click="stop" class="px-3 py-2 rounded-lg bg-error-container text-on-error-container hover:bg-error/80 transition-colors font-label-md text-label-md font-semibold flex items-center gap-1.5">
<span class="material-symbols-outlined text-[16px]">link_off</span>
          Disconnect Peripheral
        </button>
</div>
</div>

<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-md mb-space-md">

<div class="bg-surface-container-high rounded-xl p-space-md relative overflow-hidden">
<div class="flex items-center justify-between text-outline mb-1">
<span class="font-code-sm text-code-sm uppercase">Biometric Heart Rate</span>
<span class="material-symbols-outlined text-[18px] text-error">favorite</span>
</div>
<div class="flex items-baseline gap-2">
<span class="font-telemetry-lg text-telemetry-lg text-on-surface font-mono" id="valHeartRate">{{latest("heartRate")}}</span>
<span class="font-label-sm text-label-sm text-outline">BPM</span>
</div>
<div class="flex items-center justify-between mt-2 pt-2 text-on-surface-variant font-code-sm text-code-sm">
<span>Contact verification: Unavailable</span>
<span class="text-primary font-mono font-semibold">SIG 0x2A37</span>
</div>
</div>

<div class="bg-surface-container-high rounded-xl p-space-md relative overflow-hidden">
<div class="flex items-center justify-between text-outline mb-1">
<span class="font-code-sm text-code-sm uppercase">RR-Interval Variability</span>
<span class="material-symbols-outlined text-[18px] text-primary">ecg_heart</span>
</div>
<div class="flex items-baseline gap-2">
<span class="font-telemetry-lg text-telemetry-lg text-on-surface font-mono" id="valRRInterval">Unavailable</span>
<span class="font-label-sm text-label-sm text-outline">MS</span>
</div>
<div class="flex items-center justify-between mt-2 pt-2 text-on-surface-variant font-code-sm text-code-sm">
<span>RMSSD: Unavailable</span>
<span class="text-primary font-mono font-semibold">RAW SAMPLE</span>
</div>
</div>

<div class="bg-surface-container-high rounded-xl p-space-md relative overflow-hidden">
<div class="flex items-center justify-between text-outline mb-1">
<span class="font-code-sm text-code-sm uppercase">Wearable Battery State</span>
<span class="material-symbols-outlined text-[18px] text-primary">battery_charging_80</span>
</div>
<div class="flex items-baseline gap-2">
<span class="font-telemetry-lg text-telemetry-lg text-on-surface font-mono" id="valBattery">{{latest("battery")}}</span>
<span class="font-label-sm text-label-sm text-outline">%</span>
</div>
<div class="flex items-center justify-between mt-2 pt-2 text-on-surface-variant font-code-sm text-code-sm">
<span>Cell voltage: Unavailable</span>
<span class="text-primary font-mono font-semibold">SIG 0x2A19</span>
</div>
</div>

<div class="bg-surface-container-high rounded-xl p-space-md relative overflow-hidden">
<div class="flex items-center justify-between text-outline mb-1">
<span class="font-code-sm text-code-sm uppercase">Synthetic Ambient Gas</span>
<span class="material-symbols-outlined text-[18px] text-tertiary">co2</span>
</div>
<div class="flex items-baseline gap-2">
<span class="font-telemetry-lg text-telemetry-lg text-tertiary font-mono" id="valGas">Unavailable</span>
<span class="font-label-sm text-label-sm text-outline">% CH4</span>
</div>
<div class="flex items-center justify-between mt-2 pt-2 text-on-surface-variant font-code-sm text-code-sm">
<span>Gas characteristic unsupported</span>
<span class="text-tertiary font-mono font-semibold">VENDOR FFE1</span>
</div>
</div>
</div>

<div class="bg-surface-container-lowest rounded-xl overflow-hidden">
<div class="p-space-sm bg-surface-container-high/60 flex items-center justify-between">
<div class="flex items-center gap-2">
<span class="w-2.5 h-2.5 rounded-full bg-primary animate-pulse"></span>
<span class="font-code-sm text-code-sm text-on-surface uppercase tracking-wider font-semibold">Real-Time GATT Notification Frames (Raw Hex Dissector)</span>
</div>
<span class="font-code-sm text-code-sm text-outline font-mono">Raw hex frames are not retained</span>
</div>
<div class="overflow-x-auto">
<table class="w-full text-left font-mono font-code-sm text-code-sm">
<thead class="bg-surface-container-high text-outline uppercase">
<tr>
<th class="py-2.5 px-space-md">Time (UTC)</th>
<th class="py-2.5 px-space-md">Service UUID</th>
<th class="py-2.5 px-space-md">Handle</th>
<th class="py-2.5 px-space-md">Raw Hex Octets</th>
<th class="py-2.5 px-space-md">Parsed Value Interpretation</th>
<th class="py-2.5 px-space-md text-right">Verification</th>
</tr>
</thead>
<tbody class="divide-y-0 text-on-surface-variant" id="rawGattStream"><tr><td class="p-space-lg text-outline" colspan="6">Raw hex logging is unavailable. Accepted values are shown above after server relay.</td></tr></tbody>
</table>
</div>
</div>
<div class="flex flex-wrap gap-space-sm mt-space-md"><button :disabled="busy||!selected||status.connected" @click="act(()=&gt;gateway.reconnect())" class="bg-surface-container-high rounded-lg p-2 text-primary">Reconnect selected peripheral</button><RouterLink :to="`/workers/${registration.workerId}`" class="text-primary p-2" v-if="registration">Worker detail →</RouterLink></div><p class="text-code-sm text-outline mt-space-sm" role="status">Server acknowledgement: {{ack?'Received':'Unavailable'}}</p></section>

<div class="fixed bottom-6 right-6 px-space-md py-space-sm bg-surface-container-highest text-on-surface rounded-xl shadow-2xl transition-all duration-300 opacity-0 pointer-events-none flex items-center gap-2 z-50" id="toastMessage">
<span class="material-symbols-outlined text-[20px] text-primary" id="toastIcon">info</span>
<span class="font-label-md text-label-md" id="toastText"></span>
</div>

</div></main>
</template>
