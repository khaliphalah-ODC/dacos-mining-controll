<script setup>
import UiIcon from './UiIcon.vue'
defineProps({loading:Boolean,error:String,empty:Boolean,message:{type:String,default:'No data available'}})
defineEmits(['retry'])
</script>
<template><div v-if="loading||error||empty" class="data-state" :role="error?'alert':'status'"><UiIcon :name="error?'alert':loading?'signal':'grid'"/><strong>{{loading?'Loading records…':error||message}}</strong><p v-if="error">Retained data may be out of date.</p><button v-if="error" type="button" @click="$emit('retry')">Try again</button></div><slot v-else/></template>
