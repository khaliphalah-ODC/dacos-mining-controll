<script setup>
import {reactive,ref} from 'vue'
import {useAuthStore} from '../stores/auth.js'
const emit=defineEmits(['registered']),auth=useAuthStore(),error=ref(''),busy=ref(false)
const form=reactive({id:'',name:'',depth:null,x:null,y:null})
async function save(){busy.value=true;error.value='';try{await auth.request('/api/manage/zones',{id:form.id,name:form.name,depth:form.depth,geometry:{x:form.x,y:form.y}});emit('registered');Object.assign(form,{id:'',name:'',depth:null,x:null,y:null})}catch(e){error.value=e.message}finally{busy.value=false}}
</script>
<template><section><h2>Register a zone</h2><p>Enter reviewed site configuration. Diagram coordinates alone do not establish a surveyed location or a connected positioning system.</p><form @submit.prevent="save"><label>Zone ID<input v-model="form.id" required maxlength="100"></label><label>Name<input v-model="form.name" required maxlength="100"></label><label>Depth<input v-model.number="form.depth" type="number" step="any" required></label><label>Diagram X<input v-model.number="form.x" type="number" step="any" required></label><label>Diagram Y<input v-model.number="form.y" type="number" step="any" required></label><p v-if="error" role="alert">{{error}}</p><button :disabled="busy">Register zone</button></form></section></template>
