<script setup lang="ts">
// 隐私政策页面（/privacy）
// 文案与站点真实数据实践保持一致：认证（PBKDF2 / JWT / DPoP）、存储（D1/KV/R2）、
// 第三方（OAuth 登录、Resend 邮件、免费 AI 接口）。修改数据流向时请同步更新本文案。
import { ref } from 'vue'
const appTitle = import.meta.env.VITE_APP_TITLE || '一方工具箱'
const siteAddr = ref(import.meta.env.VITE_MY_SITE_ADDR || '')
const gitUrl = ref(import.meta.env.VITE_GIT_URL || '')
const updatedDate = '2026-11-09'
</script>

<template>
  <div class="flex flex-col mt-8 flex-1 items-center bg-white rounded-md p-4 md:p-10">
    <div class="p-1 w-full md:p-5 md:w-2/3">
      <h1 class="text-h2 font-bold">隐私政策</h1>
      <p class="mt-2 text-caption text-gray-500">最后更新：{{ updatedDate }} ｜ 本政策适用于 {{ appTitle }}（tool.fologde.com）及其所有子页面</p>

      <h2 class="text-h3 font-bold mt-8 mb-3">一、我们收集哪些信息</h2>
      <el-text class="leading-7">
        <p class="mt-1">我们仅收集运行本站服务所必需的信息，不出售任何用户数据。具体包括：</p>
        <p class="mt-3 font-medium">1. 账号信息</p>
        <p>邮箱地址、用户名、头像。使用第三方登录（Google / GitHub / LinuxDo / QQ / Gitee）时，会接收并提供方返回的昵称、头像及第三方用户标识，用于建立与匹配您的账号。</p>
        <p class="mt-3 font-medium">2. 认证凭据</p>
        <p>密码使用 PBKDF2 算法加盐哈希后存储，任何人（包括站长）都无法还原明文。登录凭证（JWT）与设备公钥仅保存在您浏览器的本地存储中。</p>
        <p class="mt-3 font-medium">3. 您主动保存的工具数据</p>
        <p>您在使用笔记、密码管理器、体重记录、薪资记录、收藏夹等工具时主动保存的内容。其中密码管理器条目采用 AES-GCM 加密存储，数据库中不落明文。</p>
        <p class="mt-3 font-medium">4. 日志与统计</p>
        <p>站点访问统计（PV）、工具使用统计、运行错误日志（含请求上下文，用于排查故障）。登录场景会读取访问 IP（Cloudflare 注入的 CF-Connecting-IP），仅用于登录限流与防爆破，不与其他数据关联分析。</p>
        <p class="mt-3 font-medium">5. Cookie 与本地存储</p>
        <p>本站使用浏览器本地存储保存登录态、偏好设置与收藏数据；后台管理页面使用一个 HttpOnly Cookie（adm_assets）做资源访问鉴权。不使用任何第三方跟踪 Cookie 或广告分析。</p>
      </el-text>

      <h2 class="text-h3 font-bold mt-8 mb-3">二、信息的用途</h2>
      <el-text class="leading-7">
        <p>收集的信息仅用于：提供与维护账号体系、保存您主动创建的工具数据、保障账号安全（防爆破/防重放）、改进工具功能与稳定性。我们不进行用户画像，不向任何第三方出售或交易您的信息。</p>
      </el-text>

      <h2 class="text-h3 font-bold mt-8 mb-3">三、第三方服务</h2>
      <el-text class="leading-7">
        <p>本站部署与运行依赖以下第三方服务，它们各自按其隐私政策处理必要数据：</p>
        <ul class="list-disc list-inside ml-4 mt-1">
          <li>Cloudflare（页面托管、D1 数据库、KV 存储、R2 对象存储）</li>
          <li>Resend（登录验证码邮件发送，仅收件地址）</li>
          <li>您主动使用的第三方登录提供方（Google / GitHub / LinuxDo / QQ / Gitee）</li>
          <li>您主动调用 AI 类工具时，请求会经本站转发至相应 AI 服务提供方</li>
        </ul>
      </el-text>

      <h2 class="text-h3 font-bold mt-8 mb-3">四、数据存储与安全措施</h2>
      <el-text class="leading-7">
        <p>全站强制 HTTPS 传输；密码 PBKDF2 哈希、敏感条目 AES-GCM 加密；登录凭证与设备密钥（DPoP）绑定，即使凭证被截获也无法在其他设备使用；登录接口设有 IP / 账号两级限流与锁定机制。我们会持续跟进安全修复，但互联网环境不存在绝对安全，请妥善保管您的密码。</p>
      </el-text>

      <h2 class="text-h3 font-bold mt-8 mb-3">五、您的权利</h2>
      <el-text class="leading-7">
        <p>您可以随时：在个人中心修改用户名与头像；通过重新设置密码使所有旧登录态立即失效；清除浏览器本地数据以移除登录态。如需查询、更正或删除账号及其全部数据，请通过页脚「反馈建议」或 GitHub issues 联系站长，我们会在合理期限内处理。</p>
      </el-text>

      <h2 class="text-h3 font-bold mt-8 mb-3">六、未成年人</h2>
      <el-text class="leading-7">
        <p>本站面向普通开发者与用户，不针对未满 14 周岁的儿童。若发现未成年人在未经监护人同意的情况下注册使用，我们将删除相关账号数据。</p>
      </el-text>

      <h2 class="text-h3 font-bold mt-8 mb-3">七、政策更新</h2>
      <el-text class="leading-7">
        <p>本政策如有重大变更，会在本页面更新日期并尽量在站内公告。继续使用本站即表示接受更新后的政策。</p>
        <p class="mt-3">联系站长：<el-link v-if="siteAddr" :href="siteAddr" target="_blank" type="primary">{{ siteAddr }}</el-link><span v-if="siteAddr"> ／ </span><el-link :href="gitUrl + '/issues/new'" target="_blank" type="primary">GitHub issues</el-link></p>
      </el-text>
    </div>
  </div>
</template>

<style scoped>
/* 排版细节：段落间距由 el-text 与 mt 类控制 */
</style>
