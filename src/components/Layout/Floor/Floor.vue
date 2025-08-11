<script setup lang="ts">
import {  ref } from 'vue';
const appDesc = ref(import.meta.env.VITE_APP_DESC || '')
const gitUrl = ref(import.meta.env.VITE_GIT_URL || '')
</script>

<template>
    <div class="w-full rounded-2xl z-10 p-5 text-center">
    <el-text>{{ appDesc }}  © 2025 <a :href="gitUrl" target="_blank" class="text-blue-700">Tools-Web</a><span class="mx-2">·</span><a :href="gitUrl + '/issues/new'" target="_blank" class="text-blue-700">反馈建议</a></el-text>
  </div>
</template>

<style scoped>

</style>