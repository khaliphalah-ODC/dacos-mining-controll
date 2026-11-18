<script setup>
defineProps({eyebrow:String,title:String,description:String})
</script>
<template><div class="page-heading"><div><p v-if="eyebrow" class="eyebrow">{{eyebrow}}</p><h1>{{title}}</h1><p v-if="description">{{description}}</p></div><div class="page-actions"><slot/></div></div></template>
