<script setup lang="ts">
// 服务条款页面（/terms）
import { ref } from 'vue'
const appTitle = import.meta.env.VITE_APP_TITLE || '一方工具箱'
const gitUrl = ref(import.meta.env.VITE_GIT_URL || '')
const updatedDate = '2026-11-09'
</script>

<template>
  <div class="flex flex-col mt-8 flex-1 items-center bg-white rounded-md p-4 md:p-10">
    <div class="p-1 w-full md:p-5 md:w-2/3">
      <h1 class="text-h2 font-bold">服务条款</h1>
      <p class="mt-2 text-caption text-gray-500">最后更新：{{ updatedDate }} ｜ 本条款适用于 {{ appTitle }}（tool.fologde.com）提供的全部服务</p>

      <h2 class="text-h3 font-bold mt-8 mb-3">一、服务性质</h2>
      <el-text class="leading-7">
        <p>{{ appTitle }}是一个免费的个人工具站，所有工具按「现状」与「可用性」提供。您注册或使用本站任一功能，即视为已阅读并同意本条款。</p>
      </el-text>

      <h2 class="text-h3 font-bold mt-8 mb-3">二、账号与安全</h2>
      <el-text class="leading-7">
        <p>您可通过邮箱（验证码 / 密码）或第三方账号（Google / GitHub / LinuxDo / QQ / Gitee）注册登录。请妥善保管账号凭据；因您主动泄露密码或设备导致的账号损失由您自行承担。同一邮箱通过不同登录方式注册的账号视为同一账号。我们保留对违反本条款或滥用行为的账号予以限制、封禁的权利，且无需事先通知。</p>
      </el-text>

      <h2 class="text-h3 font-bold mt-8 mb-3">三、使用规范</h2>
      <el-text class="leading-7">
        <p>使用本站服务时，您承诺不从事以下行为：</p>
        <ul class="list-disc list-inside ml-4 mt-1">
          <li>对登录、验证码等接口进行爆破、扫描或恶意高频请求</li>
          <li>利用 AI 类工具生成违法违规、侵犯他人权益的内容</li>
          <li>利用本站存储或传播违法信息、恶意代码</li>
          <li>通过自动化脚本滥用免费资源（含免费 AI 额度）</li>
          <li>干扰、破坏本站服务或试图未授权访问本站系统与数据</li>
        </ul>
        <p class="mt-2">本站已部署限流与安全防护，违反上述规范的请求会被自动拦截，情节严重的将封禁账号并保留追责权利。</p>
      </el-text>

      <h2 class="text-h3 font-bold mt-8 mb-3">四、用户内容</h2>
      <el-text class="leading-7">
        <p>您在工具中主动创建与保存的内容（笔记、密码条目、记录等）归您所有，本站仅按功能需要为您存储与展示。您应对自己保存内容的合法性负责。使用笔记分享等公开功能时，请注意任何获得分享链接的人都可能阅读该内容。</p>
      </el-text>

      <h2 class="text-h3 font-bold mt-8 mb-3">五、AI 功能的特别说明</h2>
      <el-text class="leading-7">
        <p>部分工具调用第三方 AI 服务，其生成内容可能不准确，请自行甄别，不作为专业依据；免费 AI 额度、可用模型可能随时调整或中断，恕不另行通知。</p>
      </el-text>

      <h2 class="text-h3 font-bold mt-8 mb-3">六、免责声明</h2>
      <el-text class="leading-7">
        <p>本站为个人维护的非商业项目，不承诺服务 uninterrupted 持续可用；因网络、服务器、第三方服务故障或不可抗力导致的服务中断、数据丢失，本站不承担赔偿责任。计算、转换、查询类工具的结果仅供参考，请勿用于医疗、金融、法律等高风险决策的唯一依据。在法律允许的最大范围内，本站对任何间接损失不承担责任。</p>
      </el-text>

      <h2 class="text-h3 font-bold mt-8 mb-3">七、服务变更与终止</h2>
      <el-text class="leading-7">
        <p>我们可能随时新增、调整或下线任何工具与功能，并同步更新本条款。若您不同意更新后的条款，请停止使用并可通过页脚「反馈建议」申请删除账号数据。</p>
      </el-text>

      <h2 class="text-h3 font-bold mt-8 mb-3">八、法律适用</h2>
      <el-text class="leading-7">
        <p>本条款的订立、执行与解释适用中华人民共和国法律。与法律强制性规定冲突的条款以法律规定为准。</p>
        <p class="mt-3">问题反馈：<el-link :href="gitUrl + '/issues/new'" target="_blank" type="primary">GitHub issues</el-link> 或页脚「反馈建议」</p>
      </el-text>
    </div>
  </div>
</template>

<style scoped>
/* 排版细节：段落间距由 el-text 与 mt 类控制 */
</style>
