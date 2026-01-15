<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'
import { copy } from '@/utils/string'

const info = reactive({
  title: "Base64编码/解码",
  content: '',
  tranRes: '',
})

// 双向联动防抖标记
const syncing = ref(false)

// 上 → 下：实时编码
watch(() => info.content, (val) => {
  if (syncing.value) return
  syncing.value = true
  try {
    // 尝试将文本转为 Base64
    info.tranRes = btoa(unescape(encodeURIComponent(val || '')))
  } finally {
    syncing.value = false
  }
})

// 下 → 上：实时解码
watch(() => info.tranRes, (val) => {
  if (syncing.value) return
  syncing.value = true
  try {
    // 尝试将 Base64 解码为文本
    info.content = decodeURIComponent(escape(atob(val || '')))
  } catch (e) {
    // 非法 Base64 时忽略更新，避免打断用户输入
  } finally {
    syncing.value = false
  }
})

//编码
const toEncode = () => {
  info.tranRes = ''
  info.tranRes = btoa(unescape(encodeURIComponent(info.content)))
}

//解码
const toDecode = () => {
  info.tranRes = ''
  info.content = decodeURIComponent(escape(atob(info.content)))
}

//clear
const clear = () => {
  info.content = ''
  info.tranRes = ''
}

//copy
const copyRes = async () => {
  copy(info.tranRes)
}

const copyContent = async () => {
  copy(info.content)
}

// 示例文本
const exampleRaw = 'Hello World! 你好世界！'
const exampleEncoded = btoa(unescape(encodeURIComponent(exampleRaw)))
const fillExample = () => {
  info.content = exampleRaw
}
</script>

<template>
  <div class="flex flex-col mt-3 flex-1">
    <DetailHeader :title="info.title"></DetailHeader>

    <div class="p-4 rounded-2xl bg-white">
      <!-- 文本 Base64 编解码 -->
      <div>
        <div class="mb-2 text-gray-500 text-sm">
          原始文本：在此输入明文，将自动进行 Base64 编码并显示在下方；也可只查看解码结果。
          <el-link type="primary" class="ml-2" @click="copyContent">复制原始文本</el-link>
        </div>
        <div class="mb-1 text-xs text-gray-500 break-all">
          示例：{{ exampleRaw }}
          <el-link type="primary" class="ml-2" @click="fillExample">填充</el-link>
        </div>
        <el-input
          type="textarea"
          :rows="10"
          v-model="info.content"
          placeholder="输入明文内容，自动编码到下方"
        />
      </div>

      <div class="mt-4 flex flex-wrap gap-2 button-container">
        <el-button @click="fillExample">填充示例</el-button>
        <el-button type="primary" @click="toEncode">Base64编码</el-button>
        <el-button type="primary" @click="toDecode">Base64解码</el-button>
        <el-button type="primary" @click="copyRes">复制结果</el-button>
        <el-button type="danger" @click="clear">清空内容</el-button>
      </div>

      <div class="mt-3 min-h-md bg-gray-100 p-3 mb-3">
        <div class="mb-2 text-gray-500 text-sm">
          Base64 编码文本：在此输入/粘贴 Base64 文本，将自动解码并显示在上方。
          <el-link type="primary" class="ml-2" @click="copyRes">复制 Base64 文本</el-link>
        </div>
        <div class="mb-1 text-xs text-gray-500 break-all">示例：{{ exampleEncoded }}</div>
        <el-input
          type="textarea"
          :rows="10"
          v-model="info.tranRes"
          placeholder="输入/粘贴 Base64 内容，自动解码到上方"
        />
      </div>
    </div>

    <!-- desc -->
    <ToolDetail title="工具说明">
      <div class="space-y-3">
        <el-text>
          <strong>Base64</strong> 是一种用64个字符来表示任意二进制数据的方法。常用于在 HTTP 环境下传递较长的标识信息或在不支持二进制传输的场合传输二进制数据。
        </el-text>
        <el-divider />
        <el-text>
          <strong>文本编码/解码：</strong>支持中文、英文、符号等任意文本的 Base64 编码与解码，双向实时转换。
        </el-text>
        <el-divider />
        <el-text>
          <strong>实时转换：</strong>在任一输入框输入内容，另一侧会自动显示转换结果。
        </el-text>
        <el-divider />
        <el-text>
          <strong>常见用途：</strong>
          <ul class="list-disc list-inside mt-2 ml-4">
            <li>URL 参数编码</li>
            <li>电子邮件内容编码</li>
            <li>HTML/CSS 中内嵌小图片的 data URI</li>
            <li>配置文件中的数据编码</li>
            <li>基本的数据加密传输</li>
          </ul>
        </el-text>
      </div>
    </ToolDetail>

  </div>
</template>

<style scoped>
.button-container .el-button {
  margin-right: 12px;
  margin-left: 0px;
}
</style>
