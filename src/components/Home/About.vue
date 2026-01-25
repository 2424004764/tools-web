<script setup lang="ts">
import { ref } from 'vue';
const gitUrl = ref(import.meta.env.VITE_GIT_URL || '')
const rawGitUrl = ref(import.meta.env.VITE_RAW_GIT_URL || '')
const appTitle = ref(import.meta.env.VITE_APP_TITLE || '')
const siteAddr = ref(import.meta.env.VITE_MY_SITE_ADDR || '')
</script>

<template>
  <div class="flex flex-col mt-8 flex-1 items-center bg-white rounded-md p-10">
    <div class="p-5 w-2/3">
      <h1 class="text-2xl font-bold">关于 {{appTitle}}（源自：Tools-Web）</h1>
      <p class="mt-6">
        <el-text>本站是一个开源免费的工具站，基于（<el-link :href="gitUrl" target="_blank" type="primary">Tools-Web</el-link>）二次开发，部署在Cloudflare上。包含开发、文本、媒体、图表、生活、查询等50+种实用工具，完全开源免费；如果对您有帮助，请将其分享给您的朋友，并且添加到收藏夹中！顺便再点个⭐️吧（<el-link :href="rawGitUrl" target="_blank" type="primary">Tools-Web源站</el-link>）！因为是纯前端，所以请求外部第三方接口用的Cloudflare 的functions实现。</el-text>
      </p>

      <h1 class="text-2xl font-bold mt-6 mb-6">技术</h1>
      <p>
        <el-text>主要基于Vite + Vue + ElementPlus + Typescript + TailwindCss + Cloudflare Functions开发，某些工具使用了第三方开源库，您可以在仓库的 <el-link :href="gitUrl + '/blob/master/package.json'" target="_blank" type="primary">package.json</el-link> 文件中找到完整的列表。</el-text>
      </p>
        <div>
          本站用到的免费AI：
            <ul class="list-disc list-inside ml-4">
              <li>
                <el-link href="https://pollinations.ai" target="_blank" type="primary">pollinations.ai</el-link>
              </li>
              <li>
                <el-link href="https://platform.aitools.cfd/" target="_blank" type="primary">platform.aitools.cfd</el-link>
              </li>
            </ul>
        </div>
      <h1 class="text-2xl font-bold mt-6 mb-6">发现了 Bug？</h1>
      <p>
        <el-text>如果您发现了 Bug，或者某些功能未能按预期工作，请在 GitHub 仓库的 <el-link type="primary" target="_blank" :href="gitUrl + '/issues/new'" class="">issues</el-link> 中提交错误报告。</el-text>
      </p>
      <template v-if="siteAddr">
      <h1 class="text-2xl font-bold mt-6 mb-6">站长信息</h1>
      <p>
          <el-text>站长个人网站：<el-link type="primary" target="_blank" :href="siteAddr" class="">{{siteAddr}}</el-link></el-text>
        </p>
      </template>
    </div>
  </div>
</template>

<style scoped>
.title{
  /* rgb(51, 54, 57) */
}
</style>