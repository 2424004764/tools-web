<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'
import { copy } from '@/utils/string'

const info = reactive({
  title: "URL编码/解码",
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
    info.tranRes = encodeURIComponent(val || '')
  } finally {
    syncing.value = false
  }
})

// 下 → 上：实时解码
watch(() => info.tranRes, (val) => {
  if (syncing.value) return
  syncing.value = true
  try {
    info.content = decodeURIComponent(val || '')
  } catch (e) {
    // 非法编码时忽略更新，避免打断用户输入
  } finally {
    syncing.value = false
  }
})


//编码
const toEncode = () => {
  info.tranRes = ''
  info.tranRes = encodeURIComponent(info.content)
}

//解码
const toDecode = () => {
  info.tranRes = ''
  info.tranRes = decodeURIComponent(info.content)
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

const exampleRaw = 'name=张三&city=北京 上海?100%&note=空格/斜杠/&中文'
const exampleEncoded = encodeURIComponent(exampleRaw)
const fillExample = () => {
  info.content = exampleRaw
}

const copyContent = async () => {
  copy(info.content)
}
</script>

<template>
  <div class="flex flex-col mt-3 flex-1">
    <DetailHeader :title="info.title"></DetailHeader>

    <div class="p-4 rounded-2xl bg-white">
      <div>
        <div class="mb-2 text-gray-500 text-sm">
          原始文本：在此输入明文，上方将自动进行 URL 编码并显示在下方；也可只查看解码结果。
          <el-link type="primary" class="ml-2" @click="copyContent">复制原始文本</el-link>
        </div>
        <div class="mb-1 text-xs text-gray-500 break-all">
          示例：{{ exampleRaw }}
          <el-link type="primary" class="ml-2" @click="fillExample">填充</el-link>
        </div>
        <el-input
          type="textarea"
          :rows="8"
          v-model="info.content"
          placeholder="输入明文内容，自动编码到下方"
        />
      </div>

      <div class="mt-4 flex flex-wrap gap-2 button-container">
        <el-button @click="fillExample">填充示例</el-button>
        <el-button type="primary" @click="toEncode">UrlEncode编码</el-button>
        <el-button type="primary" @click="toDecode">UrlDecode解码</el-button>
        <el-button type="primary" @click="copyRes">复制结果</el-button>
        <el-button type="danger" @click="clear">清空内容</el-button>
      </div>

      <div class="mt-3 min-h-md bg-gray-100 p-3 mb-3">
        <div class="mb-2 text-gray-500 text-sm">
          URL 编码文本：在此输入/粘贴已编码文本，将自动解码并显示在上方。
          <el-link type="primary" class="ml-2" @click="copyRes">复制 URL 编码文本</el-link>
        </div>
        <div class="mb-1 text-xs text-gray-500 break-all">示例：{{ exampleEncoded }}</div>
        <el-input
          type="textarea"
          :rows="8"
          v-model="info.tranRes"
          placeholder="输入/粘贴已编码内容，自动解码到上方"
        />
      </div>
    </div>

    <!-- desc -->
    <ToolDetail title="描述">
      <el-text>
        在线url编码，在线url解码工具
      </el-text> 
    </ToolDetail>

  </div>
</template>

<style scoped>
.button-container .el-button {
  margin-right: 12px;
  margin-left: 0px;
}
</style>