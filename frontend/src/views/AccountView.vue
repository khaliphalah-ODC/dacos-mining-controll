<script setup>

import {ref,computed} from 'vue'
import {useRouter} from 'vue-router'
import {useAuthStore} from '../stores/auth.js'
import {useTelemetryStore} from '../stores/telemetry.js'
import {useApiQuery} from '../composables/useApiQuery.js'
import {useModalFocus} from '../composables/useModalFocus.js'
const auth=useAuthStore(),router=useRouter(),telemetry=useTelemetryStore(),session=useApiQuery('/api/auth/session')
const currentPassword=ref(''),password=ref(''),confirmation=ref(''),error=ref(''),busy=ref(false),showCurrent=ref(false),showPassword=ref(false),showConfirmation=ref(false),signoutOpen=ref(false),signoutDialog=ref(null)
const bytes=computed(()=>new TextEncoder().encode(password.value).length)
const matches=computed(()=>password.value===confirmation.value)
const checks=computed(()=>({length:password.value.length>=12&&password.value.length<=128,bytes:bytes.value>0&&bytes.value<=72,confirmation:!!confirmation.value&&matches.value,current:!!currentPassword.value}))
const canChange=computed(()=>Object.values(checks.value).every(Boolean)&&!busy.value)
useModalFocus(signoutOpen,signoutDialog,()=>{signoutOpen.value=false})
async function change(){
 if(!canChange.value)return
 busy.value=true;error.value=''
 try{await auth.request('/api/auth/password',{currentPassword:currentPassword.value,password:password.value});currentPassword.value='';password.value='';confirmation.value='';auth.user=null;auth.csrfToken='';await router.replace('/login')}
 catch(e){error.value=e.message}finally{busy.value=false}
}
async function logout(){busy.value=true;error.value='';try{await auth.logout();await router.replace('/login')}catch(e){error.value=e.message;signoutOpen.value=false}finally{busy.value=false}}

</script>
<template>
<main class="flex-1 pt-[68px] bg-surface w-full px-space-md py-space-md reference-page dacos_my_account_security_profile"><p class="bg-error-container text-on-error-container rounded-lg p-space-md mb-space-md" role="alert" v-if="error">{{error}}</p><div class="flex flex-col w-full gap-space-lg">
<div class="flex flex-col md:flex-row md:items-center justify-between gap-space-md bg-surface-container-high/60 backdrop-blur px-space-lg py-space-md rounded-xl shadow-md">
<div class="flex items-center gap-space-md">
<div class="relative shrink-0">
<span class="w-16 h-16 rounded-full bg-primary/10 text-primary text-headline-xl font-semibold flex items-center justify-center">{{auth.user?.name?.charAt(0)||"D"}}</span>
<span class="absolute bottom-0 right-0 w-4 h-4 rounded-full bg-primary-container shadow"></span>
</div>
<div class="flex flex-col">
<div class="flex flex-wrap items-center gap-space-sm">
<span class="font-headline-lg text-headline-lg text-on-surface">{{auth.user?.name}}</span>
<span class="px-2.5 py-0.5 rounded-full bg-primary/10 text-primary font-code-sm text-code-sm uppercase tracking-wider font-semibold">ROLE: {{auth.user?.role}}</span>
</div>
<span class="font-body-md text-body-md text-on-surface-variant font-mono">{{auth.user?.email}}</span>
</div>
</div>
<div class="flex items-center gap-2 self-start md:self-auto px-space-sm py-1 rounded-lg bg-surface-container-lowest text-outline font-code-sm text-code-sm">
<span class="material-symbols-outlined text-[16px] text-tertiary">verified_user</span>
<span>COOKIE SESSION · ROLE-BASED ACCESS</span>
</div>
</div>
<div class="grid grid-cols-1 lg:grid-cols-12 gap-space-lg">
<div class="lg:col-span-8 flex flex-col gap-space-lg">
<div class="bg-surface-container rounded-xl p-space-lg shadow-sm flex flex-col gap-space-md">
<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm">
<div class="flex items-center gap-space-sm">
<span class="material-symbols-outlined text-primary text-[22px]">lock_reset</span>
<h2 class="font-headline-sm text-headline-sm text-on-surface">In-Session Password Rotation</h2>
</div>
<span class="font-code-sm text-code-sm text-on-surface-variant uppercase tracking-wider bg-surface-container-high px-2 py-0.5 rounded">Invalidates existing sessions</span>
</div>
<form @submit.prevent="change" class="flex flex-col gap-space-md" id="password-form">
<div class="flex flex-col gap-space-xs">
<label class="font-label-md text-label-md text-on-surface-variant flex items-center justify-between" for="current-pwd">
<span>Current password</span>
<span class="font-code-sm text-code-sm text-outline">Authenticated session</span>
</label>
<div class="relative">
<input :disabled="busy" :type="showCurrent?'text':'password'" autocomplete="current-password" class="w-full h-11 px-space-md pr-11 bg-surface-container-low text-on-surface rounded-lg placeholder-outline focus:outline-none focus:bg-surface-container-high font-body-md text-body-md transition-colors" id="current-pwd" maxlength="128" placeholder="Enter current password" required="" v-model="currentPassword"/>
<button :aria-pressed="showCurrent" @click="showCurrent=!showCurrent" aria-label="Show or hide current password" class="absolute right-3 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface" type="button">
<span class="material-symbols-outlined text-[20px]">visibility</span>
</button>
</div>
</div>
<div class="grid grid-cols-1 md:grid-cols-2 gap-space-md">
<div class="flex flex-col gap-space-xs">
<label class="font-label-md text-label-md text-on-surface-variant flex items-center justify-between" for="new-pwd">
<span>New Password</span>
<span class="font-code-sm text-code-sm text-outline" id="byte-counter">{{bytes}} / 72 bytes</span>
</label>
<div class="relative">
<input :disabled="busy" :type="showPassword?'text':'password'" autocomplete="new-password" class="w-full h-11 px-space-md pr-11 bg-surface-container-low text-on-surface rounded-lg placeholder-outline focus:outline-none focus:bg-surface-container-high font-body-md text-body-md transition-colors" id="new-pwd" maxlength="128" minlength="12" placeholder="Create a password" required="" v-model="password"/>
<button :aria-pressed="showPassword" @click="showPassword=!showPassword" aria-label="Show or hide new password" class="absolute right-3 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface" type="button">
<span class="material-symbols-outlined text-[20px]">visibility</span>
</button>
</div>
</div>
<div class="flex flex-col gap-space-xs">
<label class="font-label-md text-label-md text-on-surface-variant" for="confirm-pwd">Confirm New Password</label>
<div class="relative">
<input :disabled="busy" :type="showConfirmation?'text':'password'" autocomplete="new-password" class="w-full h-11 px-space-md pr-11 bg-surface-container-low text-on-surface rounded-lg placeholder-outline focus:outline-none focus:bg-surface-container-high font-body-md text-body-md transition-colors" id="confirm-pwd" maxlength="128" placeholder="Confirm new password" required="" v-model="confirmation"/>
<button :aria-pressed="showConfirmation" @click="showConfirmation=!showConfirmation" aria-label="Show or hide password confirmation" class="absolute right-3 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface" type="button">
<span class="material-symbols-outlined text-[20px]">visibility</span>
</button>
</div>
</div>
</div>
<div class="bg-surface-container-low p-space-md rounded-lg flex flex-col gap-space-sm">
<div class="flex items-center justify-between">
<span class="font-code-sm text-code-sm uppercase tracking-wider text-outline">Password policy checks</span>
<span class="font-code-sm text-code-sm text-outline" id="strength-meter-label">{{canChange?"READY TO SUBMIT":"CHECK REQUIRED FIELDS"}}</span>
</div>
<div class="grid grid-cols-1 sm:grid-cols-2 gap-space-xs font-label-sm text-label-sm text-on-surface-variant">
<div :class="checks.length?'text-primary':'text-outline'" class="flex items-center gap-2 text-outline transition-colors" id="rule-len">
<span class="material-symbols-outlined text-[16px] text-outline">{{checks.length?"check_circle":"radio_button_unchecked"}}</span>
<span>Minimum 12 characters; maximum 128 characters</span>
</div>
<div :class="checks.bytes?'text-primary':'text-outline'" class="flex items-center gap-2 text-outline transition-colors" id="rule-bytes">
<span class="material-symbols-outlined text-[16px] text-outline">{{checks.bytes?"check_circle":"radio_button_unchecked"}}</span>
<span>Maximum 72 UTF-8 bytes</span>
</div>
<div :class="checks.confirmation?'text-primary':'text-outline'" class="flex items-center gap-2 text-outline transition-colors" id="rule-case">
<span class="material-symbols-outlined text-[16px] text-outline">{{checks.confirmation?"check_circle":"radio_button_unchecked"}}</span>
<span>New password confirmation matches</span>
</div>
<div :class="checks.current?'text-primary':'text-outline'" class="flex items-center gap-2 text-outline transition-colors" id="rule-sym">
<span class="material-symbols-outlined text-[16px] text-outline">{{checks.current?"check_circle":"radio_button_unchecked"}}</span>
<span>Current password supplied</span>
</div>
</div>
<div class="text-error font-code-sm text-code-sm pt-1" id="match-indicator" role="status" v-if="confirmation&amp;&amp;!matches">
              Passwords do not match.
            </div>
</div>
<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-space-md pt-space-xs">
<div class="flex items-start gap-2 max-w-lg">
<span class="material-symbols-outlined text-tertiary text-[18px] shrink-0 mt-0.5">policy</span>
<span class="font-code-sm text-code-sm text-on-surface-variant leading-relaxed">Changing your password invalidates all existing sessions and requires signing in again. Forgotten passwords require administrator-managed recovery; self-service recovery is unavailable.</span>
</div>
<button :disabled="!canChange" class="h-11 px-space-lg rounded-lg bg-primary-container text-on-primary-container font-label-md text-label-md font-semibold hover:bg-primary transition-colors flex items-center justify-center gap-2 shrink-0 shadow-sm" id="btn-update-pwd" type="submit">
<span class="material-symbols-outlined text-[18px]">verified</span>
<span>Change password and sign out all sessions</span>
</button>
</div>
</form>
</div>
<div class="bg-surface-container rounded-xl p-space-lg shadow-sm flex flex-col gap-space-md">
<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm">
<div class="flex items-center gap-space-sm">
<span class="material-symbols-outlined text-primary text-[22px]">devices</span>
<div class="flex flex-col">
<h2 class="font-headline-sm text-headline-sm text-on-surface">Active Sessions &amp; Terminal Security</h2>
<span class="font-label-sm text-label-sm text-on-surface-variant">This browser is authenticated. Other terminal sessions are not listed by the API.</span>
</div>
</div>
<button class="px-space-md py-2 rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-on-surface transition-colors font-label-md text-label-md flex items-center gap-1.5 self-start sm:self-auto" disabled="" title="The API does not expose terminal session management" type="button">
<span class="material-symbols-outlined text-error text-[18px]">gpp_maybe</span>
<span>Terminate All Other Sessions</span>
</button>
</div>
<div class="flex flex-col gap-space-sm">
<div class="bg-surface-container-low rounded-lg p-space-md flex flex-col sm:flex-row sm:items-center justify-between gap-space-md">
<div class="flex items-start gap-space-md">
<div class="p-2.5 rounded-lg bg-primary/10 text-primary shrink-0">
<span class="material-symbols-outlined text-[24px]">desktop_windows</span>
</div>
<div class="flex flex-col gap-0.5">
<div class="flex items-center gap-space-sm">
<span class="font-headline-sm text-headline-sm text-on-surface">Current browser session</span>
<span class="px-2 py-0.5 rounded bg-primary-container/20 text-primary font-code-sm text-code-sm font-semibold">CURRENT BROWSER</span>
</div>
<div class="flex flex-wrap items-center gap-2 font-code-sm text-code-sm text-on-surface-variant">
<span>{{auth.user?.role}} access</span>
<span>•</span>
<span>IP address not exposed</span>
<span>•</span>
<span>Session token is HttpOnly</span>
</div>
</div>
</div>
<div class="flex items-center gap-2 shrink-0 sm:self-center">
<span class="w-2 h-2 rounded-full bg-primary animate-ping"></span>
<span class="font-code-sm text-code-sm text-primary font-semibold uppercase tracking-wider">Authenticated</span>
</div>
</div>
<div class="bg-surface-container-low rounded-lg p-space-md flex flex-col sm:flex-row sm:items-center justify-between gap-space-md" id="session-tablet"><div class="flex gap-space-md items-center"><span class="material-symbols-outlined text-outline">tablet_android</span><div><span class="text-label-md">Other terminal sessions</span><p class="text-code-sm text-outline mt-1">Session inventory and per-terminal revocation are unavailable.</p></div></div></div>
</div>
</div>
</div>
<div class="lg:col-span-4 flex flex-col gap-space-lg">
<div class="bg-surface-container rounded-xl p-space-lg shadow-sm flex flex-col gap-space-md">
<div class="flex items-center gap-space-sm">
<span class="material-symbols-outlined text-primary text-[20px]">sensors</span>
<h2 class="font-headline-sm text-headline-sm text-on-surface">Telemetry Session Status</h2>
</div>
<div class="flex flex-col gap-space-sm">
<div class="bg-surface-container-low p-space-sm rounded-lg flex items-center justify-between">
<span class="font-label-sm text-label-sm text-outline">Realtime connection</span>
<span class="font-code-sm text-code-sm text-on-surface font-semibold">{{telemetry.connected?"Realtime connected":"Realtime offline"}}</span>
</div>
<div class="bg-surface-container-low p-space-sm rounded-lg flex items-center justify-between">
<span class="font-label-sm text-label-sm text-outline">Occupational shift</span>
<span class="font-code-sm text-code-sm text-primary font-semibold">Not assigned by this account</span>
</div>
<div class="bg-surface-container-low p-space-sm rounded-lg flex items-center justify-between">
<span class="font-label-sm text-label-sm text-outline">Session expires</span>
<div class="flex items-center gap-1.5 font-code-sm text-code-sm text-on-surface">
<span class="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
<span class="font-bold">{{session.data.value?.expiresAt?new Date(session.data.value.expiresAt).toLocaleString():"Unavailable"}}</span>
</div>
</div>
</div>
<div class="bg-surface-container-high/40 p-space-sm rounded-lg flex items-start gap-2">
<span class="material-symbols-outlined text-outline text-[18px] shrink-0 mt-0.5">info</span>
<p class="font-code-sm text-code-sm text-on-surface-variant leading-relaxed">Application roles control monitoring and administration access. They are distinct from occupational worker records.</p>
</div>
</div>
<div class="bg-surface-container rounded-xl p-space-lg shadow-sm flex flex-col gap-space-md">
<div class="flex items-center gap-space-sm">
<span class="material-symbols-outlined text-error text-[20px]">power_settings_new</span>
<h2 class="font-headline-sm text-headline-sm text-on-surface">Session Termination</h2>
</div>
<p class="font-body-md text-body-md text-on-surface-variant">End this authenticated browser session. The server invalidates its session and disconnects authenticated realtime subscriptions.</p>
<div class="bg-surface-container-low p-space-md rounded-lg flex flex-col gap-space-xs font-code-sm text-code-sm text-outline">
<div class="flex items-center gap-2">
<span class="material-symbols-outlined text-[16px] text-tertiary">check_circle</span>
<span>Clears this browser’s session cookie</span>
</div>
<div class="flex items-center gap-2">
<span class="material-symbols-outlined text-[16px] text-tertiary">check_circle</span>
<span>Disconnects authenticated realtime subscriptions</span>
</div>
<div class="flex items-center gap-2">
<span class="material-symbols-outlined text-[16px] text-tertiary">check_circle</span>
<span>Records the logout audit event</span>
</div>
</div>
<button @click="signoutOpen=true" aria-label="Open account signout confirmation" class="w-full h-12 rounded-lg bg-error hover:bg-on-error-container text-on-error font-label-md text-label-md font-semibold transition-colors flex items-center justify-center gap-2 shadow-sm" type="button">
<span class="material-symbols-outlined text-[20px]">logout</span>
<span>Sign Out from DACOS SCADA Console</span>
</button>
</div>
<div class="bg-surface-container-lowest p-space-md rounded-xl flex flex-col gap-2">
<span class="font-code-sm text-code-sm text-outline uppercase tracking-wider">Audit Identifier</span>
<div class="font-mono text-code-sm text-on-surface-variant break-all select-all bg-surface-container-low p-2 rounded">{{auth.user?.id}}</div>
</div>
</div>
</div>
<div aria-labelledby="signout-title" aria-modal="true" class="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-space-md" id="signout-dialog" ref="signoutDialog" role="dialog" tabindex="-1" v-if="signoutOpen">
<div class="bg-surface-container-high rounded-xl max-w-md w-full p-space-lg shadow-xl flex flex-col gap-space-md">
<div class="flex items-center gap-space-sm text-error">
<span class="material-symbols-outlined text-[28px]">warning</span>
<h3 class="font-headline-sm text-headline-sm text-on-surface" id="signout-title">Confirm Operational Sign Out</h3>
</div>
<p class="font-body-md text-body-md text-on-surface-variant leading-relaxed">
        Are you sure you want to end your session? Handover checks must be confirmed with the relief supervisor before disconnecting terminal hardware.
      </p>
<div class="flex items-center justify-end gap-space-sm pt-space-sm">
<button @click="signoutOpen=false" class="px-space-md py-2.5 rounded-lg bg-surface-container hover:bg-surface-container-highest text-on-surface font-label-md text-label-md transition-colors" type="button">
          Cancel
        </button>
<button :disabled="busy" @click="logout" aria-label="Confirm account signout" class="px-space-md py-2.5 rounded-lg bg-error text-on-error font-label-md text-label-md font-semibold hover:bg-on-error-container transition-colors flex items-center gap-1.5" type="button">
<span class="material-symbols-outlined text-[18px]">logout</span>
<span>Invalidate Token &amp; Exit</span>
</button>
</div>
</div>
</div>

</div>
</main>
</template>
