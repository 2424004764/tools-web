<script setup lang="ts">
import { ref } from 'vue'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'

const title = '文本加密/解密'
const mode = ref<'encrypt' | 'decrypt'>('encrypt')
const inputText = ref('')
const password = ref('')
const outputText = ref('')
const errorMessage = ref('')
const isBusy = ref(false)

const textTip = {
  encrypt: '输入要加密的原文，使用秘钥生成 AES-GCM 密文并输出为 Base64 字符串。',
  decrypt: '输入 Base64 密文并填写相同秘钥，解密后恢复原文。'
}

const randomKey = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?'
  password.value = Array.from({ length: 16 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

const concatUint8 = (...arrays: Uint8Array[]) => {
  const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0)
  const result = new Uint8Array(totalLength)
  let offset = 0
  arrays.forEach(arr => {
    result.set(arr, offset)
    offset += arr.length
  })
  return result
}

const arrayBufferToBase64 = (buffer: ArrayBuffer) => {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

const base64ToUint8 = (base64: string) => {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

const getCryptoKey = async (passwordText: string, salt: Uint8Array) => {
  const encoder = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(passwordText),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  )

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt.buffer as ArrayBuffer,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

const encryptText = async () => {
  if (!inputText.value.trim() || !password.value.trim()) {
    errorMessage.value = '请输入待加密内容和秘钥。'
    return
  }

  isBusy.value = true
  errorMessage.value = ''

  try {
    const encoder = new TextEncoder()
    const salt = crypto.getRandomValues(new Uint8Array(16))
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const key = await getCryptoKey(password.value, salt)
    const cipher = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      encoder.encode(inputText.value)
    )

    const payload = concatUint8(salt, iv, new Uint8Array(cipher))
    outputText.value = arrayBufferToBase64(payload.buffer)
  } catch (error) {
    errorMessage.value = '加密失败，请检查输入或重试。'
    outputText.value = ''
  } finally {
    isBusy.value = false
  }
}

const decryptText = async () => {
  if (!inputText.value.trim() || !password.value.trim()) {
    errorMessage.value = '请输入待解密内容和秘钥。'
    return
  }

  isBusy.value = true
  errorMessage.value = ''

  try {
    const payload = base64ToUint8(inputText.value.trim())
    if (payload.length < 28) {
      throw new Error('数据长度不足')
    }

    const salt = payload.slice(0, 16)
    const iv = payload.slice(16, 28)
    const ciphertext = payload.slice(28)
    const key = await getCryptoKey(password.value, salt)
    const plainBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertext
    )

    outputText.value = new TextDecoder().decode(plainBuffer)
  } catch (error) {
    errorMessage.value = '解密失败，请确认秘钥和 Base64 内容是否正确。'
    outputText.value = ''
  } finally {
    isBusy.value = false
  }
}

const handleAction = async () => {
  if (mode.value === 'encrypt') {
    await encryptText()
  } else {
    await decryptText()
  }
}

const copyOutput = async () => {
  if (!outputText.value) {
    return
  }
  await navigator.clipboard.writeText(outputText.value)
}
</script>

<template>
  <div class="flex flex-col mt-3 flex-1">
    <DetailHeader :title="title" />

    <div class="p-4 rounded-2xl bg-white shadow-sm border border-slate-200">
      <div class="mb-4">
        <div class="text-2xl font-semibold">文本加密/解密</div>
        <div class="mt-1 text-sm text-slate-500">使用秘钥进行 AES-GCM 加密和解密，输出为 Base64 格式，适合安全传输与保护文本内容。</div>
      </div>

      <div class="space-y-4">
        <el-radio-group v-model="mode">
          <el-radio-button label="encrypt">加密</el-radio-button>
          <el-radio-button label="decrypt">解密</el-radio-button>
        </el-radio-group>

        <el-alert v-if="errorMessage" :title="errorMessage" type="error" show-icon />

        <el-form-item label="输入文本">
          <el-input
            v-model="inputText"
            type="textarea"
            :placeholder="mode === 'encrypt' ? '在此输入明文...' : '在此输入 Base64 密文...'"
            :rows="8"
            show-word-limit
            maxlength="10000"
          />
        </el-form-item>

        <el-row :gutter="16">
          <el-col :xs="24" :sm="16">
            <el-form-item label="秘钥">
              <el-input v-model="password" placeholder="请输入秘钥" />
            </el-form-item>
          </el-col>
          <el-col :xs="24" :sm="8" class="flex items-end">
            <el-button type="primary" class="w-full" @click="randomKey">生成随机秘钥</el-button>
          </el-col>
        </el-row>

        <div class="flex flex-wrap gap-3 items-center">
          <el-button type="success" :loading="isBusy" @click="handleAction">{{ mode === 'encrypt' ? '加密文本' : '解密文本' }}</el-button>
          <el-button type="warning" :disabled="!outputText" @click="copyOutput">复制结果</el-button>
          <span class="text-sm text-slate-500">{{ textTip[mode] }}</span>
        </div>

        <el-form-item label="输出结果">
          <el-input
            v-model="outputText"
            type="textarea"
            placeholder="结果将显示在此处"
            :rows="8"
            readonly
          />
        </el-form-item>
      </div>
    </div>

    <ToolDetail title="使用说明">
      <el-text>
        文本加密/解密工具使用密码派生的 AES-GCM 算法，输入明文后可生成 Base64 编码的密文；使用相同秘钥对密文解密即可恢复原文。建议不要忘记秘钥，否则无法恢复原文。
      </el-text>
    </ToolDetail>
  </div>
</template>
