<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useToolsStore } from '@/store/modules/tools';
import { ElMessage, ElMessageBox } from 'element-plus';
const gitUrl = ref(import.meta.env.VITE_GIT_URL || '')
const rawGitUrl = ref(import.meta.env.VITE_RAW_GIT_URL || '')
const appTitle = ref(import.meta.env.VITE_APP_TITLE || '')
const siteAddr = ref(import.meta.env.VITE_MY_SITE_ADDR || '')
const toolsStore = useToolsStore()

// 计算工具总数
const totalTools = computed(() => {
  let count = 0
  for (const cate of toolsStore.cates) {
    count += cate.list?.length || 0
  }
  return count
})

// 构建时间显示在底部页脚（Floor.vue），所有页面都能看到

onMounted(async () => {
  if (toolsStore.cates.length === 0) {
    await toolsStore.getToolCate()
  }
})

/**
 * 清理缓存并强制刷新（保留登录态）
 *
 * 清理范围：
 *   ① 所有 Service Worker（反注册，老 SW 不会再拦截网络）
 *   ② Cache API 全部缓存（fonts/images/css/js）
 *   ③ sessionStorage（仅本次会话的临时数据）
 *
 * 不清理：
 *   ✗ localStorage（包含登录态 / 收藏夹 / 偏好，删了下次要重新登录）
 *   ✗ cookies（同登录态）
 *
 * 之后用 location.replace() 强制刷新 —— 比 reload() 更彻底，
 * 会重新发起新请求而不是从 bfcache 还原。
 */
async function clearCacheAndReload() {
  const messages: string[] = []

  // ① 反注册所有 Service Worker
  if ('serviceWorker' in navigator) {
    try {
      const regs = await navigator.serviceWorker.getRegistrations()
      await Promise.all(regs.map(r => r.unregister()))
      messages.push(`SW ×${regs.length}`)
    } catch (e) { /* ignore */ }
  }

  // ② 清空 Cache API
  if ('caches' in window) {
    try {
      const keys = await caches.keys()
      await Promise.all(keys.map(k => caches.delete(k)))
      messages.push(`Cache ×${keys.length}`)
    } catch (e) { /* ignore */ }
  }

  // ③ 清 sessionStorage（可选，主要是清掉一些临时标记）
  try {
    sessionStorage.clear()
    messages.push('sessionStorage')
  } catch (e) { /* ignore */ }

  if (messages.length > 0) {
    ElMessage.success(`已清理 ${messages.join(' / ')}，正在刷新…`)
  } else {
    ElMessage.success('无可清理项，正在刷新…')
  }

  // 用 replace 而非 reload：replace 不依赖当前内存状态，
  // 强制从服务器重新拉取，避免 bfcache 还原旧页面
  setTimeout(() => {
    window.location.replace(location.pathname + location.search + location.hash)
  }, 500)
}

/**
 * 完全重置 —— 警告：会清掉登录态、收藏夹、所有偏好
 *
 * 在"清理缓存"基础上额外清掉：
 *   ④ localStorage（含登录 token、用户偏好、收藏夹等）
 *
 * 用户确认后才执行，避免误操作。
 */
async function fullReset() {
  try {
    await ElMessageBox.confirm(
      '将清除所有本地数据（登录态、收藏夹、偏好设置等），并强制刷新页面。继续？',
      '完全重置',
      {
        confirmButtonText: '确定重置',
        cancelButtonText: '取消',
        type: 'warning',
        confirmButtonClass: 'el-button--danger',
      }
    )
  } catch {
    return // 用户取消
  }

  // 先做标准清理
  if ('serviceWorker' in navigator) {
    try {
      const regs = await navigator.serviceWorker.getRegistrations()
      await Promise.all(regs.map(r => r.unregister()))
    } catch (e) { /* ignore */ }
  }
  if ('caches' in window) {
    try {
      const keys = await caches.keys()
      await Promise.all(keys.map(k => caches.delete(k)))
    } catch (e) { /* ignore */ }
  }
  try { sessionStorage.clear() } catch (e) { /* ignore */ }
  // ④ 清 localStorage —— 登录态/收藏等都会丢
  try { localStorage.clear() } catch (e) { /* ignore */ }

  ElMessage.success('已完全重置，3 秒后跳到首页…')
  setTimeout(() => {
    // 跳到首页确保清理完整（路由可能已被破坏）
    window.location.replace('/')
  }, 800)
}
</script>

<template>
  <div class="flex flex-col mt-8 flex-1 items-center bg-white rounded-md p-4 md:p-10">
    <div class="p-1 w-full md:p-5 md:w-2/3">
      <h1 class="text-h2 font-bold">关于 {{appTitle}}（源自：Tools-Web）</h1>
      <p class="mt-6">
        <el-text>本站是一个开源免费的工具站，基于（<el-link :href="gitUrl" target="_blank" type="primary">Tools-Web</el-link>）二次开发，部署在Cloudflare上。包含开发、文本、媒体、图表、生活、查询等 <span class="text-primary font-bold">{{ totalTools }}</span> 种实用工具，完全开源免费；如果对您有帮助，请将其分享给您的朋友，并且添加到收藏夹中！顺便再点个⭐️吧（<el-link :href="rawGitUrl" target="_blank" type="primary">Tools-Web源站</el-link>）！因为是纯前端，所以请求外部第三方接口用的Cloudflare 的functions实现。</el-text>
      </p>

      <h1 class="text-h2 font-bold mt-6 mb-6">技术</h1>
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
      <h1 class="text-h2 font-bold mt-6 mb-6">发现了 Bug？</h1>
      <p>
        <el-text>如果您发现了 Bug，或者某些功能未能按预期工作，请在 GitHub 仓库的 <el-link type="primary" target="_blank" :href="gitUrl + '/issues/new'" class="">issues</el-link> 中提交错误报告。</el-text>
      </p>
      <template v-if="siteAddr">
      <h1 class="text-h2 font-bold mt-6 mb-6">站长信息</h1>
      <p>
          <el-text>站长个人网站：<el-link type="primary" target="_blank" :href="siteAddr" class="">{{siteAddr}}</el-link></el-text>
        </p>
         <p class="mt-2">
          <el-text>公众号：<el-text type="primary" class="font-medium">《全栈缝合车间》</el-text></el-text>
        </p>
        <div class="mt-3 flex items-center gap-4">
          <img
            src="https://tool-r2.fologde.com/qrcode_for_gh_ab396f4a9554_344.jpg"
            alt="公众号《全栈缝合车间》二维码"
            class="w-36 h-36 rounded-md border border-gray-200 shadow-sm bg-white"
            referrerpolicy="no-referrer"
            loading="lazy"
          />
          <el-text class="text-body-sm text-gray-500 leading-6">扫码关注<br />获取更多工具更新与开发动态</el-text>
        </div>
      </template>

      <h1 class="text-h2 font-bold mt-6 mb-6">友情链接</h1>
      <p>
        <el-text>linux.do：<el-link href="https://linux.do" type="primary" target="_blank">https://linux.do</el-link></el-text>
      </p>

      <h1 class="text-h2 font-bold mt-6 mb-6">页面管理</h1>
      <div class="space-y-4">
        <p class="text-body-sm text-ink-700">
          如果你遇到 <strong class="text-danger-600">刷新没变化</strong>、<strong class="text-danger-600">看不到新工具</strong>、
          <strong class="text-danger-600">界面显示陈旧</strong> 等问题，可以用下面的按钮清理本地缓存并强制拉取最新版本。
        </p>
        <p class="text-body-sm text-ink-700">
          <span class="inline-block w-2 h-2 rounded-full bg-accent-500 mr-1.5 align-middle"></span>
          <strong>清理缓存并刷新</strong>：保留你的登录态、收藏夹等数据，只清掉缓存层面的旧资源。
        </p>
        <p class="text-body-sm text-ink-700">
          <span class="inline-block w-2 h-2 rounded-full bg-danger-500 mr-1.5 align-middle"></span>
          <strong>完全重置</strong>：在清理缓存基础上，额外清掉登录态、偏好设置等所有本地数据，刷新后需要重新登录。
        </p>
        <div class="flex flex-wrap gap-3 pt-2">
          <el-button type="primary" size="large" @click="clearCacheAndReload">
            🧹 清理缓存并刷新
          </el-button>
          <el-button type="danger" plain size="large" @click="fullReset">
            ⚠️ 完全重置（含登录态）
          </el-button>
        </div>
        <el-text size="small" class="text-ink-500 block">
          清理的是浏览器本地的缓存层（磁盘缓存 / Service Worker / Cache API / 内存缓存），
          与服务端无关。如果清理后仍未看到最新版本，请到
          <el-link type="primary" target="_blank" :href="gitUrl + '/issues/new'">GitHub issues</el-link>
          反馈。
        </el-text>
      </div>

    </div>
  </div>
</template>

<style scoped>
/* 友链页面样式，暂时无独立类 */
</style>