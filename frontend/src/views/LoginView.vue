<script setup>

import { ref } from 'vue'
import { RouterLink,useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth.js'
import UiIcon from '../components/ui/UiIcon.vue'
const auth=useAuthStore(),router=useRouter(),email=ref(''),password=ref(''),error=ref(''),busy=ref(false),visible=ref(false)
async function submit(){busy.value=true;error.value='';try{await auth.login(email.value,password.value);password.value='';await router.replace('/overview')}catch(e){error.value=e.message}finally{busy.value=false}}

</script>
<template>
<main class="w-full min-h-screen bg-surface flex flex-col justify-center items-center p-space-md reference-ui dark reference-login"><div class="flex flex-col w-full items-center justify-center relative py-space-xl">

<div class="absolute inset-0 pointer-events-none opacity-20 overflow-hidden">
<svg class="w-full h-full" xmlns="http://www.w3.org/2000/svg">
<defs>
<pattern height="48" id="telemetry-grid" patternUnits="userSpaceOnUse" width="48">
<path d="M 48 0 L 0 0 0 48" fill="none" opacity="0.15" stroke="#4bdbcb" stroke-width="0.5"></path>
<circle cx="0" cy="0" fill="#4bdbcb" opacity="0.4" r="1"></circle>
</pattern>
</defs>
<rect fill="url(#telemetry-grid)" height="100%" width="100%"></rect>
</svg>
</div>
<div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[720px] h-[720px] bg-primary/5 rounded-full blur-[140px] pointer-events-none"></div>

<div class="w-full max-w-[480px] mb-space-md z-10">
<div class="bg-surface-container-high px-space-md py-space-xs rounded flex items-center justify-between shadow-sm">
<div class="flex items-center space-x-space-xs text-tertiary">
<span class="material-symbols-outlined text-label-sm" style="font-variation-settings: 'FILL' 1;">security_update_warning</span>
<span class="font-code-sm text-code-sm tracking-wider uppercase">SUPERVISED DEMO PROTOTYPE</span>
</div>
<span class="font-code-sm text-code-sm text-on-surface-variant uppercase tracking-widest">GATE // 04-SEC</span>
</div>
</div>

<div class="w-full max-w-[480px] bg-surface-container rounded-lg shadow-xl relative z-10 overflow-hidden">

<div class="h-1 w-full bg-gradient-to-r from-primary via-primary-container to-surface-variant"></div>
<div class="p-space-lg md:p-space-xl flex flex-col space-y-space-lg">

<div class="flex flex-col space-y-space-md">
<div class="flex items-center justify-between">
<img alt="DACOS Industrial Logo" class="h-10 w-auto object-contain" src="https://lh3.googleusercontent.com/aida/ALJJyrAX2iZPbYx64GpY3yb9I4VZO6I7n-ysR6m3YuaOEdd236wG-R_z0O3sW_fW-xXtdF6N4EghOFzYEnSCFSKjynx3BMqmENGE73fxlsBZPQ2V1HXselFBnsw24FHS6EQNn-CJnKwzk3AXpYIc7R3spmWdV9IzIWxd3BhnklSxvhiSJZqgC2ik_55Rn7Nbwgupu6LAmFfMnsTZbHjUXQO_UtJNlfw0dtLj5oayaT_60-Ol"/>
<div class="flex items-center space-x-space-xs px-2 py-1 bg-surface-container-highest rounded">
<span class="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
<span class="font-code-sm text-code-sm text-primary tracking-wider">AUTHORIZED ACCESS</span>
</div>
</div>
<div class="space-y-space-xs">
<h1 class="font-headline-lg text-headline-lg text-on-surface tracking-tight">Control Room Sign In</h1>
<p class="font-body-md text-body-md text-on-surface-variant">
            Enter your credentials to access the supervisor and operator telemetry dashboard.
          </p>
</div>

<div class="bg-surface-container-low px-space-md py-space-xs rounded flex items-start space-x-space-xs text-secondary">
<span class="material-symbols-outlined text-label-sm mt-0.5" style="font-variation-settings: 'FILL' 1;">terminal</span>
<span class="font-label-sm text-label-sm">
            Supervised Demonstration Workspace — Role-based authorization enforced.
          </span>
</div>
</div>

<div class="bg-error-container text-on-error-container px-space-md py-space-sm rounded flex items-start space-x-space-sm shadow-sm transition-all duration-300" id="error-banner" role="alert" v-if="error">
<span class="material-symbols-outlined text-headline-sm mt-0.5" style="font-variation-settings: 'FILL' 1;">error</span>
<div class="flex-1">
<p class="font-code-sm text-code-sm font-semibold uppercase tracking-wider">Authentication failed</p>
<p class="font-label-sm text-label-sm mt-0.5">{{error}}</p>
</div>
<button @click="error=''" class="text-on-error-container hover:opacity-75 focus:outline-none" type="button">
<span class="material-symbols-outlined text-label-sm">close</span>
</button>
</div>

<form @submit.prevent="submit" class="space-y-space-md" id="login-form">

<div class="space-y-space-xs">
<label class="font-code-sm text-code-sm text-on-surface tracking-wider uppercase flex justify-between" for="terminal-id">
<span>Operator Identifier</span>
<span class="text-on-surface-variant">EMAIL ADDRESS</span>
</label>
<div class="relative flex items-center bg-surface-container-lowest rounded shadow-inner">
<span class="material-symbols-outlined absolute left-3 text-outline-variant select-none pointer-events-none">badge</span>
<input :disabled="busy" autocomplete="username" class="w-full bg-transparent pl-10 pr-space-md py-3 font-body-md text-body-md text-on-surface placeholder:text-outline-variant focus:outline-none rounded" id="terminal-id" maxlength="254" name="terminal-id" placeholder="operator@dacos-mining.internal" required="" type="email" v-model="email"/>
</div>
</div>

<div class="space-y-space-xs">
<label class="font-code-sm text-code-sm text-on-surface tracking-wider uppercase flex justify-between" for="auth-key">
<span>Access Keycode</span>
<span class="text-on-surface-variant font-code-sm">ROLE-BASED ACCESS</span>
</label>
<div class="relative flex items-center bg-surface-container-lowest rounded shadow-inner">
<span class="material-symbols-outlined absolute left-3 text-outline-variant select-none pointer-events-none">lock</span>
<input :disabled="busy" :type="visible?'text':'password'" autocomplete="current-password" class="w-full bg-transparent pl-10 pr-12 py-3 font-body-md text-body-md text-on-surface placeholder:text-outline-variant focus:outline-none rounded" id="auth-key" maxlength="128" name="auth-key" placeholder="••••••••••••••••" required="" v-model="password"/>
<button :aria-pressed="visible" @click="visible=!visible" aria-label="Show or hide password" class="absolute right-2 px-2 py-1 flex items-center text-outline hover:text-primary transition-colors focus:outline-none" id="toggle-visibility-btn" type="button">
<span class="material-symbols-outlined text-headline-sm" id="visibility-icon">visibility</span>
</button>
</div>
</div>

<div class="flex items-center justify-between pt-space-xs">
<span class="font-label-sm text-label-sm text-on-surface-variant">Secure administrator-managed session</span>
<span class="font-code-sm text-code-sm text-on-surface-variant uppercase">HTTPS SESSION</span>
</div>

<div class="pt-space-xs">
<button :disabled="busy" class="w-full min-h-[48px] bg-primary text-on-primary font-headline-sm text-headline-sm rounded flex items-center justify-center space-x-space-xs hover:bg-primary-container active:scale-[0.99] transition-all shadow-md focus:outline-none" id="auth-submit-btn" type="submit">
<span :class="{'hidden':!busy}" class="material-symbols-outlined animate-spin text-headline-sm" id="btn-spinner">sync</span>
<span id="btn-text">{{busy?"Signing in…":"Authenticate Session"}}</span>
<span class="material-symbols-outlined text-headline-sm" id="btn-arrow">login</span>
</button>
</div>
</form>

<div class="space-y-space-xs pt-space-xs">
<div class="p-space-sm bg-surface-container-high rounded space-y-space-xs">
<div class="flex items-start space-x-space-xs text-on-surface-variant">
<span class="material-symbols-outlined text-label-sm mt-0.5 text-primary">admin_panel_settings</span>
<p class="font-label-sm text-label-sm leading-relaxed">
              Access is administrator-managed. Contact your system administrator or shift superintendent for access provisioning or credential recovery.
            </p>
</div>
<div class="flex items-start space-x-space-xs text-on-surface-variant/80 pl-6">
<span class="font-code-sm text-code-sm tracking-wide">
              NOTICE: Self-registration and public password recovery are disabled by system security policy.
            </span>
</div>
</div>
</div>

<div class="pt-space-sm flex items-center justify-between text-on-surface-variant">
<a class="inline-flex items-center space-x-space-xs font-label-md text-label-md text-secondary hover:text-primary transition-colors focus:outline-none" href="/welcome">
<span class="material-symbols-outlined text-label-sm">arrow_back</span>
<span>Back to DACOS Public Overview</span>
</a>
<span class="font-code-sm text-code-sm opacity-60">DACOS / AUTH</span>
</div>
</div>
</div>

<div class="w-full max-w-[480px] mt-space-md flex items-center justify-between text-outline-variant font-code-sm text-code-sm px-space-xs z-10">
<div class="flex items-center space-x-space-xs">
<span class="inline-block w-1.5 h-1.5 rounded-full bg-outline"></span>
<span>DACOS TELEMETRY WORKSPACE</span>
</div>
<span>Secure cookie session</span>
</div>

</div></main>
</template>
