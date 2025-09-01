<script setup lang="ts">
import { ref } from 'vue';
const appDesc = ref(import.meta.env.VITE_APP_DESC || '')
const gitUrl = ref(import.meta.env.VITE_GIT_URL || '')
</script>

<template>
    <div class="w-full rounded-2xl z-10 p-5 text-center">
        <div class="copyright text-sm text-gray-600 leading-relaxed">
            <div class="mb-2">
                {{ appDesc }} © 2019 - 2025 BY Bucaicai
            </div>
            <div class="flex flex-col sm:flex-row justify-center items-center gap-2 text-xs">
                <a href="https://beian.miit.gov.cn/" target="_blank" class="text-blue-700 hover:underline">
                    湘ICP备16007032号-1
                </a>
                <span class="hidden sm:inline">|</span>
                <a href="https://www.beian.gov.cn/portal/registerSystemInfo?recordcode=43030202001052&token=2be051c1-22dd-44ec-9f4b-d41155f2d855" 
                   target="_blank" class="text-blue-700 hover:underline">
                    湘公安网备43030202001052号
                </a>
                <span class="hidden sm:inline">|</span>
                <a :href="gitUrl" target="_blank" class="text-blue-700 hover:underline">Tools-Web</a>
                <span class="hidden sm:inline">|</span>
                <a :href="gitUrl + '/issues/new'" target="_blank" class="text-blue-700 hover:underline">反馈建议</a>
            </div>
        </div>
    </div>
</template>

<style scoped>
</style>