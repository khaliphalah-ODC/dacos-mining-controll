<script setup>

import ScenarioControls from '../components/ScenarioControls.vue'
import PageHeading from '../components/ui/PageHeading.vue'
import { ref, computed, onBeforeUnmount } from 'vue'
import { RouterLink } from 'vue-router'
import { useTelemetryStore } from '../stores/telemetry.js'
import { deviceRequest, createDeviceSender } from '../services/device-client.js'
const telemetry = useTelemetryStore()
const code = ref(''), pairing = ref(null), workerId = ref(''), registration = ref(null)
const error = ref(''), acknowledgement = ref(null), running = ref(false), busy = ref(false)
const heartRate = ref(78), temperature = ref(37.1), spo2 = ref(98), battery = ref(92)
const secure = window.isSecureContext
const available = computed(() => telemetry.workers.filter(w => !(telemetry.snapshot?.deviceSessions ?? []).some(d => d.workerId === w.id && d.connectionStatus !== 'revoked')))
let timer, send, active = true
async function act(work) { busy.value = true; error.value = ''; try { await work() } catch (e) { error.value = e.message; clearInterval(timer); running.value = false } finally { busy.value = false } }
async function pair() {
  await act(async () => { registration.value = await deviceRequest('/api/devices/register', { code: code.value.trim(), workerId: workerId.value, transport: 'wifi', source: 'simulator' }); send = createDeviceSender(registration.value); code.value = '' })
}
const metrics = () => [{ metric: 'heartRate', value: heartRate.value, unit: 'bpm' }, { metric: 'temperature', value: temperature.value, unit: '°C' }, { metric: 'spo2', value: spo2.value, unit: '%' }, { metric: 'battery', value: battery.value, unit: '%' }]
async function transmit(options) { acknowledgement.value = await send(metrics(), options) }
async function start() { await act(async () => { await transmit(); if (!active) return; running.value = true; timer = setInterval(() => { if (!busy.value) act(() => transmit()) }, 3000) }) }
async function stop() { clearInterval(timer); running.value = false; await act(() => transmit({ connectionStatus: 'disconnected' })) }
onBeforeUnmount(() => { active = false; clearInterval(timer) })

</script>
<template>
<main class="flex-1 pt-[68px] bg-surface w-full px-space-md py-space-md reference-page dacos_wi_fi_device_simulator"><p class="bg-error-container text-on-error-container rounded-lg p-space-md" role="alert" v-if="error">{{error}}</p><p class="bg-surface-container-high text-tertiary p-space-md rounded-lg" role="alert" v-if="!secure">Use HTTPS or secure localhost before pairing.</p><p class="bg-surface-container-high text-tertiary p-space-md rounded-lg" role="status" v-if="telemetry.snapshot?.mode==='operational'">Operational mode accepts hardware only. Wi-Fi simulation requires demo mode.</p><div class="flex flex-col w-full">
<section class="mb-space-md w-full rounded-lg bg-tertiary-container/15 p-space-md text-tertiary shadow-md">
<div class="flex flex-col md:flex-row md:items-center justify-between gap-space-sm">
<div class="flex items-start gap-space-sm">
<span class="material-symbols-outlined text-[24px] text-tertiary shrink-0 mt-0.5">warning</span>
<div>
<span class="font-code-sm text-code-sm tracking-wider uppercase font-semibold block text-tertiary-fixed">
            SIMULATED TELEMETRY LAB — EXPERIMENTAL TESTBENCH // NOT CONNECTED TO CERTIFIED HARDWARE // NEVER USED FOR ACTUAL EMERGENCY DISPATCH
          </span>
<p class="font-body-md text-body-md text-on-surface-variant mt-0.5">Simulation uses the real authenticated DACOS ingestion endpoint. Samples and SOS remain explicitly simulated. No external emergency dispatch is connected.</p>
</div>
</div>
<div class="flex items-center gap-space-xs self-start md:self-auto shrink-0 bg-surface-container-lowest px-space-sm py-1 rounded">
<span class="w-2 h-2 rounded-full bg-tertiary animate-pulse"></span>
<span class="font-code-sm text-code-sm text-tertiary uppercase tracking-widest">SIMULATED INPUTS</span>
</div>
</div>
</section>
<section class="mb-space-lg flex flex-col lg:flex-row lg:items-end justify-between gap-space-md">
<div>
<div class="flex items-center gap-2 mb-1">
<span class="font-code-sm text-code-sm uppercase tracking-widest text-primary font-semibold">DEVICE LAB // NODE VIRTUALIZER</span>
<span class="text-outline">/</span>
<span class="font-code-sm text-code-sm text-on-surface-variant uppercase">LIB-EXT-SUBMESH-SIM-09</span>
</div>
<h1 class="font-headline-xl text-headline-xl text-on-surface tracking-tight">
        Wi-Fi Device Simulator
      </h1>
<p class="font-body-md text-body-md text-on-surface-variant max-w-2xl mt-1">
        Configure emulated wearable telemetry packs, inject physiological anomalies, and stress-test SCADA ingestion pipelines across simulated Liberian mining tunnels.
      </p>
</div>
<div class="flex items-center gap-space-sm flex-wrap"><div class="bg-surface-container rounded-lg p-space-md text-code-sm"><span class="text-outline">Registered in this tab</span><strong class="block text-telemetry-md">{{registration?1:0}}</strong></div><div class="bg-surface-container rounded-lg p-space-md text-code-sm"><span class="text-outline">Transmitter state</span><strong class="block text-primary">{{running?"Transmitting":"Stopped"}}</strong></div></div>
</section>
<div class="grid grid-cols-1 lg:grid-cols-12 gap-space-lg items-start">
<div class="lg:col-span-7 flex flex-col gap-space-md"><section class="bg-surface-container rounded-xl p-space-md shadow-sm reference-form space-y-space-md"><h2>1. Create a pairing code on your laptop</h2><button :disabled="!secure || busy" @click="act(async () =&gt; pairing = await deviceRequest('/api/device-pairing', {}))">Create single-use code</button><p v-if="pairing"><code>{{ pairing.code }}</code><br/>Expires {{ pairing.expiresAt }}. Enter this code on the phone.</p><div :key="d.id" v-for="d in telemetry.snapshot?.deviceSessions ?? []"><p>{{ d.workerId }} · {{ d.transport }} · {{ d.id }}</p><button :disabled="busy" @click="act(() =&gt; deviceRequest(`/api/devices/${d.id}/revoke`, {}))">Revoke pairing on laptop</button></div></section><section class="bg-surface-container rounded-xl p-space-md reference-form" v-if="!registration"><h2>Interactive simulated telemetry</h2><p>Operator-controlled simulation inputs. Pair a test device before transmission.</p><label>Heart rate · {{heartRate}} bpm<input max="250" min="0" type="range" v-model.number="heartRate"/></label><label>Skin temperature · {{temperature}} °C<input max="50" min="20" step="0.1" type="range" v-model.number="temperature"/></label><label>SpO₂ · {{spo2}}%<input max="100" min="0" type="range" v-model.number="spo2"/></label><label>Battery · {{battery}}%<input max="100" min="0" type="range" v-model.number="battery"/></label></section><section class="bg-surface-container rounded-xl p-space-md shadow-sm reference-form space-y-space-md" v-if="!registration"><h2>2. Register this phone</h2><label>Pairing code<input autocomplete="off" v-model="code"/></label><label>Registered worker<select v-model="workerId"><option disabled="" value="">Select a registered worker</option><option :key="w.id" :value="w.id" v-for="w in available">{{ w.id }} · {{ w.name }}</option></select></label><p v-if="!available.length">No available workers, or telemetry is loading.</p><button :disabled="!secure||busy||!code||!workerId||!available.length||telemetry.snapshot?.mode==='operational'" @click="pair">Pair test device</button></section><section class="bg-surface-container rounded-xl p-space-md shadow-sm reference-form space-y-space-md" v-else=""><h2>3. Send simulated readings</h2><p>Device {{ registration.deviceId }} · {{ registration.workerId }}</p><RouterLink :to="`/workers/${registration.workerId}`">Open worker detail →</RouterLink><div class="detail-grid"><label>Heart rate (bpm)<input max="250" min="0" type="number" v-model.number="heartRate"/></label><label>Temperature (°C)<input max="50" min="20" step="0.1" type="number" v-model.number="temperature"/></label><label>SpO₂ (%)<input max="100" min="0" type="number" v-model.number="spo2"/></label><label>Battery (%)<input max="100" min="0" type="number" v-model.number="battery"/></label></div><button :disabled="busy || running" @click="start">Start transmission</button><button :disabled="busy || !running" @click="stop">Stop safely</button><button :disabled="busy" @click="act(() =&gt; transmit({ sos: true }))">SIMULATED SOS</button><p role="status">{{ running ? 'Transmitting every 3 seconds' : 'Stopped' }}</p><p v-if="acknowledgement">Server acknowledgement: {{ acknowledgement }}</p><p>Keep this tab open. Closing it stops transmission; the server marks the device stale after 10 seconds and disconnected after 30 seconds. Registration credentials stay in this tab only.</p></section><div class="bg-surface-container rounded-xl p-space-md reference-form"><ScenarioControls></ScenarioControls></div></div>
<div class="lg:col-span-5 flex flex-col gap-space-md sticky top-[80px]"><section class="bg-surface-container rounded-xl p-space-md shadow-sm reference-form space-y-space-md"><div class="flex justify-between gap-space-sm"><h2>Uplink packet stream</h2><span class="text-code-sm text-primary">{{running?'TRANSMITTING':'STOPPED'}}</span></div><div class="grid grid-cols-2 gap-space-sm"><div class="bg-surface-container-low rounded-lg p-space-sm text-code-sm"><span class="text-outline">TRANSPORT</span><p>Wi-Fi · SIMULATED</p></div><div class="bg-surface-container-low rounded-lg p-space-sm text-code-sm"><span class="text-outline">INTERVAL</span><p>3000 ms while running</p></div></div><div class="bg-surface-container-lowest rounded-lg p-space-md min-h-[320px] text-code-sm overflow-auto"><p class="text-outline mb-space-sm">Actual server acknowledgement · Credentials are never displayed here</p><pre class="whitespace-pre-wrap break-all">{{acknowledgement?JSON.stringify(acknowledgement,null,2):'No packet sent.'}}</pre></div><p class="text-label-sm">Only accepted backend acknowledgements establish ingestion. Closing this tab stops the transmitter.</p><RouterLink :to="`/workers/${registration.workerId}`" class="text-primary" v-if="registration">Open worker detail →</RouterLink></section></div>
</div>
</div>
</main>
</template>
