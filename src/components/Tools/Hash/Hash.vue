<script setup lang="ts">
import { reactive, watch } from 'vue'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'
import { copy } from '@/utils/string'
import { ElMessage } from 'element-plus'

const info = reactive({
  title: '哈希校验/HMAC',
})

type Algo = 'SHA-1' | 'SHA-256' | 'SHA-512' | 'HMAC-SHA256'

const state = reactive({
  algo: 'SHA-256' as Algo,
  text: '',
  hmacKey: '',
  textResult: '',
  fileResult: '',
  fileName: '',
  fileSize: 0,
  loadingText: false,
  loadingFile: false,
  file: null as File | null,
})

const enc = (s: string) => new TextEncoder().encode(s)
const toHex = (buf: ArrayBuffer) => {
  const bytes = new Uint8Array(buf)
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}

const ensureCrypto = () => {
  if (!window.crypto || !window.crypto.subtle) {
    ElMessage.error('当前环境不支持 Web Crypto')
    throw new Error('WebCrypto not available')
  }
}

const digestArrayBuffer = async (algo: Exclude<Algo, 'HMAC-SHA256'>, data: ArrayBuffer) => {
  ensureCrypto()
  const res = await crypto.subtle.digest({ name: algo }, data)
  return toHex(res)
}

const digestText = async () => {
  try {
    state.loadingText = true
    if (state.algo === 'HMAC-SHA256') {
      ensureCrypto()
      const key = await crypto.subtle.importKey(
        'raw',
        enc(state.hmacKey || ''),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      )
      const sig = await crypto.subtle.sign('HMAC', key, enc(state.text || ''))
      state.textResult = toHex(sig)
    } else {
      const res = await digestArrayBuffer(state.algo, enc(state.text || '').buffer)
      state.textResult = res
    }
  } catch (e) {
    // ignore, message already shown in ensureCrypto
  } finally {
    state.loadingText = false
  }
}

const digestFile = async (file: File) => {
  try {
    state.loadingFile = true
    if (state.algo === 'HMAC-SHA256') {
      ensureCrypto()
      const key = await crypto.subtle.importKey(
        'raw',
        enc(state.hmacKey || ''),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      )
      const buf = await file.arrayBuffer()
      const sig = await crypto.subtle.sign('HMAC', key, buf)
      state.fileResult = toHex(sig)
    } else {
      const buf = await file.arrayBuffer()
      const res = await digestArrayBuffer(state.algo, buf)
      state.fileResult = res
    }
  } catch (e) {
    // ignore
  } finally {
    state.loadingFile = false
  }
}

const onFileChange = async (e: Event) => {
  const input = e.target as HTMLInputElement
  const file = input.files && input.files[0]
  if (!file) return
  state.fileName = file.name
  state.fileSize = file.size
  state.file = file
  await digestFile(file)
}

const clearText = () => {
  state.text = ''
  state.textResult = ''
}

const clearFile = (inputRef?: HTMLInputElement | null) => {
  state.fileName = ''
  state.fileSize = 0
  state.fileResult = ''
  state.file = null
  state.loadingFile = false
  if (inputRef) inputRef.value = ''
}

const copyTextRes = () => copy(state.textResult)
const copyFileRes = () => copy(state.fileResult)

const fillExample = () => {
  state.text = 'The quick brown fox jumps over the lazy dog'
}

watch(
  () => [state.text, state.algo, state.hmacKey],
  () => {
    // 文本实时计算
    digestText()
    // 变更算法/密钥后，若已有文件则自动重新计算
    if (state.file) digestFile(state.file)
  }
)
</script>

<template>
  <div class="flex flex-col mt-3 flex-1">
    <DetailHeader :title="info.title" />
    <div class="p-4 rounded-2xl bg-white">
      <div class="flex flex-wrap gap-3 items-center">
        <div>
          <el-select v-model="state.algo" placeholder="选择算法" style="width: 180px;">
            <el-option label="SHA-1" value="SHA-1" />
            <el-option label="SHA-256" value="SHA-256" />
            <el-option label="SHA-512" value="SHA-512" />
            <el-option label="HMAC-SHA256" value="HMAC-SHA256" />
          </el-select>
        </div>
        <div v-if="state.algo === 'HMAC-SHA256'" class="flex-1 min-w-[240px]">
          <el-input v-model="state.hmacKey" placeholder="HMAC 密钥（文本）" />
        </div>
      </div>

      <!-- 文本摘要/HMAC -->
      <div class="mt-4">
        <div class="mb-2 text-sm text-gray-600">
          文本摘要/HMAC
          <el-link class="ml-2" type="primary" @click="fillExample">填充示例</el-link>
        </div>
        <el-input
          v-model="state.text"
          type="textarea"
          :rows="6"
          placeholder="在此输入文本"
        />
        <div class="mt-2 flex flex-wrap gap-2 button-container">
          <el-button @click="copyTextRes">复制结果</el-button>
          <el-button type="danger" @click="clearText">清空</el-button>
        </div>
        <div class="mt-3">
          <div class="text-sm text-gray-600 mb-1">结果：</div>
          <el-input v-model="state.textResult" readonly />
        </div>
      </div>

      <!-- 文件摘要/HMAC -->
      <div class="mt-6">
        <div class="mb-2 text-sm text-gray-600">文件摘要/HMAC</div>
        <input type="file" @change="onFileChange" />
        <div v-if="state.fileName" class="mt-2 text-xs text-gray-500">
          文件：{{ state.fileName }}（{{ state.fileSize }} 字节 ≈ {{ (state.fileSize/1024).toFixed(2) }} KB / {{ (state.fileSize/1024/1024).toFixed(2) }} MB / {{ (state.fileSize/1024/1024/1024).toFixed(2) }} GB）
        </div>
        <div class="mt-2 flex flex-wrap gap-2 button-container">
          <el-button @click="copyFileRes">复制结果</el-button>
          <el-button type="danger" @click="clearFile($event?.target as HTMLInputElement)">清空</el-button>
          <el-button v-if="state.loadingFile" :loading="true" disabled>计算中</el-button>
        </div>
        <div class="mt-3">
          <div class="text-sm text-gray-600 mb-1">结果：</div>
          <el-input v-model="state.fileResult" readonly />
        </div>
      </div>
    </div>

    <ToolDetail title="描述">
      <el-text>
        支持 SHA-1、SHA-256、SHA-512 与 HMAC-SHA256；文本/文件摘要；结果十六进制显示，可复制。
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